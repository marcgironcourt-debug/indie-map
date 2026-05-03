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

function normComment(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 1200);
}

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ ok: false }, { status: 401, headers: V1_HEADERS });
    }

    const [places, comments] = await Promise.all([
      prisma.userPlace.findMany({
        where: {
          userId: currentUser.id,
        },
        select: {
          placeId: true,
          visited: true,
          visitedAt: true,
          updatedAt: true,
        },
      }),
      prisma.placeComment.findMany({
        where: {
          userId: currentUser.id,
        },
        select: {
          placeId: true,
          body: true,
          updatedAt: true,
        },
      }),
    ]);

    const notes: Record<string, { visited?: boolean; visitedAt?: string; comment?: string; updatedAt?: string }> = {};

    for (const place of places) {
      notes[place.placeId] = {
        ...(notes[place.placeId] ?? {}),
        visited: place.visited,
        visitedAt: place.visitedAt ? place.visitedAt.toISOString() : undefined,
        updatedAt: place.updatedAt.toISOString(),
      };
    }

    for (const comment of comments) {
      notes[comment.placeId] = {
        ...(notes[comment.placeId] ?? {}),
        comment: comment.body,
        updatedAt: comment.updatedAt.toISOString(),
      };
    }

    return NextResponse.json(
      {
        ok: true,
        notes,
      },
      { headers: V1_HEADERS }
    );
  } catch (err) {
    console.error("[/api/v1/me/place-notes] GET error", err);
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
    const placeId = normId(body?.placeId);

    if (!placeId) {
      return NextResponse.json({ ok: false }, { status: 400, headers: V1_HEADERS });
    }

    const visited = body?.visited === true;
    const visitedAt = typeof body?.visitedAt === "string" && body.visitedAt.trim()
      ? new Date(body.visitedAt)
      : visited
        ? new Date()
        : null;
    const comment = normComment(body?.comment);

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
        visited,
        visitedAt,
        visibility: visited ? "friends" : "private",
      },
      update: {
        visited,
        visitedAt,
        visibility: visited ? "friends" : "private",
      },
    });

    const existingComment = await prisma.placeComment.findFirst({
      where: {
        userId: currentUser.id,
        placeId,
      },
      select: {
        id: true,
      },
    });

    let placeComment = null;

    if (comment) {
      placeComment = existingComment
        ? await prisma.placeComment.update({
            where: {
              id: existingComment.id,
            },
            data: {
              body: comment,
              visibility: "friends",
            },
          })
        : await prisma.placeComment.create({
            data: {
              userId: currentUser.id,
              placeId,
              body: comment,
              visibility: "friends",
            },
          });
    } else if (existingComment) {
      await prisma.placeComment.delete({
        where: {
          id: existingComment.id,
        },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        userPlace: {
          placeId: userPlace.placeId,
          visited: userPlace.visited,
          visitedAt: userPlace.visitedAt ? userPlace.visitedAt.toISOString() : null,
        },
        comment: placeComment
          ? {
              placeId: placeComment.placeId,
              body: placeComment.body,
            }
          : null,
      },
      { headers: V1_HEADERS }
    );
  } catch (err) {
    console.error("[/api/v1/me/place-notes] POST error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
