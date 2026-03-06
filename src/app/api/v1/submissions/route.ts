import { NextResponse } from "next/server";
import { Resend } from "resend";
import { locales } from "../../../../../i18n";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

function normStr(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json({ ok: false }, { status: 400, headers: V1_HEADERS });
    }

    const locale = req.headers.get("accept-language")?.toLowerCase().startsWith("fr") ? "fr" : "en";
    const fd = await req.formData();

    const formLocale = normStr(fd.get("locale"), 10) || locale;
    const name = normStr(fd.get("name"), 200);
    const address = normStr(fd.get("address"), 300);
    const openingHours = normStr(fd.get("openingHours"), 800);
    const phone = normStr(fd.get("phone"), 80);
    const website = normStr(fd.get("website"), 300);

    if (!(locales as readonly string[]).includes(formLocale)) {
      return NextResponse.json({ ok: false }, { status: 400, headers: V1_HEADERS });
    }
    if (!name || name.length < 2) {
      return NextResponse.json({ ok: false }, { status: 400, headers: V1_HEADERS });
    }
    if (!website || website.length < 5) {
      return NextResponse.json({ ok: false }, { status: 400, headers: V1_HEADERS });
    }

    const apiKey = process.env.RESEND_API_KEY || "";
    const from = process.env.RESEND_FROM || "";
    const to = process.env.RESEND_TO || "";

    if (!apiKey || !from || !to) {
      console.error("[/api/v1/submissions] missing env", {
        hasApiKey: Boolean(apiKey),
        hasFrom: Boolean(from),
        hasTo: Boolean(to),
      });
      return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
    }

    const resend = new Resend(apiKey);

    const subject =
      formLocale === "fr"
        ? `Nouvelle contribution Indie Map — ${name}`
        : `New Indie Map contribution — ${name}`;

    const html =
      "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111\">" +
      "<h2 style=\"margin:0 0 16px 0;\">" + esc(subject) + "</h2>" +
      "<p><strong>Langue :</strong> " + esc(formLocale) + "</p>" +
      "<p><strong>Nom :</strong> " + esc(name) + "</p>" +
      "<p><strong>Site web :</strong> <a href=\"" + esc(website) + "\">" + esc(website) + "</a></p>" +
      "<p><strong>Adresse :</strong> " + esc(address || "—") + "</p>" +
      "<p><strong>Téléphone :</strong> " + esc(phone || "—") + "</p>" +
      "<p><strong>Horaires :</strong><br>" + esc(openingHours || "—").replaceAll("\n", "<br>") + "</p>" +
      "</div>";

    const { error } = await resend.emails.send({
      from,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error("[/api/v1/submissions] resend error", error);
      return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
    }

    return NextResponse.json({ ok: true }, { headers: V1_HEADERS });
  } catch (err) {
    console.error("[/api/v1/submissions] error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
