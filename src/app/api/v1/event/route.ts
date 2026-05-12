import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
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

    const user = await getCurrentUser().catch(() => null);

    const headerSessionId = cleanString(req.headers.get("x-session-id"), 120);
    const headerLocale = cleanString(req.headers.get("x-locale"), 12);
    const headerPlatform = cleanString(req.headers.get("x-platform"), 40);

    await prisma.event.create({
      data: {
        eventType,
        placeId: cleanString(body.placeId, 120),
        city: cleanString(body.city, 120),
        country: cleanString(body.country, 120),
        category: cleanString(body.category, 120),
        sessionId: cleanString(body.sessionId, 120) || headerSessionId,
        userId: user?.id ?? null,
        locale: cleanString(body.locale, 12) || headerLocale,
        platform: cleanString(body.platform, 40) || headerPlatform,
        metadata: cleanMetadata(body.metadata)
      },
    });

    return NextResponse.json({ ok: true }, { headers: V1_HEADERS });
  } catch (err) {
    console.error("[/api/v1/event] error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
