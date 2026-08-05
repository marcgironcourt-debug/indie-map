import { connect } from "node:http2";
import { createSign } from "node:crypto";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

type PushKind = "friend_request" | "shared_list_invite" | "context_suggestion" | "reactivation" | "app_update";

type PushPayload = {
  kind: PushKind;
  title: string;
  body: string;
  url: string;
  target: string;
  badge?: number;
  placeId?: string;
  categoryKey?: string;
  appVersion?: string;
};

type BadgePayload = {
  badge: number;
};

function getBaseUrlForPlatform(platform?: string | null) {
  return platform === "ios" || platform === "android" ? "https://app.indie-map.com" : "https://www.indie-map.com";
}

function getBaseUrl() {
  return getBaseUrlForPlatform("web");
}

function withPlatformUrl(payload: PushPayload, platform?: string | null): PushPayload {
  const baseUrl = getBaseUrlForPlatform(platform);
  const base = new URL(baseUrl);

  try {
    const url = new URL(payload.url || baseUrl, baseUrl);
    url.protocol = base.protocol;
    url.host = base.host;
    return {
      ...payload,
      url: url.toString(),
    };
  } catch {
    return {
      ...payload,
      url: baseUrl,
    };
  }
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

function getStoreUrlForPlatform(platform: string, locale?: string | null) {
  const isFr = locale !== "en";

  if (platform === "ios") {
    const localizedUrl = isFr ? process.env.APP_STORE_URL_FR : process.env.APP_STORE_URL_EN;
    return String(localizedUrl || process.env.APP_STORE_URL || "").trim();
  }

  if (platform === "android") {
    const localizedUrl = isFr ? process.env.PLAY_STORE_URL_FR : process.env.PLAY_STORE_URL_EN;
    return String(localizedUrl || process.env.PLAY_STORE_URL || "").trim();
  }

  return "";
}

function buildAppUpdateCopy(params: {
  locale?: string | null;
  version: string;
}) {
  const isFr = params.locale !== "en";

  if (isFr) {
    return {
      title: "Nouvelle mise à jour disponible",
      body: `La version ${params.version} d’Indie Map est disponible.`,
    };
  }

  return {
    title: "New update available",
    body: `Indie Map version ${params.version} is available.`,
  };
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
  const [pendingFriendRequests, unreadPlaceRecommendations, unseenSharedLists] = await Promise.all([
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
    prisma.sharedListMember.count({
      where: {
        userId,
        role: { not: "owner" },
        seenAt: null,
      },
    }),
  ]);

  return pendingFriendRequests + unreadPlaceRecommendations + unseenSharedLists;
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

function buildSharedListInvitePayload(params: {
  inviterDisplayName: string;
  listTitle: string;
  listId: string;
  locale?: string | null;
  badge: number;
}): PushPayload {
  const isFr = params.locale !== "en";
  const name = params.inviterDisplayName.trim() || (isFr ? "Un ami" : "A friend");
  const title = params.listTitle.trim() || (isFr ? "une liste partagée" : "a shared list");

  return {
    kind: "shared_list_invite",
    title: isFr ? "Nouvelle liste partagée" : "New shared list",
    body: isFr
      ? `${name} t’a ajouté à « ${title} ».`
      : `${name} added you to “${title}”.`,
    url: `${getBaseUrl()}/${isFr ? "fr" : "en"}?panel=sharedLists&sharedListId=${encodeURIComponent(params.listId)}`,
    target: "shared_list",
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
        return sendWebPush(device.subscription, withPlatformUrl(payload, device.platform));
      }

      if (device.platform === "ios" && device.token) {
        return sendApns(device.token, withPlatformUrl(payload, device.platform));
      }

      return false;
    })
  );

  return {
    attempted: devices.length,
    sent: results.filter((result) => result.status === "fulfilled" && result.value === true).length,
  };
}


export async function notifySharedListInvite(params: {
  receiverId: string;
  inviterDisplayName: string;
  listTitle: string;
  listId: string;
  locale?: string | null;
}) {
  const badge = await getUnreadNotificationBadgeCount(params.receiverId);

  const payload = buildSharedListInvitePayload({
    inviterDisplayName: params.inviterDisplayName,
    listTitle: params.listTitle,
    listId: params.listId,
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
        return sendWebPush(device.subscription, withPlatformUrl(payload, device.platform));
      }

      if (device.platform === "ios" && device.token) {
        return sendApns(device.token, withPlatformUrl(payload, device.platform));
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
      if ((device.platform === "android" || device.platform === "web") && device.subscription) {
        return sendWebPush(device.subscription, withPlatformUrl(payload, device.platform));
      }

      if (device.platform === "ios" && device.token) {
        return sendApns(device.token, withPlatformUrl(payload, device.platform));
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


export async function notifyPushInstallationReactivation(
  params: {
    platform: string;
    token: string;
    subscription?: string | null;
    title: string;
    body: string;
    url: string;
  },
) {
  const payload: PushPayload = {
    kind: "reactivation",
    title: params.title,
    body: params.body,
    url: params.url,
    target: "reactivation",
  };

  try {
    let sent = false;

    if (
      (
        params.platform === "android" ||
        params.platform === "web"
      ) &&
      params.subscription
    ) {
      sent = await sendWebPush(
        params.subscription,
        withPlatformUrl(
          payload,
          params.platform,
        ),
      );
    }

    if (
      params.platform === "ios" &&
      params.token
    ) {
      sent = await sendApns(
        params.token,
        withPlatformUrl(
          payload,
          params.platform,
        ),
      );
    }

    return {
      attempted: 1,
      sent: sent ? 1 : 0,
    };
  } catch {
    return {
      attempted: 1,
      sent: 0,
    };
  }
}

export async function notifyReactivation(params: {
  userId: string;
  title: string;
  body: string;
  url: string;
}) {
  const badge = await getUnreadNotificationBadgeCount(params.userId);

  const payload: PushPayload = {
    kind: "reactivation",
    title: params.title,
    body: params.body,
    url: params.url,
    target: "reactivation",
    badge,
  };

  const devices = await prisma.pushDevice.findMany({
    where: {
      userId: params.userId,
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
      if ((device.platform === "android" || device.platform === "web") && device.subscription) {
        return sendWebPush(device.subscription, withPlatformUrl(payload, device.platform));
      }

      if (device.platform === "ios" && device.token) {
        return sendApns(device.token, withPlatformUrl(payload, device.platform));
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

export async function notifyAppUpdateAvailable(params: {
  userId: string;
  version: string;
  locale?: string | null;
}) {
  const version = params.version.trim();

  if (!version) {
    return {
      attempted: 0,
      sent: 0,
      skipped: 0,
      reason: "missing_version",
    };
  }

  const badge = await getUnreadNotificationBadgeCount(params.userId);

  const devices = await prisma.pushDevice.findMany({
    where: { userId: params.userId },
    select: {
      id: true,
      platform: true,
      token: true,
      subscription: true,
    },
  });

  let skipped = 0;

  const results = await Promise.allSettled(
    devices.map(async (device) => {
      const platform = device.platform;
      const url = getStoreUrlForPlatform(platform, params.locale);

      if (!url) {
        skipped += 1;
        return false;
      }

      const existing = await prisma.appUpdateNotificationLog.findUnique({
        where: {
          userId_version_platform: {
            userId: params.userId,
            version,
            platform,
          },
        },
      });

      if (existing) {
        skipped += 1;
        return false;
      }

      const copy = buildAppUpdateCopy({
        locale: params.locale,
        version,
      });

      const payload: PushPayload = {
        kind: "app_update",
        title: copy.title,
        body: copy.body,
        url,
        target: "app_update",
        badge,
        appVersion: version,
      };

      let sent = false;

      if ((platform === "android" || platform === "web") && device.subscription) {
        sent = await sendWebPush(device.subscription, payload);
      }

      if (platform === "ios" && device.token) {
        sent = await sendApns(device.token, payload);
      }

      if (sent) {
        await prisma.appUpdateNotificationLog.create({
          data: {
            userId: params.userId,
            version,
            platform,
            title: copy.title,
            body: copy.body,
          },
        });
      }

      return sent;
    })
  );

  return {
    attempted: devices.length,
    sent: results.filter((result) => result.status === "fulfilled" && result.value === true).length,
    skipped,
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
