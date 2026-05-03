import { NextResponse } from "next/server";
import { AUTH_COOKIE, hashToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

export async function POST() {
  try {
    const jar = await cookies();
    const raw = jar.get(AUTH_COOKIE)?.value;

    if (raw) {
      await prisma.userSession.deleteMany({
        where: { token: hashToken(raw) },
      });
    }

    const res = NextResponse.json({ ok: true }, { headers: V1_HEADERS });
    res.cookies.set(AUTH_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    return res;
  } catch (err) {
    console.error("[/api/v1/auth/logout] error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
