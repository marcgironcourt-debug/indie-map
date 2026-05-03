import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

function serializePublicUser(user: {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  avatarColor: string | null;
}) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    avatarColor: user.avatarColor,
  };
}

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ ok: false }, { status: 401, headers: V1_HEADERS });
    }

    const [accepted, incoming, outgoing] = await Promise.all([
      prisma.friendship.findMany({
        where: {
          status: "accepted",
          OR: [
            { requesterId: currentUser.id },
            { receiverId: currentUser.id },
          ],
        },
        include: {
          requester: true,
          receiver: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      }),
      prisma.friendship.findMany({
        where: {
          receiverId: currentUser.id,
          status: "pending",
        },
        include: {
          requester: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.friendship.findMany({
        where: {
          requesterId: currentUser.id,
          status: "pending",
        },
        include: {
          receiver: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
    ]);

    const friends = accepted.map((friendship) => {
      const friend = friendship.requesterId === currentUser.id ? friendship.receiver : friendship.requester;

      return {
        id: friendship.id,
        status: friendship.status,
        createdAt: friendship.createdAt.toISOString(),
        updatedAt: friendship.updatedAt.toISOString(),
        user: serializePublicUser(friend),
      };
    });

    const incomingRequests = incoming.map((friendship) => ({
      id: friendship.id,
      status: friendship.status,
      createdAt: friendship.createdAt.toISOString(),
      user: serializePublicUser(friendship.requester),
    }));

    const outgoingRequests = outgoing.map((friendship) => ({
      id: friendship.id,
      status: friendship.status,
      createdAt: friendship.createdAt.toISOString(),
      user: serializePublicUser(friendship.receiver),
    }));

    return NextResponse.json(
      {
        ok: true,
        friends,
        incomingRequests,
        outgoingRequests,
      },
      { headers: V1_HEADERS }
    );
  } catch (err) {
    console.error("[/api/v1/me/friends] GET error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
