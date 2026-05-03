import { NextResponse } from "next/server";
import { hashPassword, hashToken, normalizePassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const rawToken = typeof body?.token === "string" ? body.token.trim() : "";
    const password = normalizePassword(body?.password);

    if (!rawToken || !password) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400, headers: V1_HEADERS });
    }

    const token = hashToken(rawToken);
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: { select: { id: true, username: true } } },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ ok: false, error: "invalid_or_expired_token" }, { status: 400, headers: V1_HEADERS });
    }

    const passwordHash = await hashPassword(password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ ok: true, username: resetToken.user.username }, { headers: V1_HEADERS });
  } catch (err) {
    console.error("[/api/v1/auth/password-reset/confirm] error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
