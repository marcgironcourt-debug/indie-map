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

function serializeUser(user: {
  id: string;
  email: string | null;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  avatarColor: string | null;
  homeCity: string | null;
  ageRange: string | null;
  commentsVisibleToFriends: boolean;
  visitedPlacesVisibleToFriends: boolean;
  profileCompletedAt: Date | null;
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    avatarColor: user.avatarColor,
    homeCity: user.homeCity,
    ageRange: user.ageRange,
    commentsVisibleToFriends: user.commentsVisibleToFriends,
    visitedPlacesVisibleToFriends: user.visitedPlacesVisibleToFriends,
    profileCompleted: Boolean(user.profileCompletedAt),
  };
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ ok: false }, { status: 401, headers: V1_HEADERS });
    }

    return NextResponse.json({ ok: true, user: serializeUser(user) }, { headers: V1_HEADERS });
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
    const displayName = normStr(body?.displayName, 80) || username;
    const avatarUrl = normStr(body?.avatarUrl, 600);
    const avatarColorRaw = normStr(body?.avatarColor, 20);
    const avatarColor = avatarColorRaw && AVATAR_COLORS.has(avatarColorRaw) ? avatarColorRaw : null;
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
        displayName: displayName || username,
        avatarUrl,
        avatarColor,
        homeCity,
        ageRange,
        commentsVisibleToFriends,
        visitedPlacesVisibleToFriends,
        profileCompletedAt: currentUser.profileCompletedAt || new Date(),
      },
    });

    return NextResponse.json({ ok: true, user: serializeUser(user) }, { headers: V1_HEADERS });
  } catch (err) {
    console.error("[/api/v1/me/profile] POST error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
