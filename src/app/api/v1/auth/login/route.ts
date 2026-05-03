import { NextResponse } from "next/server";
import { AUTH_COOKIE, hashToken, makeToken, normalizeEmail, normalizePassword, normalizeUsername, verifyPassword } from "@/lib/auth";
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
    console.error("[/api/v1/auth/login] error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
