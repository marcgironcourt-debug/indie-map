import { NextResponse } from "next/server";
import { AUTH_COOKIE, hashToken, makeToken, makeUniqueUsername } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rawToken = url.searchParams.get("token") || "";
    if (!rawToken || rawToken.length < 32) {
      return NextResponse.redirect(new URL("/fr?auth=invalid", url.origin));
    }

    const token = hashToken(rawToken);
    const loginToken = await prisma.loginToken.findUnique({ where: { token } });

    if (!loginToken || loginToken.usedAt || loginToken.expiresAt.getTime() <= Date.now()) {
      return NextResponse.redirect(new URL("/fr?auth=expired", url.origin));
    }

    const email = loginToken.email;
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      const username = await makeUniqueUsername(email);
      const displayName = email.split("@")[0] || "Indie Map";
      user = await prisma.user.create({
        data: {
          email,
          username,
          displayName,
        },
      });
    }

    await prisma.loginToken.update({
      where: { id: loginToken.id },
      data: { usedAt: new Date() },
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

    const res = NextResponse.redirect(new URL("/fr?auth=ok", url.origin), { headers: V1_HEADERS });
    res.cookies.set(AUTH_COOKIE, rawSession, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });

    return res;
  } catch (err) {
    console.error("[/api/v1/auth/verify] error", err);
    const url = new URL(req.url);
    return NextResponse.redirect(new URL("/fr?auth=error", url.origin));
  }
}
