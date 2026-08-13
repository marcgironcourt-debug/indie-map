import fs from "node:fs";
import dotenv from "dotenv";
import OpenAI from "openai";
import {
  localSearch,
  type SearchPlace,
} from "../src/lib/placeSearch";

dotenv.config({ path: ".env.local" });

const MODEL = "text-embedding-3-small";

type Cache = {
  model: string;
  entries: Array<{
    id: string;
    embedding: number[];
  }>;
};

type IntentDef = {
  name: string;
  prototype: string;
  canonical: string;
};

type ContextDef = {
  name: string;
  prototype: string;
  canonical: string;
  mode: "hard" | "soft";
  categoryHint?: string;
};

const INTENTS: IntentDef[] = [
  {
    name: "bar",
    prototype:
      "boire quelque chose, prendre un verre, boire un coup, apéro, bar, pub, bière, vin, cocktail",
    canonical: "boire un verre",
  },
  {
    name: "eat",
    prototype:
      "manger, déjeuner, dîner, prendre un repas, aller manger, restaurant",
    canonical: "manger",
  },
  {
    name: "quick_food",
    prototype:
      "manger rapidement, manger sur le pouce, snack, repas rapide, quick bite, grab a bite",
    canonical: "manger sur le pouce",
  },
  {
    name: "cafe",
    prototype:
      "prendre un café, boire un café, café, coffee shop, prendre un thé, goûter",
    canonical: "boire un cafe",
  },
  {
    name: "work_cafe",
    prototype:
      "travailler dans un café, travailler avec un ordinateur, laptop, endroit pour travailler",
    canonical: "boire un cafe",
  },
  {
    name: "groceries",
    prototype:
      "faire les courses, acheter des produits alimentaires, épicerie, marché, produits locaux",
    canonical: "faire les courses",
  },
  {
    name: "direct_producer",
    prototype:
      "acheter directement au producteur, vente directe à la ferme, acheter auprès d un producteur",
    canonical: "vente directe producteur",
  },
  {
    name: "shopping",
    prototype:
      "acheter un objet, faire du shopping, boutique, trouver un cadeau",
    canonical: "cadeau",
  },
  {
    name: "bakery",
    prototype:
      "acheter du pain, boulangerie, viennoiserie, pâtisserie",
    canonical: "pain",
  },
  {
    name: "culture",
    prototype:
      "voir une exposition, culture, galerie, art, concert, lieu culturel",
    canonical: "expo",
  },
  {
    name: "workshop",
    prototype:
      "participer à un atelier, apprendre, réparer, faire un cours, workshop",
    canonical: "faire un atelier",
  },
];

const CONTEXTS: ContextDef[] = [
  {
    name: "vegan",
    prototype: "vegan, végétalien, alimentation entièrement végétale",
    canonical: "vegan",
    mode: "hard",
  },
  {
    name: "gluten_free",
    prototype: "sans gluten, gluten free",
    canonical: "sans gluten",
    mode: "hard",
  },
  {
    name: "vegetarian",
    prototype: "végétarien, sans viande",
    canonical: "vegetarien",
    mode: "hard",
  },
  {
    name: "organic",
    prototype: "bio, biologique, organic",
    canonical: "bio",
    mode: "hard",
  },
  {
    name: "local_products",
    prototype:
      "produits locaux, producteurs locaux, alimentation locale, produits du territoire",
    canonical: "produits locaux",
    mode: "hard",
  },
  {
    name: "zero_waste",
    prototype:
      "zéro déchet, lutter contre le gaspillage, anti gaspi, éviter le gaspillage",
    canonical: "zero dechet",
    mode: "hard",
  },
  {
    name: "ethical_fashion",
    prototype:
      "vêtements responsables, mode éthique, mode responsable, habillement durable",
    canonical: "mode ethique",
    mode: "hard",
    categoryHint: "boutique",
  },
  {
    name: "second_hand",
    prototype:
      "seconde main, friperie, vêtements d occasion, vintage, réemploi",
    canonical: "seconde main",
    mode: "hard",
  },
  {
    name: "craft",
    prototype:
      "artisanat, fait par des artisans, fabrication artisanale, fait main",
    canonical: "artisanat",
    mode: "soft",
    categoryHint: "boutique",
  },
  {
    name: "independent",
    prototype:
      "indépendant, créateurs indépendants, commerce indépendant",
    canonical: "independant",
    mode: "soft",
  },
  {
    name: "rooftop",
    prototype: "rooftop, bar sur un toit, terrasse sur un toit",
    canonical: "rooftop",
    mode: "hard",
  },
  {
    name: "terrace",
    prototype:
      "terrasse, boire dehors, manger dehors, outdoor seating",
    canonical: "terrasse",
    mode: "hard",
  },
  {
    name: "quiet",
    prototype:
      "calme, tranquille, paisible, endroit où lire au calme",
    canonical: "calme",
    mode: "soft",
  },
  {
    name: "romantic",
    prototype:
      "romantique, intimiste, rendez vous amoureux, restaurant pour un date",
    canonical: "romantique",
    mode: "soft",
  },
  {
    name: "inclusive",
    prototype:
      "inclusif, insertion, emploi de personnes en situation de handicap",
    canonical: "inclusif",
    mode: "hard",
  },
  {
    name: "brittany",
    prototype:
      "Bretagne, Breizh, breton, bretonne, produits bretons",
    canonical: "bretagne",
    mode: "hard",
  },
];

const EXTRA_CONTEXT_META: Record<
  string,
  { canonical: string; mode: "hard" | "soft"; categoryHint?: string }
> = {
  quick_food: {
    canonical: "manger sur le pouce",
    mode: "soft",
  },
  work_friendly: {
    canonical: "",
    mode: "soft",
  },
  cozy: {
    canonical: "",
    mode: "soft",
  },
  family: {
    canonical: "",
    mode: "soft",
  },
  sustainable: {
    canonical: "",
    mode: "soft",
  },
  craft: {
    canonical: "artisanat",
    mode: "soft",
    categoryHint: "boutique",
  },
  independent: {
    canonical: "",
    mode: "soft",
  },
  beer: {
    canonical: "biere",
    mode: "hard",
  },
  wine: {
    canonical: "vin",
    mode: "hard",
  },
  cocktail: {
    canonical: "cocktail",
    mode: "hard",
  },
  creperie: {
    canonical: "creperie",
    mode: "hard",
  },
  pastry: {
    canonical: "patisserie",
    mode: "hard",
  },
  repair: {
    canonical: "reparation",
    mode: "hard",
  },
  workshop: {
    canonical: "atelier",
    mode: "hard",
  },
  art_culture: {
    canonical: "",
    mode: "soft",
  },
  garden: {
    canonical: "jardin",
    mode: "hard",
  },
  homemade: {
    canonical: "fait maison",
    mode: "hard",
  },
  seasonal: {
    canonical: "de saison",
    mode: "hard",
  },
  short_supply: {
    canonical: "circuit court",
    mode: "hard",
  },
  direct_producer: {
    canonical: "vente directe producteur",
    mode: "hard",
  },
  bulk: {
    canonical: "vrac",
    mode: "hard",
  },
};

const GENERIC = new Set([
  "endroit",
  "sympa",
  "quelque",
  "chose",
  "truc",
  "coin",
  "spot",
  "genre",
]);

const QUERIES = [
  "ou boire un coup à sydney",
  "un endroit où boire quelque chose à Sydney",
  "un endroit sympa pour prendre l'apéro à Sydney",

  "je veux manger vers coogee",
  "un endroit où manger près de Coogee",

  "je veux manger rapidement à Paris",
  "un truc à manger sur le pouce à Paris",

  "un café tranquille où lire à Paris",
  "un endroit calme pour travailler avec mon ordinateur à Paris",

  "restaurant vegan à Sydney",
  "café sans gluten à Sydney",

  "trouve moi un snack porte maillot paris",
  "où manger près de Porte Maillot",

  "un bar sur un toit à Sydney",
  "bar avec terrasse à Sydney",

  "restaurant romantique à Paris",
  "un restaurant intimiste pour un date à Paris",

  "des vêtements responsables à Paris",
  "boutique de seconde main à Paris",

  "artisanat indépendant à Paris",
  "un cadeau fabriqué par un artisan à Paris",

  "un endroit engagé contre le gaspillage à Paris",

  "où boire une bière locale à Sydney",

  "où acheter directement à un producteur",

  "restaurant inclusif à Bois-Colombes",

  "une crêperie avec des produits bretons à Paris",

  "Food breizh",
  "Maison nouvelle",
];

const places = JSON.parse(
  fs.readFileSync("data/places.json", "utf8")
) as SearchPlace[];

const cache = JSON.parse(
  fs.readFileSync(
    "data/private/search-embeddings-v1.json",
    "utf8"
  )
) as Cache;

const placeById = new Map(
  places.map((place) => [place.id, place])
);

const vectorByPlaceId = new Map(
  cache.entries.map((entry) => [
    entry.id,
    entry.embedding,
  ])
);

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cosine(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }

  if (!na || !nb) return 0;

  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function levenshtein(a: string, b: string) {
  const prev = Array.from(
    { length: b.length + 1 },
    (_, i) => i
  );

  const curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] +
          (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }

    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length];
}

const locationWords = new Set<string>();

for (const place of places) {
  const text = normalize([
    place.name,
    place.city,
    place.country,
    place.address,
  ].filter(Boolean).join(" "));

  for (const word of text.split(/\s+/)) {
    if (word.length >= 3) {
      locationWords.add(word);
    }
  }
}

function looksLikeKnownLocationToken(token: string) {
  const t = normalize(token);

  if (locationWords.has(t)) return true;
  if (t.length < 5) return false;

  for (const word of locationWords) {
    if (word.length < 5) continue;
    if (word.slice(0, 2) !== t.slice(0, 2)) continue;

    const max = Math.max(word.length, t.length) >= 8
      ? 2
      : 1;

    if (levenshtein(t, word) <= max) {
      return true;
    }
  }

  return false;
}

function semanticWinner(
  scores: Array<{ name: string; score: number }>,
  minScore: number,
  minGap: number
) {
  const first = scores[0];
  const second = scores[1];

  if (!first) return null;

  const gap =
    first.score - (second?.score ?? 0);

  if (
    first.score < minScore ||
    gap < minGap
  ) {
    return null;
  }

  return first;
}

function canonicalIntentFromLocal(
  local: ReturnType<typeof localSearch>
) {
  if (local.explicitCategory) {
    return local.explicitCategory;
  }

  const categories = new Set(
    local.targetCategories
  );

  if (categories.has("bar")) {
    return "boire un verre";
  }

  if (categories.has("restaurant")) {
    return "manger";
  }

  if (
    categories.size === 1 &&
    categories.has("cafe")
  ) {
    return "boire un cafe";
  }

  if (
    categories.has("epicerie") ||
    categories.has("marche") ||
    categories.has("ferme")
  ) {
    return "faire les courses";
  }

  if (categories.has("boulangerie")) {
    return "pain";
  }

  if (
    categories.has("boutique") ||
    categories.has("librairie")
  ) {
    return "cadeau";
  }

  if (
    categories.has("atelier") ||
    categories.has("alternatif")
  ) {
    return "expo";
  }

  return "";
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY absente");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const texts = [
    ...INTENTS.map((item) => item.prototype),
    ...CONTEXTS.map((item) => item.prototype),
    ...QUERIES,
  ];

  const response = await openai.embeddings.create({
    model: MODEL,
    input: texts,
  });

  const vectors = [...response.data]
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);

  const intentVectors = vectors.slice(
    0,
    INTENTS.length
  );

  const contextStart = INTENTS.length;
  const queryStart =
    INTENTS.length + CONTEXTS.length;

  const contextVectors = vectors.slice(
    contextStart,
    queryStart
  );

  const queryVectors = vectors.slice(
    queryStart
  );

  for (
    let queryIndex = 0;
    queryIndex < QUERIES.length;
    queryIndex += 1
  ) {
    const query = QUERIES[queryIndex];
    const queryVector =
      queryVectors[queryIndex];

    const local = localSearch(
      query,
      places
    );

    const intentScores = INTENTS
      .map((item, i) => ({
        name: item.name,
        score: cosine(
          queryVector,
          intentVectors[i]
        ),
      }))
      .sort(
        (a, b) => b.score - a.score
      );

    const contextScores = CONTEXTS
      .map((item, i) => ({
        name: item.name,
        score: cosine(
          queryVector,
          contextVectors[i]
        ),
      }))
      .sort(
        (a, b) => b.score - a.score
      );

    const semanticIntent =
      semanticWinner(
        intentScores,
        0.40,
        0.05
      );

    const semanticContext =
      semanticWinner(
        contextScores,
        0.50,
        0.05
      );

    /*
     * Le déterministe gagne normalement.
     * Une intention sémantique très forte peut seulement
     * préciser une intention plus générale.
     */
    let intentCanonical =
      canonicalIntentFromLocal(local);

    if (
      !intentCanonical &&
      semanticIntent
    ) {
      intentCanonical =
        INTENTS.find(
          (item) =>
            item.name === semanticIntent.name
        )?.canonical || "";
    }

    if (
      semanticIntent &&
      semanticIntent.score >= 0.50 &&
      (
        semanticIntent.name === "quick_food" ||
        semanticIntent.name === "work_cafe" ||
        semanticIntent.name === "direct_producer"
      )
    ) {
      intentCanonical =
        INTENTS.find(
          (item) =>
            item.name === semanticIntent.name
        )?.canonical ||
        intentCanonical;
    }

    const detectedContextNames =
      local.detectedConcepts || [];

    const hardContextParts: string[] = [];
    const softContextNames: string[] = [];
    const categoryHints: string[] = [];

    for (
      const name of detectedContextNames
    ) {
      const semanticDef =
        CONTEXTS.find(
          (item) => item.name === name
        );

      const meta =
        semanticDef ||
        (
          EXTRA_CONTEXT_META[name]
            ? {
                name,
                prototype: "",
                ...EXTRA_CONTEXT_META[name],
              }
            : null
        );

      if (!meta) continue;

      if (meta.mode === "hard") {
        if (meta.canonical) {
          hardContextParts.push(
            meta.canonical
          );
        }
      } else {
        softContextNames.push(name);
      }

      if (meta.categoryHint) {
        categoryHints.push(
          meta.categoryHint
        );
      }
    }

    if (
      semanticContext &&
      !detectedContextNames.includes(
        semanticContext.name
      )
    ) {
      const def =
        CONTEXTS.find(
          (item) =>
            item.name ===
            semanticContext.name
        );

      if (def) {
        if (def.mode === "hard") {
          hardContextParts.push(
            def.canonical
          );
        } else {
          softContextNames.push(
            def.name
          );
        }

        if (def.categoryHint) {
          categoryHints.push(
            def.categoryHint
          );
        }
      }
    }

    const rawMeaningful =
      local.meaningfulTokens || [];

    const locationTokens =
      rawMeaningful.filter(
        (token) =>
          looksLikeKnownLocationToken(
            token
          )
      );

    const unresolved =
      rawMeaningful.filter(
        (token) =>
          !GENERIC.has(normalize(token)) &&
          !locationTokens.includes(token)
      );

    /*
     * Si une partie ressemble à une localisation connue
     * mais qu'une autre partie de cette localisation reste
     * inconnue, on ne l'ignore surtout pas.
     *
     * Exemple : Porte Maillot.
     */
    const unresolvedLocation =
      locationTokens.length > 0 &&
      unresolved.length > 0;

    /*
     * Requête qui ressemble uniquement à un nom/adresse
     * inconnu : on conserve le zéro du déterministe.
     */
    const unknownEntity =
      local.searchMode === "entity_v2" &&
      local.results.length === 0 &&
      !semanticIntent &&
      !semanticContext;

    let candidates: SearchPlace[] = [];
    let decision = "";

    if (
      unresolvedLocation ||
      unknownEntity
    ) {
      decision =
        unresolvedLocation
          ? "BLOCK_UNRESOLVED_LOCATION"
          : "BLOCK_UNKNOWN_ENTITY";
    } else {
      const canonicalParts = [
        intentCanonical,
        ...categoryHints,
        ...hardContextParts,
        local.detectedCity || "",
        ...locationTokens,
      ].filter(Boolean);

      const canonicalQuery =
        canonicalParts.join(" ");

      /*
       * On reconstruit un pool propre lorsque :
       * - l'ancien moteur donne zéro,
       * - il donne beaucoup trop de résultats,
       * - ou il y a un contexte sémantique / subjectif.
       */
      const shouldRebuild =
        local.results.length === 0 ||
        local.results.length > 12 ||
        Boolean(semanticContext) ||
        softContextNames.length > 0;

      if (
        shouldRebuild &&
        canonicalQuery
      ) {
        const rebuilt =
          localSearch(
            canonicalQuery,
            places
          );

        candidates =
          rebuilt.results;

        decision =
          `REBUILT:${canonicalQuery}`;
      } else {
        candidates =
          local.results;

        decision = "LOCAL_POOL";
      }

      /*
       * Pour les préférences subjectives, le contexte
       * ne doit pas être un filtre dur.
       *
       * Si le pool reconstruit est vide, on retire donc
       * uniquement les contextes soft et on garde
       * catégorie + ville.
       */
      if (
        candidates.length === 0 &&
        softContextNames.length > 0
      ) {
        const fallbackParts = [
          intentCanonical,
          ...categoryHints,
          local.detectedCity || "",
          ...locationTokens,
        ].filter(Boolean);

        if (fallbackParts.length > 0) {
          const fallback =
            localSearch(
              fallbackParts.join(" "),
              places
            );

          candidates =
            fallback.results;

          decision +=
            ` -> SOFT_POOL:${fallbackParts.join(" ")}`;
        }
      }
    }

    const softVectors: number[][] = [];

    for (const name of softContextNames) {
      const index =
        CONTEXTS.findIndex(
          (item) => item.name === name
        );

      if (index >= 0) {
        softVectors.push(
          contextVectors[index]
        );
      }
    }

    const ranked = candidates
      .map((place) => {
        const vector =
          vectorByPlaceId.get(place.id);

        if (!vector) return null;

        const queryScore =
          cosine(
            queryVector,
            vector
          );

        let contextScore = 0;

        if (softVectors.length > 0) {
          contextScore =
            softVectors.reduce(
              (sum, contextVector) =>
                sum +
                cosine(
                  contextVector,
                  vector
                ),
              0
            ) / softVectors.length;
        }

        const finalScore =
          softVectors.length > 0
            ? queryScore * 0.7 +
              contextScore * 0.3
            : queryScore;

        return {
          place,
          queryScore,
          contextScore,
          finalScore,
        };
      })
      .filter(
        (
          item
        ): item is NonNullable<typeof item> =>
          item !== null
      )
      .sort(
        (a, b) =>
          b.finalScore -
          a.finalScore
      );

    console.log("");
    console.log(
      "=================================================="
    );
    console.log("QUERY:", query);

    console.log(
      "LOCAL:",
      local.searchMode,
      local.results.length
    );

    console.log(
      "SEM INTENT:",
      semanticIntent
        ? `${semanticIntent.name} ${semanticIntent.score.toFixed(4)}`
        : "—"
    );

    console.log(
      "SEM CONTEXT:",
      semanticContext
        ? `${semanticContext.name} ${semanticContext.score.toFixed(4)}`
        : "—"
    );

    console.log(
      "DECISION:",
      decision
    );

    console.log(
      "CANDIDATS:",
      candidates.length
    );

    console.log("TOP:");

    for (
      let i = 0;
      i < Math.min(6, ranked.length);
      i += 1
    ) {
      const item = ranked[i];

      console.log(
        ` ${i + 1}. ${item.place.name} [${item.place.city || "?"}] — ${item.finalScore.toFixed(4)}`
      );
    }

    if (ranked.length === 0) {
      console.log(" —");
    }
  }

  console.log("");
  console.log(
    "TOKENS FACTURÉS :",
    response.usage?.total_tokens ?? "—"
  );
}

main().catch((error) => {
  console.error(
    "ERREUR :",
    error?.message || error
  );
  process.exit(1);
});
