import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { AUTH_COOKIE, hashToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

const ALLOWED = new Set([
  "click_explore_world",
  "click_recent_additions",
  "click_discovery_of_day",
  "search_ai_used",
  "click_search_result_detail",
  "click_search_results_map",
  "click_mini_immersion",
  "click_mini_more_info",
  "save_place",
  "unsave_place",
  "open_shared_list_picker",
  "add_place_to_shared_list",
  "create_shared_list",
  "click_detail_website",
  "click_detail_itinerary",
  "click_detail_copy_address",
  "click_detail_share",
  "click_detail_view_on_map",
  "click_detail_phone",
  "view_place_detail"
]);

type EventPayload = {
  eventType?: unknown;
  placeId?: unknown;
  city?: unknown;
  country?: unknown;
  category?: unknown;
  sessionId?: unknown;
  locale?: unknown;
  platform?: unknown;
  metadata?: unknown;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function cleanString(value: unknown, max = 200) {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (!clean) return null;
  return clean.slice(0, max);
}

function cleanMetadata(value: unknown): Prisma.InputJsonValue | undefined {
  if (!isObject(value)) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function POST(req: Request) {
  try {
    const raw = await req.text().catch(() => "");
    const bodyUnknown: unknown = (() => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })();

    if (!isObject(bodyUnknown)) {
      return NextResponse.json({ ok: false }, { status: 400, headers: V1_HEADERS });
    }

    const body = bodyUnknown as EventPayload;
    const eventType = cleanString(body.eventType, 80);

    if (!eventType || !ALLOWED.has(eventType)) {
      return NextResponse.json({ ok: false }, { status: 400, headers: V1_HEADERS });
    }

    const jar = await cookies();
    const rawAuthToken = jar.get(AUTH_COOKIE)?.value ?? null;
    const authToken = rawAuthToken ? hashToken(rawAuthToken) : null;

    const headerSessionId = cleanString(req.headers.get("x-session-id"), 120);
    const headerLocale = cleanString(req.headers.get("x-locale"), 12);
    const headerPlatform = cleanString(req.headers.get("x-platform"), 40);

    const now = new Date();
    const staleUserCutoff = new Date(now.getTime() - 5 * 60 * 1000);
    const metadata = cleanMetadata(body.metadata);
    const metadataJson =
      metadata === undefined ? null : JSON.stringify(metadata);

    await prisma.$executeRaw`
      WITH session_match AS (
        SELECT "id", "userId", "expiresAt"
        FROM "UserSession"
        WHERE "token" = ${authToken}
        LIMIT 1
      ),
      delete_expired_session AS (
        DELETE FROM "UserSession"
        WHERE "id" = (
          SELECT "id"
          FROM session_match
          WHERE "expiresAt" <= ${now}
        )
        RETURNING "id"
      ),
      valid_session AS (
        SELECT "userId"
        FROM session_match
        WHERE "expiresAt" > ${now}
      ),
      touch_user AS (
        UPDATE "User"
        SET
          "lastSeenAt" = ${now},
          "updatedAt" = ${now}
        WHERE "id" = (SELECT "userId" FROM valid_session)
          AND (
            "lastSeenAt" IS NULL
            OR "lastSeenAt" < ${staleUserCutoff}
          )
        RETURNING "id"
      )
      INSERT INTO "Event" (
        "id",
        "eventType",
        "placeId",
        "city",
        "country",
        "category",
        "sessionId",
        "userId",
        "locale",
        "platform",
        "metadata",
        "createdAt"
      )
      VALUES (
        ${randomUUID()},
        ${eventType},
        ${cleanString(body.placeId, 120)},
        ${cleanString(body.city, 120)},
        ${cleanString(body.country, 120)},
        ${cleanString(body.category, 120)},
        ${cleanString(body.sessionId, 120) || headerSessionId},
        (SELECT "userId" FROM valid_session),
        ${cleanString(body.locale, 12) || headerLocale},
        ${cleanString(body.platform, 40) || headerPlatform},
        CAST(${metadataJson} AS jsonb),
        ${now}
      )
    `;

    return NextResponse.json({ ok: true }, { headers: V1_HEADERS });
  } catch (err) {
    console.error("[/api/v1/event] error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
