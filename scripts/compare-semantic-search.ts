import fs from "node:fs";
import dotenv from "dotenv";
import OpenAI from "openai";
import {
  localSearch,
  type SearchPlace,
} from "../src/lib/placeSearch";

dotenv.config({ path: ".env.local" });

const MODEL = "text-embedding-3-small";

type CacheEntry = {
  id: string;
  embedding: number[];
};

type Cache = {
  model: string;
  dimensions: number;
  entries: CacheEntry[];
};

const places = JSON.parse(
  fs.readFileSync("data/places.json", "utf8")
) as SearchPlace[];

const cache = JSON.parse(
  fs.readFileSync(
    "data/private/search-embeddings-v1.json",
    "utf8"
  )
) as Cache;

const placesById = new Map(
  places.map((place) => [place.id, place])
);

const queries = [
  "ou boire un coup à sydney",
  "un endroit où boire quelque chose à Sydney",
  "un endroit sympa pour prendre l'apéro à Sydney",

  "je veux manger vers coogee",
  "un endroit où manger près de Coogee",

  "restaurant vegan à Sydney",
  "café sans gluten à Sydney",

  "un café tranquille où lire à Paris",
  "un endroit calme pour travailler avec mon ordinateur à Paris",

  "je veux manger rapidement à Paris",
  "un truc à manger sur le pouce à Paris",

  "trouve moi un snack porte maillot paris",
  "où manger près de Porte Maillot",

  "rooftop à Sydney",
  "un bar sur un toit à Sydney",
  "bar avec terrasse à Sydney",

  "restaurant romantique à Paris",
  "un restaurant intimiste pour un date à Paris",

  "produits locaux à Sydney",
  "où acheter directement à un producteur",

  "boutique de seconde main à Paris",
  "des vêtements responsables à Paris",

  "artisanat indépendant à Paris",
  "un cadeau fabriqué par un artisan à Paris",

  "un lieu zéro déchet à Paris",
  "un endroit engagé contre le gaspillage à Paris",

  "bière artisanale à Sydney",
  "où boire une bière locale à Sydney",

  "vin naturel à Paris",

  "Bretagne",
  "Breizh",
  "Food breizh",

  "Maison nouvelle",

  "restaurant inclusif à Bois-Colombes",

  "une crêperie avec des produits bretons à Paris",
];

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY absente");
  }

  if (cache.model !== MODEL) {
    throw new Error(
      `Cache modèle ${cache.model}, attendu ${MODEL}`
    );
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log("=== VECTORISATION DES REQUÊTES ===");

  const response = await openai.embeddings.create({
    model: MODEL,
    input: queries,
  });

  const queryVectors = [...response.data].sort(
    (a, b) => a.index - b.index
  );

  console.log(
    "REQUÊTES :",
    queries.length,
    "| TOKENS :",
    response.usage?.total_tokens ?? "—"
  );

  for (let index = 0; index < queries.length; index += 1) {
    const query = queries[index];
    const queryEmbedding = queryVectors[index].embedding;

    const deterministic = localSearch(query, places);

    const semantic = cache.entries
      .map((entry) => {
        const place = placesById.get(entry.id);

        if (!place) return null;

        return {
          place,
          score: cosineSimilarity(
            queryEmbedding,
            entry.embedding
          ),
        };
      })
      .filter(
        (
          item
        ): item is {
          place: SearchPlace;
          score: number;
        } => item !== null
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    console.log("");
    console.log("==================================================");
    console.log("QUERY:", query);

    console.log("");
    console.log(
      "V2.2:",
      deterministic.searchMode,
      "|",
      deterministic.results.length,
      "résultat(s)"
    );

    console.log(
      deterministic.results
        .slice(0, 6)
        .map(
          (place, i) =>
            ` ${i + 1}. ${place.name} [${place.city || "?"}]`
        )
        .join("\n") || " —"
    );

    console.log("");
    console.log("SÉMANTIQUE:");

    for (let i = 0; i < semantic.length; i += 1) {
      const item = semantic[i];

      console.log(
        ` ${i + 1}. ${item.place.name} [${item.place.city || "?"}] — ${item.score.toFixed(4)}`
      );
    }
  }

  console.log("");
  console.log("==================================================");
  console.log("TOKENS FACTURÉS :", response.usage?.total_tokens ?? "—");
}

main().catch((error) => {
  console.error("");
  console.error("ERREUR :", error?.message || error);
  process.exit(1);
});
