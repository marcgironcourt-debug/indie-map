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
const MAX_VERIFY_CANDIDATES = 4;
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


type PreAssessment = {
  id: string;
  status:
    | "confirmed"
    | "needs_verification"
    | "rejected";
  confidence: number;
  reason: string;
  internalEvidence: string[];
  missingFacts: string[];
  verificationQuestion: string;
};

type VerifiedAssessment = {
  assessment: PreAssessment;
  official?: OfficialVerificationResult;
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

async function preJudge(
  query: string,
  parsed: ParsedQuery,
  candidates: Place[],
  resolvedCity: string,
  resolvedCountry: string
) {
  if (candidates.length === 0) {
    return [] as PreAssessment[];
  }

  const ids = candidates.map(
    (place) => String(place.id)
  );

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
Tu es le pré-jugement factuel de la recherche Indie Map.

Tu reçois une requête utilisateur et une liste fermée de lieux.

Ton travail n'est PAS de produire les résultats finaux.

Pour chaque candidat, choisis exactement un état :

confirmed =
les données Indie Map fournies suffisent réellement pour
établir que le lieu répond au besoin principal ET à toutes
les exigences indispensables.

needs_verification =
le lieu est réellement plausible, mais une ou plusieurs
informations factuelles indispensables manquent.
Le site officiel devra être consulté.

rejected =
le lieu ne correspond pas au besoin, une donnée fournie
le contredit, ou il est trop éloigné du besoin pour justifier
une vérification externe.

RÈGLES ABSOLUES :

- mustHave = indispensable.
- prefer = préférence souple, jamais motif automatique de rejet.
- avoid doit être respecté.
- Ne suppose jamais qu'un restaurant propose vegan,
  sans gluten, terrasse, accès PMR, menu enfant, etc.
- Ne suppose jamais qu'un lieu est ouvert à une heure donnée.
- Ne suppose jamais qu'un lieu accueille un événement à
  une date donnée.
- Ne suppose jamais un prix, une disponibilité ou une
  possibilité de réservation.
- Pour ces faits, si la donnée Indie Map ne le prouve pas :
  needs_verification.
- Si le type même du lieu ne correspond pas à la demande :
  rejected.
- Si une recherche vise une entité précise, un nom sans
  ressemblance réelle doit être rejected.
- Mieux vaut rejected ou needs_verification qu'une invention.

internalEvidence :
liste de courts extraits EXACTS présents dans les données
du candidat et qui soutiennent la décision.
Ne paraphrase pas.

verificationQuestion :
pour needs_verification uniquement, formule UNE question
factuelle précise au site officiel. Elle peut regrouper
plusieurs exigences indispensables si nécessaire.
Pour les autres états, chaîne vide.
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
            name:
              "indie_map_prejudge_v41",
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
                      status: {
                        type: "string",
                        enum: [
                          "confirmed",
                          "needs_verification",
                          "rejected",
                        ],
                      },
                      confidence: {
                        type: "integer",
                        minimum: 0,
                        maximum: 100,
                      },
                      reason: {
                        type: "string",
                      },
                      internalEvidence: {
                        type: "array",
                        maxItems: 5,
                        items: {
                          type: "string",
                        },
                      },
                      missingFacts: {
                        type: "array",
                        maxItems: 5,
                        items: {
                          type: "string",
                        },
                      },
                      verificationQuestion: {
                        type: "string",
                      },
                    },
                    required: [
                      "id",
                      "status",
                      "confidence",
                      "reason",
                      "internalEvidence",
                      "missingFacts",
                      "verificationQuestion",
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
      "PreJudge : réponse vide"
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

    let assessment =
      byId.get(id) || {
        id,
        status:
          "rejected" as const,
        confidence: 0,
        reason:
          "Aucune évaluation retournée.",
        internalEvidence: [],
        missingFacts: [],
        verificationQuestion: "",
      };

    /*
     * Garde-fou déterministe pour recherche de nom précis :
     * le LLM ne peut pas transformer Plantxa en Panacée.
     */
    if (
      parsed.entity &&
      lexicalEntityScore(
        place,
        parsed.entity
      ) < 0.72
    ) {
      return {
        ...assessment,
        status:
          "rejected" as const,
        reason:
          "Nom/adresse insuffisamment proche de l'entité recherchée.",
        verificationQuestion: "",
      };
    }

    const verifiedEvidence =
      assessment.internalEvidence.filter(
        (evidence) =>
          internalEvidenceExists(
            place,
            evidence
          )
      );

    /*
     * Une confirmation portant sur des exigences factuelles
     * ou temporelles doit au moins disposer d'une preuve
     * interne réellement retrouvable.
     */
    const needsHardProof =
      parsed.mustHave.length > 0 ||
      Boolean(parsed.dateTime);

    if (
      assessment.status ===
        "confirmed" &&
      needsHardProof &&
      verifiedEvidence.length === 0
    ) {
      assessment = {
        ...assessment,
        status:
          "needs_verification",
        missingFacts:
          assessment.missingFacts.length
            ? assessment.missingFacts
            : [
                ...parsed.mustHave,
                ...(parsed.dateTime
                  ? [
                      `contrainte temporelle: ${parsed.dateTime}`,
                    ]
                  : []),
              ],
        verificationQuestion:
          assessment.verificationQuestion ||
          `Le site officiel confirme-t-il explicitement que ${place.name} satisfait les exigences suivantes pour cette recherche : ${[
            ...parsed.mustHave,
            parsed.dateTime,
          ]
            .filter(Boolean)
            .join(" ; ")} ?`,
      };
    }

    if (
      assessment.status ===
        "needs_verification" &&
      !assessment.verificationQuestion.trim()
    ) {
      assessment = {
        ...assessment,
        verificationQuestion:
          `Le site officiel de ${place.name} confirme-t-il explicitement les informations manquantes nécessaires pour répondre à cette demande : "${query}" ?`,
      };
    }

    return {
      ...assessment,
      internalEvidence:
        verifiedEvidence,
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

  const assessments =
    await preJudge(
      query,
      parsed,
      candidates,
      resolvedCity,
      resolvedCountry
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

  /*
   * On vérifie seulement les candidats plausibles
   * qui ont réellement besoin d'une donnée externe.
   */
  const toVerify =
    assessments
      .filter(
        (assessment) =>
          assessment.status ===
            "needs_verification"
      )
      .sort(
        (a, b) =>
          b.confidence -
          a.confidence
      )
      .slice(
        0,
        MAX_VERIFY_CANDIDATES
      );

  const officialById =
    new Map<
      string,
      OfficialVerificationResult
    >();

  for (
    const assessment of toVerify
  ) {
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
          question:
            assessment.verificationQuestion,
        });

      officialById.set(
        assessment.id,
        official
      );
    } catch (error: any) {
      console.error(
        "VERIFICATION OFFICIELLE ÉCHOUÉE :",
        place.name,
        error?.message || error
      );
    }
  }

  /*
   * Éligibilité dure :
   * - confirmed interne => admissible
   * - needs_verification => admissible uniquement si
   *   le site officiel CONFIRME
   * - rejected / NOT_FOUND / CONTRADICTED => exclus
   */
  const eligible = candidates
    .map((place) => {
      const id =
        String(place.id);

      const assessment =
        assessmentById.get(id);

      if (!assessment) {
        return null;
      }

      if (
        assessment.status ===
          "confirmed"
      ) {
        return {
          place,
          assessment,
        };
      }

      if (
        assessment.status ===
          "needs_verification"
      ) {
        const official =
          officialById.get(id);

        if (
          official?.status ===
            "CONFIRMED"
        ) {
          return {
            place,
            assessment,
            official,
          };
        }
      }

      return null;
    })
    .filter(
      (
        item
      ): item is {
        place: Place;
        assessment: PreAssessment;
        official?: OfficialVerificationResult;
      } =>
        item !== null
    );

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
            a.status === "confirmed"
        ).length,
      needsVerification:
        assessments.filter(
          (a) =>
            a.status ===
              "needs_verification"
        ).length,
      rejected:
        assessments.filter(
          (a) =>
            a.status === "rejected"
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
    "tmp/search-v4.1-blind-results.json",
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
    "RÉSULTATS JSON : tmp/search-v4.1-blind-results.json"
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
