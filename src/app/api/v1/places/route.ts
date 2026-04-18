import { NextResponse } from "next/server";
import { normalizePlace } from "./_normalize";
import { applyPrivateHomeSuggestionPatches } from "@/lib/privateHomeSuggestions";
import fs from "node:fs";
import path from "node:path";
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
      return NextResponse.json(applyPrivateHomeSuggestionPatches(parsed.map(normalizePlace)), { headers: CACHE_HEADERS });
    }

    const out = parsed.map((x: unknown) => {
      if (!isObj(x)) return x;

      const tr = x.translations;
      if (!isObj(tr)) return x;

            
      let next = x;

      const tObj = tr[lang];
      if (isObj(tObj)) {
        const patch: Record<string, unknown> = {};

        const miniText = tObj.miniText;
        if (typeof miniText === "string" && miniText.trim().length > 0) {
          patch.miniText = miniText;
        }

        const homeTextNear = tObj.homeTextNear;
        if (typeof homeTextNear === "string" && homeTextNear.trim().length > 0) {
          patch.homeTextNear = homeTextNear;
        }

        const homeTextFar = tObj.homeTextFar;
        if (typeof homeTextFar === "string" && homeTextFar.trim().length > 0) {
          patch.homeTextFar = homeTextFar;
        }

        if (Object.keys(patch).length > 0) {
          next = { ...next, ...patch };
        }
      }

      const mt = tr.miniText;
      if (isObj(mt)) {
        const t2 = mt[lang];
        if (typeof t2 === "string" && t2.trim().length > 0) {
          next = { ...next, miniText: t2 };
        }
      }

      return next;
    });

    return NextResponse.json(applyPrivateHomeSuggestionPatches(out.map(normalizePlace)), { headers: CACHE_HEADERS });
  } catch (err) {
    console.error("[/api/v1/places] Erreur de lecture places.json", err);
    return NextResponse.json(
      { error: "Server Error" },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}
