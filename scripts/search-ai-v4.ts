import fs from "node:fs";
import dotenv from "dotenv";
import OpenAI from "openai";
import {
  localSearch,
  type SearchPlace,
} from "../src/lib/placeSearch";

dotenv.config({ path: ".env.local" });

const EMBEDDING_MODEL = "text-embedding-3-small";
const JUDGE_MODEL = "gpt-5-nano";

const SEMANTIC_CANDIDATES = 35;
const FINAL_CANDIDATES = 24;
const MAX_RESULTS = 8;

type Place = SearchPlace & {
  openingHours?: unknown;
  website?: string;
  phone?: string;
};

type Cache = {
  model: string;
  entries: Array<{
    id: string;
    embedding: number[];
  }>;
};

type ParsedQuery = {
  need: string;
  city: string;
  country: string;
  location: string;
  entity: string;
  dateTime: string;
  partySize: string;
  budget: string;
  mobility: string;
  mustHave: string[];
  prefer: string[];
  avoid: string[];
};

type RankedResult = {
  id: string;
  fit: number;
  reason: string;
};

type SearchResult = {
  query: string;
  parsed: ParsedQuery;
  resolvedCity: string;
  resolvedCountry: string;
  retrievalCount: number;
  noGoodMatch: boolean;
  results: Array<{
    id: string;
    name: string;
    city: string;
    category: string;
    fit: number;
    reason: string;
  }>;
};

const places = JSON.parse(
  fs.readFileSync("data/places.json", "utf8")
) as Place[];

const cache = JSON.parse(
  fs.readFileSync(
    "data/private/search-embeddings-v1.json",
    "utf8"
  )
) as Cache;

if (cache.model !== EMBEDDING_MODEL) {
  throw new Error(
    `Cache ${cache.model}, attendu ${EMBEDDING_MODEL}`
  );
}

const vectorById = new Map(
  cache.entries.map((entry) => [
    String(entry.id),
    entry.embedding,
  ])
);

const placeById = new Map(
  places.map((place) => [
    String(place.id),
    place,
  ])
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let embeddingTokens = 0;
let llmInputTokens = 0;
let llmOutputTokens = 0;

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function short(value: unknown, max = 500) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > max
    ? text.slice(0, max) + "…"
    : text;
}

function levenshtein(a: string, b: string) {
  const prev = Array.from(
    { length: b.length + 1 },
    (_, i) => i
  );

  const curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;

    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] +
          (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }

    for (let j = 0; j <= b.length; j++) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length];
}

function cosine(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }

  if (!na || !nb) return 0;

  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function retry<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      const status = error?.status;

      if (
        status &&
        status < 500 &&
        status !== 429
      ) {
        throw error;
      }

      if (attempt < 3) {
        console.error(
          `${label}: tentative ${attempt} échouée, nouvel essai…`
        );

        await new Promise((resolve) =>
          setTimeout(resolve, attempt * 1000)
        );
      }
    }
  }

  throw lastError;
}

const cityNames = [
  ...new Set(
    places
      .map((place) => String(place.city ?? "").trim())
      .filter(Boolean)
  ),
];

const countryNames = [
  ...new Set(
    places
      .map((place) => String(place.country ?? "").trim())
      .filter(Boolean)
  ),
];

function resolveKnownValue(
  requested: string,
  knownValues: string[]
) {
  const wanted = normalize(requested);

  if (!wanted) return "";

  const exact = knownValues.find(
    (value) => normalize(value) === wanted
  );

  if (exact) return exact;

  if (wanted.length < 5) return "";

  const fuzzy = knownValues
    .map((value) => {
      const normalized = normalize(value);

      return {
        value,
        distance: levenshtein(
          wanted,
          normalized
        ),
      };
    })
    .filter((item) => {
      const maxLength = Math.max(
        wanted.length,
        normalize(item.value).length
      );

      const maxDistance =
        maxLength >= 9 ? 2 : 1;

      return item.distance <= maxDistance;
    })
    .sort(
      (a, b) =>
        a.distance - b.distance
    );

  if (
    fuzzy.length === 1 ||
    (
      fuzzy.length > 1 &&
      fuzzy[0].distance <
        fuzzy[1].distance
    )
  ) {
    return fuzzy[0].value;
  }

  return "";
}

async function parseQuery(
  query: string
): Promise<ParsedQuery> {
  const response = await retry(
    "PARSE",
    () =>
      openai.responses.create({
        model: JUDGE_MODEL,
        reasoning: {
          effort: "minimal",
        },
        store: false,

        input: [
          {
            role: "system",
            content: `
Tu es le module de compréhension de recherche d'Indie Map.

Analyse librement la demande de l'utilisateur.
Tu EXTRAIS son intention : tu ne recherches aucun lieu
et tu ne dois pas forcer la demande dans des catégories prédéfinies.

Les champs sont du texte libre.

need:
résume précisément ce que la personne cherche.

city:
ville explicitement demandée, sinon chaîne vide.

country:
pays explicitement demandé, sinon chaîne vide.

location:
quartier, rue, adresse, plage, zone, région ou point géographique
plus précis que la ville, sinon chaîne vide.

entity:
nom supposé d'un lieu/commerce/adresse précis si la personne
semble rechercher une entité particulière. Sinon chaîne vide.

dateTime:
toute contrainte temporelle explicite :
date, jour, heure, "ce soir", "dimanche matin", etc.
Sinon chaîne vide.

partySize:
nombre/type de personnes explicitement indiqué.
Sinon chaîne vide.

budget:
contrainte de budget/prix explicite.
Sinon chaîne vide.

mobility:
contrainte ou préférence de déplacement explicite.
Sinon chaîne vide.

mustHave:
conditions indispensables explicitement demandées ou
très fortement impliquées.

prefer:
préférences souples.

avoid:
éléments explicitement refusés.

IMPORTANT :
- Ne transforme jamais "local", "artisan", "romantique",
  "calme", etc. en géographie.
- N'invente aucune contrainte absente.
- Garde les nuances de la demande.
- Français, anglais et langage familier sont acceptés.
            `.trim(),
          },
          {
            role: "user",
            content: query,
          },
        ],

        text: {
          format: {
            type: "json_schema",
            name: "indie_map_query_understanding",
            strict: true,
            schema: {
              type: "object",
              properties: {
                need: {
                  type: "string",
                },
                city: {
                  type: "string",
                },
                country: {
                  type: "string",
                },
                location: {
                  type: "string",
                },
                entity: {
                  type: "string",
                },
                dateTime: {
                  type: "string",
                },
                partySize: {
                  type: "string",
                },
                budget: {
                  type: "string",
                },
                mobility: {
                  type: "string",
                },
                mustHave: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                },
                prefer: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                },
                avoid: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                },
              },
              required: [
                "need",
                "city",
                "country",
                "location",
                "entity",
                "dateTime",
                "partySize",
                "budget",
                "mobility",
                "mustHave",
                "prefer",
                "avoid",
              ],
              additionalProperties: false,
            },
          },
        },
      })
  );

  llmInputTokens +=
    response.usage?.input_tokens || 0;

  llmOutputTokens +=
    response.usage?.output_tokens || 0;

  if (!response.output_text) {
    throw new Error(
      "Parseur : réponse vide"
    );
  }

  return JSON.parse(
    response.output_text
  ) as ParsedQuery;
}

async function embedQuery(
  query: string
) {
  const response = await retry(
    "EMBED",
    () =>
      openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: query,
      })
  );

  embeddingTokens +=
    response.usage?.total_tokens || 0;

  return response.data[0].embedding;
}

function lexicalEntityScore(
  place: Place,
  entity: string
) {
  const wanted = normalize(entity);

  if (!wanted) return 0;

  const name = normalize(place.name);
  const address = normalize(place.address);

  if (name === wanted) return 1;

  if (
    name.includes(wanted) ||
    wanted.includes(name)
  ) {
    return 0.92;
  }

  if (
    address.includes(wanted)
  ) {
    return 0.9;
  }

  if (
    wanted.length >= 5 &&
    name.length >= 5
  ) {
    const distance =
      levenshtein(name, wanted);

    const maxLength = Math.max(
      name.length,
      wanted.length
    );

    if (
      distance <=
      (maxLength >= 12 ? 2 : 1)
    ) {
      return 0.82;
    }
  }

  const wantedTokens =
    wanted.split(" ").filter(Boolean);

  const nameTokens =
    new Set(
      name.split(" ").filter(Boolean)
    );

  const overlap =
    wantedTokens.filter((token) =>
      nameTokens.has(token)
    ).length;

  if (
    wantedTokens.length >= 2 &&
    overlap === wantedTokens.length
  ) {
    return 0.8;
  }

  return 0;
}

function locationTextMatch(
  place: Place,
  location: string
) {
  const wanted = normalize(location);

  if (!wanted) return false;

  const haystack = normalize(
    [
      place.name,
      place.city,
      place.country,
      place.address,
      place.miniText,
    ]
      .filter(Boolean)
      .join(" ")
  );

  return haystack.includes(wanted);
}

function placeForJudge(place: Place) {
  return {
    id: String(place.id),
    name: place.name || "",
    category: place.category || "",
    city: place.city || "",
    country: place.country || "",
    address: place.address || "",
    tags: Array.isArray(place.tags)
      ? place.tags
      : [],
    description: short(
      place.miniText,
      500
    ),
    contextNear: short(
      place.homeTextNear,
      450
    ),
    contextFar: short(
      place.homeTextFar,
      450
    ),
    openingHours:
      place.openingHours ?? null,
  };
}

async function rerank(
  query: string,
  parsed: ParsedQuery,
  candidates: Place[],
  resolvedCity: string,
  resolvedCountry: string
) {
  if (candidates.length === 0) {
    return {
      noGoodMatch: true,
      ranked: [] as RankedResult[],
    };
  }

  const ids = candidates.map(
    (place) => String(place.id)
  );

  const response = await retry(
    "RERANK",
    () =>
      openai.responses.create({
        model: JUDGE_MODEL,
        reasoning: {
          effort: "minimal",
        },
        store: false,

        input: [
          {
            role: "system",
            content: `
Tu es le juge de pertinence d'Indie Map.

Tu reçois :
1. la recherche originale ;
2. sa compréhension structurée ;
3. une liste fermée de lieux Indie Map.

Tu n'as PAS le droit d'inventer un lieu.
Tu n'as PAS le droit d'inventer une propriété d'un lieu.
Tu ne peux sélectionner que les IDs fournis.

OBJECTIF :
déterminer quels candidats répondent réellement à la demande,
puis les classer.

RÈGLES :
- Les exigences mustHave sont indispensables.
- Les préférences prefer améliorent le classement mais ne sont
  pas obligatoires.
- Les éléments avoid doivent être respectés.
- Une caractéristique factuelle comme vegan, sans gluten,
  terrasse, accessibilité, horaires ou prix doit être appuyée
  par les données du candidat.
- Si une donnée nécessaire n'est pas fournie, considère-la
  comme inconnue et ne l'invente pas.
- Pour une recherche de nom/entity, exige une correspondance
  réellement plausible avec le nom ou l'adresse.
- Si une ville a été résolue, tous les candidats ont déjà été
  limités à cette ville.
- Une location plus précise (quartier/rue/etc.) n'est PAS
  géocodée dans ce prototype. Ne prétends jamais qu'un lieu
  est "près de" cette zone si les données fournies ne
  permettent pas de l'établir.
- Une demande d'événement actuel (concert ce soir,
  vernissage demain, etc.) ne peut être satisfaite par un
  simple lieu si aucune programmation correspondante n'est
  présente dans les données.
- Mieux vaut zéro résultat qu'un faux résultat.

ÉCHELLE fit :
90-100 = correspondance exceptionnelle/directe
75-89 = très bonne correspondance
60-74 = correspondance utile mais partielle
moins de 60 = ne pas retourner

Retourne au maximum 8 résultats et uniquement fit >= 60.

Si aucun candidat n'atteint 60 :
noGoodMatch=true et ranked=[].
            `.trim(),
          },
          {
            role: "user",
            content: JSON.stringify({
              query,
              understanding: parsed,
              resolvedCity,
              resolvedCountry,
              candidates:
                candidates.map(
                  placeForJudge
                ),
            }),
          },
        ],

        text: {
          format: {
            type: "json_schema",
            name: "indie_map_ranking",
            strict: true,
            schema: {
              type: "object",
              properties: {
                noGoodMatch: {
                  type: "boolean",
                },
                ranked: {
                  type: "array",
                  maxItems: MAX_RESULTS,
                  items: {
                    type: "object",
                    properties: {
                      id: {
                        type: "string",
                        enum: ids,
                      },
                      fit: {
                        type: "integer",
                        minimum: 60,
                        maximum: 100,
                      },
                      reason: {
                        type: "string",
                      },
                    },
                    required: [
                      "id",
                      "fit",
                      "reason",
                    ],
                    additionalProperties: false,
                  },
                },
              },
              required: [
                "noGoodMatch",
                "ranked",
              ],
              additionalProperties: false,
            },
          },
        },
      })
  );

  llmInputTokens +=
    response.usage?.input_tokens || 0;

  llmOutputTokens +=
    response.usage?.output_tokens || 0;

  if (!response.output_text) {
    throw new Error(
      "Reranker : réponse vide"
    );
  }

  return JSON.parse(
    response.output_text
  ) as {
    noGoodMatch: boolean;
    ranked: RankedResult[];
  };
}

async function searchV4(
  query: string
): Promise<SearchResult> {
  const parsed =
    await parseQuery(query);

  const resolvedCity =
    resolveKnownValue(
      parsed.city,
      cityNames
    );

  const resolvedCountry =
    resolveKnownValue(
      parsed.country,
      countryNames
    );

  /*
   * Si l'utilisateur demande explicitement une ville
   * qui n'existe pas dans le catalogue, on ne remplace
   * surtout pas cette ville par une autre.
   *
   * Plus tard, le géocodeur permettra d'aller plus loin.
   */
  if (
    parsed.city &&
    !resolvedCity
  ) {
    return {
      query,
      parsed,
      resolvedCity: "",
      resolvedCountry,
      retrievalCount: 0,
      noGoodMatch: true,
      results: [],
    };
  }

  let universe = places;

  if (resolvedCity) {
    universe = universe.filter(
      (place) =>
        normalize(place.city) ===
        normalize(resolvedCity)
    );
  } else if (resolvedCountry) {
    universe = universe.filter(
      (place) =>
        normalize(place.country) ===
        normalize(resolvedCountry)
    );
  }

  const queryVector =
    await embedQuery(query);

  const retrievalScores =
    new Map<string, number>();

  const semantic = universe
    .map((place) => {
      const vector =
        vectorById.get(
          String(place.id)
        );

      if (!vector) {
        return null;
      }

      let score =
        cosine(
          queryVector,
          vector
        );

      if (
        parsed.location &&
        locationTextMatch(
          place,
          parsed.location
        )
      ) {
        score += 0.12;
      }

      const entityScore =
        lexicalEntityScore(
          place,
          parsed.entity
        );

      if (entityScore > 0) {
        score +=
          entityScore * 0.25;
      }

      return {
        place,
        score,
      };
    })
    .filter(
      (
        item
      ): item is {
        place: Place;
        score: number;
      } => item !== null
    )
    .sort(
      (a, b) =>
        b.score - a.score
    )
    .slice(
      0,
      SEMANTIC_CANDIDATES
    );

  for (const item of semantic) {
    retrievalScores.set(
      String(item.place.id),
      item.score
    );
  }

  /*
   * V2.2 n'est plus le cerveau.
   * On l'utilise seulement comme filet de sécurité
   * pour ne pas perdre une correspondance lexicale
   * évidente de nom/adresse/catégorie.
   */
  const deterministic =
    localSearch(
      query,
      places
    ).results
      .filter((place) => {
        if (resolvedCity) {
          return (
            normalize(place.city) ===
            normalize(resolvedCity)
          );
        }

        if (resolvedCountry) {
          return (
            normalize(place.country) ===
            normalize(
              resolvedCountry
            )
          );
        }

        return true;
      })
      .slice(0, 15);

  for (const place of deterministic) {
    const id =
      String(place.id);

    const current =
      retrievalScores.get(id) || 0;

    retrievalScores.set(
      id,
      Math.max(current, 0.5)
    );
  }

  /*
   * Recherche spécifique de nom :
   * on ajoute aussi les correspondances lexicales
   * indépendamment du classement embeddings.
   */
  if (parsed.entity) {
    for (const place of universe) {
      const score =
        lexicalEntityScore(
          place,
          parsed.entity
        );

      if (score > 0) {
        const id =
          String(place.id);

        const current =
          retrievalScores.get(id) || 0;

        retrievalScores.set(
          id,
          Math.max(
            current,
            0.55 + score * 0.2
          )
        );
      }
    }
  }

  const candidates =
    [...retrievalScores.entries()]
      .map(([id, score]) => ({
        place: placeById.get(id),
        score,
      }))
      .filter(
        (
          item
        ): item is {
          place: Place;
          score: number;
        } => Boolean(item.place)
      )
      .sort(
        (a, b) =>
          b.score - a.score
      )
      .slice(
        0,
        FINAL_CANDIDATES
      )
      .map(
        (item) => item.place
      );

  const judged =
    await rerank(
      query,
      parsed,
      candidates,
      resolvedCity,
      resolvedCountry
    );

  const seen =
    new Set<string>();

  const results =
    judged.ranked
      .filter((item) => {
        if (seen.has(item.id)) {
          return false;
        }

        seen.add(item.id);

        return placeById.has(
          item.id
        );
      })
      .map((item) => {
        const place =
          placeById.get(item.id)!;

        return {
          id: item.id,
          name:
            String(
              place.name ?? ""
            ),
          city:
            String(
              place.city ?? ""
            ),
          category:
            String(
              place.category ?? ""
            ),
          fit: item.fit,
          reason: item.reason,
        };
      });

  return {
    query,
    parsed,
    resolvedCity,
    resolvedCountry,
    retrievalCount:
      candidates.length,
    noGoodMatch:
      results.length === 0 ||
      judged.noGoodMatch,
    results,
  };
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY absente"
    );
  }

  const file =
    process.argv[2];

  if (!file) {
    console.error(
      "Usage: pnpm exec tsx scripts/search-ai-v4.ts <fichier.json>"
    );
    process.exit(1);
  }

  const queries =
    JSON.parse(
      fs.readFileSync(
        file,
        "utf8"
      )
    ) as string[];

  const output: SearchResult[] = [];

  console.log(
    "=== INDIE MAP AI SEARCH V4 ==="
  );
  console.log(
    "REQUÊTES :",
    queries.length
  );

  for (
    let i = 0;
    i < queries.length;
    i++
  ) {
    const query =
      queries[i];

    console.log("");
    console.log(
      "=================================================="
    );
    console.log(
      `[${i + 1}/${queries.length}] ${query}`
    );

    const result =
      await searchV4(query);

    output.push(result);

    console.log(
      "COMPRIS :",
      result.parsed.need
    );

    console.log(
      "VILLE :",
      result.resolvedCity ||
        result.parsed.city ||
        "—"
    );

    console.log(
      "ZONE :",
      result.parsed.location ||
        "—"
    );

    console.log(
      "ENTITÉ :",
      result.parsed.entity ||
        "—"
    );

    console.log(
      "MUST :",
      result.parsed.mustHave.join(
        " | "
      ) || "—"
    );

    console.log(
      "PREF :",
      result.parsed.prefer.join(
        " | "
      ) || "—"
    );

    console.log(
      "TEMPS :",
      result.parsed.dateTime ||
        "—"
    );

    console.log(
      "CANDIDATS :",
      result.retrievalCount
    );

    if (
      result.noGoodMatch ||
      result.results.length === 0
    ) {
      console.log(
        "RÉSULTAT : AUCUN BON MATCH"
      );

      continue;
    }

    console.log("RÉSULTATS :");

    for (
      const [
        index,
        item,
      ] of result.results.entries()
    ) {
      console.log(
        ` ${index + 1}. ${item.name} [${item.city}] — ${item.fit}/100`
      );

      console.log(
        `    ${item.reason}`
      );
    }
  }

  fs.mkdirSync(
    "tmp",
    {
      recursive: true,
    }
  );

  fs.writeFileSync(
    "tmp/search-v4-blind-results.json",
    JSON.stringify(
      output,
      null,
      2
    )
  );

  const embeddingCost =
    embeddingTokens /
    1_000_000 *
    0.02;

  const llmInputCost =
    llmInputTokens /
    1_000_000 *
    0.05;

  const llmOutputCost =
    llmOutputTokens /
    1_000_000 *
    0.40;

  console.log("");
  console.log(
    "=================================================="
  );
  console.log("=== USAGE ===");
  console.log(
    "EMBEDDING TOKENS :",
    embeddingTokens
  );
  console.log(
    "LLM INPUT TOKENS :",
    llmInputTokens
  );
  console.log(
    "LLM OUTPUT TOKENS :",
    llmOutputTokens
  );
  console.log(
    "COÛT ESTIMÉ TOTAL : $",
    (
      embeddingCost +
      llmInputCost +
      llmOutputCost
    ).toFixed(6)
  );
  console.log(
    "RÉSULTATS JSON : tmp/search-v4-blind-results.json"
  );
}

main().catch((error: any) => {
  console.error("");
  console.error(
    "ERREUR V4 :"
  );
  console.error(
    error?.status || ""
  );
  console.error(
    error?.message || error
  );
  process.exit(1);
});
