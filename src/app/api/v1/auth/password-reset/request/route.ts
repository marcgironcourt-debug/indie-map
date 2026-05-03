import { NextResponse } from "next/server";
import { Resend } from "resend";
import { hashToken, makeToken, normalizeEmail } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = normalizeEmail(body?.email);

    if (!email) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400, headers: V1_HEADERS });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, username: true },
    });

    if (!user) {
      return NextResponse.json({ ok: true }, { headers: V1_HEADERS });
    }

    const rawToken = makeToken();
    const token = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    const origin = new URL(req.url).origin;
    const resetUrl = `${origin}/fr?resetPasswordToken=${encodeURIComponent(rawToken)}`;

    const apiKey = process.env.RESEND_API_KEY || "";
    const from = process.env.RESEND_FROM || "";

    if (apiKey && from) {
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from,
        to: [email],
        subject: "Réinitialisation du mot de passe Indie Map",
        html:
          "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111\">" +
          "<h2 style=\"margin:0 0 16px 0;\">Réinitialisation du mot de passe Indie Map</h2>" +
          "<p>Clique sur ce lien pour choisir un nouveau mot de passe :</p>" +
          "<p><a href=\"" + esc(resetUrl) + "\">Choisir un nouveau mot de passe</a></p>" +
          "<p>Ce lien expire dans 30 minutes.</p>" +
          "<p>Ton pseudo Indie Map : <strong>" + esc(user.username) + "</strong></p>" +
          "</div>",
      });

      if (error) {
        console.error("[/api/v1/auth/password-reset/request] resend error", error);
        return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
      }
    } else {
      console.log("[/api/v1/auth/password-reset/request] reset link", resetUrl);
      console.log("[/api/v1/auth/password-reset/request] username", user.username);
    }

    return NextResponse.json({ ok: true }, { headers: V1_HEADERS });
  } catch (err) {
    console.error("[/api/v1/auth/password-reset/request] error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
