import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncNotificationBadge } from "@/lib/pushNotifications";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

function normId(value: unknown) {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id ? id : null;
}

function normAction(value: unknown) {
  if (value === "accept" || value === "decline") return value;
  return null;
}

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ ok: false }, { status: 401, headers: V1_HEADERS });
    }

    const body = await req.json().catch(() => null);
    const friendshipId = normId(body?.friendshipId);
    const action = normAction(body?.action);

    if (!friendshipId || !action) {
      return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400, headers: V1_HEADERS });
    }

    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId },
      select: {
        id: true,
        receiverId: true,
        status: true,
      },
    });

    if (!friendship || friendship.receiverId !== currentUser.id) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: V1_HEADERS });
    }

    if (friendship.status !== "pending") {
      return NextResponse.json({ ok: false, error: "not_pending" }, { status: 409, headers: V1_HEADERS });
    }

    if (action === "decline") {
      await prisma.friendship.delete({
        where: { id: friendshipId },
      });

      syncNotificationBadge({ userId: currentUser.id }).catch((error) => {
        console.error("[/api/v1/me/friends/respond] badge sync error", error);
      });

      return NextResponse.json({ ok: true, declined: true }, { headers: V1_HEADERS });
    }

    const updated = await prisma.friendship.update({
      where: { id: friendshipId },
      data: {
        status: "accepted",
      },
      select: {
        id: true,
        status: true,
        requesterId: true,
        receiverId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    syncNotificationBadge({ userId: currentUser.id }).catch((error) => {
      console.error("[/api/v1/me/friends/respond] badge sync error", error);
    });

    return NextResponse.json(
      {
        ok: true,
        friendship: {
          ...updated,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
      },
      { headers: V1_HEADERS }
    );
  } catch (err) {
    console.error("[/api/v1/me/friends/respond] POST error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
