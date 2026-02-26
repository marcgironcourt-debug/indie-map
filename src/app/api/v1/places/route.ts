import { NextResponse } from "next/server";
import { normalizePlace } from "./_normalize";
import fs from "node:fs";
import path from "node:path";
import { locales, defaultLocale } from "../../../../../i18n";

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=60, s-maxage=300",
} as const;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const requested = (url.searchParams.get("lang") || "").toLowerCase();

    const lang = (locales as readonly string[]).includes(requested)
      ? requested
      : defaultLocale;

    const filePath = path.join(process.cwd(), "data", "places.json");
    const raw = await fs.promises.readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      console.error("[/api/v1/places] places.json n'est pas un tableau");
      return NextResponse.json(
        { error: "Server Error" },
        { status: 500, headers: CACHE_HEADERS }
      );
    }

    if (lang === defaultLocale) {
      return NextResponse.json(parsed.map(normalizePlace), { headers: CACHE_HEADERS });
    }

    const out = parsed.map((x: unknown) => {
      if (!isObj(x)) return x;

      const tr = x.translations;
      if (!isObj(tr)) return x;

      const mt = tr.miniText;
      if (!isObj(mt)) return x;

      const t = mt[lang];
      if (typeof t === "string" && t.trim().length > 0) {
        return { ...x, miniText: t };
      }

      return x;
    });

    return NextResponse.json(out.map(normalizePlace), { headers: CACHE_HEADERS });
  } catch (err) {
    console.error("[/api/v1/places] Erreur de lecture places.json", err);
    return NextResponse.json(
      { error: "Server Error" },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}
