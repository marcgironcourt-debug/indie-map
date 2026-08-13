import fs from "node:fs";
import dotenv from "dotenv";
import OpenAI from "openai";
import {
  verifyOfficialSiteFact,
  type OfficialVerifierUsage,
  type OfficialVerificationResult,
} from "../src/lib/ai/officialSiteVerifier";
import {
  localSearch,
  type SearchPlace,
} from "../src/lib/placeSearch";

dotenv.config({ path: ".env.local" });

const EMBEDDING_MODEL = "text-embedding-3-small";
const JUDGE_MODEL = "gpt-5.4-nano";

const SEMANTIC_CANDIDATES = 35;
const FINAL_CANDIDATES = 24;
const MAX_RESULTS = 8;
const MAX_VERIFY_CANDIDATES = 6;
const TARGET_ELIGIBLE_CANDIDATES = 6;
const FINAL_MIN_FIT = 70;

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
  entityIsSpecific: boolean;
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


type RequirementCheck = {
  requirement: string;
  status:
    | "confirmed_internal"
    | "needs_verification"
    | "contradicted";
  evidence: string[];
  reason: string;
};

type PreAssessment = {
  id: string;
  coreStatus:
    | "plausible"
    | "rejected";
  coreFit: number;
  reason: string;
  requirementChecks: RequirementCheck[];
};

type SearchResult = {
  query: string;
  parsed: ParsedQuery;
  resolvedCity: string;
  resolvedCountry: string;
  retrievalCount: number;
  debug?: {
    confirmed: number;
    needsVerification: number;
    rejected: number;
    officialChecks: number;
    officialConfirmed: number;
    officialNotFound: number;
    officialContradicted: number;
  };
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

const officialVerifierUsage: OfficialVerifierUsage = {
  httpRequests: 0,
  embeddingTokens: 0,
  llmInputTokens: 0,
  llmOutputTokens: 0,
};

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
          effort: "low",
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
nom supposé d'un lieu, commerce ou adresse PRÉCIS si la
personne semble rechercher cette entité particulière.
Sinon chaîne vide.

entityIsSpecific:
true uniquement si l'utilisateur semble réellement chercher
un nom propre, une enseigne précise ou une adresse précise.

Exemples :
- "un café à Paris" => entity="", entityIsSpecific=false
- "un restaurant à Bois-Colombes" => false
- "une épicerie ouverte dimanche" => false
- "le restaurant Plantxa" => entity="Plantxa", true
- "le resto qui s'appelle peut-être Plantxa" => true
- "1601 Oxford Street Regina" => true

Un nom commun de catégorie comme café, restaurant, ferme,
épicerie, boutique ou librairie n'est JAMAIS une entité précise.

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
                entityIsSpecific: {
                  type: "boolean",
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
                "entityIsSpecific",
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


function internalEvidenceExists(
  place: Place,
  evidence: string
) {
  const wanted = normalize(evidence);

  if (wanted.length < 3) {
    return false;
  }

  const internal = normalize(
    JSON.stringify(
      placeForJudge(place)
    )
  );

  return internal.includes(wanted);
}

function buildHardRequirements(
  parsed: ParsedQuery
) {
  const requirements: string[] = [];

  for (const item of parsed.mustHave) {
    const value =
      String(item || "").trim();

    if (value) {
      requirements.push(value);
    }
  }

  if (
    parsed.dateTime &&
    !requirements.some(
      (item) =>
        normalize(item).includes(
          normalize(parsed.dateTime)
        )
    )
  ) {
    requirements.push(
      `être ouvert ou disponible au moment demandé : ${parsed.dateTime}`
    );
  }

  if (
    parsed.budget &&
    !requirements.some(
      (item) =>
        normalize(item).includes(
          normalize(parsed.budget)
        )
    )
  ) {
    requirements.push(
      `respecter le budget demandé : ${parsed.budget}`
    );
  }

  const seen = new Set<string>();

  return requirements.filter(
    (item) => {
      const key = normalize(item);

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    }
  );
}

async function preJudge(
  query: string,
  parsed: ParsedQuery,
  candidates: Place[],
  resolvedCity: string,
  resolvedCountry: string,
  hardRequirements: string[]
) {
  if (candidates.length === 0) {
    return [] as PreAssessment[];
  }

  const ids = candidates.map(
    (place) => String(place.id)
  );

  const requirementEnum =
    hardRequirements.length > 0
      ? hardRequirements
      : ["__NONE__"];

  const response = await retry(
    "PREJUDGE",
    () =>
      openai.responses.create({
        model: JUDGE_MODEL,

        reasoning: {
          effort: "low",
        },

        store: false,

        input: [
          {
            role: "system",
            content: `
Tu es le pré-jugement factuel d'Indie Map.

Tu reçois :
- une demande utilisateur ;
- son interprétation ;
- une liste fermée de lieux ;
- une liste exacte d'exigences indispensables.

Tu ne produis PAS encore les résultats finaux.

Pour chaque lieu :

CORE :
coreStatus="plausible" si le lieu correspond réellement
au besoin général recherché.

coreStatus="rejected" si le type, l'activité ou le rôle du
lieu est clairement hors sujet.

coreFit :
mesure seulement l'adéquation générale avec le besoin,
indépendamment des informations factuelles encore manquantes.

Ensuite évalue CHAQUE exigence indispensable séparément.

confirmed_internal =
les données Indie Map fournies contiennent une preuve
explicite de cette exigence.

needs_verification =
le candidat est plausible mais les données Indie Map
ne suffisent pas. Le site officiel doit être vérifié.

contradicted =
les données fournies indiquent explicitement que
l'exigence n'est pas respectée.

RÈGLES ABSOLUES :

- Copie le texte de "requirement" EXACTEMENT.
- Retourne chaque requirement exactement une fois.
- Une preuve doit être un extrait court EXACT des données
  Indie Map du candidat.
- Ne paraphrase jamais une preuve.
- Si tu n'as pas de preuve : needs_verification.
- N'invente jamais vegan, sans gluten, terrasse,
  accessibilité, enfants, horaires, prix, événement,
  réservation, production sur place, etc.
- Une brasserie n'implique pas automatiquement que la bière
  demandée est brassée dans l'établissement visité.
- Un lieu public n'implique jamais l'accessibilité PMR.
- Un lieu culturel n'implique jamais un événement à
  la date demandée.
- Une préférence souple ne devient pas une exigence.
- Mieux vaut demander une vérification qu'inventer.
            `.trim(),
          },
          {
            role: "user",
            content: JSON.stringify({
              query,
              understanding: parsed,
              resolvedCity,
              resolvedCountry,
              hardRequirements,
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
            name:
              "indie_map_prejudge_v42",
            strict: true,
            schema: {
              type: "object",
              properties: {
                assessments: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: {
                        type: "string",
                        enum: ids,
                      },
                      coreStatus: {
                        type: "string",
                        enum: [
                          "plausible",
                          "rejected",
                        ],
                      },
                      coreFit: {
                        type: "integer",
                        minimum: 0,
                        maximum: 100,
                      },
                      reason: {
                        type: "string",
                      },
                      requirementChecks: {
                        type: "array",
                        maxItems:
                          hardRequirements.length,
                        items: {
                          type: "object",
                          properties: {
                            requirement: {
                              type: "string",
                              enum:
                                requirementEnum,
                            },
                            status: {
                              type: "string",
                              enum: [
                                "confirmed_internal",
                                "needs_verification",
                                "contradicted",
                              ],
                            },
                            evidence: {
                              type: "array",
                              maxItems: 4,
                              items: {
                                type: "string",
                              },
                            },
                            reason: {
                              type: "string",
                            },
                          },
                          required: [
                            "requirement",
                            "status",
                            "evidence",
                            "reason",
                          ],
                          additionalProperties:
                            false,
                        },
                      },
                    },
                    required: [
                      "id",
                      "coreStatus",
                      "coreFit",
                      "reason",
                      "requirementChecks",
                    ],
                    additionalProperties:
                      false,
                  },
                },
              },
              required: [
                "assessments",
              ],
              additionalProperties:
                false,
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
      "PreJudge V4.2 : réponse vide"
    );
  }

  const raw = JSON.parse(
    response.output_text
  ) as {
    assessments: PreAssessment[];
  };

  const byId =
    new Map<string, PreAssessment>();

  for (
    const assessment of raw.assessments
  ) {
    if (!byId.has(assessment.id)) {
      byId.set(
        assessment.id,
        assessment
      );
    }
  }

  return candidates.map((place) => {
    const id = String(place.id);

    const rawAssessment =
      byId.get(id);

    let assessment:
      PreAssessment =
        rawAssessment || {
          id,
          coreStatus:
            "rejected",
          coreFit: 0,
          reason:
            "Aucune évaluation retournée.",
          requirementChecks: [],
        };

    /*
     * Recherche d'une vraie entité précise :
     * cette règle ne s'applique plus à "café",
     * "restaurant", "épicerie", etc.
     */
    if (
      parsed.entityIsSpecific &&
      parsed.entity &&
      lexicalEntityScore(
        place,
        parsed.entity
      ) < 0.72
    ) {
      return {
        ...assessment,
        coreStatus:
          "rejected" as const,
        coreFit: 0,
        reason:
          "Nom ou adresse insuffisamment proche de l'entité précise recherchée.",
        requirementChecks: [],
      };
    }

    if (
      assessment.coreFit < 50
    ) {
      assessment = {
        ...assessment,
        coreStatus:
          "rejected",
      };
    }

    const rawChecks =
      new Map(
        assessment.requirementChecks.map(
          (check) => [
            check.requirement,
            check,
          ]
        )
      );

    const normalizedChecks:
      RequirementCheck[] =
        hardRequirements.map(
          (requirement) => {
            const existing =
              rawChecks.get(
                requirement
              );

            if (!existing) {
              return {
                requirement,
                status:
                  "needs_verification",
                evidence: [],
                reason:
                  "Exigence non évaluée : vérification nécessaire.",
              };
            }

            const verifiedEvidence =
              existing.evidence.filter(
                (evidence) =>
                  internalEvidenceExists(
                    place,
                    evidence
                  )
              );

            if (
              existing.status ===
                "confirmed_internal" &&
              verifiedEvidence.length === 0
            ) {
              return {
                ...existing,
                status:
                  "needs_verification",
                evidence: [],
                reason:
                  "La confirmation proposée n'avait aucune preuve exacte retrouvable dans les données Indie Map.",
              };
            }

            return {
              ...existing,
              evidence:
                verifiedEvidence,
            };
          }
        );

    return {
      ...assessment,
      requirementChecks:
        normalizedChecks,
    };
  });
}

async function finalJudge(
  query: string,
  parsed: ParsedQuery,
  eligible: Array<{
    place: Place;
    assessment: PreAssessment;
    official?: OfficialVerificationResult;
  }>,
  resolvedCity: string,
  resolvedCountry: string
) {
  if (eligible.length === 0) {
    return {
      noGoodMatch: true,
      ranked: [] as RankedResult[],
    };
  }

  const ids = eligible.map(
    (item) =>
      String(item.place.id)
  );

  const response = await retry(
    "FINALJUDGE",
    () =>
      openai.responses.create({
        model: JUDGE_MODEL,

        reasoning: {
          effort: "low",
        },

        store: false,

        input: [
          {
            role: "system",
            content: `
Tu es le classement final d'Indie Map.

Les candidats fournis ont déjà passé un pré-jugement.
Lorsque des informations externes étaient nécessaires,
elles ont été vérifiées sur le site officiel.

Tu ne peux classer QUE les IDs fournis.

RÈGLES :

- Respecte le besoin principal.
- Toutes les exigences mustHave doivent être satisfaites.
- Les préférences prefer servent à départager.
- Les avoid doivent être respectés.
- N'invente aucune propriété.
- Les preuves "official" sont des preuves issues du site officiel.
- Une information inconnue reste inconnue.
- La raison doit être soutenue uniquement par les données fournies.
- Ne mets pas artificiellement un mauvais candidat à 60 ou 70.
- fit peut être inférieur à 70 si le candidat est faible.
- Un bon zéro vaut mieux qu'un résultat hors sujet.

ÉCHELLE :
90-100 : excellent
80-89 : très bon
70-79 : bon et réellement utile
50-69 : trop partiel pour être affiché
0-49 : mauvais
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
                eligible.map(
                  (item) => ({
                    place:
                      placeForJudge(
                        item.place
                      ),
                    preAssessment:
                      item.assessment,
                    official:
                      item.official
                        ? {
                            status:
                              item.official.status,
                            answer:
                              item.official.answer,
                            evidence:
                              item.official.evidence
                                .filter(
                                  (evidence) =>
                                    evidence.actuallyFound &&
                                    (
                                      evidence.scope ===
                                        "target_place" ||
                                      evidence.scope ===
                                        "brand_general"
                                    )
                                )
                                .map(
                                  (evidence) => ({
                                    sourceUrl:
                                      evidence.sourceUrl,
                                    evidenceText:
                                      evidence.evidenceText,
                                    scope:
                                      evidence.scope,
                                  })
                                ),
                          }
                        : null,
                  })
                ),
            }),
          },
        ],

        text: {
          format: {
            type: "json_schema",
            name:
              "indie_map_final_ranking_v41",
            strict: true,
            schema: {
              type: "object",
              properties: {
                noGoodMatch: {
                  type: "boolean",
                },
                ranked: {
                  type: "array",
                  maxItems:
                    MAX_RESULTS,
                  items: {
                    type: "object",
                    properties: {
                      id: {
                        type: "string",
                        enum: ids,
                      },
                      fit: {
                        type: "integer",
                        minimum: 0,
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
                    additionalProperties:
                      false,
                  },
                },
              },
              required: [
                "noGoodMatch",
                "ranked",
              ],
              additionalProperties:
                false,
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
      "FinalJudge : réponse vide"
    );
  }

  const parsedResult =
    JSON.parse(
      response.output_text
    ) as {
      noGoodMatch: boolean;
      ranked: RankedResult[];
    };

  const ranked =
    parsedResult.ranked
      .filter(
        (item) =>
          item.fit >=
          FINAL_MIN_FIT
      );

  return {
    noGoodMatch:
      ranked.length === 0 ||
      parsedResult.noGoodMatch,
    ranked,
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

  const hardRequirements =
    buildHardRequirements(parsed);

  const assessments =
    await preJudge(
      query,
      parsed,
      candidates,
      resolvedCity,
      resolvedCountry,
      hardRequirements
    );

  const assessmentById =
    new Map(
      assessments.map(
        (assessment) => [
          assessment.id,
          assessment,
        ]
      )
    );

  function isRejected(
    assessment: PreAssessment
  ) {
    return (
      assessment.coreStatus ===
        "rejected" ||
      assessment.requirementChecks.some(
        (check) =>
          check.status ===
            "contradicted"
      )
    );
  }

  function needsVerification(
    assessment: PreAssessment
  ) {
    return (
      !isRejected(assessment) &&
      assessment.requirementChecks.some(
        (check) =>
          check.status ===
            "needs_verification"
      )
    );
  }

  function internallyEligible(
    assessment: PreAssessment
  ) {
    return (
      !isRejected(assessment) &&
      !needsVerification(
        assessment
      )
    );
  }

  const eligible: Array<{
    place: Place;
    assessment: PreAssessment;
    official?: OfficialVerificationResult;
  }> = [];

  for (
    const assessment of assessments
  ) {
    if (
      !internallyEligible(
        assessment
      )
    ) {
      continue;
    }

    const place =
      placeById.get(
        assessment.id
      );

    if (!place) continue;

    eligible.push({
      place,
      assessment,
    });
  }

  /*
   * Les candidats à vérifier sont triés selon leur
   * vraie pertinence générale, pas selon un score
   * d'incertitude arbitraire.
   */
  const verificationQueue =
    assessments
      .filter(
        (assessment) =>
          needsVerification(
            assessment
          )
      )
      .sort(
        (a, b) =>
          b.coreFit -
          a.coreFit
      );

  const officialById =
    new Map<
      string,
      OfficialVerificationResult
    >();

  let verificationCount = 0;

  for (
    const assessment of
    verificationQueue
  ) {
    if (
      verificationCount >=
        MAX_VERIFY_CANDIDATES ||
      eligible.length >=
        TARGET_ELIGIBLE_CANDIDATES
    ) {
      break;
    }

    const place =
      placeById.get(
        assessment.id
      );

    if (
      !place ||
      !place.website
    ) {
      continue;
    }

    const missingRequirements =
      assessment.requirementChecks
        .filter(
          (check) =>
            check.status ===
              "needs_verification"
        )
        .map(
          (check) =>
            check.requirement
        );

    if (
      missingRequirements.length ===
      0
    ) {
      continue;
    }

    verificationCount += 1;

    const question =
      `Pour l'établissement "${place.name}", le site officiel confirme-t-il explicitement TOUS les points suivants : ${missingRequirements.join(
        " ; "
      )} ?`;

    try {
      const official =
        await verifyOfficialSiteFact({
          openai,
          model:
            JUDGE_MODEL,
          embeddingModel:
            EMBEDDING_MODEL,
          usage:
            officialVerifierUsage,
          place: {
            id:
              String(
                place.id
              ),
            name:
              String(
                place.name || ""
              ),
            city:
              String(
                place.city || ""
              ),
            address:
              String(
                place.address || ""
              ),
            website:
              place.website,
          },
          question,
        });

      officialById.set(
        assessment.id,
        official
      );

      /*
       * CONFIRMED signifie ici que TOUS les points
       * de la question combinée ont été confirmés.
       */
      if (
        official.status ===
          "CONFIRMED"
      ) {
        eligible.push({
          place,
          assessment,
          official,
        });
      }
    } catch (error: any) {
      console.error(
        "VERIFICATION OFFICIELLE ÉCHOUÉE :",
        place.name,
        error?.message || error
      );
    }
  }

  const judged =
    await finalJudge(
      query,
      parsed,
      eligible,
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
    debug: {
      confirmed:
        assessments.filter(
          (a) =>
            internallyEligible(a)
        ).length,
      needsVerification:
        assessments.filter(
          (a) =>
            needsVerification(a)
        ).length,
      rejected:
        assessments.filter(
          (a) =>
            isRejected(a)
        ).length,
      officialChecks:
        officialById.size,
      officialConfirmed:
        [...officialById.values()]
          .filter(
            (v) =>
              v.status ===
                "CONFIRMED"
          ).length,
      officialNotFound:
        [...officialById.values()]
          .filter(
            (v) =>
              v.status ===
                "NOT_FOUND"
          ).length,
      officialContradicted:
        [...officialById.values()]
          .filter(
            (v) =>
              v.status ===
                "CONTRADICTED"
          ).length,
    },
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

    if (result.debug) {
      console.log(
        "PREJUDGE :",
        `confirmed=${result.debug.confirmed}`,
        `verify=${result.debug.needsVerification}`,
        `rejected=${result.debug.rejected}`
      );

      console.log(
        "OFFICIEL :",
        `checks=${result.debug.officialChecks}`,
        `confirmed=${result.debug.officialConfirmed}`,
        `not_found=${result.debug.officialNotFound}`,
        `contradicted=${result.debug.officialContradicted}`
      );
    }

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
    "tmp/search-v4.2-blind-results.json",
    JSON.stringify(
      output,
      null,
      2
    )
  );

  const totalEmbeddingTokens =
    embeddingTokens +
    officialVerifierUsage.embeddingTokens;

  const totalLlmInputTokens =
    llmInputTokens +
    officialVerifierUsage.llmInputTokens;

  const totalLlmOutputTokens =
    llmOutputTokens +
    officialVerifierUsage.llmOutputTokens;

  const embeddingCost =
    totalEmbeddingTokens /
    1_000_000 *
    0.02;

  const llmInputCost =
    totalLlmInputTokens /
    1_000_000 *
    0.20;

  const llmOutputCost =
    totalLlmOutputTokens /
    1_000_000 *
    1.25;

  console.log("");
  console.log(
    "=================================================="
  );
  console.log("=== USAGE ===");
  console.log(
    "EMBEDDING TOKENS :",
    totalEmbeddingTokens
  );
  console.log(
    "LLM INPUT TOKENS :",
    totalLlmInputTokens
  );
  console.log(
    "LLM OUTPUT TOKENS :",
    totalLlmOutputTokens
  );
  console.log(
    "HTTP OFFICIEL :",
    officialVerifierUsage.httpRequests
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
    "RÉSULTATS JSON : tmp/search-v4.2-blind-results.json"
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
