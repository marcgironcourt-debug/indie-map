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
import {
  getPlaceIdsWithFreshVerifiedFacts,
  getFreshVerifiedFactsForPlaces,
} from "../src/lib/ai/memoryStore";

dotenv.config({ path: ".env.local" });

const EMBEDDING_MODEL = "text-embedding-3-small";
const JUDGE_MODEL = "gpt-5.4-nano";

const SEMANTIC_CANDIDATES = 35;
const FINAL_CANDIDATES = 24;
const MAX_RESULTS = 8;
/*
 * Le plafond historique reste à 6 comme garde-fou.
 *
 * Mais V5 ne remplit plus automatiquement ces 6 places :
 * le provisionalJudge ne sélectionne que les candidats
 * qui valent réellement une vérification coûteuse.
 */
const MAX_VERIFY_CANDIDATES = 6;
const MAX_PROVISIONAL_VERIFY_CANDIDATES = 4;
const TARGET_ELIGIBLE_CANDIDATES = 6;
const FINAL_MIN_FIT = 70;

type Place = SearchPlace & {
  openingHours?: string;
  website?: string;
  phone?: string;
  translations?: unknown;

  verifiedFacts?: Array<{
    evidenceText: string;
    sourceUrl: string;
    scope: string;
    verifiedAt: Date;
    expiresAt: Date;
  }>;
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

    identity: {
      name: place.name || "",
      category: place.category || "",
      tags: Array.isArray(place.tags)
        ? place.tags
        : [],
    },

    location: {
      city: place.city || "",
      country: place.country || "",
      address: place.address || "",

      lat: Number.isFinite(
        Number(place.lat)
      )
        ? Number(place.lat)
        : null,

      lng: Number.isFinite(
        Number(place.lng)
      )
        ? Number(place.lng)
        : null,
    },

    editorial: {
      miniText: short(
        place.miniText,
        700
      ),

      homeTextNear: short(
        place.homeTextNear,
        550
      ),

      homeTextFar: short(
        place.homeTextFar,
        550
      ),

      translations:
        place.translations ?? null,
    },

    practical: {
      openingHours:
        place.openingHours ?? null,

      timeZone:
        place.timeZone ?? null,

      phone:
        place.phone ?? null,

      website:
        place.website ?? null,
    },

    metadata: {
      createdAt:
        place.createdAt ?? null,

      updatedAt:
        place.updatedAt ?? null,
    },

    verifiedFacts:
      (
        place.verifiedFacts ?? []
      ).map((fact) => ({
        evidenceText:
          fact.evidenceText,

        sourceUrl:
          fact.sourceUrl,

        scope:
          fact.scope,

        verifiedAt:
          fact.verifiedAt,

        expiresAt:
          fact.expiresAt,
      })),
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

coreStatus="rejected" signale seulement que le pré-jugement
estime le type, l'activité ou le rôle du lieu hors sujet.

IMPORTANT V5 :
ce statut est informatif et NON éliminatoire.
Le classement final décidera de la pertinence générale.

L'absence d'information, une information partielle ou une
incertitude ne sont JAMAIS des motifs de rejet.

coreFit :
mesure seulement l'adéquation générale avec le besoin.
coreFit ne constitue JAMAIS un seuil éliminatoire.

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
              "indie_map_prejudge_v5",
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
      "PreJudge V5 : réponse vide"
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
            "plausible",
          coreFit: 0,
          reason:
            "Aucune évaluation retournée : candidat conservé pour éviter un faux négatif.",
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

    /*
     * V5 :
     * coreFit est uniquement un signal de classement.
     * Un score faible ne peut plus tuer un candidat avant
     * mémoire / vérification / classement final.
     */

    /*
     * V5 :
     * le PREJUDGE n'a plus le droit d'éliminer un candidat
     * uniquement sur son appréciation générale.
     *
     * Les vraies éliminations du pipeline restent :
     * - mauvaise identité pour une entité précise
     *   (return déterministe ci-dessus) ;
     * - contradiction explicite d'une exigence.
     *
     * Le classement final reste libre de donner un fit faible
     * ou de ne pas afficher un candidat hors sujet.
     */
    if (
      assessment.coreStatus ===
        "rejected"
    ) {
      assessment = {
        ...assessment,
        coreStatus:
          "plausible",
        reason:
          `Pré-jugement V5 non éliminatoire : ${assessment.reason}`,
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


type ProvisionalVerificationRank = {
  id: string;
  priority: number;
  reason: string;
};

/*
 * Ce juge ne décide PAS si un candidat doit être affiché.
 *
 * Son unique rôle :
 * parmi les candidats dont certains faits sont encore inconnus,
 * choisir ceux qui semblent suffisamment plausibles pour que
 * le coût d'une vérification officielle soit justifié.
 *
 * Une information inconnue n'est jamais une information négative.
 */
async function provisionalVerificationJudge(
  query: string,
  parsed: ParsedQuery,
  candidates: PreAssessment[],
  resolvedCity: string,
  resolvedCountry: string
): Promise<ProvisionalVerificationRank[]> {
  if (
    candidates.length === 0
  ) {
    return [];
  }

  const candidateRows =
    candidates
      .map(
        (assessment) => {
          const place =
            placeById.get(
              assessment.id
            );

          if (!place) {
            return null;
          }

          return {
            place:
              placeForJudge(
                place
              ),
            preAssessment:
              assessment,
          };
        }
      )
      .filter(
        (
          item
        ): item is {
          place:
            ReturnType<
              typeof placeForJudge
            >;
          preAssessment:
            PreAssessment;
        } =>
          item !== null
      );

  if (
    candidateRows.length === 0
  ) {
    return [];
  }

  const ids =
    candidateRows.map(
      (item) =>
        item.preAssessment.id
    );

  const response =
    await retry(
      "PROVISIONAL_VERIFY",
      () =>
        openai.responses.create({
          model:
            JUDGE_MODEL,

          reasoning: {
            effort: "low",
          },

          store: false,

          input: [
            {
              role: "system",
              content: `
Tu sélectionnes les candidats Indie Map qui méritent une
vérification factuelle coûteuse sur leur site officiel.

Tu ne fais PAS le classement final.
Tu ne dois PAS rejeter un candidat simplement parce qu'une
information manque dans les données Indie Map.

OBJECTIF :
choisir au maximum ${MAX_PROVISIONAL_VERIFY_CANDIDATES}
candidats pour lesquels une vérification officielle a de bonnes
chances de changer utilement la décision finale.

RÈGLES :
- Le manque d'information n'est pas une preuve négative.
- Une faible certitude n'est pas une contradiction.
- Favorise les candidats dont l'activité générale correspond
  réellement au besoin.
- Utilise les preuves internes confirmées lorsqu'elles existent.
- Une exigence "needs_verification" peut parfaitement être vraie.
- Ne suppose jamais qu'une propriété inconnue est vraie.
- Ne suppose jamais qu'une propriété inconnue est fausse.
- Ne choisis pas un candidat manifestement hors sujet uniquement
  pour remplir la liste.
- Le classement final sera fait plus tard.
              `.trim(),
            },
            {
              role: "user",
              content:
                JSON.stringify({
                  query,
                  understanding:
                    parsed,
                  resolvedCity,
                  resolvedCountry,
                  candidates:
                    candidateRows,
                }),
            },
          ],

          text: {
            format: {
              type:
                "json_schema",
              name:
                "indie_map_v5_verification_shortlist",
              strict:
                true,
              schema: {
                type:
                  "object",
                properties: {
                  ranked: {
                    type:
                      "array",
                    maxItems:
                      MAX_PROVISIONAL_VERIFY_CANDIDATES,
                    items: {
                      type:
                        "object",
                      properties: {
                        id: {
                          type:
                            "string",
                          enum:
                            ids,
                        },
                        priority: {
                          type:
                            "integer",
                          minimum:
                            0,
                          maximum:
                            100,
                        },
                        reason: {
                          type:
                            "string",
                        },
                      },
                      required: [
                        "id",
                        "priority",
                        "reason",
                      ],
                      additionalProperties:
                        false,
                    },
                  },
                },
                required: [
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
    response.usage
      ?.input_tokens || 0;

  llmOutputTokens +=
    response.usage
      ?.output_tokens || 0;

  if (
    !response.output_text
  ) {
    throw new Error(
      "ProvisionalJudge V5 : réponse vide"
    );
  }

  const parsedResult =
    JSON.parse(
      response.output_text
    ) as {
      ranked:
        ProvisionalVerificationRank[];
    };

  const seen =
    new Set<string>();

  return parsedResult.ranked
    .filter(
      (item) => {
        if (
          !ids.includes(
            item.id
          )
        ) {
          return false;
        }

        if (
          seen.has(
            item.id
          )
        ) {
          return false;
        }

        seen.add(
          item.id
        );

        return true;
      }
    );
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

async function searchV5(
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
   * =======================================================
   * V5 — SHORTLIST DE VERIFICATION
   * =======================================================
   *
   * On ne vérifie plus automatiquement les six premiers
   * candidats incertains.
   *
   * 1. Les candidats possédant déjà une mémoire factuelle
   *    fraîche sont prioritaires.
   *
   * 2. Un provisionalJudge choisit au maximum quatre autres
   *    candidats suffisamment plausibles pour justifier une
   *    vérification coûteuse.
   *
   * 3. Aucun score absolu coreFit n'est utilisé comme seuil
   *    destructif.
   */
  const verificationCandidates =
    assessments.filter(
      (assessment) =>
        needsVerification(
          assessment
        )
    );

  const memoryBackedIds =
    await getPlaceIdsWithFreshVerifiedFacts(
      verificationCandidates.map(
        (assessment) =>
          assessment.id
      )
    );

  let provisionalRank:
    ProvisionalVerificationRank[] =
      [];

  try {
    provisionalRank =
      await provisionalVerificationJudge(
        query,
        parsed,
        verificationCandidates,
        resolvedCity,
        resolvedCountry
      );
  } catch (error: any) {
    console.error(
      "PROVISIONAL VERIFY ÉCHOUÉ :",
      error?.message || error
    );
  }

  const provisionalPriority =
    new Map(
      provisionalRank.map(
        (item) => [
          item.id,
          item.priority,
        ]
      )
    );

  const shortlistedIds =
    new Set<string>([
      ...memoryBackedIds,
      ...provisionalRank.map(
        (item) =>
          item.id
      ),
    ]);

  /*
   * Filet de sécurité :
   * si le provisionalJudge ne renvoie rien et qu'aucune
   * mémoire fraîche n'existe, on conserve les meilleurs
   * candidats selon deux signaux déjà disponibles :
   * coreFit et retrieval sémantique.
   *
   * Ce fallback n'est utilisé qu'en cas d'échec du juge.
   */
  if (
    shortlistedIds.size === 0 &&
    verificationCandidates.length >
      0
  ) {
    const fallback =
      new Map<
        string,
        PreAssessment
      >();

    for (
      const assessment of
      [...verificationCandidates]
        .sort(
          (a, b) =>
            b.coreFit -
            a.coreFit
        )
        .slice(0, 2)
    ) {
      fallback.set(
        assessment.id,
        assessment
      );
    }

    for (
      const assessment of
      [...verificationCandidates]
        .sort(
          (a, b) =>
            (
              retrievalScores.get(
                b.id
              ) || 0
            ) -
            (
              retrievalScores.get(
                a.id
              ) || 0
            )
        )
        .slice(0, 2)
    ) {
      fallback.set(
        assessment.id,
        assessment
      );
    }

    for (
      const id of
      fallback.keys()
    ) {
      shortlistedIds.add(
        id
      );
    }
  }

  const verificationQueue =
    verificationCandidates
      .filter(
        (assessment) =>
          shortlistedIds.has(
            assessment.id
          )
      )
      .sort(
        (a, b) => {
          const memoryA =
            memoryBackedIds.has(
              a.id
            )
              ? 1
              : 0;

          const memoryB =
            memoryBackedIds.has(
              b.id
            )
              ? 1
              : 0;

          if (
            memoryA !==
            memoryB
          ) {
            return (
              memoryB -
              memoryA
            );
          }

          const provisionalA =
            provisionalPriority.get(
              a.id
            ) || 0;

          const provisionalB =
            provisionalPriority.get(
              b.id
            ) || 0;

          if (
            provisionalA !==
            provisionalB
          ) {
            return (
              provisionalB -
              provisionalA
            );
          }

          return (
            b.coreFit -
            a.coreFit
          );
        }
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



type LocalKnowledgePiece = {
  label: string;
  text: string;
};

const LOCAL_REQUIREMENT_STOPWORDS =
  new Set([
    "a",
    "au",
    "aux",
    "avec",
    "boire",
    "prendre",
    "deguster",
    "trouve",
    "trouver",
    "cherche",
    "chercher",
    "je",
    "moi",
    "endroit",
    "peux",
    "peut",
    "veux",
    "voudrais",
    "voir",
    "ce",
    "ces",
    "cette",
    "dans",
    "de",
    "des",
    "du",
    "en",
    "et",
    "etre",
    "faire",
    "la",
    "le",
    "les",
    "lieu",
    "l",
    "me",
    "mes",
    "mon",
    "ou",
    "pour",
    "pouvoir",
    "qui",
    "ses",
    "son",
    "sur",
    "un",
    "une",
    "y",
  ]);

function localTokenRoot(
  value: string
) {
  const token =
    normalize(value);

  if (!token) {
    return "";
  }

  /*
   * Quelques familles morphologiques importantes
   * pour la recherche Indie Map.
   *
   * Ce ne sont PAS des synonymes inventés :
   * seulement des variantes d'un même radical.
   */
  const families:
    Array<
      [string, string]
    > = [
      ["appren", "appren"],
      ["repar", "repar"],
      ["transform", "transform"],
      ["modif", "modif"],
      ["recycl", "recycl"],
      ["reemploi", "reemploi"],
      ["coutur", "coutur"],
      ["vetement", "vetement"],
      ["atelier", "atelier"],
      ["restaurant", "restaurant"],
      ["cafe", "cafe"],
      ["boulanger", "boulanger"],
      ["librair", "librair"],
      ["brasser", "brasser"],
      ["epicer", "epicer"],
      ["ferme", "ferme"],
      ["marche", "marche"],
      ["boutiqu", "boutiqu"],
      ["mode", "mode"],
      ["telephone", "telephone"],
      ["dimanch", "dimanch"],
      ["samed", "samed"],
      ["lund", "lund"],
      ["mard", "mard"],
      ["mercred", "mercred"],
      ["jeud", "jeud"],
      ["vendred", "vendred"],
    ];

  for (
    const [
      prefix,
      root,
    ] of families
  ) {
    if (
      token.startsWith(
        prefix
      )
    ) {
      return root;
    }
  }

  /*
   * Pluriel simple.
   */
  if (
    token.length > 5 &&
    token.endsWith("s")
  ) {
    return token.slice(
      0,
      -1
    );
  }

  return token;
}

function localRequirementRoots(
  value: string
) {
  const roots =
    normalize(value)
      .split(/\s+/)
      .map(
        localTokenRoot
      )
      .filter(
        (token) =>
          token &&
          token.length >= 3 &&
          !LOCAL_REQUIREMENT_STOPWORDS.has(
            token
          )
      );

  return [
    ...new Set(
      roots
    ),
  ];
}


type LocalUsageIntent =
  | "drink"
  | "eat"
  | "repair";

function detectLocalUsageIntent(
  requirement: string
): LocalUsageIntent | null {
  const value =
    normalize(requirement);

  if (
    /\b(boire|drink|drinking)\b/.test(
      value
    )
  ) {
    return "drink";
  }

  if (
    /\b(manger|eat|eating)\b/.test(
      value
    )
  ) {
    return "eat";
  }

  if (
    /\b(reparer|repair|fix)\b/.test(
      value
    )
  ) {
    return "repair";
  }

  return null;
}

function sentenceSupportsLocalUsageIntent(
  sentence: string,
  intent: LocalUsageIntent
) {
  const value =
    normalize(sentence);

  if (
    intent === "drink"
  ) {
    return (
      /\bboir\w*\b/.test(value) ||
      /\bdrink\w*\b/.test(value) ||
      /\bdegust\w*\b/.test(value) ||
      /\bserv\w*\b/.test(value) ||
      /\bpinte?s?\b/.test(value) ||
      /\bpression\b/.test(value) ||
      /\bverre?s?\b/.test(value) ||
      /\bon tap\b/.test(value) ||
      /\bsur place\b/.test(value)
    );
  }

  if (
    intent === "eat"
  ) {
    return (
      /\bmang\w*\b/.test(value) ||
      /\beat\w*\b/.test(value) ||
      /\bdegust\w*\b/.test(value) ||
      /\bserv\w*\b/.test(value) ||
      /\brepas\b/.test(value) ||
      /\bmenu\b/.test(value) ||
      /\bplat\w*\b/.test(value) ||
      /\bcuisine\b/.test(value) ||
      /\brestaurant\b/.test(value) ||
      /\bcantine\b/.test(value) ||
      /\bbrunch\b/.test(value) ||
      /\bsur place\b/.test(value)
    );
  }

  return (
    /\brepar\w*\b/.test(value) ||
    /\brepair\w*\b/.test(value) ||
    /\bfix\w*\b/.test(value) ||
    /\bretouch\w*\b/.test(value) ||
    /\braccommod\w*\b/.test(value)
  );
}


function localKnowledgePieces(
  place: Place
): LocalKnowledgePiece[] {
  const pieces:
    LocalKnowledgePiece[] =
      [];

  function add(
    label: string,
    value: unknown
  ) {
    const text =
      String(
        value ?? ""
      ).trim();

    if (!text) {
      return;
    }

    pieces.push({
      label,
      text,
    });
  }

  add(
    "name",
    place.name
  );

  add(
    "category",
    place.category
  );

  add(
    "city",
    place.city
  );

  add(
    "country",
    place.country
  );

  add(
    "address",
    place.address
  );

  if (
    Array.isArray(
      place.tags
    )
  ) {
    add(
      "tags",
      place.tags.join(
        " "
      )
    );
  }

  add(
    "miniText",
    place.miniText
  );

  add(
    "homeTextNear",
    place.homeTextNear
  );

  add(
    "homeTextFar",
    place.homeTextFar
  );

  /*
   * Les traductions sont déjà du contenu Indie Map.
   */
  if (
    place.translations
  ) {
    add(
      "translations",
      JSON.stringify(
        place.translations
      )
    );
  }

  add(
    "openingHours",
    place.openingHours
  );

  add(
    "timeZone",
    place.timeZone
  );

  add(
    "phone",
    place.phone
  );

  add(
    "website",
    place.website
  );

  for (
    const fact of
    place.verifiedFacts ?? []
  ) {
    add(
      `verifiedFact:${fact.scope}`,
      fact.evidenceText
    );
  }

  return pieces;
}

function localSentences(
  text: string
) {
  return text
    .split(
      /\n+|[.!?]\s+/
    )
    .map(
      (item) =>
        item.trim()
    )
    .filter(Boolean);
}


function localRequirementCoverage(
  place: Place,
  requirement: string
) {
  const roots =
    localRequirementRoots(
      requirement
    );

  if (
    roots.length === 0
  ) {
    return {
      coverage: 0,
      matched: 0,
      total: 0,
      evidence: "",
      source: "",
    };
  }

  let best = {
    coverage: 0,
    matched: 0,
    total:
      roots.length,
    evidence: "",
    source: "",
  };

  for (
    const piece of
    localKnowledgePieces(
      place
    )
  ) {
    for (
      const sentence of
      localSentences(
        piece.text
      )
    ) {
      const sentenceRoots =
        new Set(
          localRequirementRoots(
            sentence
          )
        );

      const matched =
        roots.filter(
          (root) =>
            sentenceRoots.has(
              root
            )
        ).length;

      const coverage =
        matched /
        roots.length;

      if (
        coverage >
          best.coverage ||
        (
          coverage ===
            best.coverage &&
          matched >
            best.matched
        )
      ) {
        best = {
          coverage,
          matched,
          total:
            roots.length,
          evidence:
            sentence,
          source:
            piece.label,
        };
      }
    }
  }

  return best;
}

/*
 * Le web est un DERNIER RECOURS.
 *
 * UNKNOWN ne suffit jamais.
 *
 * Un candidat peut être vérifié sur son site seulement si :
 *
 * 1. au moins un autre critère demandé est déjà confirmé
 *    dans Indie Map / mémoire ;
 *
 * OU
 *
 * 2. le critère inconnu possède déjà un signal local
 *    substantiel mais incomplet.
 *
 * Exemples :
 *
 * "boire un café + manger"
 * café confirmé, manger inconnu
 * -> le site peut compléter "manger"
 *
 * "participer à un atelier"
 * le lieu parle déjà d'ateliers mais pas clairement
 *    de participation / calendrier
 * -> le site peut compléter
 *
 * "apprendre à réparer des vêtements"
 * le lieu mentionne seulement "vêtements"
 * -> signal trop faible, PAS de web
 */

/*
 * Certaines demandes portent sur une information
 * qui peut changer rapidement et que la fiche statique
 * Indie Map ne peut pas toujours garantir.
 *
 * Exemples :
 * - concert ce soir
 * - atelier cette semaine
 * - projection aujourd'hui
 *
 * En revanche :
 * - café
 * - manger
 * - ouvert dimanche soir
 *
 * doivent d'abord être résolus avec les données Indie Map.
 */
function queryNeedsFreshOfficialCheck(
  query: string
) {
  const value =
    normalize(query);

  const hasFreshTime =
    [
      "aujourd hui",
      "ce soir",
      "cet apres midi",
      "demain",
      "cette semaine",
      "dans la semaine",
      "ce week end",
      "ce weekend",
      "samedi soir",
      "dimanche soir",
    ].some(
      (token) =>
        value.includes(token)
    );

  if (!hasFreshTime) {
    return false;
  }

  /*
   * "dimanche soir" seul ne force PAS le web :
   * openingHours peut répondre.
   *
   * Il faut également une activité dont la tenue
   * réelle dépend d'une programmation.
   */
  const hasChangingActivity =
    [
      "concert",
      "atelier",
      "evenement",
      "programmation",
      "spectacle",
      "projection",
      "dj",
      "jam",
      "cours",
      "rencontre",
      "conference",
    ].some(
      (token) =>
        value.includes(token)
    );

  return hasChangingActivity;
}


function isOpeningRequirementForV5(
  requirement: string
) {
  const value =
    normalize(requirement);

  return (
    value.includes(
      "etre ouvert"
    ) ||
    value.includes(
      "ouvert ou disponible"
    ) ||
    value.includes(
      "disponible au moment demande"
    )
  );
}

function isDynamicFreshRequirement(
  requirement: string
) {
  const value =
    normalize(requirement);

  return [
    "concert",
    "live",
    "musique",
    "musical",
    "programmation",
    "spectacle",
    "projection",
    "dj",
    "jam",
    "atelier",
    "workshop",
    "cours",
    "initiation",
    "stage",
    "rencontre",
    "conference",
    "evenement",
  ].some(
    (token) =>
      value.includes(token)
  );
}

function hasDynamicLocalSignal(
  place: Place,
  requirement: string
) {
  const requirementValue =
    normalize(requirement);

  const knowledge =
    normalize(
      localKnowledgePieces(place)
        .map(
          (piece) =>
            piece.text
        )
        .join(" ")
    );

  const aliasGroups:
    Array<{
      when: string[];
      signals: string[];
    }> = [
      {
        when: [
          "concert",
          "musique",
          "musical",
          "live",
        ],
        signals: [
          "concert",
          "live",
          "musique",
          "musical",
          "scene",
          "programmation",
          "dj",
          "jam",
        ],
      },
      {
        when: [
          "atelier",
          "workshop",
          "cours",
          "initiation",
          "stage",
        ],
        signals: [
          "atelier",
          "workshop",
          "cours",
          "initiation",
          "stage",
          "apprendre",
          "formation",
        ],
      },
      {
        when: [
          "projection",
          "cinema",
          "film",
        ],
        signals: [
          "projection",
          "cinema",
          "film",
          "seance",
        ],
      },
    ];

  for (
    const group of
    aliasGroups
  ) {
    const applies =
      group.when.some(
        (token) =>
          requirementValue.includes(
            token
          )
      );

    if (!applies) {
      continue;
    }

    return group.signals.some(
      (signal) =>
        knowledge.includes(
          signal
        )
    );
  }

  const partial =
    localRequirementCoverage(
      place,
      requirement
    );

  return (
    partial.coverage >=
      0.5 &&
    partial.matched >=
      1
  );
}

function hasStableLocalPlausibility(
  place: Place,
  requirement: string
) {
  const value =
    normalize(requirement);

  const category =
    normalize(
      String(
        place.category ?? ""
      )
    );

  const knowledge =
    normalize(
      localKnowledgePieces(place)
        .map(
          (piece) =>
            piece.text
        )
        .join(" ")
    );

  const containsAny = (
    source: string,
    tokens: string[]
  ) =>
    tokens.some(
      (token) =>
        source.includes(token)
    );

  /*
   * Un recouvrement partiel réel avec la fiche
   * suffit à rendre le lieu plausible.
   *
   * Cela ne CONFIRME jamais le critère :
   * cela autorise seulement une vérification officielle.
   */
  const partial =
    localRequirementCoverage(
      place,
      requirement
    );

  if (
    partial.coverage >= 0.5 &&
    partial.matched >= 1
  ) {
    return true;
  }

  /*
   * CAFE
   */
  if (
    containsAny(
      value,
      [
        "cafe",
        "coffee",
      ]
    )
  ) {
    if (
      containsAny(
        category,
        [
          "cafe",
          "brasserie",
          "bar",
          "restaurant",
          "boulangerie",
          "patisserie",
        ]
      )
    ) {
      return true;
    }

    return containsAny(
      knowledge,
      [
        "restauration",
        "restaurant",
        "cantine",
        "bar",
        "brunch",
        "petit dejeuner",
        "salon de the",
        "boisson",
      ]
    );
  }

  /*
   * BOIRE UN VERRE / BIERE / VIN / COCKTAIL
   */
  if (
    containsAny(
      value,
      [
        "boire un verre",
        "un verre",
        "biere",
        "vin",
        "cocktail",
        "boisson",
      ]
    )
  ) {
    if (
      containsAny(
        category,
        [
          "bar",
          "brasserie",
          "cafe",
          "restaurant",
        ]
      )
    ) {
      return true;
    }

    return containsAny(
      knowledge,
      [
        "bar",
        "biere",
        "vin",
        "cocktail",
        "boisson",
        "aperitif",
      ]
    );
  }

  /*
   * MANGER
   */
  if (
    containsAny(
      value,
      [
        "manger",
        "repas",
        "dejeuner",
        "diner",
        "restaurant",
        "cuisine",
      ]
    )
  ) {
    if (
      containsAny(
        category,
        [
          "restaurant",
          "brasserie",
          "cafe",
          "boulangerie",
        ]
      )
    ) {
      return true;
    }

    return containsAny(
      knowledge,
      [
        "restauration",
        "restaurant",
        "cuisine",
        "cantine",
        "repas",
        "brunch",
        "dejeuner",
        "diner",
      ]
    );
  }

  /*
   * PAIN / BOULANGERIE
   */
  if (
    containsAny(
      value,
      [
        "pain",
        "boulangerie",
        "viennoiserie",
        "patisserie",
      ]
    )
  ) {
    return (
      containsAny(
        category,
        [
          "boulangerie",
          "patisserie",
        ]
      ) ||
      containsAny(
        knowledge,
        [
          "pain",
          "boulangerie",
          "viennoiserie",
          "patisserie",
        ]
      )
    );
  }

  return false;
}

function shouldVerifyUnknownOnWeb(
  place: Place,
  assessment: PreAssessment
) {
  const checks =
    assessment.requirementChecks;

  const unknownChecks =
    checks.filter(
      (check) =>
        check.status ===
          "needs_verification"
    );

  if (
    unknownChecks.length === 0
  ) {
    return false;
  }

  /*
   * Besoins stables :
   * chacun doit être plausible avant d'aller sur le web.
   */
  const unknownStableNeeds =
    unknownChecks.filter(
      (check) =>
        !isOpeningRequirementForV5(
          check.requirement
        ) &&
        !isDynamicFreshRequirement(
          check.requirement
        )
    );

  if (
    unknownStableNeeds.some(
      (check) =>
        !hasStableLocalPlausibility(
          place,
          check.requirement
        )
    )
  ) {
    return false;
  }

  /*
   * Besoins dynamiques :
   * concert / atelier / projection...
   *
   * On garde le verrou strict :
   * Indie Map doit déjà contenir un signal.
   */
  const dynamicUnknowns =
    unknownChecks.filter(
      (check) =>
        isDynamicFreshRequirement(
          check.requirement
        )
    );

  if (
    dynamicUnknowns.some(
      (check) =>
        !hasDynamicLocalSignal(
          place,
          check.requirement
        )
    )
  ) {
    return false;
  }

  /*
   * On ne consulte pas un site uniquement
   * pour vérifier un horaire.
   */
  const realNeeds =
    checks.filter(
      (check) =>
        !isOpeningRequirementForV5(
          check.requirement
        )
    );

  return realNeeds.length > 0;
}

function findLocalEvidence(
  place: Place,
  requirement: string
) {
  const requirementNormalized =
    normalize(
      requirement
    );

  const requiredRoots =
    localRequirementRoots(
      requirement
    );

  /*
   * Une intention d'usage ne peut pas être prouvée
   * par le seul objet recherché.
   *
   * Exemple :
   * "sélection de bières" != "boire une bière".
   */
  const usageIntent =
    detectLocalUsageIntent(
      requirement
    );

  if (
    !requirementNormalized
  ) {
    return null;
  }

  /*
   * Quelques champs structurés sont des preuves
   * directes lorsqu'on demande simplement leur présence.
   */
  if (
    (
      requirementNormalized.includes(
        "telephone"
      ) ||
      requirementNormalized.includes(
        "numero"
      )
    ) &&
    place.phone
  ) {
    return {
      evidence:
        String(
          place.phone
        ),
      source:
        "phone",
    };
  }

  if (
    (
      requirementNormalized.includes(
        "site web"
      ) ||
      requirementNormalized.includes(
        "website"
      )
    ) &&
    place.website
  ) {
    return {
      evidence:
        String(
          place.website
        ),
      source:
        "website",
    };
  }

  const pieces =
    localKnowledgePieces(
      place
    );

  let best:
    {
      evidence: string;
      source: string;
      coverage: number;
      matched: number;
    } | null =
      null;

  for (
    const piece of pieces
  ) {
    for (
      const sentence of
      localSentences(
        piece.text
      )
    ) {
      const normalizedSentence =
        normalize(
          sentence
        );

      /*
       * Si l'utilisateur demande explicitement une action,
       * la phrase utilisée comme preuve doit elle-même
       * contenir un signal de cette action.
       *
       * La simple présence du produit ne suffit pas.
       */
      const supportsUsageIntent =
        !usageIntent ||
        sentenceSupportsLocalUsageIntent(
          normalizedSentence,
          usageIntent
        );

      if (
        normalizedSentence.includes(
          requirementNormalized
        ) &&
        supportsUsageIntent
      ) {
        return {
          evidence:
            sentence,
          source:
            piece.label,
        };
      }

      if (
        requiredRoots.length ===
        0 ||
        !supportsUsageIntent
      ) {
        continue;
      }

      const sentenceRoots =
        new Set(
          localRequirementRoots(
            sentence
          )
        );

      const matched =
        requiredRoots.filter(
          (root) =>
            sentenceRoots.has(
              root
            )
        ).length;

      const coverage =
        matched /
        requiredRoots.length;

      if (
        !best ||
        coverage >
          best.coverage ||
        (
          coverage ===
            best.coverage &&
          matched >
            best.matched
        )
      ) {
        best = {
          evidence:
            sentence,
          source:
            piece.label,
          coverage,
          matched,
        };
      }
    }
  }

  /*
   * Une preuve locale doit couvrir la quasi-totalité
   * des concepts explicites de l'exigence.
   *
   * Sinon : INCONNU.
   * Jamais CONTRADIT par simple absence.
   */
  if (
    best &&
    (
      (
        requiredRoots.length ===
          1 &&
        best.matched === 1
      ) ||
      (
        requiredRoots.length >=
          2 &&
        best.coverage >=
          0.75 &&
        best.matched >= 2
      )
    )
  ) {
    return {
      evidence:
        best.evidence,
      source:
        best.source,
    };
  }

  return null;
}


type OpeningMinuteRange = {
  start: number;
  end: number;
};

function parseOpeningRanges(
  line: string
): OpeningMinuteRange[] {
  const ranges:
    OpeningMinuteRange[] =
      [];

  const regex =
    /(\d{1,2})\s*(?:h|:)\s*(\d{0,2})\s*[-–—]\s*(\d{1,2})\s*(?:h|:)\s*(\d{0,2})/gi;

  let match:
    RegExpExecArray | null;

  while (
    (
      match =
        regex.exec(line)
    )
  ) {
    const startHour =
      Number(match[1]);

    const startMinute =
      Number(
        match[2] || 0
      );

    const endHour =
      Number(match[3]);

    const endMinute =
      Number(
        match[4] || 0
      );

    if (
      !Number.isFinite(
        startHour
      ) ||
      !Number.isFinite(
        startMinute
      ) ||
      !Number.isFinite(
        endHour
      ) ||
      !Number.isFinite(
        endMinute
      )
    ) {
      continue;
    }

    const start =
      startHour * 60 +
      startMinute;

    let end =
      endHour * 60 +
      endMinute;

    /*
     * Exemples :
     *
     * 6h00-0h00
     * -> 06:00 à minuit
     *
     * 19h00-2h00
     * -> 19:00 à 02:00 le lendemain
     */
    if (
      end <= start
    ) {
      end += 24 * 60;
    }

    ranges.push({
      start,
      end,
    });
  }

  return ranges;
}

function frenchWeekdayForPlace(
  place: Place,
  offsetDays = 0
) {
  try {
    const date =
      new Date(
        Date.now() +
          offsetDays *
            24 *
            60 *
            60 *
            1000
      );

    return normalize(
      new Intl.DateTimeFormat(
        "fr-FR",
        {
          timeZone:
            place.timeZone ||
            "Europe/Paris",

          weekday:
            "long",
        }
      ).format(date)
    );
  } catch {
    return "";
  }
}

function requestedOpeningDay(
  place: Place,
  requirement: string
) {
  const req =
    normalize(
      requirement
    );

  const days = [
    "lundi",
    "mardi",
    "mercredi",
    "jeudi",
    "vendredi",
    "samedi",
    "dimanche",
  ];

  for (
    const day of days
  ) {
    if (
      req.includes(day)
    ) {
      return day;
    }
  }

  if (
    req.includes(
      "demain"
    )
  ) {
    return frenchWeekdayForPlace(
      place,
      1
    );
  }

  if (
    req.includes(
      "aujourd hui"
    ) ||
    req.includes(
      "ce soir"
    ) ||
    req.includes(
      "cet apres midi"
    ) ||
    req.includes(
      "ce matin"
    )
  ) {
    return frenchWeekdayForPlace(
      place,
      0
    );
  }

  return "";
}

function requestedOpeningWindow(
  requirement: string
): {
  start: number;
  end: number;
  label: string;
} | null {
  const req =
    normalize(
      requirement
    );

  /*
   * Heure exacte :
   * 19h
   * 19h30
   * 19:30
   */
  const exact =
    requirement.match(
      /\b(\d{1,2})\s*(?:h|:)\s*(\d{0,2})\b/i
    );

  if (exact) {
    const hour =
      Number(exact[1]);

    const minute =
      Number(
        exact[2] || 0
      );

    if (
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59
    ) {
      const point =
        hour * 60 +
        minute;

      return {
        start:
          point,

        /*
         * Une minute suffit pour tester
         * l'appartenance au créneau.
         */
        end:
          point + 1,

        label:
          `${hour}h${String(
            minute
          ).padStart(2, "0")}`,
      };
    }
  }

  if (
    req.includes(
      "soir"
    )
  ) {
    return {
      start:
        18 * 60,
      end:
        24 * 60,
      label:
        "soir",
    };
  }

  if (
    req.includes(
      "apres midi"
    )
  ) {
    return {
      start:
        12 * 60,
      end:
        18 * 60,
      label:
        "après-midi",
    };
  }

  if (
    req.includes(
      "matin"
    )
  ) {
    return {
      start:
        6 * 60,
      end:
        12 * 60,
      label:
        "matin",
    };
  }

  if (
    req.includes(
      "midi"
    )
  ) {
    return {
      start:
        11 * 60,
      end:
        15 * 60,
      label:
        "midi",
    };
  }

  if (
    req.includes(
      "nuit"
    )
  ) {
    return {
      start:
        22 * 60,
      end:
        26 * 60,
      label:
        "nuit",
    };
  }

  return null;
}

function openingRangesOverlap(
  opening:
    OpeningMinuteRange,
  requested: {
    start: number;
    end: number;
  }
) {
  /*
   * Comparaison normale.
   */
  if (
    opening.start <
      requested.end &&
    opening.end >
      requested.start
  ) {
    return true;
  }

  /*
   * Pour un horaire après minuit :
   * 01:00 peut appartenir à un créneau
   * 19:00-02:00.
   */
  const shiftedStart =
    requested.start +
    24 * 60;

  const shiftedEnd =
    requested.end +
    24 * 60;

  return (
    opening.start <
      shiftedEnd &&
    opening.end >
      shiftedStart
  );
}

function evaluateOpeningHoursRequirement(
  place: Place,
  requirement: string
): RequirementCheck | null {
  const req =
    normalize(
      requirement
    );

  /*
   * Cette fonction ne traite que le critère horaire
   * généré par buildHardRequirements().
   *
   * Elle ne doit surtout pas transformer
   * "boire un café dimanche soir"
   * en simple vérification d'horaires.
   */
  const isOpeningRequirement =
    req.includes(
      "etre ouvert"
    ) ||
    req.includes(
      "etre disponible au moment demande"
    ) ||
    req.includes(
      "ouvert ou disponible"
    );

  if (
    !isOpeningRequirement
  ) {
    return null;
  }

  if (
    !place.openingHours
  ) {
    return {
      requirement,
      status:
        "needs_verification",
      evidence: [],
      reason:
        "Aucun horaire Indie Map disponible pour ce lieu.",
    };
  }

  const day =
    requestedOpeningDay(
      place,
      requirement
    );

  if (!day) {
    return {
      requirement,
      status:
        "needs_verification",
      evidence: [],
      reason:
        "Le jour demandé n'a pas pu être déterminé.",
    };
  }

  const line =
    place.openingHours
      .split(/\n+/)
      .map(
        (item) =>
          item.trim()
      )
      .find(
        (item) =>
          normalize(
            item
          ).startsWith(
            day
          )
      );

  if (!line) {
    return {
      requirement,
      status:
        "needs_verification",
      evidence: [],
      reason:
        `Aucun horaire Indie Map trouvé pour ${day}.`,
    };
  }

  const normalizedLine =
    normalize(line);

  if (
    normalizedLine.includes(
      "ferme"
    ) ||
    normalizedLine.includes(
      "closed"
    )
  ) {
    return {
      requirement,
      status:
        "contradicted",
      evidence: [
        line,
      ],
      reason:
        `Indie Map indique que le lieu est fermé ${day}.`,
    };
  }

  const ranges =
    parseOpeningRanges(
      line
    );

  if (
    ranges.length === 0
  ) {
    return {
      requirement,
      status:
        "needs_verification",
      evidence: [
        line,
      ],
      reason:
        "L'horaire existe dans Indie Map mais son format n'a pas pu être interprété.",
    };
  }

  const requestedWindow =
    requestedOpeningWindow(
      requirement
    );

  /*
   * Si l'utilisateur demande seulement :
   * "ouvert dimanche"
   *
   * la présence d'au moins un créneau suffit.
   */
  if (
    !requestedWindow
  ) {
    return {
      requirement,
      status:
        "confirmed_internal",
      evidence: [
        line,
      ],
      reason:
        `Les horaires Indie Map confirment une ouverture ${day}.`,
    };
  }

  const overlaps =
    ranges.some(
      (range) =>
        openingRangesOverlap(
          range,
          requestedWindow
        )
    );

  if (overlaps) {
    return {
      requirement,
      status:
        "confirmed_internal",
      evidence: [
        line,
      ],
      reason:
        `Les horaires Indie Map confirment une ouverture ${day} ${requestedWindow.label}.`,
    };
  }

  return {
    requirement,
    status:
      "contradicted",
    evidence: [
      line,
    ],
    reason:
      `Le lieu est ouvert ${day}, mais pas pendant le créneau demandé (${requestedWindow.label}).`,
  };
}

function explicitOpeningHoursContradiction(
  place: Place,
  requirement: string
) {
  if (
    !place.openingHours
  ) {
    return null;
  }

  const req =
    normalize(
      requirement
    );

  if (
    !req.includes(
      "ouvert"
    )
  ) {
    return null;
  }

  const days = [
    ["lundi", "lund"],
    ["mardi", "mard"],
    ["mercredi", "mercred"],
    ["jeudi", "jeud"],
    ["vendredi", "vendred"],
    ["samedi", "samed"],
    ["dimanche", "dimanch"],
  ] as const;

  const requested =
    days.find(
      ([
        day,
        root,
      ]) =>
        req.includes(day) ||
        req.includes(root)
    );

  if (!requested) {
    return null;
  }

  const [
    day,
  ] =
    requested;

  const line =
    place.openingHours
      .split(/\n+/)
      .find(
        (item) =>
          normalize(
            item
          ).includes(
            day
          )
      );

  if (
    !line
  ) {
    return null;
  }

  const normalizedLine =
    normalize(
      line
    );

  if (
    normalizedLine.includes(
      "ferme"
    ) ||
    normalizedLine.includes(
      "closed"
    )
  ) {
    return line;
  }

  return null;
}

function evaluateRequirementLocally(
  place: Place,
  requirement: string
): RequirementCheck {
  /*
   * Les horaires sont des données structurées :
   * ils passent avant toute correspondance textuelle.
   */
  const openingCheck =
    evaluateOpeningHoursRequirement(
      place,
      requirement
    );

  if (openingCheck) {
    return openingCheck;
  }

  const contradiction =
    explicitOpeningHoursContradiction(
      place,
      requirement
    );

  if (
    contradiction
  ) {
    return {
      requirement,
      status:
        "contradicted",
      evidence: [
        contradiction,
      ],
      reason:
        "Contradiction explicite trouvée dans les horaires Indie Map.",
    };
  }

  const found =
    findLocalEvidence(
      place,
      requirement
    );

  if (found) {
    return {
      requirement,
      status:
        "confirmed_internal",
      evidence: [
        found.evidence,
      ],
      reason:
        `Preuve trouvée localement dans ${found.source}.`,
    };
  }

  return {
    requirement,
    status:
      "needs_verification",
    evidence: [],
    reason:
      "Aucune preuve suffisante dans les données Indie Map ni dans la mémoire vérifiée.",
  };
}


function buildLocalAssessments(
  candidates: Place[],
  hardRequirements: string[],
  semanticScoreById: Map<string, number>,
  bestScore: number,
  deterministicIds: Set<string>
): PreAssessment[] {
  return candidates.map(
    (place) => {
      const id =
        String(place.id);

      const score =
        semanticScoreById.get(
          id
        ) ?? 0;

      const semanticGap =
        Math.max(
          0,
          bestScore - score
        );

      let coreFit =
        Math.round(
          100 -
            semanticGap * 180
        );

      if (
        deterministicIds.has(
          id
        )
      ) {
        coreFit += 4;
      }

      coreFit =
        Math.max(
          0,
          Math.min(
            100,
            coreFit
          )
        );

      const requirementChecks =
        hardRequirements.map(
          (requirement) =>
            evaluateRequirementLocally(
              place,
              requirement
            )
        );

      const allConfirmed =
        requirementChecks.length >
          0 &&
        requirementChecks.every(
          (check) =>
            check.status ===
              "confirmed_internal"
        );

      if (allConfirmed) {
        coreFit =
          Math.max(
            coreFit,
            80
          );
      }

      const confirmedCount =
        requirementChecks.filter(
          (check) =>
            check.status ===
              "confirmed_internal"
        ).length;

      const unknownCount =
        requirementChecks.filter(
          (check) =>
            check.status ===
              "needs_verification"
        ).length;

      const contradictedCount =
        requirementChecks.filter(
          (check) =>
            check.status ===
              "contradicted"
        ).length;

      return {
        id,

        coreStatus:
          "plausible",

        coreFit,

        reason:
          hardRequirements.length ===
            0
            ? "Candidat retenu par la recherche sémantique/lexicale Indie Map."
            : `${confirmedCount}/${hardRequirements.length} critère(s) confirmé(s) localement, ${unknownCount} inconnu(s), ${contradictedCount} contradit(s).`,

        requirementChecks,
      };
    }
  );
}

function splitLocalAssessments(
  assessments: PreAssessment[]
) {
  const contradicted =
    assessments.filter(
      (assessment) =>
        assessment
          .requirementChecks
          .some(
            (check) =>
              check.status ===
                "contradicted"
          )
    );

  const unknown =
    assessments
      .filter(
        (assessment) =>
          !assessment
            .requirementChecks
            .some(
              (check) =>
                check.status ===
                  "contradicted"
            ) &&
          assessment
            .requirementChecks
            .some(
              (check) =>
                check.status ===
                  "needs_verification"
            )
      )
      .sort(
        (a, b) =>
          b.coreFit -
          a.coreFit
      );

  const confirmed =
    assessments
      .filter(
        (assessment) =>
          !assessment
            .requirementChecks
            .some(
              (check) =>
                check.status ===
                  "contradicted" ||
                check.status ===
                  "needs_verification"
            )
      )
      .sort(
        (a, b) =>
          b.coreFit -
          a.coreFit
      );

  return {
    confirmed,
    unknown,
    contradicted,
  };
}

function assessmentsToResults(
  assessments: PreAssessment[],
  candidates: Place[]
) {
  const byId =
    new Map(
      candidates.map(
        (place) => [
          String(place.id),
          place,
        ]
      )
    );

  return assessments
    .filter(
      (assessment) =>
        assessment.coreFit >=
          FINAL_MIN_FIT
    )
    .map(
      (assessment) => {
        const place =
          byId.get(
            assessment.id
          );

        if (!place) {
          return null;
        }

        return {
          id:
            assessment.id,

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

          fit:
            assessment.coreFit,

          reason:
            assessment.reason,
        };
      }
    )
    .filter(
      (
        result
      ): result is {
        id: string;
        name: string;
        city: string;
        category: string;
        fit: number;
        reason: string;
      } =>
        result !== null
    );
}


const WEB_VERIFY_CONCURRENCY =
  4;


const V5_STREAM_PREFIX =
  "__V5_EVENT__";

function emitV5StreamEvent(
  event:
    Record<string, unknown>
) {
  if (
    process.env
      .V5_SIMPLE_STREAM_JSON !==
    "1"
  ) {
    return;
  }

  process.stdout.write(
    V5_STREAM_PREFIX +
      JSON.stringify(event) +
      "\n"
  );
}

async function mapWithConcurrency<
  T,
  R
>(
  items: T[],
  concurrency: number,
  worker:
    (
      item: T,
      index: number
    ) => Promise<R>
): Promise<R[]> {
  if (
    items.length === 0
  ) {
    return [];
  }

  const results =
    new Array<R>(
      items.length
    );

  let nextIndex =
    0;

  async function runWorker() {
    while (true) {
      const index =
        nextIndex++;

      if (
        index >=
        items.length
      ) {
        return;
      }

      results[index] =
        await worker(
          items[index]!,
          index
        );
    }
  }

  const workerCount =
    Math.min(
      Math.max(
        1,
        concurrency
      ),
      items.length
    );

  await Promise.all(
    Array.from(
      {
        length:
          workerCount,
      },
      () =>
        runWorker()
    )
  );

  return results;
}


function requirementRootsOverlap(
  left: string,
  right: string
) {
  const leftRoots =
    localRequirementRoots(
      left
    );

  const rightRoots =
    localRequirementRoots(
      right
    );

  if (
    leftRoots.length === 0 ||
    rightRoots.length === 0
  ) {
    return false;
  }

  const leftSet =
    new Set(leftRoots);

  const rightSet =
    new Set(rightRoots);

  /*
   * Si l'un des deux critères est déjà contenu
   * conceptuellement dans l'autre, inutile de le dupliquer.
   */
  const leftInsideRight =
    leftRoots.every(
      (root) =>
        rightSet.has(root)
    );

  const rightInsideLeft =
    rightRoots.every(
      (root) =>
        leftSet.has(root)
    );

  return (
    leftInsideRight ||
    rightInsideLeft
  );
}

function deriveRequirementsFromRawQuery(
  query: string,
  parsed: ParsedQuery,
  resolvedCity?: string | null,
  resolvedCountry?: string | null
) {
  let value =
    normalize(query);

  /*
   * La localisation et la date sont déjà traitées
   * dans leurs champs structurés.
   *
   * On les retire donc avant d'extraire le besoin.
   */
  for (
    const removable of [
      resolvedCity,
      resolvedCountry,
      parsed.dateTime,
    ]
  ) {
    const normalized =
      normalize(
        removable
      );

    if (!normalized) {
      continue;
    }

    value =
      value
        .split(normalized)
        .join(" ");
  }

  /*
   * Une conjonction sépare souvent deux critères :
   *
   * "boire un café ET manger"
   * -> café
   * -> manger
   *
   * En revanche :
   * "apprendre à réparer mes vêtements"
   * reste un seul critère composé.
   */
  const rawClauses =
    value
      .split(
        /\s+(?:et|puis)\s+|[,;]+/
      )
      .map(
        (clause) =>
          clause.trim()
      )
      .filter(Boolean);

  const requirements:
    string[] =
      [];

  for (
    const clause of rawClauses
  ) {
    const roots =
      localRequirementRoots(
        clause
      );

    if (
      roots.length === 0
    ) {
      continue;
    }

    /*
     * On stocke une formulation canonique uniquement
     * composée des concepts réellement utiles.
     *
     * Exemples :
     * "pour boire un café"
     * -> "cafe"
     *
     * "où je peux manger"
     * -> "manger"
     *
     * "apprendre à réparer mes vêtements"
     * -> "appren repar vetement"
     */
    requirements.push(
      roots.join(" ")
    );
  }

  return [
    ...new Set(
      requirements
    ),
  ];
}


function isTemporalRequirementForV5(
  requirement: string,
  dateTime?: string | null
) {
  const req =
    normalize(requirement);

  const normalizedDateTime =
    normalize(dateTime);

  /*
   * Si le parseur a produit :
   *
   * "disponible dimanche soir"
   *
   * on ne conserve PAS cette formulation textuelle.
   * Le temps sera traité par openingHours avec une
   * exigence canonique structurée.
   */
  if (
    normalizedDateTime &&
    req.includes(
      normalizedDateTime
    )
  ) {
    return true;
  }

  const temporalTokens = [
    "lundi",
    "mardi",
    "mercredi",
    "jeudi",
    "vendredi",
    "samedi",
    "dimanche",
    "aujourd hui",
    "demain",
    "ce soir",
    "matin",
    "midi",
    "apres midi",
    "soir",
    "nuit",
  ];

  const availabilityTokens = [
    "ouvert",
    "ouverte",
    "disponible",
    "horaire",
  ];

  const hasTemporalToken =
    temporalTokens.some(
      (token) =>
        req.includes(token)
    );

  const hasAvailabilityToken =
    availabilityTokens.some(
      (token) =>
        req.includes(token)
    );

  return (
    hasTemporalToken &&
    hasAvailabilityToken
  );
}

function buildV5SimpleRequirements(
  query: string,
  parsed: ParsedQuery,
  resolvedCity?: string | null,
  resolvedCountry?: string | null
) {
  const requirements:
    string[] =
      [];

  /*
   * ======================================================
   * 1. CRITERES COMPRIS PAR LE PARSEUR
   * ======================================================
   *
   * On garde les besoins réels :
   *
   * "boire un café"
   * "manger"
   * "réparer des vêtements"
   *
   * mais PAS les formulations temporelles libres
   * comme :
   *
   * "disponible dimanche soir"
   *
   * car elles doivent être évaluées contre
   * openingHours.
   */
  for (
    const raw of
    parsed.mustHave
  ) {
    const value =
      String(
        raw ?? ""
      ).trim();

    if (!value) {
      continue;
    }

    if (
      isTemporalRequirementForV5(
        value,
        parsed.dateTime
      )
    ) {
      continue;
    }

    requirements.push(
      value
    );
  }

  /*
   * ======================================================
   * 2. TEMPS CANONIQUE
   * ======================================================
   *
   * Une seule formulation, toujours reconnue par
   * evaluateOpeningHoursRequirement().
   */
  if (
    parsed.dateTime
  ) {
    requirements.push(
      `être ouvert ou disponible au moment demandé : ${parsed.dateTime}`
    );
  }

  /*
   * ======================================================
   * 3. FILET DETERMINISTE SUR LA PHRASE UTILISATEUR
   * ======================================================
   *
   * Si le LLM oublie "café", "manger", etc.,
   * on les récupère directement dans la requête.
   */
  const derived =
    deriveRequirementsFromRawQuery(
      query,
      parsed,
      resolvedCity,
      resolvedCountry
    );

  for (
    const requirement of
    derived
  ) {
    if (
      requirements.some(
        (existing) =>
          requirementRootsOverlap(
            existing,
            requirement
          )
      )
    ) {
      continue;
    }

    requirements.push(
      requirement
    );
  }

  return requirements;
}

async function searchV5Simple(
  query: string
): Promise<SearchResult> {
  const startedAt =
    performance.now();

  /*
   * Mode utilisé actuellement par le wrapper local :
   *
   * - compréhension V5 conservée ;
   * - embeddings conservés ;
   * - uniquement les données Indie Map ;
   * - aucune mémoire issue du web ;
   * - aucun site officiel.
   */
  const localOnly =
    process.env.V5_SIMPLE_LOCAL_ONLY ===
    "1";

  /*
   * V5 SIMPLE :
   *
   * On lance immédiatement, en parallèle :
   * - compréhension de la requête ;
   * - embedding de la requête ;
   * - chargement de la mémoire vérifiée.
   *
   * Le catalogue ne contient actuellement que 626 lieux :
   * récupérer les faits frais en une seule requête est
   * suffisamment petit pour éviter d'attendre Neon après
   * le retrieval.
   */
  const memoryStartedAt =
    performance.now();

  const allFreshFactsPromise =
    localOnly
      ? Promise.resolve([])
      : getFreshVerifiedFactsForPlaces(
          places.map(
            (place) =>
              String(place.id)
          )
        );

  const [
    parsed,
    queryVector,
  ] =
    await Promise.all([
      parseQuery(query),
      embedQuery(query),
    ]);

  const understoodAt =
    performance.now();

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

  /*
   * Filtres durs uniquement lorsque l'information
   * est certaine dans la requête.
   */
  let universe =
    places;

  if (resolvedCity) {
    universe =
      universe.filter(
        (place) =>
          normalize(
            place.city
          ) ===
          normalize(
            resolvedCity
          )
      );
  } else if (
    resolvedCountry
  ) {
    universe =
      universe.filter(
        (place) =>
          normalize(
            place.country
          ) ===
          normalize(
            resolvedCountry
          )
      );
  }

  /*
   * Évaluation sémantique de TOUS les lieux
   * de l'univers restant.
   *
   * Aucun top 6 / 8 / 24 / 35.
   */
  const semantic =
    universe
      .map(
        (place) => {
          const vector =
            vectorById.get(
              String(
                place.id
              )
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

          if (
            parsed.entity
          ) {
            const entityScore =
              lexicalEntityScore(
                place,
                parsed.entity
              );

            if (
              entityScore > 0
            ) {
              score +=
                entityScore *
                0.25;
            }
          }

          return {
            place,
            score,
          };
        }
      )
      .filter(
        (
          item
        ): item is {
          place: Place;
          score: number;
        } =>
          item !== null
      )
      .sort(
        (a, b) =>
          b.score -
          a.score
      );

  const semanticScoreById =
    new Map(
      semantic.map(
        (item) => [
          String(
            item.place.id
          ),
          item.score,
        ]
      )
    );

  /*
   * Filet lexical Indie Map.
   */
  const deterministic =
    localSearch(
      query,
      universe
    ).results;

  const deterministicIds =
    new Set(
      deterministic.map(
        (place) =>
          String(
            place.id
          )
      )
    );

  const bestScore =
    semantic[0]?.score ??
    0;

  /*
   * Il n'y a pas de limite en nombre.
   *
   * La coupure dépend de la pertinence observée :
   * un lieu doit soit être dans la même zone de score
   * que les meilleurs, soit avoir été trouvé par la
   * recherche lexicale déterministe.
   */
  const relativeFloor =
    bestScore - 0.18;

  const candidateById =
    new Map<
      string,
      Place
    >();

  for (
    const item of semantic
  ) {
    const id =
      String(
        item.place.id
      );

    if (
      item.score >=
        relativeFloor ||
      deterministicIds.has(
        id
      )
    ) {
      candidateById.set(
        id,
        item.place
      );
    }
  }

  for (
    const place of
    deterministic
  ) {
    candidateById.set(
      String(
        place.id
      ),
      place as Place
    );
  }

  /*
   * Une recherche de nom précis conserve toute
   * correspondance lexicale forte, indépendamment
   * de l'embedding.
   */
  if (
    parsed.entityIsSpecific &&
    parsed.entity
  ) {
    for (
      const place of universe
    ) {
      if (
        lexicalEntityScore(
          place,
          parsed.entity
        ) >= 0.72
      ) {
        candidateById.set(
          String(
            place.id
          ),
          place
        );
      }
    }
  }

  const candidates =
    [
      ...candidateById.values(),
    ];

  const retrievalAt =
    performance.now();

  /*
   * UNE requête DB pour récupérer tous les faits
   * officiels frais des candidats.
   */
  /*
   * La requête Neon a déjà commencé pendant parse+embedding.
   * Ici on attend seulement ce qui reste éventuellement
   * de son exécution.
   */
  const hardRequirements =
    buildV5SimpleRequirements(
      query,
      parsed,
      resolvedCity,
      resolvedCountry
    );

  /*
   * ======================================================
   * PHASE A — DONNEES INDIE MAP UNIQUEMENT
   * ======================================================
   *
   * On N'ATTEND PAS Neon.
   *
   * Dès que ces résultats sont prêts, l'interface pourra
   * les afficher immédiatement.
   */
  const phaseAStartedAt =
    performance.now();

  const phaseAAssessments =
    buildLocalAssessments(
      candidates,
      hardRequirements,
      semanticScoreById,
      bestScore,
      deterministicIds
    );

  const phaseASplit =
    splitLocalAssessments(
      phaseAAssessments
    );

  const phaseAResults =
    assessmentsToResults(
      phaseASplit.confirmed,
      candidates
    );

  const phaseAReadyAt =
    performance.now();

  emitV5StreamEvent({
    type: "results",
    phase: "local",
    results: phaseAResults,
  });

  console.log(
    "PHASE A PRETE :",
    `resultats=${phaseAResults.length}`,
    `inconnus=${phaseASplit.unknown.length}`,
    `latence=${Math.round(
      phaseAReadyAt -
      startedAt
    )}ms`
  );

  if (
    phaseAResults.length > 0
  ) {
    console.log(
      "RESULTATS IMMEDIATS :"
    );

    for (
      const result of
      phaseAResults
    ) {
      console.log(
        "-",
        result.name,
        `${result.fit}/100`
      );
    }
  }

  /*
   * ======================================================
   * PHASE B — MEMOIRE VERIFIEE
   * ======================================================
   *
   * La requête Neon tournait déjà en parallèle.
   * On l'attend seulement APRÈS avoir obtenu la phase A.
   */
  const memoryWaitStartedAt =
    performance.now();

  const allFreshFacts =
    await allFreshFactsPromise;

  const memoryLoadedAt =
    performance.now();

  const candidateIds =
    new Set(
      candidates.map(
        (place) =>
          String(place.id)
      )
    );

  const facts =
    allFreshFacts.filter(
      (fact) =>
        candidateIds.has(
          fact.placeId
        )
    );

  const factsByPlace =
    new Map<
      string,
      typeof facts
    >();

  for (
    const fact of facts
  ) {
    const existing =
      factsByPlace.get(
        fact.placeId
      ) ?? [];

    existing.push(
      fact
    );

    factsByPlace.set(
      fact.placeId,
      existing
    );
  }

  const enrichedCandidates:
    Place[] =
      candidates.map(
        (place) => ({
          ...place,

          verifiedFacts:
            (
              factsByPlace.get(
                String(place.id)
              ) ?? []
            ).map(
              (fact) => ({
                evidenceText:
                  fact.evidenceText,

                sourceUrl:
                  fact.sourceUrl,

                scope:
                  fact.scope,

                verifiedAt:
                  fact.verifiedAt,

                expiresAt:
                  fact.expiresAt,
              })
            ),
        })
      );

  const localEvaluationStartedAt =
    performance.now();

  const assessments =
    buildLocalAssessments(
      enrichedCandidates,
      hardRequirements,
      semanticScoreById,
      bestScore,
      deterministicIds
    );

  const evaluatedAt =
    performance.now();

  const {
    confirmed,
    unknown,
    contradicted,
  } =
    splitLocalAssessments(
      assessments
    );

  const results =
    assessmentsToResults(
      confirmed,
      enrichedCandidates
    );

  const phaseAIds =
    new Set(
      phaseAResults.map(
        (result) =>
          result.id
      )
    );

  const memoryAddedResults =
    results.filter(
      (result) =>
        !phaseAIds.has(
          result.id
        )
    );

  if (
    memoryAddedResults.length >
      0
  ) {
    emitV5StreamEvent({
      type: "results",
      phase: "memory",
      results:
        memoryAddedResults,
    });
  }

  console.log(
    "PHASE B MEMOIRE :",
    `nouveauxResultats=${memoryAddedResults.length}`,
    `faitsMemoire=${facts.length}`
  );

  if (
    memoryAddedResults.length >
      0
  ) {
    console.log(
      "RESULTATS AJOUTES PAR LA MEMOIRE :"
    );

    for (
      const result of
      memoryAddedResults
    ) {
      console.log(
        "-",
        result.name,
        `${result.fit}/100`
      );
    }
  }

  /*
   * ======================================================
   * PHASE C — SITE OFFICIEL
   * ======================================================
   *
   * On arrive ici uniquement après :
   * - données Indie Map ;
   * - mémoire vérifiée.
   *
   * Chaque critère encore INCONNU est vérifié
   * séparément.
   *
   * Il n'y a AUCUN cap sur le nombre de candidats
   * pertinents.
   *
   * WEB_VERIFY_CONCURRENCY limite seulement le nombre
   * de sites sollicités simultanément.
   */
  const phaseCStartedAt =
    performance.now();

  /*
   * ======================================================
   * DOIT-ON MEME UTILISER LE WEB ?
   * ======================================================
   *
   * Si Indie Map + mémoire ont déjà produit au moins
   * un résultat satisfaisant tous les critères,
   * on ne lance PAS des recherches officielles simplement
   * pour essayer de trouver davantage de lieux.
   *
   * Exception :
   * une information fraîche / programmée explicitement
   * demandée par l'utilisateur.
   */
  /*
   * Un résultat déjà confirmé ne doit pas arrêter
   * la recherche des autres lieux correspondants.
   *
   * Le gate shouldVerifyUnknownOnWeb() décide seul
   * quels UNKNOWN méritent une consultation officielle.
   */
  const unknownAtWebStart =
    localOnly
      ? []
      : unknown.filter(
      (assessment) => {
        const place =
          enrichedCandidates.find(
            (candidate) =>
              String(
                candidate.id
              ) ===
              assessment.id
          );

        if (!place) {
          return false;
        }

        return shouldVerifyUnknownOnWeb(
          place,
          assessment
        );
      }
    );

  if (
    unknown.length > 0 &&
    unknownAtWebStart.length === 0
  ) {
    console.log(
      "WEB NON NECESSAIRE :",
      "aucun critère inconnu ne justifie une consultation du site officiel"
    );
  }

  if (localOnly) {
    console.log(
      "V5 LOCAL ONLY : mémoire web et sites officiels désactivés"
    );
  }

  const webDryRun =
    process.env.V5_SIMPLE_WEB_DRY_RUN ===
      "1";

  console.log(
    "CANDIDATS WEB ELIGIBLES :",
    unknownAtWebStart.length
  );

  for (
    const assessment of
    unknownAtWebStart
  ) {
    const place =
      enrichedCandidates.find(
        (candidate) =>
          String(
            candidate.id
          ) ===
          assessment.id
      );

    if (!place) {
      continue;
    }

    const missing =
      assessment
        .requirementChecks
        .filter(
          (check) =>
            check.status ===
              "needs_verification"
        )
        .map(
          (check) =>
            check.requirement
        );

    console.log(
      "-",
      place.name,
      "→",
      missing.join(
        " | "
      )
    );
  }

  const skippedWebUnknowns =
    unknown.filter(
      (assessment) =>
        !unknownAtWebStart.some(
          (webAssessment) =>
            webAssessment.id ===
            assessment.id
        )
    );

  if (
    skippedWebUnknowns.length >
      0
  ) {
    console.log(
      "WEB INUTILE POUR :"
    );

    for (
      const assessment of
      skippedWebUnknowns
    ) {
      const place =
        enrichedCandidates.find(
          (candidate) =>
            String(
              candidate.id
            ) ===
            assessment.id
        );

      if (!place) {
        continue;
      }

      console.log(
        "-",
        place.name,
        "→ aucun signal Indie Map suffisant pour justifier une consultation du site"
      );
    }
  }

  let webChecks =
    0;

  let webConfirmedChecks =
    0;

  let webContradictedChecks =
    0;

  let webNotFoundChecks =
    0;

  let webErrors =
    0;

  const webCandidatesToRun =
    webDryRun
      ? []
      : unknownAtWebStart;

  if (
    webDryRun
  ) {
    console.log(
      "WEB DRY RUN : aucune consultation officielle exécutée"
    );
  }

  const webOutcomes =
    await mapWithConcurrency(
      webCandidatesToRun,
      WEB_VERIFY_CONCURRENCY,
      async (
        assessment
      ) => {
        const place =
          enrichedCandidates.find(
            (candidate) =>
              String(
                candidate.id
              ) ===
              assessment.id
          );

        if (
          !place ||
          !place.website
        ) {
          return {
            status:
              "unknown" as const,

            assessment,
            place:
              place ?? null,
          };
        }

        const updatedChecks:
          RequirementCheck[] =
            [];

        for (
          const check of
          assessment
            .requirementChecks
        ) {
          /*
           * Un critère déjà résolu localement ou par
           * la mémoire n'est jamais revérifié.
           */
          if (
            check.status !==
              "needs_verification"
          ) {
            updatedChecks.push(
              check
            );

            continue;
          }

          webChecks +=
            1;

          const question =
            `Pour l'établissement "${place.name}"${place.city ? ` à ${place.city}` : ""}, le site officiel confirme-t-il explicitement le point suivant : "${check.requirement}" ?`;

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
                      place.name ||
                        ""
                    ),

                  city:
                    String(
                      place.city ||
                        ""
                    ),

                  address:
                    String(
                      place.address ||
                        ""
                    ),

                  website:
                    place.website,
                },

                question,
              });

            /*
             * Seules les preuves réellement trouvées
             * et applicables au lieu / à la marque
             * peuvent servir à confirmer ou contredire.
             */
            const relevantEvidence =
              official.evidence
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
                  (evidence) =>
                    evidence.evidenceText
                      .trim()
                )
                .filter(
                  Boolean
                );

            if (
              official.status ===
                "CONFIRMED" &&
              relevantEvidence.length >
                0
            ) {
              webConfirmedChecks +=
                1;

              updatedChecks.push({
                requirement:
                  check.requirement,

                /*
                 * Le type actuel appelle encore cet état
                 * confirmed_internal.
                 *
                 * La provenance réelle reste explicite
                 * dans reason/evidence et dans AiVerifiedFact.
                 */
                status:
                  "confirmed_internal",

                evidence:
                  relevantEvidence,

                reason:
                  "Critère confirmé explicitement par le site officiel.",
              });

              continue;
            }

            if (
              official.status ===
                "CONTRADICTED" &&
              relevantEvidence.length >
                0
            ) {
              webContradictedChecks +=
                1;

              updatedChecks.push({
                requirement:
                  check.requirement,

                status:
                  "contradicted",

                evidence:
                  relevantEvidence,

                reason:
                  "Critère explicitement contredit par le site officiel.",
              });

              continue;
            }

            /*
             * NOT_FOUND ou décision sans preuve
             * exploitable :
             *
             * on n'invente rien et on ne rejette pas.
             */
            webNotFoundChecks +=
              1;

            updatedChecks.push({
              requirement:
                check.requirement,

              status:
                "needs_verification",

              evidence: [],

              reason:
                official.status ===
                  "NOT_FOUND"
                  ? "Information non trouvée sur le site officiel."
                  : "Le site officiel n'a pas fourni de preuve exploitable pour ce critère.",
            });
          } catch (
            error: any
          ) {
            webErrors +=
              1;

            console.error(
              "VERIFICATION OFFICIELLE ÉCHOUÉE :",
              place.name,
              check.requirement,
              error?.message ||
                error
            );

            /*
             * Une erreur réseau ne devient jamais
             * une contradiction.
             */
            updatedChecks.push({
              ...check,

              status:
                "needs_verification",

              reason:
                "Vérification officielle impossible pour le moment.",
            });
          }
        }

        let coreFit =
          assessment.coreFit;

        const hasContradiction =
          updatedChecks.some(
            (check) =>
              check.status ===
                "contradicted"
          );

        const hasUnknown =
          updatedChecks.some(
            (check) =>
              check.status ===
                "needs_verification"
          );

        const allConfirmed =
          updatedChecks.length >
            0 &&
          updatedChecks.every(
            (check) =>
              check.status ===
                "confirmed_internal"
          );

        /*
         * Un candidat dont TOUS les critères sont
         * désormais prouvés ne reste pas artificiellement
         * sous le seuil de résultat.
         */
        if (
          allConfirmed
        ) {
          coreFit =
            Math.max(
              coreFit,
              80
            );
        }

        const confirmedCount =
          updatedChecks.filter(
            (check) =>
              check.status ===
                "confirmed_internal"
          ).length;

        const unknownCount =
          updatedChecks.filter(
            (check) =>
              check.status ===
                "needs_verification"
          ).length;

        const contradictedCount =
          updatedChecks.filter(
            (check) =>
              check.status ===
                "contradicted"
          ).length;

        const updatedAssessment:
          PreAssessment = {
            ...assessment,

            coreFit,

            requirementChecks:
              updatedChecks,

            reason:
              `${confirmedCount}/${updatedChecks.length} critère(s) confirmé(s), ${unknownCount} inconnu(s), ${contradictedCount} contradit(s) après données Indie Map, mémoire et site officiel.`,
          };

        if (
          hasContradiction
        ) {
          return {
            status:
              "contradicted" as const,

            assessment:
              updatedAssessment,

            place,
          };
        }

        if (
          hasUnknown
        ) {
          return {
            status:
              "unknown" as const,

            assessment:
              updatedAssessment,

            place,
          };
        }

        /*
         * À cet instant précis, une future API en flux
         * pourra envoyer immédiatement le nouveau résultat
         * à l'interface.
         */
        const streamedWebResult =
          assessmentsToResults(
            [
              updatedAssessment,
            ],
            enrichedCandidates
          )[0];

        if (
          streamedWebResult
        ) {
          emitV5StreamEvent({
            type: "results",
            phase: "web",
            results: [
              streamedWebResult,
            ],
          });
        }

        console.log(
          "RESULTAT CONFIRME PAR LE WEB :",
          place.name,
          `${coreFit}/100`
        );

        return {
          status:
            "confirmed" as const,

          assessment:
            updatedAssessment,

          place,
        };
      }
    );

  /*
   * Les tableaux sont volontairement mutés :
   * tout le reste de searchV5Simple peut continuer
   * d'utiliser confirmed / unknown / contradicted / results.
   */
  unknown.length =
    0;

  /*
   * Les candidats pour lesquels le web serait une
   * exploration aveugle restent simplement UNKNOWN.
   */
  unknown.push(
    ...skippedWebUnknowns
  );

  const webConfirmedAssessments:
    PreAssessment[] =
      [];

  for (
    const outcome of
    webOutcomes
  ) {
    if (
      outcome.status ===
        "confirmed"
    ) {
      confirmed.push(
        outcome.assessment
      );

      webConfirmedAssessments.push(
        outcome.assessment
      );

      continue;
    }

    if (
      outcome.status ===
        "contradicted"
    ) {
      contradicted.push(
        outcome.assessment
      );

      continue;
    }

    unknown.push(
      outcome.assessment
    );
  }

  const existingResultIds =
    new Set(
      results.map(
        (result) =>
          result.id
      )
    );

  const webAddedResults =
    assessmentsToResults(
      webConfirmedAssessments,
      enrichedCandidates
    ).filter(
      (result) =>
        !existingResultIds.has(
          result.id
        )
    );

  /*
   * On AJOUTE les nouveaux lieux.
   * On ne réordonne pas les résultats déjà visibles,
   * pour éviter que l'écran saute pendant la lecture.
   */
  results.push(
    ...webAddedResults
  );

  const phaseCFinishedAt =
    performance.now();

  console.log(
    "PHASE C WEB :",
    `candidats=${unknownAtWebStart.length}`,
    `checks=${webChecks}`,
    `confirmes=${webConfirmedChecks}`,
    `contradits=${webContradictedChecks}`,
    `nonTrouves=${webNotFoundChecks}`,
    `erreurs=${webErrors}`,
    `nouveauxResultats=${webAddedResults.length}`,
    `latence=${Math.round(
      phaseCFinishedAt -
      phaseCStartedAt
    )}ms`
  );

  const finishedAt =
    performance.now();

  console.log(
    "V5 SIMPLE :",
    `univers=${universe.length}`,
    `candidats=${candidates.length}`,
    `faitsMemoire=${facts.length}`,
    `confirmes=${confirmed.length}`,
    `inconnus=${unknown.length}`,
    `contradits=${contradicted.length}`
  );

  console.log(
    "LATENCE V5 SIMPLE :",
    `parse+embedding=${Math.round(
      understoodAt -
      startedAt
    )}ms`,
    `retrieval=${Math.round(
      retrievalAt -
      understoodAt
    )}ms`,
    `premiersResultats=${Math.round(
      phaseAReadyAt -
      startedAt
    )}ms`,
    `memoireTotal=${Math.round(
      memoryLoadedAt -
      memoryStartedAt
    )}ms`,
    `attenteMemoireApresPhaseA=${Math.round(
      memoryLoadedAt -
      memoryWaitStartedAt
    )}ms`,
    `evaluationMemoire=${Math.round(
      evaluatedAt -
      localEvaluationStartedAt
    )}ms`,
    `total=${Math.round(
      finishedAt -
      startedAt
    )}ms`
  );

  if (
    unknown.length > 0
  ) {
    console.log(
      "INCONNUS POTENTIELLEMENT A VERIFIER SUR LE WEB :"
    );

    for (
      const assessment of
      unknown
    ) {
      const place =
        candidates.find(
          (candidate) =>
            String(
              candidate.id
            ) ===
            assessment.id
        );

      console.log(
        "-",
        place?.name ??
          assessment.id,
        `${assessment.coreFit}/100`,
        "→",
        assessment
          .requirementChecks
          .filter(
            (check) =>
              check.status ===
                "needs_verification"
          )
          .map(
            (check) =>
              check.requirement
          )
          .join(" | ")
      );
    }
  }

  emitV5StreamEvent({
    type: "done",
    results,
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
        confirmed.length,

      needsVerification:
        unknown.length,

      rejected:
        contradicted.length,

      officialChecks: 0,
      officialConfirmed: 0,
      officialNotFound: 0,
      officialContradicted: 0,
    },

    noGoodMatch:
      results.length === 0,

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
      "Usage: pnpm exec tsx scripts/search-ai-v5.ts <fichier.json>"
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
    "=== INDIE MAP AI SEARCH V5 SIMPLE ==="
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
      await searchV5Simple(query);

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
    "tmp/search-v5-simple-results.json",
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
    "RÉSULTATS JSON : tmp/search-v5-simple-results.json"
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
