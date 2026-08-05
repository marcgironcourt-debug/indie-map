import { randomUUID } from "node:crypto";
import { geolocation } from "@vercel/functions";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const sessionId = req.headers.get("x-session-id") || "unknown";
    const launchId = req.headers.get("x-launch-id") || "unknown";
    const now = new Date();

    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    const geo = geolocation(req);

    const city =
      geo.city ||
      req.headers.get("x-vercel-ip-city") ||
      null;

    const country =
      geo.country ||
      req.headers.get("x-vercel-ip-country") ||
      null;

    const userAgent = req.headers.get("user-agent") || "";

    const platform =
      req.headers.get("x-platform") ||
      (userAgent.includes("Android")
        ? "android"
        : /iPhone|iPad|iPod/i.test(userAgent)
          ? "ios"
          : "web");

    const dailyActiveUserId = randomUUID();
    const dailySessionId = randomUUID();

    /*
     * Une seule requête et un seul aller-retour PostgreSQL pour :
     * - actualiser la présence ;
     * - compter l'utilisateur actif du jour ;
     * - compter le lancement du jour.
     */
    await prisma.$executeRaw`
      WITH upsert_active_session AS (
        INSERT INTO "ActiveSession" (
          "sessionId",
          "city",
          "country",
          "platform",
          "lastSeenAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${sessionId},
          ${city},
          ${country},
          ${platform},
          ${now},
          ${now},
          ${now}
        )
        ON CONFLICT ("sessionId")
        DO UPDATE SET
          "city" = EXCLUDED."city",
          "country" = EXCLUDED."country",
          "platform" = EXCLUDED."platform",
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
    });
  } catch (error) {
    console.error("presence heartbeat failed", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
