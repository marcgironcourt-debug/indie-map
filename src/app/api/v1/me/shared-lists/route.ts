import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

function normText(value: unknown, max = 80) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

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

    const lists = await prisma.sharedList.findMany({
      where: {
        OR: [
          { ownerId: currentUser.id },
          { members: { some: { userId: currentUser.id } } },
        ],
      },
      select: {
        id: true,
        title: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            avatarColor: true,
          },
        },
        members: {
          select: {
            id: true,
            userId: true,
            role: true,
            createdAt: true,
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
          orderBy: { createdAt: "asc" },
        },
        places: {
          select: {
            id: true,
            placeId: true,
            addedById: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(
      {
        ok: true,
        lists: lists.map((list) => ({
          id: list.id,
          title: list.title,
          ownerId: list.ownerId,
          owner: serializePublicUser(list.owner),
          createdAt: list.createdAt.toISOString(),
          updatedAt: list.updatedAt.toISOString(),
          members: list.members.map((member) => ({
            id: member.id,
            userId: member.userId,
            role: member.role,
            createdAt: member.createdAt.toISOString(),
            user: serializePublicUser(member.user),
          })),
          places: list.places.map((place) => ({
            id: place.id,
            placeId: place.placeId,
            addedById: place.addedById,
            createdAt: place.createdAt.toISOString(),
          })),
        })),
      },
      { headers: V1_HEADERS }
    );
  } catch (err) {
    console.error("[/api/v1/me/shared-lists] GET error", err);
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
    const title = normText(body?.title);

    if (!title) {
      return NextResponse.json({ ok: false, error: "invalid_title" }, { status: 400, headers: V1_HEADERS });
    }

    const list = await prisma.sharedList.create({
      data: {
        ownerId: currentUser.id,
        title,
        members: {
          create: {
            userId: currentUser.id,
            role: "owner",
          },
        },
      },
      select: {
        id: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        listId: list.id,
      },
      { headers: V1_HEADERS }
    );
  } catch (err) {
    console.error("[/api/v1/me/shared-lists] POST error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
