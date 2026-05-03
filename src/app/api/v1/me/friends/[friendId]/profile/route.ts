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

function serializePublicUser(user: {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  avatarColor: string | null;
  visitedPlacesVisibleToFriends: boolean;
  commentsVisibleToFriends: boolean;
}) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    avatarColor: user.avatarColor,
    visitedPlacesVisibleToFriends: user.visitedPlacesVisibleToFriends,
    commentsVisibleToFriends: user.commentsVisibleToFriends,
  };
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ friendId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ ok: false }, { status: 401, headers: V1_HEADERS });
    }

    const params = await context.params;
    const friendId = normId(params.friendId);

    if (!friendId || friendId === currentUser.id) {
      return NextResponse.json({ ok: false }, { status: 400, headers: V1_HEADERS });
    }

    const friendship = await prisma.friendship.findFirst({
      where: {
        status: "accepted",
        OR: [
          {
            requesterId: currentUser.id,
            receiverId: friendId,
          },
          {
            requesterId: friendId,
            receiverId: currentUser.id,
          },
        ],
      },
      select: {
        id: true,
      },
    });

    if (!friendship) {
      return NextResponse.json({ ok: false }, { status: 403, headers: V1_HEADERS });
    }

    const friend = await prisma.user.findUnique({
      where: {
        id: friendId,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        avatarColor: true,
        visitedPlacesVisibleToFriends: true,
        commentsVisibleToFriends: true,
      },
    });

    if (!friend) {
      return NextResponse.json({ ok: false }, { status: 404, headers: V1_HEADERS });
    }

    const visitedPlaces = friend.visitedPlacesVisibleToFriends
      ? await prisma.userPlace.findMany({
          where: {
            userId: friend.id,
            visited: true,
            visibility: "friends",
          },
          orderBy: {
            visitedAt: "desc",
          },
          select: {
            placeId: true,
            visitedAt: true,
            updatedAt: true,
          },
        })
      : [];

    return NextResponse.json(
      {
        ok: true,
        friend: serializePublicUser(friend),
        visitedPlaces: visitedPlaces.map((item) => ({
          placeId: item.placeId,
          visitedAt: item.visitedAt ? item.visitedAt.toISOString() : null,
          updatedAt: item.updatedAt.toISOString(),
        })),
      },
      { headers: V1_HEADERS }
    );
  } catch (err) {
    console.error("[/api/v1/me/friends/[friendId]/profile] GET error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
