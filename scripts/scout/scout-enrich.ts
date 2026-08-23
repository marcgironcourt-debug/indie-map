import fs from "node:fs";
import dotenv from "dotenv";
import OpenAI from "openai";

import {
  collectOfficialPagesForScout,
  type OfficialVerifierUsage,
  type ScoutOfficialPage,
} from "../../src/lib/ai/officialSiteVerifier";

dotenv.config({
  path: ".env.local",
});

const VERSION = "scout-catalogue-enrichment-v1";

const MODEL =
  process.env.SCOUT_ENRICH_MODEL?.trim() ||
  process.env.SCOUT_WEB_MODEL?.trim() ||
  process.env.SCOUT_MODEL?.trim() ||
  "gpt-5.4-nano";

const EMBEDDING_MODEL =
  process.env.SCOUT_WEB_EMBEDDING_MODEL?.trim() ||
  "text-embedding-3-small";

const PLACES_PATH =
  "data/places.json";

const INTERNAL_PROFILES_PATH =
  "data/private/scout/catalogue-profiles.v1.json";

const WEB_FUSION_PATH =
  "data/private/scout/catalogue-web-fusion-by-site.v1.json";

const OUTPUT_PATH =
  "data/private/scout/catalogue-enrichment.v1.json";

const ATTRIBUTE_KEYS = [
  "vegetarian_options",
  "vegan_options",
  "gluten_free_options",
  "organic",
  "local_sourcing",
  "seasonal",
  "short_supply_chain",
  "artisan",
  "on_site_production",
  "direct_sale",
  "repair_reuse_second_hand",
  "zero_waste",
  "social_solidarity",
  "community_alternative",
  "local_creators",
  "terrace",
  "brunch",
  "takeaway",
  "wheelchair_accessible",
  "dogs_allowed",
  "family_friendly",
  "wifi",
] as const;

type AttributeKey =
  typeof ATTRIBUTE_KEYS[number];

type Place = {
  id: string;
  name: string;
  city?: string;
  country?: string;
  address?: string;
  category?: string;
  website?: string;
  priceRange?: {
    min?: number;
    max?: number;
    currency?: string;
    basis?: string;
  };
  [key: string]: unknown;
};

type AttributeEvidence = {
  key: AttributeKey;
  evidenceQuote: string;
  sourceUrl: string;
  sourceContentHash: string;
  scope:
    | "target_place"
    | "brand_general";
};

type PriceEvidence = {
  observedMin: number;
  observedMax: number;
  displayMin: number;
  displayMax: number;
  currency: string;
  basis: "per_person";
  method: string;
  minEvidenceQuote: string;
  minSourceUrl: string;
  minSourceContentHash: string;
  maxEvidenceQuote: string;
  maxSourceUrl: string;
  maxSourceContentHash: string;
};

type EnrichmentEntry = {
  placeId: string;
  name: string;
  city: string;
  country: string;
  category: string;
  website: string;
  attributes: AttributeEvidence[];
  priceRange?: PriceEvidence;
  discoveredUrlCount?: number;
  selectedUrls?: string[];
  officialPages?: Array<{
    url: string;
    title: string;
    contentHash: string;
    textLength: number;
  }>;
  cautions?: string[];
  verifiedAt: string;
  model: string;
  status: "success" | "error";
  error?: string;
  usage?: OfficialVerifierUsage;
};

type OutputFile = {
  version: typeof VERSION;
  updatedAt: string;
  entries: Record<string, EnrichmentEntry>;
};

function emptyUsage(): OfficialVerifierUsage {
  return {
    httpRequests: 0,
    embeddingTokens: 0,
    llmInputTokens: 0,
    llmOutputTokens: 0,
    ramCacheHits: 0,
    persistentCacheHits: 0,
    persistentCacheMisses: 0,
    persistentCacheWrites: 0,
    verifiedFactMemoryHits: 0,
    verifiedFactMemoryMisses: 0,
    verifiedFactWrites: 0,
  } as OfficialVerifierUsage;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalUrl(value: unknown) {
  try {
    const url =
      new URL(String(value || "").trim());

    url.hash = "";

    return url.toString()
      .replace(/\/$/, "");
  } catch {
    return String(value || "")
      .trim()
      .replace(/\/$/, "");
  }
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function flagValue(name: string) {
  const index =
    process.argv.indexOf(name);

  if (
    index === -1 ||
    index + 1 >= process.argv.length
  ) {
    return "";
  }

  return String(
    process.argv[index + 1] || ""
  ).trim();
}

function positiveIntegerFlag(
  name: string
) {
  const value =
    Number(flagValue(name));

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return null;
  }

  return Math.trunc(value);
}

function isPriceCategory(
  category: unknown
) {
  const value =
    normalizeText(category);

  return (
    value.includes("restaurant") ||
    value.includes("brasserie") ||
    value.includes("bar") ||
    value.includes("pub") ||
    value.includes("cafe") ||
    value.includes("café") ||
    value.includes("brunch")
  );
}

function roundPriceDown(
  value: number
) {
  return (
    Math.floor(value / 5) * 5
  );
}

function roundPriceUp(
  value: number
) {
  return (
    Math.ceil(value / 5) * 5
  );
}

function readJson(
  filename: string,
  fallback: unknown
) {
  if (!fs.existsSync(filename)) {
    return fallback;
  }

  return JSON.parse(
    fs.readFileSync(
      filename,
      "utf8"
    )
  );
}

function loadOutput():
  OutputFile {
  const raw =
    readJson(
      OUTPUT_PATH,
      null
    ) as OutputFile | null;

  if (
    raw &&
    raw.version === VERSION &&
    raw.entries &&
    typeof raw.entries === "object"
  ) {
    return raw;
  }

  return {
    version: VERSION,
    updatedAt:
      new Date().toISOString(),
    entries: {},
  };
}

function saveOutput(
  output: OutputFile
) {
  output.updatedAt =
    new Date().toISOString();

  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      output,
      null,
      2
    ) + "\n"
  );
}

function modelSchema() {
  return {
    type: "object",
    properties: {
      attributes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: {
              type: "string",
              enum: ATTRIBUTE_KEYS,
            },
            evidenceQuote: {
              type: "string",
            },
            sourceUrl: {
              type: "string",
            },
            scope: {
              type: "string",
              enum: [
                "target_place",
                "brand_general",
              ],
            },
          },
          required: [
            "key",
            "evidenceQuote",
            "sourceUrl",
            "scope",
          ],
          additionalProperties:
            false,
        },
      },

      priceRanges: {
        type: "array",
        maxItems: 1,
        items: {
          type: "object",
          properties: {
            observedMin: {
              type: "number",
            },
            observedMax: {
              type: "number",
            },
            currency: {
              type: "string",
            },
            method: {
              type: "string",
            },
            minEvidenceQuote: {
              type: "string",
            },
            minSourceUrl: {
              type: "string",
            },
            maxEvidenceQuote: {
              type: "string",
            },
            maxSourceUrl: {
              type: "string",
            },
          },
          required: [
            "observedMin",
            "observedMax",
            "currency",
            "method",
            "minEvidenceQuote",
            "minSourceUrl",
            "maxEvidenceQuote",
            "maxSourceUrl",
          ],
          additionalProperties:
            false,
        },
      },

      cautions: {
        type: "array",
        items: {
          type: "string",
        },
      },
    },

    required: [
      "attributes",
      "priceRanges",
      "cautions",
    ],

    additionalProperties:
      false,
  };
}

function validateQuote(
  pages: ScoutOfficialPage[],
  sourceUrl: string,
  quote: string
) {
  const wantedUrl =
    canonicalUrl(sourceUrl);

  const page =
    pages.find(
      item =>
        canonicalUrl(
          item.url
        ) === wantedUrl
    );

  if (!page) return null;

  const normalizedQuote =
    normalizeText(quote);

  if (
    normalizedQuote.length < 3 ||
    !normalizeText(
      page.text
    ).includes(
      normalizedQuote
    )
  ) {
    return null;
  }

  return page;
}

function validateAttributes(
  raw: unknown,
  pages: ScoutOfficialPage[]
): AttributeEvidence[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const allowed =
    new Set<string>(
      ATTRIBUTE_KEYS
    );

  const seen =
    new Set<string>();

  const result:
    AttributeEvidence[] = [];

  for (const item of raw) {
    if (
      !item ||
      typeof item !== "object"
    ) {
      continue;
    }

    const value =
      item as Record<
        string,
        unknown
      >;

    const key =
      String(
        value.key || ""
      ) as AttributeKey;

    const evidenceQuote =
      String(
        value.evidenceQuote || ""
      ).trim();

    const sourceUrl =
      String(
        value.sourceUrl || ""
      ).trim();

    const scope =
      String(
        value.scope || ""
      );

    if (
      !allowed.has(key) ||
      (
        scope !== "target_place" &&
        scope !== "brand_general"
      ) ||
      seen.has(key)
    ) {
      continue;
    }

    const page =
      validateQuote(
        pages,
        sourceUrl,
        evidenceQuote
      );

    if (!page) continue;

    seen.add(key);

    result.push({
      key,
      evidenceQuote,
      sourceUrl:
        page.url,
      sourceContentHash:
        page.contentHash,
      scope,
    });
  }

  return result;
}

function validatePrice(
  raw: unknown,
  pages: ScoutOfficialPage[]
): PriceEvidence | undefined {
  if (
    !Array.isArray(raw) ||
    raw.length === 0
  ) {
    return undefined;
  }

  const value =
    raw[0];

  if (
    !value ||
    typeof value !== "object"
  ) {
    return undefined;
  }

  const item =
    value as Record<
      string,
      unknown
    >;

  const observedMin =
    Number(
      item.observedMin
    );

  const observedMax =
    Number(
      item.observedMax
    );

  const currency =
    String(
      item.currency || ""
    )
      .trim()
      .toUpperCase();

  const method =
    String(
      item.method || ""
    ).trim();

  const minEvidenceQuote =
    String(
      item.minEvidenceQuote ||
      ""
    ).trim();

  const minSourceUrl =
    String(
      item.minSourceUrl ||
      ""
    ).trim();

  const maxEvidenceQuote =
    String(
      item.maxEvidenceQuote ||
      ""
    ).trim();

  const maxSourceUrl =
    String(
      item.maxSourceUrl ||
      ""
    ).trim();

  if (
    !Number.isFinite(
      observedMin
    ) ||
    !Number.isFinite(
      observedMax
    ) ||
    observedMin < 0 ||
    observedMax < observedMin ||
    !/^[A-Z]{3}$/.test(
      currency
    ) ||
    !method
  ) {
    return undefined;
  }

  const minPage =
    validateQuote(
      pages,
      minSourceUrl,
      minEvidenceQuote
    );

  const maxPage =
    validateQuote(
      pages,
      maxSourceUrl,
      maxEvidenceQuote
    );

  if (
    !minPage ||
    !maxPage
  ) {
    return undefined;
  }

  return {
    observedMin,
    observedMax,

    displayMin:
      roundPriceDown(
        observedMin
      ),

    displayMax:
      roundPriceUp(
        observedMax
      ),

    currency,
    basis: "per_person",
    method,

    minEvidenceQuote,
    minSourceUrl:
      minPage.url,
    minSourceContentHash:
      minPage.contentHash,

    maxEvidenceQuote,
    maxSourceUrl:
      maxPage.url,
    maxSourceContentHash:
      maxPage.contentHash,
  };
}

async function analyzePlace(
  openai: OpenAI,
  place: Place,
  internalProfile: unknown,
  existingWebProfile: unknown,
  usage: OfficialVerifierUsage
) {
  const priceEligible =
    !hasFlag("--attributes-only") &&
    isPriceCategory(
      place.category
    );

  const selectionQuestion = [
    `Établissement : ${place.name}.`,
    place.city
      ? `Ville : ${place.city}.`
      : "",
    "Trouver les pages officielles les plus utiles pour enrichir sa fiche Indie Map.",
    "Chercher notamment menus, cartes, prix, tarifs, boissons,",
    "options végétariennes, vegan et sans gluten, bio, produits locaux,",
    "saisonnalité, circuit court, artisanat, fabrication sur place,",
    "vente directe, seconde main, réemploi, zéro déchet,",
    "dimension sociale ou communautaire, créateurs locaux,",
    "terrasse, brunch, vente à emporter, accessibilité fauteuil roulant,",
    "chiens acceptés, accueil des familles et Wi-Fi.",
    priceEligible
      ? "Pour ce lieu, rechercher aussi les prix réellement publiés permettant d'estimer une fourchette par personne."
      : "",
    "Utiliser uniquement le site officiel et ses documents officiels.",
  ]
    .filter(Boolean)
    .join(" ");

  const collection =
    await collectOfficialPagesForScout({
      openai,
      place: {
        id: place.id,
        name: place.name,
        city: place.city,
        address:
          place.address,
        website:
          place.website,
      },
      usage,
      embeddingModel:
        EMBEDDING_MODEL,
      maxSelectedPages: 8,
      selectionQuestion,
    });

  if (
    collection.pages.length === 0
  ) {
    throw new Error(
      "Aucune page officielle exploitable"
    );
  }

  const response =
    await openai.responses.create({
      model: MODEL,

      reasoning: {
        effort: "low",
      },

      store: false,

      max_output_tokens:
        6000,

      text: {
        format: {
          type: "json_schema",
          name:
            "indie_map_scout_enrichment",
          strict: true,
          schema:
            modelSchema(),
        },
      },

      input: [
        {
          role: "system",
          content: `
Tu enrichis les fiches de lieux déjà sélectionnés par Indie Map.

Tu dois extraire uniquement des informations explicitement
documentées dans les pages officielles fournies.

ABSOLU :
- aucune connaissance extérieure ;
- aucune supposition ;
- absence d'information = inconnu ;
- ne produis jamais de valeur false ;
- chaque attribut doit avoir une citation exacte et continue ;
- sourceUrl doit être exactement l'URL d'une page fournie ;
- target_place si la preuve concerne cette adresse précise ;
- brand_general seulement si la caractéristique concerne réellement
  toute la marque / structure ;
- ne déduis jamais vegan depuis végétarien ;
- ne déduis jamais accessible PMR depuis une photo ;
- ne déduis jamais chiens acceptés, famille, Wi-Fi ou terrasse
  sans mention explicite ;
- "local" seul n'est pas suffisant pour local_sourcing :
  il faut provenance, producteur ou approvisionnement concret ;
- organic ne doit être retourné que si le caractère biologique
  concerne une part significative de l'offre, des produits ou de
  l'approvisionnement du lieu, ou si le lieu revendique explicitement
  une démarche/certification bio globale ;
- un seul ingrédient bio, quelques herbes bio ou un produit bio isolé
  ne suffisent jamais à attribuer organic au lieu ;
- si tu dois écrire dans cautions que la preuve d'un attribut est
  insuffisante, partielle, ambiguë ou non généralisable, N'INCLUS PAS
  cet attribut dans attributes ;
- vegetarian_options exige une preuve portant explicitement sur
  l'offre réellement proposée aux clients : plats végétariens,
  options végétariennes, menu végétarien ou établissement végétarien ;
- le fait qu'un chef, fondateur ou membre de l'équipe soit végétarien
  ne prouve JAMAIS vegetarian_options ;
- une cuisine décrite comme végétale ou davantage végétale ne suffit
  pas non plus sans offre végétarienne explicitement documentée ;
- vegan_options exige une offre vegan explicitement proposée aux
  clients ; une philosophie végétale ne suffit pas ;
- gluten_free_options exige une offre sans gluten explicitement
  proposée aux clients ;
- ne retourne jamais simultanément un attribut ET une caution disant
  que cet attribut n'est pas suffisamment prouvé.

ATTRIBUTS AUTORISÉS :
${ATTRIBUTE_KEYS.join(", ")}

PRIX :
- retourne un priceRange uniquement si priceEligible=true ;
- utilise la monnaie locale réellement utilisée par le lieu ;
- ne convertis jamais les devises ;
- observedMin et observedMax doivent être des prix réellement visibles ;
- pour un restaurant : représente une dépense réaliste permettant
  de manger par personne, en utilisant la carte ou les menus ;
- un menu dégustation réellement proposé peut constituer la borne haute ;
- ignore bouteilles premium, suppléments exceptionnels et grands plats
  à partager lorsqu'ils ne représentent pas une dépense individuelle normale ;
- pour un bar/pub/brasserie sans repas complet, utilise une consommation
  individuelle représentative explicitement tarifée ;
- si les pages ne suffisent pas, retourne priceRanges=[] ;
- currency doit être un code ISO à 3 lettres, par ex. EUR, CAD, AUD, GBP, COP ;
- minEvidenceQuote et maxEvidenceQuote doivent chacune contenir la preuve
  exacte du prix correspondant.

Les informations internes Scout servent uniquement de contexte et
d'indices. Elles ne remplacent jamais la preuve officielle requise.
          `.trim(),
        },

        {
          role: "user",
          content:
            JSON.stringify({
              targetPlace: {
                id: place.id,
                name: place.name,
                city:
                  place.city || "",
                country:
                  place.country || "",
                address:
                  place.address || "",
                category:
                  place.category || "",
                website:
                  place.website || "",
                priceEligible,
              },

              existingIndieMapPrice:
                place.priceRange ||
                null,

              internalScoutProfile:
                internalProfile ||
                null,

              existingOfficialScoutKnowledge:
                existingWebProfile ||
                null,

              officialPages:
                collection.pages.map(
                  page => ({
                    sourceUrl:
                      page.url,
                    title:
                      page.title,
                    text:
                      page.text,
                  })
                ),
            }),
        },
      ],
    });

  usage.llmInputTokens +=
    Number(
      response.usage
        ?.input_tokens ||
      0
    );

  usage.llmOutputTokens +=
    Number(
      response.usage
        ?.output_tokens ||
      0
    );

  if (
    !response.output_text
  ) {
    throw new Error(
      "Réponse OpenAI vide"
    );
  }

  const parsed =
    JSON.parse(
      response.output_text
    ) as Record<
      string,
      unknown
    >;

  return {
    attributes:
      validateAttributes(
        parsed.attributes,
        collection.pages
      ),

    priceRange:
      priceEligible
        ? validatePrice(
            parsed.priceRanges,
            collection.pages
          )
        : undefined,

    cautions:
      Array.isArray(
        parsed.cautions
      )
        ? parsed.cautions
            .map(value =>
              String(value || "").trim()
            )
            .filter(Boolean)
        : [],

    discoveredUrlCount:
      collection.discoveredCount,

    selectedUrls:
      collection.selectedUrls,

    officialPages:
      collection.pages.map(
        page => ({
          url: page.url,
          title: page.title,
          contentHash:
            page.contentHash,
          textLength:
            page.text.length,
        })
      ),
  };
}

async function main() {
  if (
    !process.env.OPENAI_API_KEY
  ) {
    throw new Error(
      "OPENAI_API_KEY absente"
    );
  }

  const places =
    readJson(
      PLACES_PATH,
      []
    ) as Place[];

  if (!Array.isArray(places)) {
    throw new Error(
      "data/places.json doit être un tableau"
    );
  }

  const internalFile =
    readJson(
      INTERNAL_PROFILES_PATH,
      { profiles: [] }
    ) as {
      profiles?: Array<
        Record<string, unknown>
      >;
    };

  const internalById =
    new Map(
      (
        internalFile.profiles ||
        []
      ).map(
        profile => [
          String(
            profile.placeId ||
            ""
          ),
          profile,
        ]
      )
    );

  const webFile =
    readJson(
      WEB_FUSION_PATH,
      { profiles: [] }
    ) as {
      profiles?: Array<
        Record<string, unknown>
      >;
    };

  const webById =
    new Map(
      (
        webFile.profiles ||
        []
      ).map(
        profile => [
          String(
            profile.placeId ||
            ""
          ),
          {
            summaryFr:
              profile.summaryFr,
            officialFindings:
              profile.officialFindings,
            combinedDrivers:
              profile.combinedDrivers,
            cautions:
              profile.cautions,
            verifiedAt:
              profile.verifiedAt,
          },
        ]
      )
    );

  let candidates =
    places.filter(
      place =>
        Boolean(
          String(
            place.website ||
            ""
          ).trim()
        )
    );

  const placeFilter =
    flagValue("--place");

  if (placeFilter) {
    const normalized =
      normalizeText(
        placeFilter
      );

    candidates =
      candidates.filter(
        place =>
          place.id ===
            placeFilter ||
          normalizeText(
            place.name
          ) === normalized
      );
  }

  const all =
    hasFlag("--all");

  const limit =
    all
      ? candidates.length
      : positiveIntegerFlag(
          "--limit"
        ) ?? 3;

  candidates =
    candidates.slice(
      0,
      limit
    );

  if (
    candidates.length === 0
  ) {
    throw new Error(
      "Aucun lieu sélectionné"
    );
  }

  const resume =
    hasFlag("--resume");

  const force =
    hasFlag("--force");

  const output =
    loadOutput();

  const openai =
    new OpenAI({
      apiKey:
        process.env
          .OPENAI_API_KEY,
    });

  console.log(
    `MODE ${all ? "COMPLET" : "PILOTE"}`
  );

  console.log(
    `Lieux sélectionnés : ${candidates.length}`
  );

  console.log(
    `Modèle : ${MODEL}`
  );

  let success = 0;
  let errors = 0;
  let skipped = 0;

  for (
    const [
      index,
      place,
    ] of candidates.entries()
  ) {
    if (
      resume &&
      !force &&
      output.entries[
        place.id
      ]?.status ===
        "success"
    ) {
      skipped += 1;

      console.log(
        `[${index + 1}/${candidates.length}] ${place.name} — déjà traité`
      );

      continue;
    }

    console.log(
      `\n[${index + 1}/${candidates.length}] ${place.name}`
    );

    const usage =
      emptyUsage();

    try {
      const result =
        await analyzePlace(
          openai,
          place,
          internalById.get(
            place.id
          ),
          webById.get(
            place.id
          ),
          usage
        );

      output.entries[
        place.id
      ] = {
        placeId:
          place.id,
        name:
          place.name,
        city:
          String(
            place.city || ""
          ),
        country:
          String(
            place.country || ""
          ),
        category:
          String(
            place.category || ""
          ),
        website:
          String(
            place.website || ""
          ),

        attributes:
          result.attributes,

        ...(result.priceRange
          ? {
              priceRange:
                result.priceRange,
            }
          : {}),

        discoveredUrlCount:
          result.discoveredUrlCount,

        selectedUrls:
          result.selectedUrls,

        officialPages:
          result.officialPages,

        cautions:
          result.cautions,

        verifiedAt:
          new Date().toISOString(),

        model:
          MODEL,

        status:
          "success",

        usage,
      };

      success += 1;

      console.log(
        `  attributs=${result.attributes.length}`
      );

      if (
        result.priceRange
      ) {
        console.log(
          `  prix=${result.priceRange.displayMin}-${result.priceRange.displayMax} ${result.priceRange.currency}`
        );
      } else if (
        isPriceCategory(
          place.category
        )
      ) {
        console.log(
          "  prix=non trouvé"
        );
      }

      console.log(
        `  HTTP=${usage.httpRequests} cache=${usage.persistentCacheHits || 0} LLM=${usage.llmInputTokens}/${usage.llmOutputTokens}`
      );
    } catch (error) {
      errors += 1;

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.error(
        `  ERREUR : ${message}`
      );

      output.entries[
        place.id
      ] = {
        placeId:
          place.id,
        name:
          place.name,
        city:
          String(
            place.city || ""
          ),
        country:
          String(
            place.country || ""
          ),
        category:
          String(
            place.category || ""
          ),
        website:
          String(
            place.website || ""
          ),
        attributes: [],
        verifiedAt:
          new Date().toISOString(),
        model:
          MODEL,
        status:
          "error",
        error:
          message,
        usage,
      };
    }

    saveOutput(
      output
    );
  }

  console.log(
    "\n============================================================"
  );

  console.log(
    `SUCCÈS : ${success}`
  );

  console.log(
    `ERREURS : ${errors}`
  );

  console.log(
    `IGNORÉS : ${skipped}`
  );

  console.log(
    `SORTIE : ${OUTPUT_PATH}`
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
