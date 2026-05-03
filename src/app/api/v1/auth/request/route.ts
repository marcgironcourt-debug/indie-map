import { NextResponse } from "next/server";
import { Resend } from "resend";
import { makeToken, hashToken, normalizeEmail } from "@/lib/auth";
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
      return NextResponse.json({ ok: false }, { status: 400, headers: V1_HEADERS });
    }

    const rawToken = makeToken();
    const token = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 20);

    await prisma.loginToken.create({
      data: {
        email,
        token,
        expiresAt,
      },
    });

    const origin = new URL(req.url).origin;
    const verifyUrl = `${origin}/api/v1/auth/verify?token=${rawToken}`;

    const apiKey = process.env.RESEND_API_KEY || "";
    const from = process.env.RESEND_FROM || "";

    if (apiKey && from) {
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from,
        to: [email],
        subject: "Connexion à Indie Map",
        html:
          "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111\">" +
          "<h2 style=\"margin:0 0 16px 0;\">Connexion à Indie Map</h2>" +
          "<p>Clique sur ce lien pour te connecter :</p>" +
          "<p><a href=\"" + esc(verifyUrl) + "\">Se connecter à Indie Map</a></p>" +
          "<p>Ce lien expire dans 20 minutes.</p>" +
          "</div>",
      });

      if (error) {
        console.error("[/api/v1/auth/request] resend error", error);
        return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
      }
    } else {
      console.log("[/api/v1/auth/request] magic link", verifyUrl);
    }

    return NextResponse.json({ ok: true }, { headers: V1_HEADERS });
  } catch (err) {
    console.error("[/api/v1/auth/request] error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
