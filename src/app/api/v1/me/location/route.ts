import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

function normCoord(value: unknown, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ ok: false }, { status: 401, headers: V1_HEADERS });
    }

    const body = await req.json().catch(() => null);
    const lat = normCoord(body?.lat, -90, 90);
    const lng = normCoord(body?.lng, -180, 180);

    if (lat === null || lng === null) {
      return NextResponse.json({ ok: false, error: "invalid_location" }, { status: 400, headers: V1_HEADERS });
    }

    await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        lastKnownLat: lat,
        lastKnownLng: lng,
        lastKnownLocationAt: new Date(),
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true }, { headers: V1_HEADERS });
  } catch (err) {
    console.error("[/api/v1/me/location] POST error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
