import { NextResponse } from "next/server";
import { normalizePlace } from "./_normalize";
import { readPlacesSource } from "./_source";
import { locales, defaultLocale } from "../../../../../i18n";

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

const CACHE_HEADERS = {
  "X-API-Version": "1",
  "Cache-Control": "public, max-age=60, s-maxage=300",
} as const;

export async function GET(req: Request) {

  try {
    const url = new URL(req.url);

    const qLocale = (url.searchParams.get("locale") || "").toLowerCase();
    const qLang = (url.searchParams.get("lang") || "").toLowerCase();
    const requested = qLocale || qLang;

    if (requested && !(locales as readonly string[]).includes(requested)) {
      return NextResponse.json(
        { error: "Invalid locale" },
        { status: 400, headers: CACHE_HEADERS }
      );
    }

    const lang = requested || defaultLocale;

    const parsed: unknown = await readPlacesSource();

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

            
      const tObj = tr[lang];
      if (isObj(tObj)) {
        const t = tObj.miniText;
        if (typeof t === "string" && t.trim().length > 0) {
          return { ...x, miniText: t };
        }
      }

      const mt = tr.miniText;
      if (isObj(mt)) {
        const t2 = mt[lang];
        if (typeof t2 === "string" && t2.trim().length > 0) {
          return { ...x, miniText: t2 };
        }
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
