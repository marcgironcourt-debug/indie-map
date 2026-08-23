import { NextResponse } from "next/server";
import { Resend } from "resend";

import { getCurrentUser } from "@/lib/auth";

const V1_HEADERS = {
  "X-API-Version": "1",
  "Cache-Control": "no-store",
} as const;

const MAX_LENGTH = 1000;

function cleanText(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function esc(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatSender(from: string) {
  const clean = from.trim();

  if (
    clean.includes("<") &&
    clean.includes(">")
  ) {
    return clean;
  }

  return `Indie Map <${clean}>`;
}

export async function POST(req: Request) {
  try {
    const currentUser =
      await getCurrentUser({
        refreshSession: true,
      });

    if (!currentUser) {
      return NextResponse.json(
        {
          ok: false,
          error: "authentication_required",
        },
        {
          status: 401,
          headers: V1_HEADERS,
        },
      );
    }

    const body =
      await req.json().catch(
        () => null,
      );

    const message =
      cleanText(body?.message);

    const locale =
      body?.locale === "en"
        ? "en"
        : "fr";

    if (
      message.length < 3 ||
      message.length > MAX_LENGTH
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_suggestion",
        },
        {
          status: 400,
          headers: V1_HEADERS,
        },
      );
    }

    const apiKey =
      process.env.RESEND_API_KEY || "";

    const from =
      process.env.RESEND_FROM || "";

    if (!apiKey || !from) {
      return NextResponse.json(
        {
          ok: false,
          error: "email_not_configured",
        },
        {
          status: 500,
          headers: V1_HEADERS,
        },
      );
    }

    const username =
      cleanText(
        currentUser.username,
      ) || "—";

    const email =
      cleanText(
        currentUser.email,
      ) || "—";

    const resend =
      new Resend(apiKey);

    const { error } =
      await resend.emails.send({
        from:
          formatSender(from),

        to: [
          "contact@indie-map.com",
        ],

        subject:
          `Suggestion Indie Map — ${username}`,

        html:
          `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111">` +
          `<h2>Nouvelle suggestion Indie Map</h2>` +
          `<p><strong>Pseudo :</strong> ${esc(username)}</p>` +
          `<p><strong>Email :</strong> ${esc(email)}</p>` +
          `<p><strong>Langue :</strong> ${esc(locale)}</p>` +
          `<hr style="border:0;border-top:1px solid #ddd;margin:24px 0">` +
          `<p><strong>Suggestion :</strong></p>` +
          `<p style="white-space:pre-wrap">${esc(message)}</p>` +
          `</div>`,
      });

    if (error) {
      console.error(
        "[suggestions] Resend error",
        error,
      );

      return NextResponse.json(
        {
          ok: false,
          error: "email_send_failed",
        },
        {
          status: 502,
          headers: V1_HEADERS,
        },
      );
    }

    return NextResponse.json(
      { ok: true },
      {
        headers: V1_HEADERS,
      },
    );
  } catch (error) {
    console.error(
      "[suggestions] POST error",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: "server_error",
      },
      {
        status: 500,
        headers: V1_HEADERS,
      },
    );
  }
}
