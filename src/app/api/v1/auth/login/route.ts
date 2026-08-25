import { NextResponse } from "next/server";
import { AUTH_COOKIE, hashToken, makeToken, normalizeEmail, normalizePassword, normalizeUsername, verifyPassword, makeSessionExpiresAt } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRewardPointsBalance, REFERRAL_INSTALL_REWARD_POINTS, REFERRAL_SIGNUP_REWARD_POINTS } from "@/lib/rewardPoints";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

function serializeUser(user: {
  id: string;
  email: string | null;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  avatarColor: string | null;
  homeCity: string | null;
  ageRange: string | null;
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
    profileCompleted: Boolean(user.profileCompletedAt),
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const identifierRaw = typeof body?.identifier === "string" ? body.identifier.trim() : "";
    const password = normalizePassword(body?.password);

    if (!identifierRaw || !password) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400, headers: V1_HEADERS });
    }

    const email = normalizeEmail(identifierRaw);
    const username = normalizeUsername(identifierRaw);

    const user = email
      ? await prisma.user.findUnique({ where: { email } })
      : username
        ? await prisma.user.findUnique({ where: { username } })
        : null;

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401, headers: V1_HEADERS });
    }

    const rawSession = makeToken();
    const sessionToken = hashToken(rawSession);
    const expiresAt = makeSessionExpiresAt();

    await prisma.userSession.create({
      data: {
        userId: user.id,
        token: sessionToken,
        expiresAt,
      },
    });

    const [savedPlaces, rewardPointsBalance] = await Promise.all([
      prisma.userPlace.findMany({
        where: { userId: user.id, saved: true },
        orderBy: { updatedAt: "desc" },
        select: { placeId: true },
      }),
      getRewardPointsBalance(user.id),
    ]);
    const savedPlaceIds = savedPlaces.map((item) => String(item.placeId));

    const res = NextResponse.json({
      ok: true,
      user: serializeUser(user),
      savedPlaceIds,
      rewards: {
        balance: rewardPointsBalance,
        referral: {
          installPoints: REFERRAL_INSTALL_REWARD_POINTS,
          signupPoints: REFERRAL_SIGNUP_REWARD_POINTS,
        },
      },
    }, { headers: V1_HEADERS });
    res.cookies.set(AUTH_COOKIE, rawSession, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });

    return res;
  } catch (err) {
    console.error("[/api/v1/auth/login] error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
