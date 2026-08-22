import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getContributionRankingMap } from "@/lib/contributionRanking";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

function normalizeSearch(value: string | null) {
  const q = String(value ?? "").trim().toLowerCase();
  if (q.length < 2) return null;
  return q.slice(0, 24).replace(/[^a-z0-9_]/g, "");
}

function serializePublicUser(user: {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  avatarColor: string | null;
}, contributionRank: number | null) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    avatarColor: user.avatarColor,
    contributionRank,
  };
}

export async function GET(req: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ ok: false }, { status: 401, headers: V1_HEADERS });
    }

    const url = new URL(req.url);
    const q = normalizeSearch(url.searchParams.get("q"));

    if (!q) {
      return NextResponse.json({ ok: true, users: [] }, { headers: V1_HEADERS });
    }

    const users = await prisma.user.findMany({
      where: {
        id: {
          not: currentUser.id,
        },
        OR: [
          {
            username: {
              contains: q,
            },
          },
          {
            displayName: {
              contains: q,
            },
          },
        ],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        avatarColor: true,
      },
      orderBy: {
        username: "asc",
      },
      take: 8,
    });

    const contributionRanking =
      await getContributionRankingMap();

    return NextResponse.json(
      {
        ok: true,
        users: users.map((user) =>
          serializePublicUser(
            user,
            contributionRanking.get(user.id)?.contributionRank ?? null,
          ),
        ),
      },
      { headers: V1_HEADERS }
    );
  } catch (err) {
    console.error("[/api/v1/users/search] GET error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
