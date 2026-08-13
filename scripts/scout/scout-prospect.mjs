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

const CATEGORY =
  "Restaurant";

const AREA =
  "Hauts-de-Seine (92)";

const COUNTRY =
  "France";

const COMMUNES_92 = [
  "Antony",
  "Asnières-sur-Seine",
  "Bagneux",
  "Bois-Colombes",
  "Boulogne-Billancourt",
  "Bourg-la-Reine",
  "Châtenay-Malabry",
  "Châtillon",
  "Chaville",
  "Clamart",
  "Clichy",
  "Colombes",
  "Courbevoie",
  "Fontenay-aux-Roses",
  "Garches",
  "Gennevilliers",
  "Issy-les-Moulineaux",
  "La Garenne-Colombes",
  "Le Plessis-Robinson",
  "Levallois-Perret",
  "Malakoff",
  "Marnes-la-Coquette",
  "Meudon",
  "Montrouge",
  "Nanterre",
  "Neuilly-sur-Seine",
  "Puteaux",
  "Rueil-Malmaison",
  "Saint-Cloud",
  "Sceaux",
  "Sèvres",
  "Suresnes",
  "Vanves",
  "Vaucresson",
  "Ville-d’Avray",
  "Villeneuve-la-Garenne"
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

function feedbackData(feedback) {
  const sessions =
    Array.isArray(
      feedback.sessions
    )
      ? feedback.sessions
      : [];

  const principles =
    uniqueStrings(
      sessions.flatMap(
        session =>
          Array.isArray(
            session.learningPrinciplesFr
          )
            ? session.learningPrinciplesFr
            : []
      )
    );

  const decisions =
    sessions.flatMap(
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
  const allowedMunicipalities =
    new Set(
      COMMUNES_92.map(
        normalize
      )
    );

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
      !allowedMunicipalities.has(
        normalize(
          candidate.municipality
        )
      )
    ) {
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

      const runId =
        `restaurants-hauts-de-seine-${proposedAt.replace(/[:.]/g, "-")}`;

      const mission = {
        category:
          CATEGORY,
        area:
          AREA,
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

async function main() {
  const limit =
    positiveIntegerArgument(
      "--limit",
      10
    );

  const rawLimit =
    Math.min(
      50,
      Math.max(
        30,
        limit * 4
      )
    );

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

  const positiveExamples =
    uniqueStrings(
      corpus.siteProfiles
        .filter(
          profile =>
            (
              Array.isArray(
                profile.categories
              )
                ? profile.categories
                : []
            ).some(
              category =>
                normalize(category) ===
                normalize(CATEGORY)
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
      "Aucun exemple Restaurant trouvé dans le corpus"
    );
  }

  const {
    principles,
    decisions
  } =
    feedbackData(
      feedback
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
          category:
            CATEGORY,
          area:
            AREA,
          positiveExamples:
            positiveExamples.length,
          feedbackPrinciples:
            principles.length,
          feedbackDecisions:
            decisions.length,
          previousProposals:
            history.proposals.length,
          cataloguePlaces:
            catalogue.length,
          requestedCandidates:
            limit,
          rawCandidateLimit:
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

  const prompt = `
MISSION

Recherche sur le Web de nouveaux restaurants susceptibles
de correspondre à Indie Map.

- Zone obligatoire : ${AREA}
- Pays : ${COUNTRY}
- Catégorie : ${CATEGORY}
- Candidats bruts demandés : jusqu'à ${rawLimit}
- L'utilisateur ne verra finalement que ${limit} lieux maximum.

Le résultat est une présélection. L'utilisateur vérifiera lui-même
chaque site. Tu ne dois pas déclarer qu'un lieu est définitivement
éligible, mais tu dois examiner suffisamment les informations
publiques et la carte pour éviter les faux positifs évidents.

APPRENTISSAGE POSITIF INDIE MAP

Les textes suivants sont issus des restaurants déjà sélectionnés
dans Indie Map. Ils fusionnent les anciens signaux internes et les
caractéristiques découvertes sur leurs sites officiels.

Ce sont des exemples positifs, pas une liste de critères obligatoires.
Un signal rare et concret reste important même s'il apparaît peu.

${JSON.stringify(positiveExamples)}

APPRENTISSAGE NÉGATIF ISSU DE LA REVUE MANUELLE

Principes appris :

${JSON.stringify(principles)}

Décisions détaillées :

${JSON.stringify(decisions)}

Applique réellement ces retours :

- une promesse générale « locale », « responsable » ou « fait maison »
  ne suffit pas ;
- cherche une cohérence concrète entre le discours, les producteurs,
  la saisonnalité et la composition réelle de la carte ;
- une carte très centrée sur viande, poisson, fruits de mer ou
  ingrédients importés est un signal négatif important ;
- « fait maison » ne signifie ni local ni saisonnier ;
- des ingrédients importés centraux comme lait de coco, tahini,
  halloumi, café ou chocolat ne prouvent pas une démarche locale ;
- vérifie que le restaurant semble encore actif ;
- ne transforme pas ces retours en interdictions mécaniques isolées :
  évalue la place réelle de ces éléments dans l'ensemble du projet.

LIEUX DÉJÀ PROPOSÉS — INTERDICTION ABSOLUE

Ne retourne aucun de ces lieux, même s'il paraît finalement pertinent.

${JSON.stringify(compactHistory)}

CATALOGUE INDIE MAP — À EXCLURE

${JSON.stringify(compactCatalogue)}

COMMUNES AUTORISÉES

${JSON.stringify(COMMUNES_92)}

MÉTHODE OBLIGATOIRE

- Effectue plusieurs recherches Web complémentaires en français.
- Cherche des restaurants indépendants, locavores, saisonniers,
  reliés à des producteurs, à une agriculture de proximité ou à
  une cuisine végétale réellement cohérente.
- Varie les requêtes et les communes.
- Les annuaires, médias et plateformes peuvent servir à découvrir
  des pistes, mais officialWebsite doit être le site officiel direct.
- Exclure Instagram, Facebook, Tripadvisor, TheFork, Google Maps,
  les plateformes de livraison, de réservation et les annuaires.
- Exclure tout lieu déjà présent dans Indie Map.
- Exclure tout lieu déjà proposé lors d'une recherche précédente.
- Ne jamais inventer un nom, une commune ou une URL.
- Retourner uniquement des restaurants physiques situés dans une
  commune autorisée des Hauts-de-Seine.
- Ne fournis aucune justification dans le JSON.
- municipality sert uniquement au contrôle géographique interne.
  `.trim();

  console.error(
    "Recherche de nouveaux restaurants dans les Hauts-de-Seine…"
  );

  const client =
    new OpenAI({
      apiKey:
        process.env
          .OPENAI_API_KEY
    });

  const response =
    await client.responses.create({
      model:
        MODEL,

      reasoning: {
        effort:
          "high"
      },

      store:
        false,

      tools: [
        {
          type:
            "web_search",
          search_context_size:
            "high"
        }
      ],

      tool_choice:
        "required",

      max_output_tokens:
        8000,

      text: {
        format: {
          type:
            "json_schema",
          name:
            "indie_map_restaurant_prospects",
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

  if (
    !response.output_text
  ) {
    throw new Error(
      "Réponse de prospection vide"
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
      limit
    });

  console.log(
    "\n=== NOUVEAUX RESTAURANTS À VÉRIFIER ===\n"
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
      `\nSeulement ${selected.length} nouveau(x) lieu(x) valide(s) obtenu(s).`
    );

    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(
    "\nERREUR DE PROSPECTION"
  );

  console.error(
    error instanceof Error
      ? error.message
      : error
  );

  process.exitCode = 1;
});
