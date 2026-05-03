import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

function normId(value: unknown) {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id ? id : null;
}

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ ok: false }, { status: 401, headers: V1_HEADERS });
    }

    const body = await req.json().catch(() => null);
    const receiverId = normId(body?.receiverId);

    if (!receiverId || receiverId === currentUser.id) {
      return NextResponse.json({ ok: false, error: "invalid_receiver" }, { status: 400, headers: V1_HEADERS });
    }

    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: { id: true },
    });

    if (!receiver) {
      return NextResponse.json({ ok: false, error: "receiver_not_found" }, { status: 404, headers: V1_HEADERS });
    }

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: currentUser.id, receiverId },
          { requesterId: receiverId, receiverId: currentUser.id },
        ],
      },
      select: {
        id: true,
        status: true,
        requesterId: true,
        receiverId: true,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          ok: true,
          friendship: existing,
          alreadyExists: true,
        },
        { headers: V1_HEADERS }
      );
    }

    const friendship = await prisma.friendship.create({
      data: {
        requesterId: currentUser.id,
        receiverId,
        status: "pending",
      },
      select: {
        id: true,
        status: true,
        requesterId: true,
        receiverId: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        friendship: {
          ...friendship,
          createdAt: friendship.createdAt.toISOString(),
        },
      },
      { headers: V1_HEADERS }
    );
  } catch (err) {
    console.error("[/api/v1/me/friends/request] POST error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
