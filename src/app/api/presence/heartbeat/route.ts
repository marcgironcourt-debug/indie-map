import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { geolocation } from "@vercel/functions";

import {
  AUTH_COOKIE,
  hashToken,
} from "@/lib/auth";

import {
  localDateAndHour,
  normalizeTimeZone,
  parseUtcOffsetMinutes,
} from "@/lib/analyticsTime";

import { prisma } from "@/lib/prisma";

function cleanHeader(
  value: string | null,
  max = 120,
) {
  const clean = String(value || "").trim();

  return clean
    ? clean.slice(0, max)
    : null;
}

export async function POST(
  req: Request,
) {
  try {
    const sessionId =
      cleanHeader(
        req.headers.get("x-session-id"),
      );

    const launchId =
      cleanHeader(
        req.headers.get("x-launch-id"),
      );

    if (!sessionId || !launchId) {
      return Response.json(
        { ok: false },
        { status: 400 },
      );
    }

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

    const {
      localDate: day,
      localHour,
    } = localDateAndHour(
      now,
      clientTimeZone,
    );

    const geo =
      geolocation(req);

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
      cleanHeader(
        req.headers.get("x-platform"),
        40,
      ) ||
      (
        userAgent.includes("Android")
          ? "android"
          : /iPhone|iPad|iPod/i.test(userAgent)
            ? "ios"
            : "web"
      );

    const deviceType =
      cleanHeader(
        req.headers.get("x-device-type"),
        40,
      );

    const deviceOs =
      cleanHeader(
        req.headers.get("x-device-os"),
        40,
      );

    const deviceBrowser =
      cleanHeader(
        req.headers.get("x-device-browser"),
        40,
      );

    const locale =
      cleanHeader(
        req.headers.get("x-locale"),
        12,
      );

    const defaultTrafficClass =
      process.env.NODE_ENV === "production"
        ? "external"
        : "test";

    const jar =
      await cookies();

    const rawAuthToken =
      jar.get(AUTH_COOKIE)?.value ?? null;

    const authToken =
      rawAuthToken
        ? hashToken(rawAuthToken)
        : null;

    const dailyActiveUserId =
      randomUUID();

    const dailySessionId =
      randomUUID();

    const launchEventId =
      randomUUID();

    await prisma.$executeRaw`
      WITH session_match AS (
        SELECT
          "id",
          "userId",
          "expiresAt"
        FROM "UserSession"
        WHERE "token" = ${authToken}
        LIMIT 1
      ),

      valid_session AS (
        SELECT "userId"
        FROM session_match
        WHERE "expiresAt" > ${now}
      ),

      upsert_installation AS (
        INSERT INTO "AnalyticsInstallation" (
          "sessionId",
          "userId",
          "trafficClass",
          "platform",
          "deviceType",
          "os",
          "browser",
          "clientTimeZone",
          "utcOffsetMinutes",
          "firstSeenAt",
          "lastSeenAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${sessionId},
          (
            SELECT "userId"
            FROM valid_session
          ),
          ${defaultTrafficClass},
          ${platform},
          ${deviceType},
          ${deviceOs},
          ${deviceBrowser},
          ${clientTimeZone},
          ${utcOffsetMinutes},
          ${now},
          ${now},
          ${now},
          ${now}
        )
        ON CONFLICT ("sessionId")
        DO UPDATE SET
          "userId" = COALESCE(
            EXCLUDED."userId",
            "AnalyticsInstallation"."userId"
          ),
          "platform" = COALESCE(
            EXCLUDED."platform",
            "AnalyticsInstallation"."platform"
          ),
          "deviceType" = COALESCE(
            EXCLUDED."deviceType",
            "AnalyticsInstallation"."deviceType"
          ),
          "os" = COALESCE(
            EXCLUDED."os",
            "AnalyticsInstallation"."os"
          ),
          "browser" = COALESCE(
            EXCLUDED."browser",
            "AnalyticsInstallation"."browser"
          ),
          "clientTimeZone" = COALESCE(
            EXCLUDED."clientTimeZone",
            "AnalyticsInstallation"."clientTimeZone"
          ),
          "utcOffsetMinutes" = COALESCE(
            EXCLUDED."utcOffsetMinutes",
            "AnalyticsInstallation"."utcOffsetMinutes"
          ),
          "lastSeenAt" = EXCLUDED."lastSeenAt",
          "updatedAt" = EXCLUDED."updatedAt"
        RETURNING "sessionId"
      ),

      upsert_active_session AS (
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
          "clientTimeZone" = EXCLUDED."clientTimeZone",
          "utcOffsetMinutes" = EXCLUDED."utcOffsetMinutes",
          "lastSeenAt" = EXCLUDED."lastSeenAt",
          "updatedAt" = EXCLUDED."updatedAt"
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
      ),

      insert_launch_event AS (
        INSERT INTO "Event" (
          "id",
          "eventType",
          "sessionId",
          "launchId",
          "userId",
          "locale",
          "platform",
          "clientTimeZone",
          "utcOffsetMinutes",
          "clientLocalDate",
          "clientLocalHour",
          "metadata",
          "createdAt"
        )
        VALUES (
          ${launchEventId},
          'launch_started',
          ${sessionId},
          ${launchId},
          (
            SELECT "userId"
            FROM valid_session
          ),
          ${locale},
          ${platform},
          ${clientTimeZone},
          ${utcOffsetMinutes},
          ${day},
          ${localHour},
          jsonb_build_object(
            'source',
            'presence_heartbeat'
          ),
          ${now}
        )
        ON CONFLICT DO NOTHING
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
      deviceType,
      os: deviceOs,
      browser: deviceBrowser,
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
