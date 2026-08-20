
import { randomUUID } from "node:crypto";
import { geolocation } from "@vercel/functions";
import {
  localDateAndHour,
  normalizeTimeZone,
  parseUtcOffsetMinutes,
} from "@/lib/analyticsTime";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const sessionId =
      req.headers.get("x-session-id") ||
      "unknown";

    const launchId =
      req.headers.get("x-launch-id") ||
      "unknown";

    const now = new Date();

    const clientTimeZone =
      normalizeTimeZone(
        req.headers.get(
          "x-client-time-zone",
        ),
      );

    const utcOffsetMinutes =
      parseUtcOffsetMinutes(
        req.headers.get(
          "x-utc-offset-minutes",
        ),
      );

    const { localDate: day } =
      localDateAndHour(
        now,
        clientTimeZone,
      );

    const geo = geolocation(req);

    const city =
      geo.city ||
      req.headers.get(
        "x-vercel-ip-city",
      ) ||
      null;

    const country =
      geo.country ||
      req.headers.get(
        "x-vercel-ip-country",
      ) ||
      null;

    const userAgent =
      req.headers.get("user-agent") || "";

    const platform =
      req.headers.get("x-platform") ||
      (userAgent.includes("Android")
        ? "android"
        : /iPhone|iPad|iPod/i.test(
              userAgent,
            )
          ? "ios"
          : "web");

    const dailyActiveUserId =
      randomUUID();

    const dailySessionId =
      randomUUID();

    await prisma.$executeRaw`
      WITH upsert_active_session AS (
        INSERT INTO "ActiveSession" (
          "sessionId",
          "city",
          "country",
          "platform",
          "clientTimeZone",
          "utcOffsetMinutes",
          "lastSeenAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${sessionId},
          ${city},
          ${country},
          ${platform},
          ${clientTimeZone},
          ${utcOffsetMinutes},
          ${now},
          ${now},
          ${now}
        )
        ON CONFLICT ("sessionId")
        DO UPDATE SET
          "city" = EXCLUDED."city",
          "country" = EXCLUDED."country",
          "platform" = EXCLUDED."platform",
          "clientTimeZone" =
            EXCLUDED."clientTimeZone",
          "utcOffsetMinutes" =
            EXCLUDED."utcOffsetMinutes",
          "lastSeenAt" =
            EXCLUDED."lastSeenAt",
          "updatedAt" =
            EXCLUDED."updatedAt"
        RETURNING "sessionId"
      ),
      update_push_installation AS (
        UPDATE "PushInstallation"
        SET
          "platform" = ${platform},
          "lastSeenAt" = ${now},
          "updatedAt" = ${now}
        WHERE "sessionId" = ${sessionId}
        RETURNING "sessionId"
      ),
      insert_daily_active_user AS (
        INSERT INTO "DailyActiveUser" (
          "id",
          "day",
          "sessionId",
          "city",
          "country",
          "platform",
          "clientTimeZone",
          "utcOffsetMinutes",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${dailyActiveUserId},
          ${day},
          ${sessionId},
          ${city},
          ${country},
          ${platform},
          ${clientTimeZone},
          ${utcOffsetMinutes},
          ${now},
          ${now}
        )
        ON CONFLICT ("day", "sessionId")
        DO NOTHING
        RETURNING "id"
      )
      INSERT INTO "DailySession" (
        "id",
        "day",
        "launchId",
        "sessionId",
        "city",
        "country",
        "platform",
        "clientTimeZone",
        "utcOffsetMinutes",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${dailySessionId},
        ${day},
        ${launchId},
        ${sessionId},
        ${city},
        ${country},
        ${platform},
        ${clientTimeZone},
        ${utcOffsetMinutes},
        ${now},
        ${now}
      )
      ON CONFLICT ("day", "launchId")
      DO NOTHING
    `;

    return Response.json({
      ok: true,
      sessionId,
      launchId,
      day,
      city,
      country,
      platform,
      clientTimeZone,
      utcOffsetMinutes,
    });
  } catch (error) {
    console.error(
      "presence heartbeat failed",
      error,
    );

    return Response.json(
      { ok: false },
      { status: 500 },
    );
  }
}
