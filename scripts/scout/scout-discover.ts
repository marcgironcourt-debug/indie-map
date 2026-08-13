import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config({ path: ".env.local" });

const EMBEDDING_MODEL =
  "text-embedding-3-small";

const PROFILES_PATH =
  "data/private/scout/catalogue-profiles.v1.json";

const CRITERIA_PATH =
  "data/private/scout/criteria.v1.json";

const CACHE_PATH =
  "data/private/scout/discovery-embeddings.cache.v1.json";

const OUTPUT_PATH =
  "data/private/scout/discovery-clusters.v1.json";

const BATCH_SIZE = 100;

/*
 * Seuil volontairement assez strict.
 * On préfère plusieurs petits clusters cohérents
 * plutôt qu'un énorme cluster vaguement similaire.
 *
 * On pourra l'ajuster après observation.
 */
const CLUSTER_THRESHOLD =
  Number(
    process.env.SCOUT_DISCOVER_THRESHOLD ||
      "0.78"
  );

type PlaceProfile = {
  placeId: string;
  name: string;
  normalizedCategory: string;
  selectionDrivers?: string[];
};

type ProfilesFile = {
  profiles: PlaceProfile[];
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

type DriverOccurrence = {
  placeId: string;
  placeName: string;
  category: string;
  driver: string;
};

type DriverGroup = {
  normalized: string;
  representative: string;
  occurrences: number;
  distinctPlaces: number;
  categories: Record<string, number>;
  examples: DriverOccurrence[];
  embedding: number[];
};

type EmbeddingCacheEntry = {
  text: string;
  textHash: string;
  model: string;
  embedding: number[];
};

type EmbeddingCache = {
  version: "scout-discovery-embeddings-v1";
  model: string;
  updatedAt: string;
  entries: Record<
    string,
    EmbeddingCacheEntry
  >;
};

type ClusterMember = {
  phrase: string;
  normalized: string;
  occurrences: number;
  distinctPlaces: number;
};

type Cluster = {
  id: string;
  representative: string;
  occurrences: number;
  distinctPlaces: number;
  categories: Record<string, number>;
  phrases: ClusterMember[];
  examples: DriverOccurrence[];
  nearestExistingSignal: string | null;
  nearestExistingSimilarity: number;
};

type InternalCluster = Cluster & {
  centroid: number[];
  centroidWeight: number;
};

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

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

function sha256(value: string) {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

function cosine(
  a: number[],
  b: number[]
) {
  if (
    a.length === 0 ||
    a.length !== b.length
  ) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (
    let i = 0;
    i < a.length;
    i += 1
  ) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (
    normA === 0 ||
    normB === 0
  ) {
    return 0;
  }

  return (
    dot /
    (
      Math.sqrt(normA) *
      Math.sqrt(normB)
    )
  );
}

function weightedCentroid(
  current: number[],
  currentWeight: number,
  incoming: number[],
  incomingWeight: number
) {
  if (current.length === 0) {
    return [...incoming];
  }

  const total =
    currentWeight +
    incomingWeight;

  return current.map(
    (value, index) =>
      (
        value * currentWeight +
        incoming[index] *
          incomingWeight
      ) /
      total
  );
}

function emptyCache(): EmbeddingCache {
  return {
    version:
      "scout-discovery-embeddings-v1",
    model: EMBEDDING_MODEL,
    updatedAt:
      new Date().toISOString(),
    entries: {},
  };
}

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) {
    return emptyCache();
  }

  try {
    const parsed =
      JSON.parse(
        fs.readFileSync(
          CACHE_PATH,
          "utf8"
        )
      ) as EmbeddingCache;

    if (
      parsed.version !==
        "scout-discovery-embeddings-v1" ||
      parsed.model !==
        EMBEDDING_MODEL ||
      !parsed.entries
    ) {
      return emptyCache();
    }

    return parsed;
  } catch {
    return emptyCache();
  }
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

function saveCache(
  cache: EmbeddingCache
) {
  cache.updatedAt =
    new Date().toISOString();

  writeJsonAtomic(
    CACHE_PATH,
    cache
  );
}

function collectOccurrences(
  profiles: PlaceProfile[]
) {
  const result:
    DriverOccurrence[] = [];

  for (const profile of profiles) {
    for (
      const raw of
        profile.selectionDrivers || []
    ) {
      const driver =
        String(raw ?? "").trim();

      if (!driver) continue;

      result.push({
        placeId:
          profile.placeId,
        placeName:
          profile.name,
        category:
          profile.normalizedCategory,
        driver,
      });
    }
  }

  return result;
}

function groupExactDrivers(
  occurrences: DriverOccurrence[]
) {
  const groups =
    new Map<
      string,
      DriverOccurrence[]
    >();

  for (const occurrence of occurrences) {
    const normalized =
      normalizeText(
        occurrence.driver
      );

    if (!normalized) continue;

    const current =
      groups.get(normalized) || [];

    current.push(occurrence);
    groups.set(
      normalized,
      current
    );
  }

  return groups;
}

async function ensureEmbeddings(
  openai: OpenAI,
  texts: string[],
  cache: EmbeddingCache
) {
  const unique =
    [...new Set(texts)];

  const pending:
    {
      text: string;
      hash: string;
    }[] = [];

  for (const text of unique) {
    const hash =
      sha256(text);

    const cached =
      cache.entries[hash];

    if (
      cached &&
      cached.model ===
        EMBEDDING_MODEL &&
      cached.text === text &&
      Array.isArray(
        cached.embedding
      ) &&
      cached.embedding.length > 0
    ) {
      continue;
    }

    pending.push({
      text,
      hash,
    });
  }

  console.log(
    "TEXTES EMBEDDINGS :",
    unique.length
  );

  console.log(
    "CACHE HITS :",
    unique.length -
      pending.length
  );

  console.log(
    "À VECTORISER :",
    pending.length
  );

  let totalTokens = 0;

  for (
    let offset = 0;
    offset < pending.length;
    offset += BATCH_SIZE
  ) {
    const batch =
      pending.slice(
        offset,
        offset + BATCH_SIZE
      );

    const response =
      await openai.embeddings.create({
        model:
          EMBEDDING_MODEL,
        input:
          batch.map(
            item =>
              item.text
          ),
      });

    totalTokens +=
      response.usage
        ?.total_tokens || 0;

    const vectors =
      [...response.data].sort(
        (a, b) =>
          a.index - b.index
      );

    if (
      vectors.length !==
      batch.length
    ) {
      throw new Error(
        `Vecteurs incorrects : ${vectors.length}/${batch.length}`
      );
    }

    batch.forEach(
      (item, index) => {
        cache.entries[
          item.hash
        ] = {
          text:
            item.text,
          textHash:
            item.hash,
          model:
            EMBEDDING_MODEL,
          embedding:
            vectors[index]
              .embedding,
        };
      }
    );

    saveCache(cache);

    console.log(
      "LOT EMBEDDINGS :",
      `${Math.min(
        offset +
          BATCH_SIZE,
        pending.length
      )}/${pending.length}`,
      "| TOKENS :",
      totalTokens
    );
  }

  return totalTokens;
}

function embeddingFor(
  text: string,
  cache: EmbeddingCache
) {
  const entry =
    cache.entries[
      sha256(text)
    ];

  if (
    !entry ||
    !entry.embedding?.length
  ) {
    throw new Error(
      `Embedding manquant : ${text}`
    );
  }

  return entry.embedding;
}

function mergeCategoryCounts(
  target: Record<
    string,
    number
  >,
  source: Record<
    string,
    number
  >
) {
  for (
    const [
      category,
      count,
    ] of Object.entries(source)
  ) {
    target[category] =
      (
        target[category] ||
        0
      ) + count;
  }
}

function clusterDrivers(
  groups: DriverGroup[]
) {
  /*
   * On commence par les formulations les plus
   * fréquentes afin que les centroïdes principaux
   * structurent le regroupement.
   */
  const ordered =
    [...groups].sort(
      (a, b) =>
        b.distinctPlaces -
          a.distinctPlaces ||
        b.occurrences -
          a.occurrences
    );

  const clusters:
    InternalCluster[] = [];

  for (const group of ordered) {
    let bestIndex = -1;
    let bestScore = -1;

    for (
      let i = 0;
      i < clusters.length;
      i += 1
    ) {
      const score =
        cosine(
          group.embedding,
          clusters[i]
            .centroid
        );

      if (
        score > bestScore
      ) {
        bestScore = score;
        bestIndex = i;
      }
    }

    const weight =
      Math.max(
        1,
        group.distinctPlaces
      );

    if (
      bestIndex >= 0 &&
      bestScore >=
        CLUSTER_THRESHOLD
    ) {
      const cluster =
        clusters[bestIndex];

      cluster.occurrences +=
        group.occurrences;

      const existingPlaces =
        new Set(
          cluster.examples.map(
            example =>
              example.placeId
          )
        );

      const memberPlaceIds =
        new Set(
          group.examples.map(
            example =>
              example.placeId
          )
        );

      /*
       * Pour le compteur global exact des lieux,
       * on recalculera plus tard à partir des
       * membres. Ici ce compteur sert surtout à
       * l'ordre intermédiaire.
       */
      for (
        const id of memberPlaceIds
      ) {
        existingPlaces.add(id);
      }

      cluster.distinctPlaces =
        existingPlaces.size;

      mergeCategoryCounts(
        cluster.categories,
        group.categories
      );

      cluster.phrases.push({
        phrase:
          group.representative,
        normalized:
          group.normalized,
        occurrences:
          group.occurrences,
        distinctPlaces:
          group.distinctPlaces,
      });

      for (
        const example of
          group.examples
      ) {
        if (
          cluster.examples.length >=
          12
        ) {
          break;
        }

        const exists =
          cluster.examples.some(
            x =>
              x.placeId ===
                example.placeId &&
              x.driver ===
                example.driver
          );

        if (!exists) {
          cluster.examples.push(
            example
          );
        }
      }

      cluster.centroid =
        weightedCentroid(
          cluster.centroid,
          cluster.centroidWeight,
          group.embedding,
          weight
        );

      cluster.centroidWeight +=
        weight;

      continue;
    }

    clusters.push({
      id:
        `cluster-${clusters.length + 1}`,
      representative:
        group.representative,
      occurrences:
        group.occurrences,
      distinctPlaces:
        group.distinctPlaces,
      categories: {
        ...group.categories,
      },
      phrases: [
        {
          phrase:
            group.representative,
          normalized:
            group.normalized,
          occurrences:
            group.occurrences,
          distinctPlaces:
            group.distinctPlaces,
        },
      ],
      examples:
        group.examples.slice(
          0,
          12
        ),
      nearestExistingSignal:
        null,
      nearestExistingSimilarity:
        0,
      centroid:
        [...group.embedding],
      centroidWeight:
        weight,
    });
  }

  return clusters;
}

function recomputeClusterPlaceCounts(
  clusters: InternalCluster[],
  exactGroups:
    Map<
      string,
      DriverOccurrence[]
    >
) {
  for (const cluster of clusters) {
    const places =
      new Set<string>();

    for (
      const phrase of
        cluster.phrases
    ) {
      for (
        const occurrence of
          exactGroups.get(
            phrase.normalized
          ) || []
      ) {
        places.add(
          occurrence.placeId
        );
      }
    }

    cluster.distinctPlaces =
      places.size;
  }
}

function attachExistingCriteria(
  clusters: InternalCluster[],
  criteria: Criteria,
  cache: EmbeddingCache
) {
  const criteriaVectors =
    Object.entries(
      criteria.signals
    ).map(
      ([key, value]) => {
        const text =
          `${key} — ${value.label} — ${value.definition}`;

        return {
          key,
          embedding:
            embeddingFor(
              text,
              cache
            ),
        };
      }
    );

  for (const cluster of clusters) {
    let bestKey:
      string | null = null;

    let bestScore = -1;

    for (
      const criterion of
        criteriaVectors
    ) {
      const score =
        cosine(
          cluster.centroid,
          criterion.embedding
        );

      if (
        score > bestScore
      ) {
        bestScore = score;
        bestKey =
          criterion.key;
      }
    }

    cluster.nearestExistingSignal =
      bestKey;

    cluster.nearestExistingSimilarity =
      Number(
        bestScore.toFixed(4)
      );
  }
}

async function main() {
  if (
    !process.env.OPENAI_API_KEY
  ) {
    throw new Error(
      "OPENAI_API_KEY absente"
    );
  }

  const profilesFile =
    JSON.parse(
      fs.readFileSync(
        PROFILES_PATH,
        "utf8"
      )
    ) as ProfilesFile;

  const criteria =
    JSON.parse(
      fs.readFileSync(
        CRITERIA_PATH,
        "utf8"
      )
    ) as Criteria;

  const occurrences =
    collectOccurrences(
      profilesFile.profiles
    );

  const exactGroups =
    groupExactDrivers(
      occurrences
    );

  console.log(
    "=== INDIE MAP SCOUT / DISCOVER V1 ==="
  );

  console.log(
    "PROFILS :",
    profilesFile
      .profiles.length
  );

  console.log(
    "DRIVERS TOTAL :",
    occurrences.length
  );

  console.log(
    "FORMULATIONS UNIQUES :",
    exactGroups.size
  );

  console.log(
    "SEUIL CLUSTER :",
    CLUSTER_THRESHOLD
  );

  console.log("");

  const criteriaTexts =
    Object.entries(
      criteria.signals
    ).map(
      ([key, value]) =>
        `${key} — ${value.label} — ${value.definition}`
    );

  const driverTexts =
    [...exactGroups.keys()];

  const allEmbeddingTexts =
    [
      ...driverTexts,
      ...criteriaTexts,
    ];

  const openai =
    new OpenAI({
      apiKey:
        process.env.OPENAI_API_KEY,
    });

  const cache =
    loadCache();

  const embeddingTokens =
    await ensureEmbeddings(
      openai,
      allEmbeddingTexts,
      cache
    );

  const groups:
    DriverGroup[] = [];

  for (
    const [
      normalized,
      rows,
    ] of exactGroups
  ) {
    const categoryCounts:
      Record<
        string,
        number
      > = {};

    const placeIds =
      new Set<string>();

    const variants =
      new Map<
        string,
        number
      >();

    for (const row of rows) {
      placeIds.add(
        row.placeId
      );

      categoryCounts[
        row.category
      ] =
        (
          categoryCounts[
            row.category
          ] || 0
        ) + 1;

      variants.set(
        row.driver,
        (
          variants.get(
            row.driver
          ) || 0
        ) + 1
      );
    }

    const representative =
      [...variants.entries()]
        .sort(
          (a, b) =>
            b[1] - a[1]
        )[0][0];

    groups.push({
      normalized,
      representative,
      occurrences:
        rows.length,
      distinctPlaces:
        placeIds.size,
      categories:
        categoryCounts,
      examples:
        rows.slice(0, 8),
      embedding:
        embeddingFor(
          normalized,
          cache
        ),
    });
  }

  const clusters =
    clusterDrivers(groups);

  recomputeClusterPlaceCounts(
    clusters,
    exactGroups
  );

  attachExistingCriteria(
    clusters,
    criteria,
    cache
  );

  clusters.sort(
    (a, b) =>
      b.distinctPlaces -
        a.distinctPlaces ||
      b.occurrences -
        a.occurrences
  );

  /*
   * Les IDs sont réattribués après tri afin
   * que cluster-1 soit réellement le cluster
   * le plus répandu.
   */
  clusters.forEach(
    (cluster, index) => {
      cluster.id =
        `cluster-${index + 1}`;
    }
  );

  const output = {
    version:
      "scout-discovery-clusters-v1",
    generatedAt:
      new Date()
        .toISOString(),
    embeddingModel:
      EMBEDDING_MODEL,
    clusterThreshold:
      CLUSTER_THRESHOLD,
    profiles:
      profilesFile
        .profiles.length,
    totalDrivers:
      occurrences.length,
    uniqueDrivers:
      exactGroups.size,
    clusters:
      clusters.length,
    embeddingTokens,
    warning:
      "Ces clusters sont des regroupements exploratoires des selectionDrivers. Ils ne constituent pas des critères Indie Map et aucun nouveau critère n'est promu automatiquement.",
    results:
      clusters.map(
        ({
          centroid,
          centroidWeight,
          ...cluster
        }) => cluster
      ),
  };

  writeJsonAtomic(
    OUTPUT_PATH,
    output
  );

  console.log("");
  console.log(
    "CLUSTERS :",
    clusters.length
  );

  console.log(
    "TOKENS EMBEDDINGS :",
    embeddingTokens
  );

  console.log(
    "SORTIE :",
    OUTPUT_PATH
  );

  console.log("");
  console.log(
    "=== TOP 30 CLUSTERS ==="
  );

  for (
    const cluster of
      clusters.slice(0, 30)
  ) {
    const categories =
      Object.entries(
        cluster.categories
      )
        .sort(
          (a, b) =>
            b[1] - a[1]
        )
        .slice(0, 4)
        .map(
          ([key, count]) =>
            `${key}:${count}`
        )
        .join(", ");

    console.log("");
    console.log(
      `${cluster.id} — ${cluster.representative}`
    );

    console.log(
      "  lieux       :",
      cluster.distinctPlaces
    );

    console.log(
      "  occurrences :",
      cluster.occurrences
    );

    console.log(
      "  catégories  :",
      categories
    );

    console.log(
      "  proche de   :",
      cluster.nearestExistingSignal,
      `(${cluster.nearestExistingSimilarity})`
    );

    console.log(
      "  formulations:",
      cluster.phrases
        .slice(0, 5)
        .map(
          x => x.phrase
        )
        .join(" | ")
    );
  }

  if (
    hasFlag("--no-classify")
  ) {
    console.log("");
    console.log(
      "Classification LLM désactivée pour ce test."
    );
  }
}

main().catch((error) => {
  console.error("");
  console.error(
    "SCOUT DISCOVER FAILED"
  );
  console.error(error);
  process.exit(1);
});
