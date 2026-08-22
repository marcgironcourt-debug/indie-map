import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifySharedListPlaceAdded } from "@/lib/pushNotifications";
import { readPlaceCatalogueWithProfessionalOverrides } from "@/lib/placeCatalogue";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

function normId(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

async function getUsableList(listId: string, userId: string) {
  return prisma.sharedList.findFirst({
    where: {
      id: listId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
    select: {
      id: true,
      ownerId: true,
      title: true,
      members: {
        select: {
          userId: true,
        },
      },
    },
  });
}

async function getPlaceName(placeId: string) {
  try {
    const parsed: unknown =
      await readPlaceCatalogueWithProfessionalOverrides();

    if (!Array.isArray(parsed)) return "";

    const place = parsed.find((item) => {
      if (!item || typeof item !== "object") return false;
      return String((item as { id?: unknown }).id ?? "").trim() === placeId;
    });

    if (!place || typeof place !== "object") return "";

    const name = (place as { name?: unknown }).name;
    return typeof name === "string" ? name.trim() : "";
  } catch (error) {
    console.error("[shared-list places] getPlaceName error", error);
    return "";
  }
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
      return NextResponse.json(
        { ok: false, error: "invalid_request" },
        { status: 400, headers: V1_HEADERS }
      );
    }

    const list = await getUsableList(cleanListId, currentUser.id);

    if (!list) {
      return NextResponse.json({ ok: false }, { status: 404, headers: V1_HEADERS });
    }

    const existingPlace = await prisma.sharedListPlace.findUnique({
      where: {
        listId_placeId: {
          listId: cleanListId,
          placeId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingPlace) {
      return NextResponse.json(
        { ok: true, created: false },
        { headers: V1_HEADERS }
      );
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

    try {
      const participantIds = Array.from(
        new Set([
          list.ownerId,
          ...list.members.map((member) => member.userId),
        ])
      );

      const receiverIds = participantIds.filter(
        (userId) => userId !== currentUser.id
      );

      if (receiverIds.length > 0) {
        await prisma.sharedListMember.updateMany({
          where: {
            listId: cleanListId,
            userId: { in: receiverIds },
            role: { not: "owner" },
          },
          data: {
            seenAt: null,
          },
        });

        const [receivers, placeName] = await Promise.all([
          prisma.user.findMany({
            where: {
              id: { in: receiverIds },
            },
            select: {
              id: true,
              preferredLocale: true,
            },
          }),
          getPlaceName(placeId),
        ]);

        await Promise.allSettled(
          receivers.map((receiver) =>
            notifySharedListPlaceAdded({
              receiverId: receiver.id,
              actorDisplayName:
                currentUser.displayName || currentUser.username,
              listTitle: list.title,
              listId: cleanListId,
              placeName,
              locale: receiver.preferredLocale,
            })
          )
        );
      }
    } catch (error) {
      console.error(
        "[/api/v1/me/shared-lists/[listId]/places] notification error",
        error
      );
    }

    return NextResponse.json(
      { ok: true, created: true },
      { headers: V1_HEADERS }
    );
  } catch (err) {
    console.error(
      "[/api/v1/me/shared-lists/[listId]/places] POST error",
      err
    );
    return NextResponse.json(
      { ok: false },
      { status: 500, headers: V1_HEADERS }
    );
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
      return NextResponse.json(
        { ok: false, error: "invalid_request" },
        { status: 400, headers: V1_HEADERS }
      );
    }

    const list = await getUsableList(cleanListId, currentUser.id);

    if (!list) {
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
    console.error(
      "[/api/v1/me/shared-lists/[listId]/places] DELETE error",
      err
    );
    return NextResponse.json(
      { ok: false },
      { status: 500, headers: V1_HEADERS }
    );
  }
}
