import { NextResponse } from "next/server";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;
import { prisma } from "@/lib/prisma";

const ALLOWED = new Set([
  "view_place",
  "click_itinerary",
  "click_phone",
  "click_website",
  "click_copy_address",
]);

type EventPayload = {
  eventType?: unknown;
  placeId?: unknown;
  city?: unknown;
  category?: unknown;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
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

    const eventType = body.eventType;
    const placeId = body.placeId;
    const city = body.city;
    const category = body.category;

    if (typeof eventType !== "string" || !ALLOWED.has(eventType)) {
      return NextResponse.json({ ok: false }, { status: 400, headers: V1_HEADERS });
    }
    if (typeof placeId !== "string" || placeId.length < 3) {
      return NextResponse.json({ ok: false }, { status: 400, headers: V1_HEADERS });
    }
    if (typeof city !== "string" || city.length < 2) {
      return NextResponse.json({ ok: false }, { status: 400, headers: V1_HEADERS });
    }
    if (typeof category !== "string" || category.length < 2) {
      return NextResponse.json({ ok: false }, { status: 400, headers: V1_HEADERS });
    }

    await prisma.event.create({
      data: { eventType, placeId, city, category },
    });

    return NextResponse.json({ ok: true }, { headers: V1_HEADERS });
  } catch (err) {
    console.error("[/api/v1/event] error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
