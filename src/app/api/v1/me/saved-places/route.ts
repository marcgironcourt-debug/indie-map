import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

function normId(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ ok: false }, { status: 401, headers: V1_HEADERS });
    }

    const places = await prisma.userPlace.findMany({
      where: {
        userId: currentUser.id,
        saved: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        placeId: true,
        updatedAt: true,
      },
    });
    return NextResponse.json(
      {
        ok: true,
        places: places.map((item) => ({
          placeId: item.placeId,
          updatedAt: item.updatedAt.toISOString(),
        })),
      },
      { headers: V1_HEADERS }
    );
  } catch (err) {
    console.error("[/api/v1/me/saved-places] GET error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ ok: false }, { status: 401, headers: V1_HEADERS });
    }

    const body = await req.json().catch(() => null);
    const saved = body?.saved === true;

    if (Array.isArray(body?.placeIds)) {
      const placeIds: string[] = Array.from(
        new Set<string>(
          body.placeIds
            .map((value: unknown) => normId(value))
            .filter((value: string) => value.length > 0),
        ),
      );

      if (placeIds.length === 0) {
        return NextResponse.json(
          { ok: false },
          { status: 400, headers: V1_HEADERS },
        );
      }

      await prisma.$transaction([
        prisma.userPlace.updateMany({
          where: {
            userId: currentUser.id,
            placeId: { in: placeIds },
          },
          data: { saved },
        }),
        ...(saved
          ? [
              prisma.userPlace.createMany({
                data: placeIds.map((placeId) => ({
                  userId: currentUser.id,
                  placeId,
                  saved: true,
                  visibility: "private",
                })),
                skipDuplicates: true,
              }),
            ]
          : []),
      ]);

      return NextResponse.json(
        { ok: true, placeIds, saved },
        { headers: V1_HEADERS },
      );
    }

    const placeId = normId(body?.placeId);

    if (!placeId) {
      return NextResponse.json({ ok: false }, { status: 400, headers: V1_HEADERS });
    }

    const userPlace = await prisma.userPlace.upsert({
      where: {
        userId_placeId: {
          userId: currentUser.id,
          placeId,
        },
      },
      create: {
        userId: currentUser.id,
        placeId,
        saved,
        visibility: "private",
      },
      update: {
        saved,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        place: {
          placeId: userPlace.placeId,
          saved: userPlace.saved,
          updatedAt: userPlace.updatedAt.toISOString(),
        },
      },
      { headers: V1_HEADERS }
    );
  } catch (err) {
    console.error("[/api/v1/me/saved-places] POST error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
