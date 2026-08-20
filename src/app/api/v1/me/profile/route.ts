import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

const AVATAR_COLORS = new Set([
  "#F97316",
  "#84A98C",
  "#2563EB",
  "#A855F7",
  "#EAB308",
  "#EC4899",
]);

const AGE_RANGES = new Set([
  "18_24",
  "25_34",
  "35_44",
  "45_54",
  "55_64",
  "65_plus",
  "prefer_not_to_say",
]);

function normStr(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

function normUsername(value: unknown) {
  if (typeof value !== "string") return null;
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  const clean = raw.replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
  if (clean.length < 3) return null;
  return clean;
}

function normLocale(value: unknown) {
  if (typeof value !== "string") return null;
  const locale = value.trim().toLowerCase();
  if (locale !== "fr" && locale !== "en") return null;
  return locale;
}

function serializeUser(user: {
  id: string;
  email: string | null;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  avatarColor: string | null;
  preferredLocale: string;
  homeCity: string | null;
  ageRange: string | null;
  commentsVisibleToFriends: boolean;
  visitedPlacesVisibleToFriends: boolean;
  profileCompletedAt: Date | null;
  contributionsCount?: number;
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    avatarColor: user.avatarColor,
    preferredLocale: user.preferredLocale,
    homeCity: user.homeCity,
    ageRange: user.ageRange,
    commentsVisibleToFriends: user.commentsVisibleToFriends,
    visitedPlacesVisibleToFriends: user.visitedPlacesVisibleToFriends,
    profileCompleted: Boolean(user.profileCompletedAt),
    contributionsCount: user.contributionsCount ?? 0,
  };
}

export async function GET() {
  try {
    const user = await getCurrentUser({ refreshSession: true });

    if (!user) {
      return NextResponse.json({ ok: false }, { status: 401, headers: V1_HEADERS });
    }

    const [counts] = await prisma.$queryRaw<
      Array<{
        contributionsCount: number;
        incomingFriendRequestCount: number;
        unseenSharedListCount: number;
        savedPlaceIds: string[];
      }>
    >`
      SELECT
        (
          SELECT COUNT(*)::int
          FROM "Submission"
          WHERE "userId" = ${user.id}
            AND "status" = 'approved'
        ) AS "contributionsCount",
        (
          SELECT COUNT(*)::int
          FROM "Friendship"
          WHERE "receiverId" = ${user.id}
            AND "status" = 'pending'
        ) AS "incomingFriendRequestCount",
        (
          SELECT COUNT(*)::int
          FROM "SharedListMember" AS member
          INNER JOIN "SharedList" AS list
            ON list."id" = member."listId"
          WHERE member."userId" = ${user.id}
            AND member."seenAt" IS NULL
            AND member."role" <> 'owner'
            AND list."ownerId" <> ${user.id}
        ) AS "unseenSharedListCount",
        ARRAY(
          SELECT "placeId"
          FROM "UserPlace"
          WHERE "userId" = ${user.id}
            AND "saved" = true
          ORDER BY "updatedAt" DESC
        ) AS "savedPlaceIds"
    `;

    const contributionsCount = counts?.contributionsCount ?? 0;
    const incomingFriendRequestCount =
      counts?.incomingFriendRequestCount ?? 0;
    const unseenSharedListCount =
      counts?.unseenSharedListCount ?? 0;
    const savedPlaceIds = Array.isArray(counts?.savedPlaceIds)
      ? counts.savedPlaceIds
      : [];

    return NextResponse.json(
      {
        ok: true,
        user: serializeUser({ ...user, contributionsCount }),
        notifications: {
          incomingFriendRequestCount,
          unseenSharedListCount,
        },
        savedPlaceIds,
      },
      { headers: V1_HEADERS },
    );
  } catch (err) {
    console.error("[/api/v1/me/profile] GET error", err);
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
    const username = normUsername(body?.username);
    const avatarUrl = normStr(body?.avatarUrl, 600);
    const avatarColorRaw = normStr(body?.avatarColor, 20);
    const avatarColor = avatarColorRaw && AVATAR_COLORS.has(avatarColorRaw) ? avatarColorRaw : null;
    const preferredLocale = normLocale(body?.preferredLocale) || currentUser.preferredLocale || "fr";
    const homeCity = normStr(body?.homeCity, 120);
    const ageRangeRaw = normStr(body?.ageRange, 40);
    const ageRange = ageRangeRaw && AGE_RANGES.has(ageRangeRaw) ? ageRangeRaw : null;
    const commentsVisibleToFriends = body?.commentsVisibleToFriends === true;
    const visitedPlacesVisibleToFriends = body?.visitedPlacesVisibleToFriends === true;

    if (!username) {
      return NextResponse.json({ ok: false, error: "invalid_username" }, { status: 400, headers: V1_HEADERS });
    }

    const existingUsername = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (existingUsername && existingUsername.id !== currentUser.id) {
      return NextResponse.json({ ok: false, error: "username_taken" }, { status: 409, headers: V1_HEADERS });
    }

    const user = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        username,
        displayName: username,
        avatarUrl,
        avatarColor,
        preferredLocale,
        homeCity,
        ageRange,
        commentsVisibleToFriends,
        visitedPlacesVisibleToFriends,
        profileCompletedAt: currentUser.profileCompletedAt || new Date(),
      },
    });

    const contributionsCount = await prisma.submission.count({
      where: {
        userId: user.id,
        status: "approved",
      },
    });

    return NextResponse.json({ ok: true, user: serializeUser({ ...user, contributionsCount }) }, { headers: V1_HEADERS });
  } catch (err) {
    console.error("[/api/v1/me/profile] POST error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
