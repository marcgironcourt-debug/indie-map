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

async function canUseList(listId: string, userId: string) {
  const list = await prisma.sharedList.findFirst({
    where: {
      id: listId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
    select: { id: true },
  });

  return Boolean(list);
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
    const placeId = normId(body?.placeId);

    if (!cleanListId || !placeId) {
      return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400, headers: V1_HEADERS });
    }

    const usable = await canUseList(cleanListId, currentUser.id);

    if (!usable) {
      return NextResponse.json({ ok: false }, { status: 404, headers: V1_HEADERS });
    }

    await prisma.sharedListPlace.upsert({
      where: {
        listId_placeId: {
          listId: cleanListId,
          placeId,
        },
      },
      create: {
        listId: cleanListId,
        placeId,
        addedById: currentUser.id,
      },
      update: {},
    });

    return NextResponse.json({ ok: true }, { headers: V1_HEADERS });
  } catch (err) {
    console.error("[/api/v1/me/shared-lists/[listId]/places] POST error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ listId: string }> }) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ ok: false }, { status: 401, headers: V1_HEADERS });
    }

    const { listId } = await context.params;
    const cleanListId = normId(listId);
    const body = await req.json().catch(() => null);
    const placeId = normId(body?.placeId);

    if (!cleanListId || !placeId) {
      return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400, headers: V1_HEADERS });
    }

    const usable = await canUseList(cleanListId, currentUser.id);

    if (!usable) {
      return NextResponse.json({ ok: false }, { status: 404, headers: V1_HEADERS });
    }

    await prisma.sharedListPlace.deleteMany({
      where: {
        listId: cleanListId,
        placeId,
      },
    });

    return NextResponse.json({ ok: true }, { headers: V1_HEADERS });
  } catch (err) {
    console.error("[/api/v1/me/shared-lists/[listId]/places] DELETE error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
