import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config({ path: ".env.local" });

const MODEL =
  process.env.SCOUT_DISCOVER_MODEL?.trim() ||
  "gpt-5.4-nano";

const CLUSTERS_PATH =
  "data/private/scout/discovery-clusters.v1.json";

const PROFILES_PATH =
  "data/private/scout/catalogue-profiles.v1.json";

const CRITERIA_PATH =
  "data/private/scout/criteria.v1.json";

const OUTPUT_PATH =
  "data/private/scout/discovery-themes.v1.json";

type DiscoveryCluster = {
  id: string;
  representative: string;
  occurrences: number;
  distinctPlaces: number;
  categories: Record<string, number>;
  phrases: Array<{
    phrase: string;
    normalized: string;
    occurrences: number;
    distinctPlaces: number;
  }>;
  examples: Array<{
    placeId: string;
    placeName: string;
    category: string;
    driver: string;
  }>;
  nearestExistingSignal: string | null;
  nearestExistingSimilarity: number;
};

type DiscoveryFile = {
  results: DiscoveryCluster[];
};

type PlaceProfile = {
  placeId: string;
  name: string;
  normalizedCategory: string;
  selectionDrivers?: string[];
};

type Criteria = {
  version: string;
  signals: Record<
    string,
    {
      label: string;
      weight: number;
      definition: string;
    }
  >;
};

type ThemeClassification =
  | "EXISTING_SIGNAL"
  | "NEW_CANDIDATE"
  | "DESCRIPTIVE_ONLY"
  | "TOO_VAGUE";

type RawAssignment = {
  label: string;
  classification: ThemeClassification;
  existingSignal: string;
  candidateSignalKey: string;
  themeKey: string;
  reason: string;
};

type RawTheme = {
  label: string;
  classification: ThemeClassification;
  existingSignal: string;
  candidateSignalKey: string;
  clusterIds: string[];
  reason: string;
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumberArg(
  prefix: string,
  fallback: number
) {
  const arg =
    process.argv.find(
      value =>
        value.startsWith(
          `${prefix}=`
        )
    );

  if (!arg) return fallback;

  const value =
    Number(
      arg.slice(
        prefix.length + 1
      )
    );

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(
      `${prefix} invalide`
    );
  }

  return Math.floor(value);
}

function writeJsonAtomic(
  filePath: string,
  value: unknown
) {
  fs.mkdirSync(
    path.dirname(filePath),
    {
      recursive: true,
    }
  );

  const tmp =
    `${filePath}.tmp-${process.pid}`;

  fs.writeFileSync(
    tmp,
    JSON.stringify(
      value,
      null,
      2
    ) + "\n"
  );

  fs.renameSync(
    tmp,
    filePath
  );
}

function cleanJsonOutput(
  value: string
) {
  return value
    .trim()
    .replace(
      /^```json\s*/i,
      ""
    )
    .replace(
      /^```\s*/i,
      ""
    )
    .replace(
      /\s*```$/i,
      ""
    )
    .trim();
}

function structuredSchema(
  existingSignalKeys: string[],
  clusterIds: string[]
) {
  const assignmentSchema = {
    type: "object",
    additionalProperties: false,
    required: [
      "label",
      "classification",
      "existingSignal",
      "candidateSignalKey",
      "themeKey",
      "reason",
    ],
    properties: {
      label: {
        type: "string",
      },
      classification: {
        type: "string",
        enum: [
          "EXISTING_SIGNAL",
          "NEW_CANDIDATE",
          "DESCRIPTIVE_ONLY",
          "TOO_VAGUE",
        ],
      },
      existingSignal: {
        type: "string",
        enum: [
          "",
          ...existingSignalKeys,
        ],
      },
      candidateSignalKey: {
        type: "string",
      },
      themeKey: {
        type: "string",
      },
      reason: {
        type: "string",
      },
    },
  };

  return {
    type: "object",
    additionalProperties: false,
    required: [
      "assignments",
    ],
    properties: {
      assignments: {
        type: "object",
        additionalProperties: false,

        /*
         * C'est ici que la couverture devient
         * structurellement obligatoire :
         * chaque cluster doit avoir exactement
         * une propriété dans assignments.
         */
        required:
          clusterIds,

        properties:
          Object.fromEntries(
            clusterIds.map(
              clusterId => [
                clusterId,
                assignmentSchema,
              ]
            )
          ),
      },
    },
  };
}

function consolidateAssignments(
  assignments:
    Record<
      string,
      RawAssignment
    >,
  clusters:
    DiscoveryCluster[]
) {
  const expected =
    new Set(
      clusters.map(
        cluster =>
          cluster.id
      )
    );

  const received =
    new Set(
      Object.keys(
        assignments
      )
    );

  const missing =
    [...expected].filter(
      id =>
        !received.has(id)
    );

  const unexpected =
    [...received].filter(
      id =>
        !expected.has(id)
    );

  if (
    missing.length ||
    unexpected.length
  ) {
    throw new Error(
      [
        missing.length
          ? `Assignments manquants : ${missing.join(", ")}`
          : "",
        unexpected.length
          ? `Assignments inattendus : ${unexpected.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  const grouped =
    new Map<
      string,
      RawTheme
    >();

  for (const cluster of clusters) {
    const assignment =
      assignments[
        cluster.id
      ];

    const themeKey =
      String(
        assignment.themeKey ?? ""
      ).trim();

    if (!themeKey) {
      throw new Error(
        `themeKey vide pour ${cluster.id}`
      );
    }

    const classification =
      assignment.classification;

    const existingSignal =
      classification ===
        "EXISTING_SIGNAL"
        ? String(
            assignment.existingSignal ??
              ""
          ).trim()
        : "";

    const candidateSignalKey =
      classification ===
        "NEW_CANDIDATE"
        ? (
            String(
              assignment.candidateSignalKey ??
                ""
            ).trim() ||
            themeKey
          )
        : "";

    /*
     * On consolide avec une clé déterministe.
     *
     * EXISTING_SIGNAL :
     *   le critère existant est l'identité.
     *
     * NEW_CANDIDATE :
     *   candidateSignalKey est l'identité.
     *
     * Autres :
     *   themeKey permet au modèle de regrouper
     *   plusieurs formulations descriptives
     *   réellement équivalentes.
     */
    let groupKey: string;

    if (
      classification ===
      "EXISTING_SIGNAL"
    ) {
      if (!existingSignal) {
        throw new Error(
          `existingSignal vide pour ${cluster.id}`
        );
      }

      groupKey =
        `existing:${existingSignal}`;
    } else if (
      classification ===
      "NEW_CANDIDATE"
    ) {
      groupKey =
        `new:${candidateSignalKey}`;
    } else {
      groupKey =
        `${classification}:${themeKey}`;
    }

    const current =
      grouped.get(
        groupKey
      );

    if (current) {
      current.clusterIds.push(
        cluster.id
      );
      continue;
    }

    grouped.set(
      groupKey,
      {
        label:
          String(
            assignment.label ??
              ""
          ).trim() ||
          themeKey,

        classification,

        existingSignal,

        candidateSignalKey,

        clusterIds: [
          cluster.id,
        ],

        reason:
          String(
            assignment.reason ??
              ""
          ).trim(),
      }
    );
  }

  return [
    ...grouped.values(),
  ];
}

function buildThemeStats(
  theme: RawTheme,
  clustersById:
    Map<
      string,
      DiscoveryCluster
    >,
  profiles: PlaceProfile[]
) {
  const normalizedPhrases =
    new Set<string>();

  for (
    const clusterId of
      theme.clusterIds
  ) {
    const cluster =
      clustersById.get(
        clusterId
      );

    if (!cluster) continue;

    for (
      const phrase of
        cluster.phrases
    ) {
      normalizedPhrases.add(
        phrase.normalized
      );
    }
  }

  const places =
    new Map<
      string,
      {
        name: string;
        category: string;
        drivers: string[];
      }
    >();

  const categoryCounts:
    Record<
      string,
      number
    > = {};

  for (const profile of profiles) {
    const matching =
      (
        profile.selectionDrivers ||
        []
      ).filter(
        driver =>
          normalizedPhrases.has(
            normalizeText(driver)
          )
      );

    if (!matching.length) {
      continue;
    }

    places.set(
      profile.placeId,
      {
        name:
          profile.name,
        category:
          profile.normalizedCategory,
        drivers:
          matching,
      }
    );

    categoryCounts[
      profile.normalizedCategory
    ] =
      (
        categoryCounts[
          profile.normalizedCategory
        ] || 0
      ) + 1;
  }

  const examples =
    [...places.values()]
      .slice(0, 12);

  return {
    distinctPlaces:
      places.size,
    categories:
      categoryCounts,
    examples,
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

  const discovery =
    JSON.parse(
      fs.readFileSync(
        CLUSTERS_PATH,
        "utf8"
      )
    ) as DiscoveryFile;

  const profilesFile =
    JSON.parse(
      fs.readFileSync(
        PROFILES_PATH,
        "utf8"
      )
    ) as {
      profiles:
        PlaceProfile[];
    };

  const criteria =
    JSON.parse(
      fs.readFileSync(
        CRITERIA_PATH,
        "utf8"
      )
    ) as Criteria;

  const minPlaces =
    parseNumberArg(
      "--min-places",
      3
    );

  const limit =
    parseNumberArg(
      "--limit",
      180
    );

  const eligible =
    discovery.results
      .filter(
        cluster =>
          cluster.distinctPlaces >=
          minPlaces
      )
      .sort(
        (a, b) =>
          b.distinctPlaces -
            a.distinctPlaces ||
          b.occurrences -
            a.occurrences
      )
      .slice(0, limit);

  console.log(
    "=== INDIE MAP SCOUT / DISCOVER CLASSIFY V1 ==="
  );

  console.log(
    "CLUSTERS TOTAL :",
    discovery.results.length
  );

  console.log(
    "MIN LIEUX :",
    minPlaces
  );

  console.log(
    "CLUSTERS À CLASSER :",
    eligible.length
  );

  console.log(
    "MODEL :",
    MODEL
  );

  const existingSignals =
    Object.entries(
      criteria.signals
    ).map(
      ([key, value]) => ({
        key,
        label:
          value.label,
        definition:
          value.definition,
      })
    );

  const clusterInput =
    eligible.map(
      cluster => ({
        id:
          cluster.id,
        representative:
          cluster.representative,
        distinctPlaces:
          cluster.distinctPlaces,
        occurrences:
          cluster.occurrences,
        categories:
          cluster.categories,
        phrases:
          cluster.phrases
            .slice(0, 10)
            .map(
              phrase =>
                phrase.phrase
            ),
        examples:
          cluster.examples
            .slice(0, 6)
            .map(
              example => ({
                place:
                  example.placeName,
                category:
                  example.category,
                driver:
                  example.driver,
              })
            ),
        embeddingNearestSignal:
          cluster.nearestExistingSignal,
        embeddingSimilarity:
          cluster.nearestExistingSimilarity,
      })
    );

  const openai =
    new OpenAI({
      apiKey:
        process.env.OPENAI_API_KEY,
    });

  const response =
    await openai.responses.create({
      model: MODEL,

      reasoning: {
        effort: "low",
      },

      store: false,

      text: {
        format: {
          type:
            "json_schema",
          name:
            "indie_map_discovery_themes",
          strict: true,
          schema:
            structuredSchema(
              Object.keys(
                criteria.signals
              ),
              eligible.map(
                cluster =>
                  cluster.id
              )
            ),
        },
      },

      input: `
Tu aides à analyser l'ADN éditorial d'Indie Map.

Nous avons déjà analysé 626 lieux existants.
Pour chaque lieu, des caractéristiques appelées selectionDrivers ont été extraites.
Ces formulations ont ensuite été regroupées par embeddings en clusters.

Ton travail est de CONSOLIDER les clusters en concepts éditoriaux cohérents.

IMPORTANT :
Tu ne modifies aucun critère.
Tu ne décides pas qu'un nouveau critère devient une règle Indie Map.
Tu proposes uniquement une classification exploratoire.

CRITÈRES INDIE MAP DÉJÀ EXISTANTS :
${JSON.stringify(
  existingSignals,
  null,
  2
)}

CLASSIFICATIONS :

EXISTING_SIGNAL
Le CONCEPT est déjà couvert par l'un des critères ci-dessus.

ATTENTION CRITIQUE :
Cette classification porte uniquement sur la nature du concept, PAS sur la force de la preuve.

Un cluster doit être EXISTING_SIGNAL même si sa formulation ne permettrait que de mettre le signal en "suggested" plutôt qu'en "supported".

Exemples :
- produits bio -> organic
- vente directe -> directSale
- cuisine de saison -> seasonal
- produits locaux sans provenance détaillée -> localSourcing
- producteurs locaux sans producteur nommé -> localSourcing

La faiblesse ou l'ambiguïté de la preuve est traitée ailleurs dans Scout Learn. Elle ne doit jamais transformer un concept déjà couvert en DESCRIPTIVE_ONLY ou TOO_VAGUE.

NEW_CANDIDATE
Le concept n'est pas correctement couvert par les critères actuels ET semble décrire une pratique, un modèle ou une caractéristique potentiellement pertinente pour la sélection Indie Map.
Il peut être pertinent seulement pour certaines catégories.
Exemple possible :
- vente en vrac + zéro déchet + réduction des emballages

DESCRIPTIVE_ONLY
Le concept décrit bien un lieu, un produit, un style ou une offre, mais ne constitue pas à lui seul une raison éditoriale suffisamment pertinente pour sélectionner un lieu Indie Map.
Exemples possibles :
- cuisine végétale
- café de spécialité
- type de produit vendu
- esthétique

TOO_VAGUE
Le concept est trop générique, marketing ou imprécis pour être utilisable.
Exemples :
- engagé
- durable
- qualité
sans explication concrète.

RÈGLES DE CONSOLIDATION :

- Regroupe plusieurs clusters lorsqu'ils expriment réellement le MÊME concept éditorial, même avec des mots différents.
- Ne regroupe PAS des notions seulement voisines.
- Exemple : "circuit court" et "vente directe" peuvent être liés mais sont déjà deux critères distincts ; ne les fusionne pas.
- "zéro déchet", "vente en vrac", "sans emballage" et "réduction des emballages à usage unique" représentent différentes manifestations d'un même axe éditorial de réduction des déchets et emballages : ils doivent partager le même themeKey s'ils sont classés NEW_CANDIDATE.
- Ne crée pas plusieurs NEW_CANDIDATE lorsqu'un concept général unique explique correctement plusieurs pratiques particulières.

DISTINCTION CONCEPT / PREUVE :
- "produits locaux" est conceptuellement localSourcing, même si la provenance précise manque.
- "producteurs locaux" est conceptuellement localSourcing, même si aucun producteur n'est nommé.
- Une provenance géographique concrète comme "québécois", "breton", "californien" ou "dans un rayon de 100 km" appartient conceptuellement à localSourcing. La question de savoir si cette provenance est réellement locale pour chaque lieu est évaluée ailleurs.
- Une relation directe avec un producteur relève de directProducerRelationship et ne doit jamais être exigée pour reconnaître le concept localSourcing.
- "production locale" peut être ambigu entre localSourcing et onSiteProduction : ne crée jamais un nouveau critère pour cette seule ambiguïté.
- Ne crée pas un nouveau concept simplement parce qu'une formulation est fréquente.
- La fréquence n'est pas une preuve de pertinence éditoriale.
- Le score embeddingNearestSignal est seulement une indication technique. Il peut être faux. Raisonne sur le sens réel des formulations.
- Tu dois fournir EXACTEMENT UNE affectation pour chaque cluster fourni.
- La sortie possède une propriété assignments dont les clés sont imposées par le schéma : cluster-1, cluster-2, etc.
- Ne déplaces jamais une analyse sous le mauvais cluster ID.
- N'invente aucun cluster ID.
- existingSignal doit être renseigné uniquement pour EXISTING_SIGNAL, sinon "".
- candidateSignalKey doit être renseigné uniquement pour NEW_CANDIDATE, sinon "".
- candidateSignalKey doit être en anglais camelCase et décrire précisément le concept.
- themeKey doit être une clé canonique courte en anglais camelCase.
- Si plusieurs clusters représentent réellement le même concept, donne-leur EXACTEMENT le même themeKey.
- Pour EXISTING_SIGNAL, utilise comme themeKey la clé du critère existant.
- Pour NEW_CANDIDATE, themeKey et candidateSignalKey doivent être identiques.
- Deux concepts seulement voisins doivent conserver des themeKey différents.
- reason explique brièvement la décision concernant le cluster.

CLUSTERS À CLASSER :
${JSON.stringify(
  clusterInput,
  null,
  2
)}
      `.trim(),
    });

  const parsed =
    JSON.parse(
      cleanJsonOutput(
        response.output_text
      )
    ) as {
      assignments:
        Record<
          string,
          RawAssignment
        >;
    };

  /*
   * Le JSON Schema garantit déjà les clés,
   * puis cette consolidation transforme les
   * 83 décisions individuelles en thèmes.
   */
  const rawThemes =
    consolidateAssignments(
      parsed.assignments,
      eligible
    );

  const clustersById =
    new Map(
      eligible.map(
        cluster => [
          cluster.id,
          cluster,
        ]
      )
    );

  const themes =
    rawThemes.map(
      theme => ({
        ...theme,
        ...buildThemeStats(
          theme,
          clustersById,
          profilesFile.profiles
        ),
      })
    );

  themes.sort(
    (a, b) =>
      b.distinctPlaces -
      a.distinctPlaces
  );

  const counts:
    Record<
      ThemeClassification,
      number
    > = {
      EXISTING_SIGNAL: 0,
      NEW_CANDIDATE: 0,
      DESCRIPTIVE_ONLY: 0,
      TOO_VAGUE: 0,
    };

  for (const theme of themes) {
    counts[
      theme.classification
    ] += 1;
  }

  writeJsonAtomic(
    OUTPUT_PATH,
    {
      version:
        "scout-discovery-themes-v1",
      generatedAt:
        new Date()
          .toISOString(),
      model: MODEL,
      criteriaVersion:
        criteria.version,
      minPlaces,
      eligibleClusters:
        eligible.length,
      classificationCounts:
        counts,
      warning:
        "Les NEW_CANDIDATE sont uniquement des hypothèses éditoriales à valider humainement. Aucun critère Indie Map n'est modifié automatiquement.",
      themes,
      usage:
        response.usage,
    }
  );

  console.log("");
  console.log(
    "=== CLASSIFICATION TERMINÉE ==="
  );

  console.log(
    "EXISTING_SIGNAL :",
    counts.EXISTING_SIGNAL
  );

  console.log(
    "NEW_CANDIDATE :",
    counts.NEW_CANDIDATE
  );

  console.log(
    "DESCRIPTIVE_ONLY :",
    counts.DESCRIPTIVE_ONLY
  );

  console.log(
    "TOO_VAGUE :",
    counts.TOO_VAGUE
  );

  console.log("");
  console.log(
    "=== NOUVEAUX CANDIDATS ==="
  );

  for (
    const theme of themes.filter(
      theme =>
        theme.classification ===
        "NEW_CANDIDATE"
    )
  ) {
    console.log("");
    console.log(
      `${theme.candidateSignalKey} — ${theme.label}`
    );

    console.log(
      "  lieux      :",
      theme.distinctPlaces
    );

    console.log(
      "  clusters   :",
      theme.clusterIds.join(
        ", "
      )
    );

    console.log(
      "  catégories :",
      Object.entries(
        theme.categories
      )
        .sort(
          (a, b) =>
            b[1] - a[1]
        )
        .map(
          ([category, count]) =>
            `${category}:${count}`
        )
        .join(", ")
    );

    console.log(
      "  raison     :",
      theme.reason
    );

    console.log(
      "  exemples   :",
      theme.examples
        .slice(0, 6)
        .map(
          example =>
            `${example.name} [${example.category}]`
        )
        .join(" | ")
    );
  }

  console.log("");
  console.log(
    "SORTIE :",
    OUTPUT_PATH
  );
}

main().catch((error) => {
  console.error("");
  console.error(
    "SCOUT DISCOVER CLASSIFY FAILED"
  );
  console.error(error);
  process.exit(1);
});
