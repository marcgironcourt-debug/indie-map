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

function normText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function PATCH(req: Request, context: { params: Promise<{ listId: string }> }) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ ok: false }, { status: 401, headers: V1_HEADERS });
    }

    const { listId } = await context.params;
    const cleanListId = normId(listId);
    const body = await req.json().catch(() => null);
    const title = normText(body?.title);

    if (!cleanListId || !title) {
      return NextResponse.json(
        { ok: false, error: "invalid_request" },
        { status: 400, headers: V1_HEADERS }
      );
    }

    const list = await prisma.sharedList.findFirst({
      where: {
        id: cleanListId,
        ownerId: currentUser.id,
      },
      select: {
        id: true,
      },
    });

    if (!list) {
      return NextResponse.json(
        { ok: false },
        { status: 404, headers: V1_HEADERS }
      );
    }

    const updated = await prisma.sharedList.update({
      where: {
        id: cleanListId,
      },
      data: {
        title,
      },
      select: {
        title: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        title: updated.title,
        updatedAt: updated.updatedAt,
      },
      { headers: V1_HEADERS }
    );
  } catch (err) {
    console.error("[/api/v1/me/shared-lists/[listId]] PATCH error", err);
    return NextResponse.json(
      { ok: false },
      { status: 500, headers: V1_HEADERS }
    );
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ listId: string }> }) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ ok: false }, { status: 401, headers: V1_HEADERS });
    }

    const { listId } = await context.params;
    const cleanListId = normId(listId);

    if (!cleanListId) {
      return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400, headers: V1_HEADERS });
    }

    const list = await prisma.sharedList.findFirst({
      where: {
        id: cleanListId,
        ownerId: currentUser.id,
      },
      select: {
        id: true,
      },
    });

    if (!list) {
      return NextResponse.json({ ok: false }, { status: 404, headers: V1_HEADERS });
    }

    await prisma.sharedList.delete({
      where: {
        id: cleanListId,
      },
    });

    return NextResponse.json({ ok: true }, { headers: V1_HEADERS });
  } catch (err) {
    console.error("[/api/v1/me/shared-lists/[listId]] DELETE error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
