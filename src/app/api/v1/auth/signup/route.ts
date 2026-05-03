import { NextResponse } from "next/server";
import { AUTH_COOKIE, hashPassword, hashToken, makeToken, normalizeEmail, normalizePassword, normalizeUsername } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    const email = normalizeEmail(body?.email);
    const username = normalizeUsername(body?.username);
    const password = normalizePassword(body?.password);

    if (!email || !username || !password) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400, headers: V1_HEADERS });
    }

    const existingEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingEmail) {
      return NextResponse.json({ ok: false, error: "email_taken" }, { status: 409, headers: V1_HEADERS });
    }

    const existingUsername = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (existingUsername) {
      return NextResponse.json({ ok: false, error: "username_taken" }, { status: 409, headers: V1_HEADERS });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        displayName: username,
      },
    });

    const rawSession = makeToken();
    const sessionToken = hashToken(rawSession);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

    await prisma.userSession.create({
      data: {
        userId: user.id,
        token: sessionToken,
        expiresAt,
      },
    });

    const res = NextResponse.json({ ok: true, user: serializeUser(user) }, { headers: V1_HEADERS });
    res.cookies.set(AUTH_COOKIE, rawSession, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });

    return res;
  } catch (err) {
    console.error("[/api/v1/auth/signup] error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
