import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { Resend } from "resend";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

function formatSender(from: string) {
  const clean = from.trim();
  if (!clean) return clean;
  if (clean.includes("<") && clean.includes(">")) return clean;
  return "Indie Map <" + clean + ">";
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

    const currentUser = await getCurrentUser();
    const reviewToken = randomBytes(32).toString("hex");

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

    const reviewBaseUrl = process.env.SUBMISSION_REVIEW_BASE_URL || new URL(req.url).origin;
    const approveUrl = reviewBaseUrl.replace(/\/$/, "") + "/api/v1/submissions/review?action=approve&token=" + encodeURIComponent(reviewToken);
    const rejectUrl = reviewBaseUrl.replace(/\/$/, "") + "/api/v1/submissions/review?action=reject&token=" + encodeURIComponent(reviewToken);

    await prisma.submission.create({
      data: {
        locale: formLocale,
        name,
        address: address || "",
        openingHours,
        phone,
        website,
        reviewToken,
        user: currentUser ? { connect: { id: currentUser.id } } : undefined,
      },
      select: { id: true },
    });

    const html =
      "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111\">" +
      "<h2 style=\"margin:0 0 16px 0;\">" + esc(subject) + "</h2>" +
      "<p><strong>Langue :</strong> " + esc(formLocale) + "</p>" +
      "<p><strong>Nom :</strong> " + esc(name) + "</p>" +
      "<p><strong>Site web :</strong> <a href=\"" + esc(website) + "\">" + esc(website) + "</a></p>" +
      "<p><strong>Adresse :</strong> " + esc(address || "—") + "</p>" +
      "<p><strong>Téléphone :</strong> " + esc(phone || "—") + "</p>" +
      "<p><strong>Horaires :</strong><br>" + esc(openingHours || "—").replaceAll("\n", "<br>") + "</p>" +
      "<p><strong>Compte connecté :</strong> " + esc(currentUser ? currentUser.email || currentUser.username : "Non") + "</p>" +
      "<p style=\"margin-top:24px;color:#555\">Clique sur Valider seulement après avoir réellement ajouté le lieu à Indie Map.</p>" +
      "<p style=\"margin-top:16px\">" +
      "<a href=\"" + esc(approveUrl) + "\" style=\"display:inline-block;margin-right:10px;padding:10px 14px;border-radius:12px;background:#5C6E3B;color:#fff;text-decoration:none;font-weight:700\">Valider</a>" +
      "<a href=\"" + esc(rejectUrl) + "\" style=\"display:inline-block;padding:10px 14px;border-radius:12px;background:#111;color:#fff;text-decoration:none;font-weight:700\">Refuser</a>" +
      "</p>" +
      "</div>";

    const { error } = await resend.emails.send({
      from: formatSender(from),
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
