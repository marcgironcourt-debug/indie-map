import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ALLOWED = new Set(["view_place", "click_itinerary", "click_phone", "click_website", "click_copy_address"]);

export async function POST(req: Request) {
  try {
    const raw = await req.text().catch(() => "");
    const body = (() => { try { return JSON.parse(raw); } catch { return null; } })();
    if (!body || typeof body !== "object") return NextResponse.json({ ok: false }, { status: 400 });

    const eventType = (body as any).eventType;
    const placeId = (body as any).placeId;
    const city = (body as any).city;
    const category = (body as any).category;

    if (typeof eventType !== "string" || !ALLOWED.has(eventType)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (typeof placeId !== "string" || placeId.length < 3) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (typeof city !== "string" || city.length < 2) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (typeof category !== "string" || category.length < 2) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    await prisma.event.create({
      data: { eventType, placeId, city, category },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/event] error", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
