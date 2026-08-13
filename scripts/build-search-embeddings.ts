import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config({ path: ".env.local" });

const MODEL = "text-embedding-3-small";
const COST_PER_MILLION_TOKENS_USD = 0.02;
const BATCH_SIZE = 80;

const placesPath = path.join(process.cwd(), "data", "places.json");
const outputPath = path.join(
  process.cwd(),
  "data",
  "private",
  "search-embeddings-v1.json"
);

type Place = Record<string, any>;

type CacheEntry = {
  id: string;
  textHash: string;
  embedding: number[];
};

type Cache = {
  version: number;
  model: string;
  createdAt: string;
  placeCount: number;
  dimensions: number;
  entries: CacheEntry[];
};

function clean(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function collectStrings(value: unknown, output: string[] = []) {
  if (typeof value === "string") {
    const text = clean(value);
    if (text) output.push(text);
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output);
    return output;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectStrings(item, output);
    }
  }

  return output;
}

function searchDocument(place: Place) {
  const parts = [
    `Nom: ${clean(place.name)}`,
    `Ville: ${clean(place.city)}`,
    `Pays: ${clean(place.country)}`,
    `Adresse: ${clean(place.address)}`,
    `Catégorie: ${clean(place.category)}`,
    place.tags?.length
      ? `Tags: ${place.tags.map(clean).filter(Boolean).join(", ")}`
      : "",
    place.miniText ? `Description: ${clean(place.miniText)}` : "",
    place.homeTextNear ? clean(place.homeTextNear) : "",
    place.homeTextFar ? clean(place.homeTextFar) : "",
  ].filter(Boolean);

  const translations = collectStrings(place.translations);

  if (translations.length > 0) {
    parts.push(`Traductions: ${translations.join(" | ")}`);
  }

  return parts.join("\n");
}

function hash(value: string) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

function loadExistingCache(): Cache | null {
  if (!fs.existsSync(outputPath)) return null;

  try {
    const parsed = JSON.parse(
      fs.readFileSync(outputPath, "utf8")
    ) as Cache;

    if (parsed.model !== MODEL) return null;
    if (!Array.isArray(parsed.entries)) return null;

    return parsed;
  } catch {
    return null;
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY absente de .env.local");
  }

  const places = JSON.parse(
    fs.readFileSync(placesPath, "utf8")
  ) as Place[];

  const existing = loadExistingCache();

  const existingById = new Map(
    (existing?.entries || []).map((entry) => [
      entry.id,
      entry,
    ])
  );

  const prepared = places.map((place) => {
    const text = searchDocument(place);

    return {
      id: String(place.id),
      text,
      textHash: hash(text),
    };
  });

  const reused = new Map<string, CacheEntry>();
  const pending: typeof prepared = [];

  for (const item of prepared) {
    const old = existingById.get(item.id);

    if (
      old &&
      old.textHash === item.textHash &&
      Array.isArray(old.embedding) &&
      old.embedding.length > 0
    ) {
      reused.set(item.id, old);
    } else {
      pending.push(item);
    }
  }

  console.log("=== EMBEDDINGS INDIE MAP ===");
  console.log("LIEUX :", places.length);
  console.log("RÉUTILISÉS :", reused.size);
  console.log("À VECTORISER :", pending.length);
  console.log("MODÈLE :", MODEL);
  console.log("");

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const generated = new Map<string, CacheEntry>();
  let totalTokens = 0;

  for (
    let offset = 0;
    offset < pending.length;
    offset += BATCH_SIZE
  ) {
    const batch = pending.slice(
      offset,
      offset + BATCH_SIZE
    );

    const response = await openai.embeddings.create({
      model: MODEL,
      input: batch.map((item) => item.text),
    });

    totalTokens += response.usage?.total_tokens || 0;

    const vectors = [...response.data].sort(
      (a, b) => a.index - b.index
    );

    if (vectors.length !== batch.length) {
      throw new Error(
        `Nombre de vecteurs incorrect : ${vectors.length}/${batch.length}`
      );
    }

    batch.forEach((item, index) => {
      generated.set(item.id, {
        id: item.id,
        textHash: item.textHash,
        embedding: vectors[index].embedding,
      });
    });

    console.log(
      `LOT ${Math.floor(offset / BATCH_SIZE) + 1} :`,
      `${Math.min(offset + BATCH_SIZE, pending.length)}/${pending.length}`,
      "— tokens cumulés :",
      totalTokens
    );
  }

  const entries: CacheEntry[] = prepared.map((item) => {
    const entry =
      generated.get(item.id) ||
      reused.get(item.id);

    if (!entry) {
      throw new Error(
        `Embedding absent pour ${item.id}`
      );
    }

    return entry;
  });

  const dimensions =
    entries[0]?.embedding?.length || 0;

  const cache: Cache = {
    version: 1,
    model: MODEL,
    createdAt: new Date().toISOString(),
    placeCount: places.length,
    dimensions,
    entries,
  };

  fs.mkdirSync(path.dirname(outputPath), {
    recursive: true,
  });

  fs.writeFileSync(
    outputPath,
    JSON.stringify(cache)
  );

  const estimatedCost =
    (totalTokens / 1_000_000) *
    COST_PER_MILLION_TOKENS_USD;

  console.log("");
  console.log("=== TERMINÉ ===");
  console.log("LIEUX VECTORISÉS :", entries.length);
  console.log("DIMENSIONS :", dimensions);
  console.log("NOUVEAUX TOKENS FACTURÉS :", totalTokens);
  console.log(
    "COÛT ESTIMÉ DE CETTE EXÉCUTION : $",
    estimatedCost.toFixed(6)
  );
  console.log("CACHE :", outputPath);
  console.log(
    "TAILLE :",
    (
      fs.statSync(outputPath).size /
      1024 /
      1024
    ).toFixed(2),
    "Mo"
  );
}

main().catch((error) => {
  console.error("");
  console.error("ERREUR EMBEDDINGS :");
  console.error(error?.message || error);
  process.exit(1);
});
