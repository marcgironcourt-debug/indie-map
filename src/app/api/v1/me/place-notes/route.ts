import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  localDateAndHour,
  normalizeTimeZone,
  parseUtcOffsetMinutes,
} from "@/lib/analyticsTime";
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

    const friendships = await prisma.friendship.findMany({
      where: {
        status: "accepted",
        OR: [
          {
            requesterId: currentUser.id,
          },
          {
            receiverId: currentUser.id,
          },
        ],
      },
      select: {
        requesterId: true,
        receiverId: true,
      },
    });

    const friendIds = friendships
      .map((friendship) => friendship.requesterId === currentUser.id ? friendship.receiverId : friendship.requesterId)
      .filter((id) => id !== currentUser.id);

    const [places, comments, friendComments] = await Promise.all([
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
      friendIds.length > 0
        ? prisma.placeComment.findMany({
            where: {
              userId: {
                in: friendIds,
              },
              visibility: "friends",
              user: {
                commentsVisibleToFriends: true,
              },
            },
            orderBy: {
              updatedAt: "desc",
            },
            select: {
              placeId: true,
              body: true,
              updatedAt: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  avatarColor: true,
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const notes: Record<string, {
      visited?: boolean;
      visitedAt?: string;
      comment?: string;
      updatedAt?: string;
      friendComments?: Array<{
        userId: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
        avatarColor: string | null;
        comment: string;
        updatedAt: string;
      }>;
    }> = {};

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

    for (const comment of friendComments) {
      const previous = notes[comment.placeId] ?? {};
      notes[comment.placeId] = {
        ...previous,
        friendComments: [
          ...(previous.friendComments ?? []),
          {
            userId: comment.user.id,
            username: comment.user.username,
            displayName: comment.user.displayName,
            avatarUrl: comment.user.avatarUrl,
            avatarColor: comment.user.avatarColor,
            comment: comment.body,
            updatedAt: comment.updatedAt.toISOString(),
          },
        ],
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

    const analyticsSessionId =
      (req.headers.get("x-session-id") || "")
        .trim()
        .slice(0, 120) || null;

    const analyticsLaunchId =
      (req.headers.get("x-launch-id") || "")
        .trim()
        .slice(0, 120) || null;

    const analyticsPlatform =
      (req.headers.get("x-platform") || "")
        .trim()
        .slice(0, 40) || null;

    const analyticsLocale =
      (req.headers.get("x-locale") || "")
        .trim()
        .slice(0, 12) || null;

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

    const analyticsNow = new Date();

    const {
      localDate: clientLocalDate,
      localHour: clientLocalHour,
    } = localDateAndHour(
      analyticsNow,
      clientTimeZone,
    );

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

    const previousUserPlace =
      await prisma.userPlace.findUnique({
        where: {
          userId_placeId: {
            userId: currentUser.id,
            placeId,
          },
        },
        select: {
          visited: true,
        },
      });

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

    const previousVisited =
      previousUserPlace?.visited === true;

    if (previousVisited !== userPlace.visited) {
      await prisma.event.create({
        data: {
          eventType: userPlace.visited
            ? "mark_place_visited"
            : "unmark_place_visited",
          placeId,
          sessionId: analyticsSessionId,
          launchId: analyticsLaunchId,
          userId: currentUser.id,
          locale: analyticsLocale,
          platform: analyticsPlatform,
          clientTimeZone,
          utcOffsetMinutes,
          clientLocalDate,
          clientLocalHour,
          metadata: {
            visitedAt:
              userPlace.visitedAt
                ? userPlace.visitedAt.toISOString()
                : null,
          },
        },
      });
    }

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

    if (comment && existingComment) {
      return NextResponse.json(
        {
          ok: false,
          error: "comment_already_exists",
        },
        { status: 409, headers: V1_HEADERS }
      );
    }

    if (comment) {
      placeComment = await prisma.placeComment.create({
        data: {
          userId: currentUser.id,
          placeId,
          body: comment,
          visibility: "friends",
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
