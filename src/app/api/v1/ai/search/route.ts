import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { applyPrivateHomeSuggestionPatches } from "@/lib/privateHomeSuggestions";
import { normalizeContextCategory } from "@/lib/contextSuggestions";
import { normalizePlace } from "../../places/_normalize";
import { locales, defaultLocale } from "../../../../../../i18n";

type Obj = Record<string, unknown>;

type SearchPlace = {
  id: string;
  name: string;
  city?: string;
  address?: string;
  category?: string;
  miniText?: string;
  lat?: number;
  lng?: number;
  panoramaImage?: string;
  website?: string;
  phone?: string;
  openingHours?: string;
  timeZone?: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
};

const HEADERS = {
  "X-API-Version": "1",
  "Cache-Control": "no-store",
} as const;

function isObj(value: unknown): value is Obj {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsNormalizedTerm(text: string, term: string) {
  const haystack = ` ${normalizeText(text)} `;
  const needle = ` ${normalizeText(term)} `;
  return haystack.includes(needle);
}

async function readPlaces(locale: string): Promise<SearchPlace[]> {
  const filePath = path.join(process.cwd(), "data", "places.json");
  const raw = await fs.promises.readFile(filePath, "utf8");
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) return [];

  const normalized = parsed.map((item: unknown) => {
    if (!isObj(item)) return item;

    if (locale === defaultLocale) return item;

    const tr = item.translations;
    if (!isObj(tr)) return item;

    let next = item;
    const tObj = tr[locale];

    if (isObj(tObj)) {
      const patch: Obj = {};

      if (typeof tObj.miniText === "string" && tObj.miniText.trim()) patch.miniText = tObj.miniText;
      if (typeof tObj.homeTextNear === "string" && tObj.homeTextNear.trim()) patch.homeTextNear = tObj.homeTextNear;
      if (typeof tObj.homeTextFar === "string" && tObj.homeTextFar.trim()) patch.homeTextFar = tObj.homeTextFar;

      if (Object.keys(patch).length > 0) next = { ...next, ...patch };
    }

    const mt = tr.miniText;
    if (isObj(mt)) {
      const value = mt[locale];
      if (typeof value === "string" && value.trim()) next = { ...next, miniText: value };
    }

    return next;
  });

  return applyPrivateHomeSuggestionPatches(normalized.map(normalizePlace)) as SearchPlace[];
}

function getPlaceSearchCategories(placeOrCategory: SearchPlace | string | undefined) {
  const category = typeof placeOrCategory === "string" ? placeOrCategory : placeOrCategory?.category;
  const text = typeof placeOrCategory === "string"
    ? category
    : [
        placeOrCategory?.category,
        placeOrCategory?.miniText,
        placeOrCategory?.name,
        ...(Array.isArray(placeOrCategory?.tags) ? placeOrCategory.tags : []),
      ].filter(Boolean).join(" ");

  const raw = normalizeText(text || "");
  const normalized = normalizeContextCategory(category);
  const categories = new Set<string>();

  if (normalized) categories.add(normalized);

  const aliases: Array<[string, string[]]> = [
    ["cafe", ["cafe", "coffee", "espresso", "cappuccino", "latte", "pause cafe"]],
    ["brunch", ["brunch"]],
    ["bar", ["bar", "pub", "brasserie", "biere", "bieres", "microbrasserie", "boisson", "boissons", "cocktail", "aperitif", "apero", "buvette", "vin", "vins", "verre", "terrasse"]],
    ["epicerie", ["epicerie", "grocery", "magasin bio", "vrac", "courses", "produits alimentaires"]],
    ["restaurant", ["restaurant", "resto", "repas", "plat", "plats", "menu", "diner", "dejeuner", "souper", "table", "assiette", "gastronomie", "brunch", "service", "convives"]],
    ["boutique", ["boutique", "mode", "shop", "artisanat", "createurs locaux", "objet", "objets", "cadeau", "decoration"]],
    ["librairie", ["librairie", "bookstore", "bouquinerie", "livres", "livre"]],
    ["boulangerie", ["boulangerie", "bakery", "pain", "viennoiserie", "patisserie", "patisseries", "croissant"]],
    ["ferme", ["ferme", "farm", "producteur", "producteurs", "agriculture"]],
    ["marche", ["marche", "market"]],
    ["atelier", ["atelier", "workshop", "artisanat", "createurs locaux"]],
    ["alternatif", ["alternatif", "alternative", "lieu alternatif", "lieu de vie", "tiers lieu"]],
  ];

  for (const [target, values] of aliases) {
    if (values.some((value) => containsNormalizedTerm(raw, value))) {
      categories.add(target);
    }
  }

  return [...categories];
}


function getStrictPlaceCategories(category: string | undefined) {
  const raw = normalizeText(category || "");
  const normalized = normalizeContextCategory(category);
  const categories = new Set<string>();

  if (normalized) categories.add(normalized);
  if (raw.includes("cafe")) categories.add("cafe");
  if (raw.includes("brunch")) categories.add("brunch");
  if (raw.includes("bar") || raw.includes("pub") || raw.includes("brasserie")) categories.add("bar");
  if (raw.includes("mode")) categories.add("boutique");

  return [...categories];
}

function localSearch(query: string, places: SearchPlace[]) {
  const normalizedQuery = normalizeText(query);

  const knownCities = [...new Set(places.map((place) => place.city).filter(Boolean) as string[])]
    .sort((a, b) => b.length - a.length);

  const detectedCity = knownCities.find((city) => normalizedQuery.includes(normalizeText(city))) || null;
  const normalizedDetectedCity = detectedCity ? normalizeText(detectedCity) : "";

  const includesAny = (values: string[]) => values.some((value) => normalizedQuery.includes(normalizeText(value)));

  const explicitCategoryAliases: Record<string, string[]> = {
    epicerie: ["epicerie", "epiceries", "grocery", "groceries", "magasin bio"],
    restaurant: ["restaurant", "restaurants", "resto", "restos"],
    brunch: ["brunch", "brunchs"],
    cafe: ["cafe", "cafes", "coffee", "coffees"],
    bar: ["bar", "bars", "pub", "pubs", "brasserie", "brasseries"],
    boutique: ["boutique", "boutiques", "mode", "shopping"],
    librairie: ["librairie", "librairies", "bookstore"],
    boulangerie: ["boulangerie", "boulangeries", "bakery"],
    ferme: ["ferme", "fermes", "producteur", "producteurs", "farm", "farms"],
    marche: ["marche", "marches", "market", "markets"],
    atelier: ["atelier", "ateliers", "artisan", "artisans"],
    alternatif: ["alternatif", "alternative", "lieu alternatif"],
  };

  const explicitCategory = Object.entries(explicitCategoryAliases).find(([, aliases]) =>
    aliases.some((alias) => normalizedQuery.includes(normalizeText(alias)))
  )?.[0] || null;

  const intentCategories =
    includesAny(["boire un verre", "prendre un verre", "sortir boire", "aller boire", "un verre", "biere", "beer", "drink", "cocktail", "aperitif", "apero"])
      ? ["bar"]
      : includesAny(["faire les courses", "faire mes courses", "acheter a manger", "ingredients", "ingredient", "repas maison", "cuisiner", "produits locaux", "local food", "organic food", "grocery"])
        ? ["epicerie", "marche", "ferme"]
        : includesAny(["manger", "dejeuner", "diner", "souper", "bon repas", "lunch", "dinner", "eat", "food"])
          ? ["restaurant", "brunch", "cafe"]
          : includesAny(["boire un cafe", "prendre un cafe", "travailler", "lire", "pause cafe", "gouter", "coffee", "work", "read"])
            ? ["cafe"]
            : includesAny(["cadeau", "cadeaux", "gift", "gifts", "pour ma niece", "pour mon neveu", "pour un enfant", "objet", "objets", "souvenir", "decoration", "deco"])
              ? ["boutique", "librairie"]
              : includesAny(["pain", "viennoiserie", "croissant", "baguette", "bread"])
                ? ["boulangerie"]
                : includesAny(["expo", "exposition", "art", "culture", "galerie", "gallery"])
                  ? ["alternatif", "atelier"]
                  : [];

  const targetCategories = [...new Set([...(explicitCategory ? [explicitCategory] : []), ...intentCategories])];
  const hasMixedIntent = Boolean(explicitCategory && intentCategories.some((category) => category !== explicitCategory));

  const stopWords = new Set([
    "je", "j", "me", "mes", "moi", "tu", "te", "le", "la", "les", "un", "une", "des", "de", "du", "d", "a", "au", "aux",
    "en", "sur", "pour", "dans", "avec", "trouve", "trouver", "montre", "montrez", "voir", "veux", "voudrais",
    "besoin", "cherche", "chercher", "peux", "peut", "aller", "faire", "bientot", "quelques", "jours", "place",
    "lieu", "lieux", "ville", "city", "near", "nearby", "show", "find", "for", "where", "need", "want", "ce", "soir",
  ]);

  const tokens = normalizedQuery
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopWords.has(token) && token !== normalizedDetectedCity);

  const ignoredSearchTokens = new Set([
    ...Object.values(explicitCategoryAliases)
      .flatMap((aliases) => aliases)
      .flatMap((alias) => normalizeText(alias).split(/\s+/)),
    "boire", "prendre", "verre", "sortir", "biere", "beer", "drink", "cocktail", "aperitif", "apero",
    "manger", "dejeuner", "diner", "souper", "repas", "lunch", "dinner", "eat", "food",
    "cafe", "coffee", "travailler", "lire", "pause", "gouter", "work", "read",
    "courses", "acheter", "ingredients", "ingredient", "cuisiner", "produits", "locaux", "local", "organic",
    "cadeau", "cadeaux", "gift", "gifts", "niece", "neveu", "enfant", "objet", "objets", "souvenir",
    "pain", "viennoiserie", "croissant", "baguette", "bread",
    "expo", "exposition", "art", "culture", "galerie", "gallery",
  ].filter((token) => token.length > 2));

  const meaningfulTokens = tokens.filter((token) => !ignoredSearchTokens.has(token));

  const cityPool = detectedCity
    ? places.filter((place) => normalizeText(place.city || "") === normalizedDetectedCity)
    : places;

  const categoryPool = targetCategories.length > 0
    ? cityPool.filter((place) => {
        const miniText = normalizeText(place.miniText || "");
        const searchCategories = getPlaceSearchCategories(place);

        if (explicitCategory && intentCategories.length === 0) {
          const baseCategories = getStrictPlaceCategories(place.category);
          return baseCategories.includes(explicitCategory);
        }

        if (targetCategories.some((category) => searchCategories.includes(category))) return true;
        if (targetCategories.includes("brunch") && miniText.includes("brunch")) return true;

        return false;
      })
    : cityPool;

  const shouldReturnFullPool = Boolean(detectedCity) && !hasMixedIntent && (targetCategories.length > 0 || tokens.length === 0) && meaningfulTokens.length === 0;

  const results = shouldReturnFullPool
    ? categoryPool.sort((a, b) => a.name.localeCompare(b.name))
    : categoryPool
        .map((place) => {
          const placeCity = normalizeText(place.city || "");
          const placeCategories = getPlaceSearchCategories(place);
          const name = normalizeText(place.name || "");
          const address = normalizeText(place.address || "");
          const category = normalizeText(place.category || "");
          const miniText = normalizeText(place.miniText || "");
          const haystack = [name, placeCity, address, category, miniText].filter(Boolean).join(" ");

          let score = 0;
          let relevance = 0;

          if (detectedCity && placeCity === normalizedDetectedCity) score += 80;

          if (explicitCategory && placeCategories.includes(explicitCategory)) {
            const value = intentCategories.length > 0 ? 25 : 90;
            score += value;
            relevance += value;
          }

          for (const category of intentCategories) {
            if (placeCategories.includes(category)) {
              const value = explicitCategory ? 90 : 70;
              score += value;
              relevance += value;
            }
          }

          if (!explicitCategory && targetCategories.some((category) => placeCategories.includes(category))) {
            score += 20;
            relevance += 20;
          }

          for (const token of meaningfulTokens) {
            if (name.includes(token)) {
              score += 18;
              relevance += 18;
            }
            if (category.includes(token)) {
              score += 14;
              relevance += 14;
            }
            if (placeCity.includes(token)) score += 12;
            if (address.includes(token)) {
              score += 8;
              relevance += 8;
            }
            if (miniText.includes(token)) {
              score += 10;
              relevance += 10;
            }
            if (haystack.includes(token)) {
              score += 3;
              relevance += 3;
            }
          }

          return { place, score, relevance };
        })
        .filter((entry) => entry.relevance > 0)
        .sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name))
        .map((entry) => entry.place);

  return {
    detectedCity,
    explicitCategory,
    targetCategories,
    intentCategories,
    meaningfulTokens,
    searchMode: shouldReturnFullPool ? "full_pool" : "scored",
    results,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const query = String(body?.query ?? "").trim();
    const requestedLocale = String(body?.locale ?? defaultLocale).trim().toLowerCase();

    if (!query) {
      return NextResponse.json({ ok: false, error: "missing_query" }, { status: 400, headers: HEADERS });
    }

    const locale = (locales as readonly string[]).includes(requestedLocale) ? requestedLocale : defaultLocale;
    const places = await readPlaces(locale);
    const local = localSearch(query, places);

    return NextResponse.json({
      ok: true,
      mode: process.env.OPENAI_API_KEY ? "fallback_ready_for_ai" : "fallback",
      query,
      detectedCity: local.detectedCity,
      explicitCategory: local.explicitCategory,
      targetCategories: local.targetCategories,
      intentCategories: local.intentCategories,
      meaningfulTokens: local.meaningfulTokens,
      searchMode: local.searchMode,
      resultsCount: local.results.length,
      results: local.results,
    }, { headers: HEADERS });
  } catch (err) {
    console.error("[/api/v1/ai/search] POST error", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500, headers: HEADERS });
  }
}
