import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config({ path: ".env.local" });

const queries = [
  "ou boire un coup à sydney",
  "un endroit où boire quelque chose à Sydney",
  "un endroit sympa pour prendre l'apéro à Sydney",

  "je veux manger vers coogee",
  "un endroit où manger près de Coogee",

  "je veux manger rapidement à Paris",
  "un truc à manger sur le pouce à Paris",

  "un café tranquille où lire à Paris",
  "un endroit calme pour travailler avec mon ordinateur à Paris",

  "restaurant vegan à Sydney",
  "café sans gluten à Sydney",

  "trouve moi un snack porte maillot paris",
  "où manger près de Porte Maillot",

  "un bar sur un toit à Sydney",
  "bar avec terrasse à Sydney",

  "restaurant romantique à Paris",
  "un restaurant intimiste pour un date à Paris",

  "des vêtements responsables à Paris",
  "boutique de seconde main à Paris",

  "artisanat indépendant à Paris",
  "un cadeau fabriqué par un artisan à Paris",

  "un endroit engagé contre le gaspillage à Paris",

  "où boire une bière locale à Sydney",

  "où acheter directement à un producteur",

  "restaurant inclusif à Bois-Colombes",

  "une crêperie avec des produits bretons à Paris",

  "Food breizh",
  "Maison nouvelle",

  // Cas nouveaux, jamais utilisés pour régler le moteur :
  "j'aimerais me poser quelque part avec un bouquin à Paris",
  "où grignoter près de Bondi Beach",
  "je cherche des fringues d'occasion responsables",
  "un endroit pour boire une mousse artisanale à Sydney",
  "je voudrais acheter mes légumes directement chez quelqu'un qui les produit"
];

const INTENTS = [
  "drink",
  "eat",
  "quick_food",
  "cafe",
  "work",
  "groceries",
  "direct_producer",
  "shopping",
  "bakery",
  "culture",
  "workshop",
  "unknown"
] as const;

const CATEGORIES = [
  "restaurant",
  "cafe",
  "bar",
  "epicerie",
  "marche",
  "ferme",
  "boutique",
  "librairie",
  "boulangerie",
  "atelier",
  "alternatif",
  "none"
] as const;

const HARD = [
  "vegan",
  "vegetarian",
  "gluten_free",
  "organic",
  "local_products",
  "zero_waste",
  "ethical_fashion",
  "second_hand",
  "rooftop",
  "terrace",
  "inclusive",
  "brittany",
  "beer",
  "wine",
  "cocktail",
  "creperie",
  "pastry",
  "repair",
  "garden",
  "seasonal",
  "short_supply",
  "direct_producer",
  "bulk"
] as const;

const SOFT = [
  "quiet",
  "romantic",
  "cozy",
  "work_friendly",
  "family",
  "craft",
  "independent",
  "sustainable",
  "quick_food",
  "art_culture"
] as const;

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY absente");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.responses.create({
    model: "gpt-5-nano",

    input: [
      {
        role: "system",
        content: `
Tu analyses des requêtes de recherche de lieux pour Indie Map.

Tu dois EXTRAIRE, pas inventer.

RÈGLES IMPORTANTES :

- cityText = ville explicitement mentionnée.
- locationText = quartier, zone, rue, adresse, région ou lieu géographique
  explicitement mentionné, mais PAS la ville déjà mise dans cityText.
- Ne transforme jamais un adjectif en localisation.
- "bière locale à Sydney" => cityText="Sydney", locationText="".
- "artisan à Paris" => cityText="Paris", locationText="".
- "Porte Maillot Paris" => cityText="Paris", locationText="Porte Maillot".
- "près de Coogee" => locationText="Coogee".
- "Bondi Beach" => locationText="Bondi Beach".
- "Maison nouvelle" ressemble à une recherche d'entité :
  entityText="Maison nouvelle".
- entityText sert uniquement lorsqu'une requête semble chercher
  un nom précis de lieu, commerce ou adresse.
- Ne mets jamais une préférence subjective dans hardConstraints.
- quiet / romantic / cozy sont des préférences souples.
- vegan / sans gluten / terrasse / rooftop sont des contraintes fortes.
- "bière locale" signifie bière + éventuellement produits locaux,
  pas une localisation appelée "locale".
- Si tu n'es pas certain d'une intention, utilise "unknown".
- Conserve le sens de la langue originale, français ou anglais.
        `.trim(),
      },
      {
        role: "user",
        content: JSON.stringify(queries),
      },
    ],

    text: {
      format: {
        type: "json_schema",
        name: "indie_map_search_parser",
        strict: true,
        schema: {
          type: "object",
          properties: {
            searches: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                  },
                  intent: {
                    type: "string",
                    enum: [...INTENTS],
                  },
                  explicitCategory: {
                    type: "string",
                    enum: [...CATEGORIES],
                  },
                  cityText: {
                    type: "string",
                  },
                  locationText: {
                    type: "string",
                  },
                  entityText: {
                    type: "string",
                  },
                  hardConstraints: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: [...HARD],
                    },
                  },
                  softPreferences: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: [...SOFT],
                    },
                  },
                },
                required: [
                  "query",
                  "intent",
                  "explicitCategory",
                  "cityText",
                  "locationText",
                  "entityText",
                  "hardConstraints",
                  "softPreferences"
                ],
                additionalProperties: false,
              },
            },
          },
          required: ["searches"],
          additionalProperties: false,
        },
      },
    },
    store: false,
  });

  const content = response.output_text;

  if (!content) {
    throw new Error("Réponse structurée vide");
  }

  const parsed = JSON.parse(content);

  for (const item of parsed.searches) {
    console.log("");
    console.log("==================================================");
    console.log("QUERY:", item.query);
    console.log(" intent:", item.intent);
    console.log(" category:", item.explicitCategory);
    console.log(" city:", item.cityText || "—");
    console.log(" location:", item.locationText || "—");
    console.log(" entity:", item.entityText || "—");
    console.log(
      " hard:",
      item.hardConstraints.join(", ") || "—"
    );
    console.log(
      " soft:",
      item.softPreferences.join(", ") || "—"
    );
  }

  console.log("");
  console.log("==================================================");
  console.log(
    "INPUT TOKENS:",
    response.usage?.input_tokens ?? "—"
  );
  console.log(
    "OUTPUT TOKENS:",
    response.usage?.output_tokens ?? "—"
  );
  console.log(
    "TOTAL TOKENS:",
    response.usage?.total_tokens ?? "—"
  );
}

main().catch((error) => {
  console.error("");
  console.error("ERREUR PARSER:");
  console.error(error?.status || "");
  console.error(error?.message || error);
  process.exit(1);
});
