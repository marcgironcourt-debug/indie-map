import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config({
  path: ".env.local",
  quiet: true
});

const MODEL =
  process.env
    .SCOUT_PROSPECT_MODEL
    ?.trim() ||
  "gpt-5.5";

const CORPUS_PATH =
  "data/private/scout/catalogue-site-learning-corpus.v2.json";

const PLACES_PATH =
  "data/places.json";

const FEEDBACK_PATH =
  "data/private/scout/prospect-feedback.v1.json";

const HISTORY_PATH =
  "data/private/scout/prospect-history.v1.json";

const HISTORY_LOCK_PATH =
  "data/private/scout/prospect-history.v1.lock";

const HISTORY_VERSION =
  "scout-prospect-history-v1";

const INDIE_MAP_CATEGORIES = [
  {
    name: "Restaurant",
    aliases: [
      "Restaurant"
    ]
  },
  {
    name: "Lieu alternatif",
    aliases: [
      "Lieu alternatif",
      "Lieu de vie"
    ]
  },
  {
    name: "Ferme",
    aliases: [
      "Ferme"
    ]
  },
  {
    name: "Marché",
    aliases: [
      "Marché"
    ]
  },
  {
    name: "Épicerie",
    aliases: [
      "Épicerie",
      "grocery"
    ]
  },
  {
    name: "Café / brunch",
    aliases: [
      "Café / brunch",
      "Café",
      "cafe",
      "Brunch"
    ]
  },
  {
    name: "Boulangerie",
    aliases: [
      "Boulangerie"
    ]
  },
  {
    name: "Librairie",
    aliases: [
      "Librairie"
    ]
  },
  {
    name: "Mode",
    aliases: [
      "Mode"
    ]
  },
  {
    name: "Brasserie / bar / pub",
    aliases: [
      "Brasserie / bar / pub",
      "Brasserie / Bar",
      "Brasserie",
      "Brasserie bar",
      "Bar",
      "Pub"
    ]
  },
  {
    name: "Atelier",
    aliases: [
      "Atelier"
    ]
  },
  {
    name: "Boutique",
    aliases: [
      "Boutique",
      "Artisanat / Créateurs locaux",
      "Artisanat"
    ]
  }
];

const BLOCKED_DOMAINS = [
  "facebook.com",
  "instagram.com",
  "tripadvisor.com",
  "tripadvisor.fr",
  "thefork.com",
  "thefork.fr",
  "google.com",
  "goo.gl",
  "linktr.ee",
  "yelp.com",
  "deliveroo.fr",
  "deliveroo.com",
  "ubereats.com",
  "just-eat.fr",
  "opentable.com",
  "restaurantguru.com",
  "pagesjaunes.fr",
  "michelin.com"
];

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values) {
  const result =
    new Map();

  for (const value of values) {
    const cleaned =
      String(value || "").trim();

    if (!cleaned) {
      continue;
    }

    const key =
      normalize(cleaned);

    if (!result.has(key)) {
      result.set(
        key,
        cleaned
      );
    }
  }

  return [
    ...result.values()
  ];
}

function argumentValue(
  name,
  fallback
) {
  const prefix =
    `${name}=`;

  const argument =
    process.argv
      .slice(2)
      .find(
        value =>
          value.startsWith(prefix)
      );

  return argument
    ? argument
        .slice(prefix.length)
        .trim()
    : fallback;
}

function positiveIntegerArgument(
  name,
  fallback
) {
  const raw =
    argumentValue(
      name,
      String(fallback)
    );

  const value =
    Number(raw);

  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > 25
  ) {
    throw new Error(
      `${name} invalide : ${raw}`
    );
  }

  return value;
}

function hasFlag(name) {
  return process.argv
    .slice(2)
    .includes(name);
}

function categoryDefinition(value) {
  const normalizedValue =
    normalize(value);

  return INDIE_MAP_CATEGORIES.find(
    category =>
      [
        category.name,
        ...category.aliases
      ].some(
        alias =>
          normalize(alias) ===
            normalizedValue
      )
  );
}

function requestedMission() {
  const area =
    argumentValue(
      "--area",
      ""
    );

  const country =
    argumentValue(
      "--country",
      ""
    );

  const requestedCategory =
    argumentValue(
      "--category",
      ""
    );

  const allCategories =
    hasFlag(
      "--all-categories"
    );

  if (!area) {
    throw new Error(
      "--area est obligatoire"
    );
  }

  if (
    allCategories ===
      Boolean(requestedCategory)
  ) {
    throw new Error(
      "Utilise soit --category=..., soit --all-categories"
    );
  }

  if (allCategories) {
    return {
      area,
      country,
      categories:
        INDIE_MAP_CATEGORIES
    };
  }

  const category =
    categoryDefinition(
      requestedCategory
    );

  if (!category) {
    throw new Error(
      [
        `Catégorie Indie Map inconnue : ${requestedCategory}`,
        "Catégories autorisées :",
        ...INDIE_MAP_CATEGORIES.map(
          value =>
            `- ${value.name}`
        )
      ].join("\n")
    );
  }

  return {
    area,
    country,
    categories: [
      category
    ]
  };
}

function canonicalWebsite(value) {
  try {
    const url =
      new URL(
        String(value || "").trim()
      );

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return "";
    }

    url.hash = "";
    url.search = "";

    url.hostname =
      url.hostname
        .toLowerCase()
        .replace(/^www\./, "");

    url.pathname =
      url.pathname
        .replace(/\/+$/, "") ||
      "/";

    return url.toString();
  } catch {
    return "";
  }
}

function hostnameOf(value) {
  const canonical =
    canonicalWebsite(value);

  if (!canonical) {
    return "";
  }

  return new URL(canonical)
    .hostname
    .toLowerCase()
    .replace(/^www\./, "");
}

function websiteOf(place) {
  return canonicalWebsite(
    place.officialWebsite ||
    place.website
  );
}

function municipalityOf(place) {
  return normalize(
    place.municipality ||
    place.city
  );
}

function isBlockedWebsite(value) {
  const hostname =
    hostnameOf(value);

  if (!hostname) {
    return true;
  }

  return BLOCKED_DOMAINS.some(
    domain =>
      hostname === domain ||
      hostname.endsWith(
        `.${domain}`
      )
  );
}

function samePlaceIdentity(
  first,
  second
) {
  const firstWebsite =
    websiteOf(first);

  const secondWebsite =
    websiteOf(second);

  if (
    firstWebsite &&
    secondWebsite &&
    firstWebsite === secondWebsite
  ) {
    return true;
  }

  const firstName =
    normalize(first.name);

  const secondName =
    normalize(second.name);

  if (
    !firstName ||
    !secondName
  ) {
    return false;
  }

  const firstMunicipality =
    municipalityOf(first);

  const secondMunicipality =
    municipalityOf(second);

  if (
    firstName === secondName &&
    (
      !firstMunicipality ||
      !secondMunicipality ||
      firstMunicipality ===
        secondMunicipality
    )
  ) {
    return true;
  }

  const firstHost =
    hostnameOf(firstWebsite);

  const secondHost =
    hostnameOf(secondWebsite);

  if (
    firstHost &&
    firstHost === secondHost
  ) {
    const shortestLength =
      Math.min(
        firstName.length,
        secondName.length
      );

    if (
      shortestLength >= 7 &&
      (
        firstName.includes(
          secondName
        ) ||
        secondName.includes(
          firstName
        )
      )
    ) {
      return true;
    }
  }

  return false;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Fichier absent : ${filePath}`
    );
  }

  return JSON.parse(
    fs.readFileSync(
      filePath,
      "utf8"
    )
  );
}

function writeJsonAtomic(
  filePath,
  value
) {
  fs.mkdirSync(
    path.dirname(filePath),
    {
      recursive: true
    }
  );

  const temporaryPath =
    `${filePath}.${process.pid}.tmp`;

  fs.writeFileSync(
    temporaryPath,
    JSON.stringify(
      value,
      null,
      2
    ) + "\n",
    "utf8"
  );

  fs.renameSync(
    temporaryPath,
    filePath
  );
}

function loadHistory() {
  if (
    !fs.existsSync(
      HISTORY_PATH
    )
  ) {
    return {
      version:
        HISTORY_VERSION,
      updatedAt:
        new Date().toISOString(),
      proposals: []
    };
  }

  const history =
    readJson(HISTORY_PATH);

  if (
    history.version !==
      HISTORY_VERSION
  ) {
    throw new Error(
      `Version d'historique inattendue : ${history.version}`
    );
  }

  if (
    !Array.isArray(
      history.proposals
    )
  ) {
    throw new Error(
      "history.proposals doit être un tableau"
    );
  }

  return history;
}

function learningTextOf(profile) {
  if (
    typeof profile.learningTextFr ===
      "string" &&
    profile.learningTextFr.trim()
  ) {
    return profile
      .learningTextFr
      .trim();
  }

  const findings =
    Array.isArray(
      profile.officialFindings
    )
      ? profile.officialFindings
      : [];

  return uniqueStrings([
    ...(
      Array.isArray(
        profile.internalDrivers
      )
        ? profile.internalDrivers
        : []
    ),
    ...findings
      .filter(
        finding =>
          finding.scope ===
            "target_place" ||
          finding.scope ===
            "brand_general"
      )
      .flatMap(
        finding => [
          finding.concept,
          finding.statementFr
        ]
      )
  ]).join(" — ");
}

function applicableOfficialFindingsOf(
  profile
) {
  return (
    Array.isArray(
      profile.officialFindings
    )
      ? profile.officialFindings
      : []
  ).filter(
    finding =>
      finding.scope ===
        "target_place" ||
      finding.scope ===
        "brand_general"
  );
}

function compactLearningOf(
  profiles
) {
  const internalSignals =
    uniqueStrings(
      profiles.flatMap(
        profile =>
          Array.isArray(
            profile.internalDrivers
          )
            ? profile.internalDrivers
            : []
      )
    );

  const officialConcepts =
    uniqueStrings(
      profiles.flatMap(
        profile =>
          applicableOfficialFindingsOf(
            profile
          )
            .map(
              finding =>
                finding.concept
            )
            .filter(
              value =>
                typeof value ===
                  "string" &&
                value.trim()
            )
      )
    );

  const sourceOfficialFindingCount =
    profiles.reduce(
      (
        total,
        profile
      ) =>
        total +
        applicableOfficialFindingsOf(
          profile
        ).length,
      0
    );

  const rankedProfiles =
    [...profiles].sort(
      (
        left,
        right
      ) =>
        applicableOfficialFindingsOf(
          right
        ).length -
          applicableOfficialFindingsOf(
            left
          ).length ||
        String(
          left.siteProfileId || ""
        ).localeCompare(
          String(
            right.siteProfileId || ""
          )
        )
    );

  const representativeProfiles =
    rankedProfiles
      .slice(
        0,
        12
      )
      .map(
        profile => ({
          places:
            uniqueStrings(
              (
                Array.isArray(
                  profile.places
                )
                  ? profile.places
                  : []
              )
                .map(
                  place =>
                    place.name
                )
                .filter(
                  value =>
                    typeof value ===
                      "string" &&
                    value.trim()
                )
            ),

          internalSignals:
            Array.isArray(
              profile.internalDrivers
            )
              ? profile.internalDrivers
              : [],

          officialEvidence:
            applicableOfficialFindingsOf(
              profile
            )
              .slice(
                0,
                3
              )
              .map(
                finding => ({
                  concept:
                    typeof finding.concept ===
                      "string"
                      ? finding.concept
                      : "",

                  statementFr:
                    typeof finding.statementFr ===
                      "string"
                      ? finding.statementFr
                      : ""
                })
              )
        })
      );

  return {
    sourceProfileCount:
      profiles.length,

    sourceOfficialFindingCount,

    internalSignals,

    officialConcepts,

    representativeProfiles
  };
}

function profileMatchesCategory(
  profile,
  category
) {
  const aliases =
    new Set(
      category.aliases.map(
        normalize
      )
    );

  return (
    Array.isArray(
      profile.categories
    )
      ? profile.categories
      : []
  ).some(
    value =>
      aliases.has(
        normalize(value)
      )
  );
}

function feedbackData(
  feedback,
  category
) {
  const sessions =
    Array.isArray(
      feedback.sessions
    )
      ? feedback.sessions
      : [];

  const relevantSessions =
    sessions.filter(
      session => {
        const recordedCategory =
          session?.mission
            ?.category ||
          session?.category ||
          "";

        if (recordedCategory) {
          return normalize(
            recordedCategory
          ) === normalize(
            category.name
          );
        }

        return normalize(
          category.name
        ) === normalize(
          "Restaurant"
        );
      }
    );

  const principles =
    uniqueStrings(
      relevantSessions.flatMap(
        session =>
          Array.isArray(
            session.learningPrinciplesFr
          )
            ? session.learningPrinciplesFr
            : []
      )
    );

  const decisions =
    relevantSessions.flatMap(
      session =>
        (
          Array.isArray(
            session.decisions
          )
            ? session.decisions
            : []
        ).map(
          decision => ({
            name:
              decision.name || "",
            website:
              decision.website || "",
            decision:
              decision.decision || "",
            reasonFr:
              decision.reasonFr || "",
            learningSignals:
              Array.isArray(
                decision.learningSignals
              )
                ? decision.learningSignals
                : []
          })
        )
    );

  return {
    principles,
    decisions
  };
}

function previousIdentities(
  history,
  decisions
) {
  return [
    ...history.proposals,
    ...decisions.map(
      decision => ({
        name:
          decision.name,
        municipality:
          null,
        website:
          decision.website
      })
    )
  ];
}

function responseSchema(
  maximumCandidates
) {
  return {
    type: "object",
    additionalProperties:
      false,
    required: [
      "candidates"
    ],
    properties: {
      candidates: {
        type: "array",
        maxItems:
          maximumCandidates,
        items: {
          type: "object",
          additionalProperties:
            false,
          required: [
            "name",
            "municipality",
            "officialWebsite"
          ],
          properties: {
            name: {
              type: "string"
            },
            municipality: {
              type: "string"
            },
            officialWebsite: {
              type: "string"
            }
          }
        }
      }
    }
  };
}

function cleanCandidate(value) {
  const name =
    String(
      value?.name || ""
    ).trim();

  const municipality =
    String(
      value?.municipality || ""
    ).trim();

  const officialWebsite =
    canonicalWebsite(
      value?.officialWebsite
    );

  if (
    !name ||
    !municipality ||
    !officialWebsite
  ) {
    return null;
  }

  return {
    name,
    municipality,
    officialWebsite
  };
}

function selectNewCandidates({
  rawCandidates,
  catalogue,
  previous,
  limit
}) {
  const selected = [];

  for (
    const rawCandidate of
    rawCandidates
  ) {
    const candidate =
      cleanCandidate(
        rawCandidate
      );

    if (!candidate) {
      continue;
    }

    if (
      isBlockedWebsite(
        candidate.officialWebsite
      )
    ) {
      continue;
    }

    if (
      catalogue.some(
        place =>
          samePlaceIdentity(
            candidate,
            place
          )
      )
    ) {
      continue;
    }

    if (
      previous.some(
        place =>
          samePlaceIdentity(
            candidate,
            place
          )
      )
    ) {
      continue;
    }

    if (
      selected.some(
        place =>
          samePlaceIdentity(
            candidate,
            place
          )
      )
    ) {
      continue;
    }

    selected.push(
      candidate
    );

    if (
      selected.length === limit
    ) {
      break;
    }
  }

  return selected;
}

function finalizeCandidates({
  rawCandidates,
  catalogue,
  feedbackDecisions,
  category,
  area,
  country,
  limit
}) {
  fs.mkdirSync(
    path.dirname(
      HISTORY_LOCK_PATH
    ),
    {
      recursive: true
    }
  );

  let lockDescriptor;

  try {
    lockDescriptor =
      fs.openSync(
        HISTORY_LOCK_PATH,
        "wx"
      );

    fs.writeFileSync(
      lockDescriptor,
      JSON.stringify({
        pid:
          process.pid,
        createdAt:
          new Date().toISOString()
      }),
      "utf8"
    );
  } catch (error) {
    if (
      error?.code === "EEXIST"
    ) {
      throw new Error(
        [
          "Une autre finalisation de prospection semble être en cours.",
          `Verrou présent : ${HISTORY_LOCK_PATH}`
        ].join("\n")
      );
    }

    throw error;
  }

  try {
    const history =
      loadHistory();

    const previous =
      previousIdentities(
        history,
        feedbackDecisions
      );

    const selected =
      selectNewCandidates({
        rawCandidates,
        catalogue,
        previous,
        limit
      });

    if (
      selected.length > 0
    ) {
      const proposedAt =
        new Date().toISOString();

      const missionSlug =
        normalize(
          `${category.name}-${area}`
        )
          .replace(/\s+/g, "-")
          .slice(0, 80) ||
        "bulle";

      const runId =
        `${missionSlug}-${proposedAt.replace(/[:.]/g, "-")}`;

      const mission = {
        category:
          category.name,
        area:
          area,
        country:
          country || null,
        requestedCandidates:
          limit
      };

      for (
        const candidate of
        selected
      ) {
        history.proposals.push({
          name:
            candidate.name,
          municipality:
            candidate.municipality,
          website:
            candidate.officialWebsite,
          firstProposedAt:
            proposedAt,
          sourceSessionId:
            runId,
          mission
        });
      }

      history.updatedAt =
        proposedAt;

      writeJsonAtomic(
        HISTORY_PATH,
        history
      );
    }

    return selected;
  } finally {
    if (
      lockDescriptor !==
        undefined
    ) {
      fs.closeSync(
        lockDescriptor
      );
    }

    if (
      fs.existsSync(
        HISTORY_LOCK_PATH
      )
    ) {
      fs.unlinkSync(
        HISTORY_LOCK_PATH
      );
    }
  }
}

async function prospectCategory({
  client,
  category,
  area,
  country,
  limit,
  rawLimit,
  corpus,
  catalogue,
  feedback
}) {
  const categoryProfiles =
    corpus.siteProfiles
      .filter(
        profile =>
          profileMatchesCategory(
            profile,
            category
          )
      );

  if (
    categoryProfiles.length === 0
  ) {
    throw new Error(
      `Aucun exemple ${category.name} trouvé dans le corpus`
    );
  }

  const compactLearning =
    compactLearningOf(
      categoryProfiles
    );

  const {
    principles,
    decisions
  } =
    feedbackData(
      feedback,
      category
    );

  const history =
    loadHistory();

  const compactCatalogue =
    catalogue.map(
      place => ({
        name:
          place.name || "",
        city:
          place.city || "",
        website:
          place.website || ""
      })
    );

  const compactHistory =
    history.proposals.map(
      proposal => ({
        name:
          proposal.name || "",
        municipality:
          proposal.municipality || "",
        website:
          proposal.website || ""
      })
    );

  const countryInstruction =
    country
      ? `- Pays obligatoire : ${country}`
      : "- Pays : inclus dans la zone indiquée";

  const prompt = `
MISSION

Recherche sur le Web de nouveaux lieux susceptibles de correspondre
à Indie Map.

- Zone géographique obligatoire : ${area}
${countryInstruction}
- Catégorie Indie Map exacte : ${category.name}
- Candidats bruts demandés : jusqu'à ${rawLimit}
- L'utilisateur ne verra finalement que ${limit} lieux maximum.

Tu recherches uniquement des candidats pour la catégorie Indie Map
indiquée. Tu n'as pas le droit de créer, renommer, subdiviser ou
remplacer cette catégorie.

Le résultat est une présélection. L'utilisateur vérifiera lui-même
chaque site. Tu ne dois pas déclarer qu'un lieu est définitivement
éligible, mais tu dois examiner suffisamment les informations
publiques pour éviter les faux positifs évidents.

APPRENTISSAGE POSITIF INDIE MAP — SYNTHÈSE LOCALE

La synthèse suivante est construite localement à partir de tous les
profils audités de cette catégorie.

- internalSignals contient les signaux internes uniques.
- officialConcepts contient tous les concepts pertinents découverts
  sur les sites officiels, y compris les concepts rares.
- representativeProfiles fournit des exemples détaillés reliant
  signaux internes et preuves officielles.

Ce sont des exemples positifs, pas une liste de critères obligatoires.
Un signal rare et concret reste important même s'il apparaît peu.

${JSON.stringify(compactLearning)}

APPRENTISSAGE ISSU DE LA REVUE MANUELLE DE CETTE CATÉGORIE

Principes appris :

${JSON.stringify(principles)}

Décisions détaillées :

${JSON.stringify(decisions)}

Applique ces retours uniquement à la catégorie demandée. Une promesse
générale comme « local », « responsable », « durable », « artisanal »
ou « fait maison » ne suffit jamais à elle seule. Recherche des
éléments concrets cohérents avec l'apprentissage Indie Map.

LIEUX DÉJÀ PROPOSÉS — INTERDICTION ABSOLUE

Ne retourne aucun de ces lieux, même s'il paraît pertinent.

${JSON.stringify(compactHistory)}

CATALOGUE INDIE MAP — À EXCLURE

${JSON.stringify(compactCatalogue)}

MÉTHODE OBLIGATOIRE

- Utilise au maximum deux appels à l'outil de recherche Web.
- Utilise le premier pour découvrir des candidats pertinents dans la
  zone et le second pour confirmer les pistes les plus solides.
- Ne poursuis pas la recherche au-delà de ces deux appels.
- Recherche seulement la catégorie Indie Map exacte indiquée.
- Vérifie que chaque lieu se trouve réellement dans la zone demandée.
- Vérifie que le lieu semble encore actif.
- Les annuaires, médias, cartes et plateformes peuvent servir à
  découvrir des pistes, mais officialWebsite doit être une page
  officielle directe du lieu ou de l'organisation qui l'exploite.
- Exclure Instagram, Facebook, Tripadvisor, TheFork, Google Maps,
  les plateformes de livraison, de réservation et les annuaires.
- Exclure tout lieu déjà présent dans Indie Map.
- Exclure tout lieu déjà proposé lors d'une recherche précédente.
- Ne jamais inventer un nom, une commune ou une URL.
- Ne fournis aucune justification dans le JSON.
- municipality sert uniquement au contrôle géographique interne.
  `.trim();

  const requestDiagnostics = {
    category:
      category.name,
    webSearchContext:
      "low",
    maximumWebToolCalls:
      2,
    learningProfiles:
      categoryProfiles.length,
    learningOfficialFindings:
      compactLearning
        .sourceOfficialFindingCount,
    learningInternalSignals:
      compactLearning
        .internalSignals.length,
    learningOfficialConcepts:
      compactLearning
        .officialConcepts.length,
    learningRepresentativeProfiles:
      compactLearning
        .representativeProfiles.length,
    learningBytes:
      Buffer.byteLength(
        JSON.stringify(
          compactLearning
        ),
        "utf8"
      ),
    cataloguePlaces:
      compactCatalogue.length,
    catalogueBytes:
      Buffer.byteLength(
        JSON.stringify(
          compactCatalogue
        ),
        "utf8"
      ),
    historyProposals:
      compactHistory.length,
    historyBytes:
      Buffer.byteLength(
        JSON.stringify(
          compactHistory
        ),
        "utf8"
      ),
    promptCharacters:
      prompt.length,
    promptBytes:
      Buffer.byteLength(
        prompt,
        "utf8"
      )
  };

  console.error(
    `Diagnostic requête : ${JSON.stringify(requestDiagnostics)}`
  );

  if (
    hasFlag(
      "--diagnose-request"
    )
  ) {
    return limit;
  }

  console.error(
    `Recherche Bulle : ${category.name} — ${area}…`
  );

  let response =
    await client.responses.create({
      model:
        MODEL,

      reasoning: {
        effort:
          "high"
      },

      background:
        true,

      store:
        false,

      tools: [
        {
          type:
            "web_search",
          search_context_size:
            "low"
        }
      ],

      tool_choice:
        "required",

      max_tool_calls:
        2,

      max_output_tokens:
        8000,

      text: {
        format: {
          type:
            "json_schema",
          name:
            "indie_map_prospects",
          strict:
            true,
          schema:
            responseSchema(
              rawLimit
            )
        }
      },

      input:
        prompt
    });

  let previousStatus =
    response.status;

  let pollingCount =
    0;

  console.error(
    `Réponse Bulle ${response.id} : ${response.status}`
  );

  while (
    response.status === "queued" ||
    response.status === "in_progress"
  ) {
    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          5000
        )
    );

    response =
      await client.responses.retrieve(
        response.id
      );

    pollingCount += 1;

    if (
      response.status !== previousStatus ||
      pollingCount % 6 === 0
    ) {
      console.error(
        `Réponse Bulle ${response.id} : ${response.status}`
      );

      previousStatus =
        response.status;
    }
  }

  if (
    response.status !== "completed"
  ) {
    const finalDetails =
      response.error ??
      response.incomplete_details ??
      null;

    const terminalError =
      new Error(
        `Réponse Bulle ${response.id} terminée avec le statut ${response.status} : ${JSON.stringify(finalDetails)}`
      );

    terminalError.code =
      finalDetails?.code ?? null;

    terminalError.type =
      "background_response_failed";

    terminalError.request_id =
      response.id;

    throw terminalError;
  }

  if (
    !response.output_text
  ) {
    throw new Error(
      `Réponse de prospection vide pour ${category.name}`
    );
  }

  const parsed =
    JSON.parse(
      response.output_text
        .replace(
          /^```(?:json)?\s*/i,
          ""
        )
        .replace(
          /\s*```$/,
          ""
        )
        .trim()
    );

  const rawCandidates =
    Array.isArray(
      parsed.candidates
    )
      ? parsed.candidates
      : [];

  const selected =
    finalizeCandidates({
      rawCandidates,
      catalogue,
      feedbackDecisions:
        decisions,
      category,
      area,
      country,
      limit
    });

  console.log(
    `\n=== ${category.name.toUpperCase()} — LIEUX À VÉRIFIER ===\n`
  );

  for (
    let index = 0;
    index < selected.length;
    index += 1
  ) {
    console.log(
      `${index + 1}. ${selected[index].name}`
    );

    console.log(
      `   ${selected[index].officialWebsite}`
    );
  }

  if (
    selected.length < limit
  ) {
    console.error(
      `\nSeulement ${selected.length} nouveau(x) lieu(x) valide(s) obtenu(s) pour ${category.name}.`
    );
  }

  return selected.length;
}

async function main() {
  if (
    hasFlag(
      "--list-categories"
    )
  ) {
    for (
      const category of
      INDIE_MAP_CATEGORIES
    ) {
      console.log(
        category.name
      );
    }

    return;
  }

  const {
    area,
    country,
    categories
  } =
    requestedMission();

  const limit =
    positiveIntegerArgument(
      "--limit",
      10
    );

  if (limit > 10) {
    throw new Error(
      "--limit ne peut pas dépasser 10"
    );
  }

  const rawLimit =
    10;

  const corpus =
    readJson(
      CORPUS_PATH
    );

  const catalogue =
    readJson(
      PLACES_PATH
    );

  const feedback =
    readJson(
      FEEDBACK_PATH
    );

  const history =
    loadHistory();

  if (
    !Array.isArray(
      corpus.siteProfiles
    )
  ) {
    throw new Error(
      "corpus.siteProfiles doit être un tableau"
    );
  }

  if (
    !Array.isArray(
      catalogue
    )
  ) {
    throw new Error(
      "data/places.json doit être un tableau"
    );
  }

  const missionSummaries =
    categories.map(
      category => {
        const positiveExamples =
          uniqueStrings(
            corpus.siteProfiles
              .filter(
                profile =>
                  profileMatchesCategory(
                    profile,
                    category
                  )
              )
              .map(
                learningTextOf
              )
          );

        if (
          positiveExamples.length === 0
        ) {
          throw new Error(
            `Aucun exemple ${category.name} trouvé dans le corpus`
          );
        }

        const {
          principles,
          decisions
        } =
          feedbackData(
            feedback,
            category
          );

        return {
          category:
            category.name,
          positiveExamples:
            positiveExamples.length,
          feedbackPrinciples:
            principles.length,
          feedbackDecisions:
            decisions.length
        };
      }
    );

  if (
    hasFlag(
      "--validate-only"
    )
  ) {
    console.log(
      JSON.stringify(
        {
          mode:
            "VALIDATION LOCALE",
          model:
            MODEL,
          area,
          country:
            country || null,
          categories:
            missionSummaries,
          previousProposals:
            history.proposals.length,
          cataloguePlaces:
            catalogue.length,
          requestedCandidatesPerCategory:
            limit,
          rawCandidateLimitPerCategory:
            rawLimit
        },
        null,
        2
      )
    );

    return;
  }

  if (
    !process.env
      .OPENAI_API_KEY
  ) {
    throw new Error(
      "OPENAI_API_KEY absente"
    );
  }

  const client =
    new OpenAI({
      apiKey:
        process.env
          .OPENAI_API_KEY
    });

  let incompleteMission =
    false;

  for (
    const category of
    categories
  ) {
    const selectedCount =
      await prospectCategory({
        client,
        category,
        area,
        country,
        limit,
        rawLimit,
        corpus,
        catalogue,
        feedback
      });

    if (
      selectedCount < limit
    ) {
      incompleteMission =
        true;
    }
  }

  if (incompleteMission) {
    console.error(
      "\nMission terminée : certaines catégories ont fourni moins de lieux que le maximum demandé."
    );
  }
}
main().catch(error => {
  const isObject =
    error !== null &&
    typeof error === "object";

  const cause =
    isObject &&
    error.cause !== null &&
    typeof error.cause === "object"
      ? error.cause
      : null;

  const nestedCause =
    cause &&
    cause.cause !== null &&
    typeof cause.cause === "object"
      ? cause.cause
      : null;

  const details =
    isObject
      ? {
          name:
            error.name || null,
          message:
            error.message || String(error),
          status:
            error.status ?? null,
          code:
            error.code ?? null,
          type:
            error.type ?? null,
          requestId:
            error.request_id ??
            error.requestId ??
            null,
          cause:
            cause
              ? {
                  name:
                    cause.name || null,
                  message:
                    cause.message || null,
                  code:
                    cause.code || null,
                  errno:
                    cause.errno || null,
                  syscall:
                    cause.syscall || null
                }
              : null,
          nestedCause:
            nestedCause
              ? {
                  name:
                    nestedCause.name || null,
                  message:
                    nestedCause.message || null,
                  code:
                    nestedCause.code || null,
                  errno:
                    nestedCause.errno || null,
                  syscall:
                    nestedCause.syscall || null
                }
              : null
        }
      : {
          message:
            String(error)
        };

  console.error(
    "\nERREUR DE PROSPECTION"
  );

  console.error(
    JSON.stringify(
      details,
      null,
      2
    )
  );

  process.exitCode = 1;
});
