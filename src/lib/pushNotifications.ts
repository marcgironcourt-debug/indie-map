import { connect } from "node:http2";
import { createSign } from "node:crypto";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

type PushKind = "friend_request" | "context_suggestion";

type PushPayload = {
  kind: PushKind;
  title: string;
  body: string;
  url: string;
  target: string;
  badge?: number;
  placeId?: string;
  categoryKey?: string;
};

type BadgePayload = {
  badge: number;
};

function getBaseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://preview.marcgironcourt-debugs-projects.vercel.app";

  return raw.replace(/\/+$/, "");
}

function getVapidSubject() {
  return process.env.WEB_PUSH_VAPID_SUBJECT || "mailto:contact@indie-map.com";
}

function canSendWebPush() {
  return Boolean(
    process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY &&
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY
  );
}

function canSendApns() {
  return Boolean(
    process.env.APNS_KEY_ID &&
    process.env.APNS_TEAM_ID &&
    process.env.APNS_BUNDLE_ID &&
    process.env.APNS_PRIVATE_KEY
  );
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getApnsJwt() {
  const keyId = process.env.APNS_KEY_ID || "";
  const teamId = process.env.APNS_TEAM_ID || "";
  const privateKey = (process.env.APNS_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  const header = base64Url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = base64Url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }));
  const body = `${header}.${claims}`;

  const sign = createSign("SHA256");
  sign.update(body);
  sign.end();

  const signature = sign.sign({ key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${body}.${base64Url(signature)}`;
}

async function getUnreadNotificationBadgeCount(userId: string) {
  const [pendingFriendRequests, unreadPlaceRecommendations] = await Promise.all([
    prisma.friendship.count({
      where: {
        receiverId: userId,
        status: "pending",
      },
    }),
    prisma.placeRecommendation.count({
      where: {
        receiverId: userId,
        readAt: null,
      },
    }),
  ]);

  return pendingFriendRequests + unreadPlaceRecommendations;
}

function buildFriendRequestPayload(params: {
  requesterDisplayName: string;
  locale?: string | null;
  badge: number;
}): PushPayload {
  const isFr = params.locale !== "en";
  const name = params.requesterDisplayName.trim() || (isFr ? "Quelqu’un" : "Someone");

  return {
    kind: "friend_request",
    title: isFr ? "Nouvelle invitation d’ami" : "New friend request",
    body: isFr
      ? `${name} veut t’ajouter sur Indie Map.`
      : `${name} wants to add you on Indie Map.`,
    url: `${getBaseUrl()}/${isFr ? "fr" : "en"}?panel=friends`,
    target: "friends",
    badge: params.badge,
  };
}

async function sendWebPush(subscriptionRaw: string, payload: PushPayload) {
  if (!canSendWebPush()) return false;

  webpush.setVapidDetails(
    getVapidSubject(),
    process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || "",
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY || ""
  );

  const subscription = JSON.parse(subscriptionRaw);
  await webpush.sendNotification(subscription, JSON.stringify(payload));
  return true;
}

async function sendApns(token: string, payload: PushPayload | BadgePayload) {
  if (!canSendApns()) return false;

  const bundleId = process.env.APNS_BUNDLE_ID || "";
  const env = (process.env.APNS_ENV || "production").toLowerCase();
  const host = env === "development" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";

  const isNotificationPayload = "kind" in payload;
  const aps: {
    alert?: {
      title: string;
      body: string;
    };
    sound?: string;
    badge?: number;
  } = {};

  if (isNotificationPayload) {
    aps.alert = {
      title: payload.title,
      body: payload.body,
    };
    aps.sound = "default";
  }

  if (typeof payload.badge === "number") {
    aps.badge = Math.max(0, Math.floor(payload.badge));
  }

  const body = JSON.stringify({
    aps,
    ...(isNotificationPayload
      ? {
          kind: payload.kind,
          target: payload.target,
          url: payload.url,
          ...(payload.placeId ? { placeId: payload.placeId } : {}),
          ...(payload.categoryKey ? { categoryKey: payload.categoryKey } : {}),
        }
      : {}),
  });

  await new Promise<void>((resolve, reject) => {
    const client = connect(host);
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${getApnsJwt()}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });

    let responseBody = "";
    let status = 0;

    req.setEncoding("utf8");

    req.on("response", (headers) => {
      status = Number(headers[":status"] || 0);
    });

    req.on("data", (chunk) => {
      responseBody += chunk;
    });

    req.on("end", () => {
      client.close();
      if (status >= 200 && status < 300) {
        resolve();
        return;
      }
      reject(new Error(`APNS ${status}: ${responseBody}`));
    });

    req.on("error", (error) => {
      client.close();
      reject(error);
    });

    client.on("error", reject);

    req.end(body);
  });

  return true;
}

export async function notifyFriendRequest(params: {
  receiverId: string;
  requesterDisplayName: string;
  locale?: string | null;
}) {
  const badge = await getUnreadNotificationBadgeCount(params.receiverId);

  const payload = buildFriendRequestPayload({
    requesterDisplayName: params.requesterDisplayName,
    locale: params.locale,
    badge,
  });

  const devices = await prisma.pushDevice.findMany({
    where: { userId: params.receiverId },
    select: {
      id: true,
      platform: true,
      token: true,
      subscription: true,
    },
  });

  const results = await Promise.allSettled(
    devices.map(async (device) => {
      if ((device.platform === "android" || device.platform === "web") && device.subscription) {
        return sendWebPush(device.subscription, payload);
      }

      if (device.platform === "ios" && device.token) {
        return sendApns(device.token, payload);
      }

      return false;
    })
  );

  return {
    attempted: devices.length,
    sent: results.filter((result) => result.status === "fulfilled" && result.value === true).length,
  };
}


export async function notifyContextSuggestion(params: {
  userId: string;
  title: string;
  body: string;
  url: string;
  placeId?: string | null;
  categoryKey?: string | null;
}) {
  const badge = await getUnreadNotificationBadgeCount(params.userId);

  const payload: PushPayload = {
    kind: "context_suggestion",
    title: params.title,
    body: params.body,
    url: params.url,
    target: "context_suggestion",
    badge,
    ...(params.placeId ? { placeId: params.placeId } : {}),
    ...(params.categoryKey ? { categoryKey: params.categoryKey } : {}),
  };

  const devices = await prisma.pushDevice.findMany({
    where: {
      userId: params.userId,
      platform: "ios",
    },
    select: {
      id: true,
      platform: true,
      token: true,
      subscription: true,
    },
  });

  const results = await Promise.allSettled(
    devices.map(async (device) => {
      if (device.platform === "ios" && device.token) {
        return sendApns(device.token, payload);
      }

      return false;
    })
  );

  return {
    attempted: devices.length,
    sent: results.filter((result) => result.status === "fulfilled" && result.value === true).length,
    badge,
  };
}


export async function syncNotificationBadge(params: {
  userId: string;
}) {
  const badge = await getUnreadNotificationBadgeCount(params.userId);

  const devices = await prisma.pushDevice.findMany({
    where: {
      userId: params.userId,
      platform: "ios",
    },
    select: {
      id: true,
      token: true,
    },
  });

  const results = await Promise.allSettled(
    devices.map(async (device) => {
      if (!device.token) return false;
      return sendApns(device.token, { badge });
    })
  );

  return {
    attempted: devices.length,
    sent: results.filter((result) => result.status === "fulfilled" && result.value === true).length,
    badge,
  };
}
