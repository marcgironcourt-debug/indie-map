import {NextResponse} from "next/server";
import fs from "node:fs";
import path from "node:path";
import {locales, defaultLocale} from "../../../../../i18n";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const requested = (url.searchParams.get("lang") || "").toLowerCase();

    const lang = (locales as readonly string[]).includes(requested)
      ? requested
      : defaultLocale;

    const filePath = path.join(process.cwd(), "data", "places.json");
    const raw = await fs.promises.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      console.error("[/api/v1/places] places.json n'est pas un tableau");
      return NextResponse.json([]);
    }

    if (lang === defaultLocale) {
      return NextResponse.json(parsed);
    }

    const out = parsed.map((x) => {
      if (!x || typeof x !== "object") return x;

      const t =
        x.translations &&
        typeof x.translations === "object" &&
        !Array.isArray(x.translations) &&
        x.translations.miniText &&
        typeof x.translations.miniText === "object" &&
        !Array.isArray(x.translations.miniText)
          ? x.translations.miniText[lang]
          : undefined;

      if (typeof t === "string" && t.trim().length > 0) {
        return {...x, miniText: t};
      }

      return x;
    });

    return NextResponse.json(out);
  } catch (err) {
    console.error("[/api/v1/places] Erreur de lecture places.json", err);
    return NextResponse.json([]);
  }
}
