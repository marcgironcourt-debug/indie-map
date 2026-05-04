import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyAppUpdateAvailable } from "@/lib/pushNotifications";

export const dynamic = "force-dynamic";

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET || process.env.APP_UPDATE_NOTIFICATIONS_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function getRequestedVersion(req: Request) {
  const url = new URL(req.url);
  return (
    url.searchParams.get("version") ||
    process.env.APP_UPDATE_VERSION ||
    ""
  ).trim();
}

function shouldSend(req: Request) {
  const url = new URL(req.url);
  return url.searchParams.get("send") === "1";
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 }
    );
  }

  const version = getRequestedVersion(req);

  if (!version) {
    return NextResponse.json(
      { error: "missing_version" },
      { status: 400 }
    );
  }

  const send = shouldSend(req);

  const users = await prisma.user.findMany({
    where: {
      pushDevices: {
        some: {
          platform: {
            in: ["ios", "android"],
          },
        },
      },
    },
    select: {
      id: true,
      preferredLocale: true,
      pushDevices: {
        select: {
          platform: true,
        },
      },
    },
  });

  if (!send) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      version,
      eligibleUsers: users.length,
      eligibleDevices: users.reduce((total, user) => total + user.pushDevices.length, 0),
      message: "Add ?send=1 to send notifications.",
    });
  }

  const results = await Promise.allSettled(
    users.map((user) =>
      notifyAppUpdateAvailable({
        userId: user.id,
        version,
        locale: user.preferredLocale,
      })
    )
  );

  const sent = results.reduce((total, result) => {
    if (result.status !== "fulfilled") return total;
    return total + result.value.sent;
  }, 0);

  const attempted = results.reduce((total, result) => {
    if (result.status !== "fulfilled") return total;
    return total + result.value.attempted;
  }, 0);

  const skipped = results.reduce((total, result) => {
    if (result.status !== "fulfilled") return total;
    return total + result.value.skipped;
  }, 0);

  const failedUsers = results.filter((result) => result.status === "rejected").length;

  return NextResponse.json({
    ok: failedUsers === 0,
    dryRun: false,
    version,
    users: users.length,
    attempted,
    sent,
    skipped,
    failedUsers,
  });
}
