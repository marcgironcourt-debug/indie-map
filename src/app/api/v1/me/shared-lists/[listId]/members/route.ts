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

async function canEditList(listId: string, userId: string) {
  const list = await prisma.sharedList.findFirst({
    where: {
      id: listId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId, role: "owner" } } },
      ],
    },
    select: { id: true },
  });

  return Boolean(list);
}

async function areFriends(a: string, b: string) {
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: "accepted",
      OR: [
        { requesterId: a, receiverId: b },
        { requesterId: b, receiverId: a },
      ],
    },
    select: { id: true },
  });

  return Boolean(friendship);
}

export async function POST(req: Request, context: { params: Promise<{ listId: string }> }) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ ok: false }, { status: 401, headers: V1_HEADERS });
    }

    const { listId } = await context.params;
    const cleanListId = normId(listId);
    const body = await req.json().catch(() => null);
    const userId = normId(body?.userId);

    if (!cleanListId || !userId) {
      return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400, headers: V1_HEADERS });
    }

    const editable = await canEditList(cleanListId, currentUser.id);

    if (!editable) {
      return NextResponse.json({ ok: false }, { status: 404, headers: V1_HEADERS });
    }

    if (userId !== currentUser.id) {
      const friendshipOk = await areFriends(currentUser.id, userId);

      if (!friendshipOk) {
        return NextResponse.json({ ok: false, error: "not_friend" }, { status: 403, headers: V1_HEADERS });
      }
    }

    await prisma.sharedListMember.upsert({
      where: {
        listId_userId: {
          listId: cleanListId,
          userId,
        },
      },
      create: {
        listId: cleanListId,
        userId,
        role: userId === currentUser.id ? "owner" : "member",
      },
      update: {},
    });

    return NextResponse.json({ ok: true }, { headers: V1_HEADERS });
  } catch (err) {
    console.error("[/api/v1/me/shared-lists/[listId]/members] POST error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
