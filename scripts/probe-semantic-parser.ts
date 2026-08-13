import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config({ path: ".env.local" });

const MODEL = "text-embedding-3-small";

const INTENTS = {
  bar: `
    boire quelque chose, prendre un verre, boire un coup,
    aller boire, apéritif, apéro, bar, pub, bière, vin,
    cocktail, sortir boire
  `,
  eat: `
    manger, déjeuner, dîner, prendre un repas,
    aller manger, trouver quelque chose à manger,
    restaurant, repas
  `,
  quick_food: `
    manger rapidement, manger sur le pouce,
    prendre un snack, quick bite, grab a bite,
    repas rapide, à emporter
  `,
  cafe: `
    prendre un café, boire un café, café,
    coffee shop, prendre un thé, goûter
  `,
  work_cafe: `
    travailler dans un café, travailler avec un ordinateur,
    travailler avec un laptop, endroit pour travailler,
    café pour travailler
  `,
  groceries: `
    faire les courses, acheter des produits alimentaires,
    épicerie, marché, acheter à manger,
    produits locaux
  `,
  direct_producer: `
    acheter directement au producteur,
    vente directe à la ferme,
    acheter auprès d'un producteur
  `,
  shopping: `
    acheter un objet, faire du shopping,
    boutique, trouver un cadeau
  `,
  bakery: `
    acheter du pain, boulangerie,
    viennoiserie, pâtisserie
  `,
  culture: `
    voir une exposition, culture, galerie,
    art, concert, lieu culturel
  `,
  workshop: `
    participer à un atelier, apprendre,
    réparer, faire un cours, workshop
  `,
};

const CONTEXTS = {
  vegan: `
    vegan, végétalien, alimentation entièrement végétale
  `,
  gluten_free: `
    sans gluten, gluten free
  `,
  vegetarian: `
    végétarien, sans viande
  `,
  organic: `
    bio, biologique, organic
  `,
  local_products: `
    produits locaux, producteurs locaux,
    alimentation locale, du territoire
  `,
  zero_waste: `
    zéro déchet, lutter contre le gaspillage,
    anti-gaspi, éviter le gaspillage,
    consommation sans déchet
  `,
  ethical_fashion: `
    vêtements responsables, mode éthique,
    mode responsable, habillement durable
  `,
  second_hand: `
    seconde main, friperie, vêtements d'occasion,
    vintage, réemploi
  `,
  craft: `
    artisanat, fait par des artisans,
    fabrication artisanale, fait main
  `,
  independent: `
    indépendant, créateurs indépendants,
    commerce indépendant
  `,
  rooftop: `
    rooftop, bar sur un toit, terrasse sur un toit
  `,
  terrace: `
    terrasse, boire dehors, manger dehors,
    outdoor seating
  `,
  quiet: `
    calme, tranquille, paisible,
    endroit où lire au calme
  `,
  romantic: `
    romantique, intimiste, rendez-vous amoureux,
    restaurant pour un date
  `,
  inclusive: `
    inclusif, insertion, emploi de personnes
    en situation de handicap
  `,
  brittany: `
    Bretagne, Breizh, breton, bretonne,
    produits bretons
  `,
};

const QUERIES = [
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
  "des vêtements responsables à Paris",
  "boutique de seconde main à Paris",
  "artisanat indépendant à Paris",
  "un cadeau fabriqué par un artisan à Paris",
  "un endroit engagé contre le gaspillage à Paris",
  "où boire une bière locale à Sydney",
  "restaurant romantique à Paris",
  "un restaurant intimiste pour un date à Paris",
  "un bar sur un toit à Sydney",
  "bar avec terrasse à Sydney",
  "où acheter directement à un producteur",
  "restaurant inclusif à Bois-Colombes",
  "une crêperie avec des produits bretons à Paris",
  "Food breizh",
  "Maison nouvelle",
];

function cosine(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }

  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY absente");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const intentEntries = Object.entries(INTENTS);
  const contextEntries = Object.entries(CONTEXTS);

  const texts = [
    ...intentEntries.map(([, text]) => text),
    ...contextEntries.map(([, text]) => text),
    ...QUERIES,
  ];

  const response = await openai.embeddings.create({
    model: MODEL,
    input: texts,
  });

  const vectors = [...response.data]
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);

  const intentVectors = vectors.slice(
    0,
    intentEntries.length
  );

  const contextStart = intentEntries.length;
  const queryStart =
    intentEntries.length + contextEntries.length;

  const contextVectors = vectors.slice(
    contextStart,
    queryStart
  );

  const queryVectors = vectors.slice(queryStart);

  console.log("TOKENS :", response.usage?.total_tokens ?? "—");

  for (let i = 0; i < QUERIES.length; i++) {
    const q = queryVectors[i];

    const intents = intentEntries
      .map(([name], index) => ({
        name,
        score: cosine(q, intentVectors[index]),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    const contexts = contextEntries
      .map(([name], index) => ({
        name,
        score: cosine(q, contextVectors[index]),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    console.log("");
    console.log("==============================================");
    console.log("QUERY:", QUERIES[i]);

    console.log(
      "INTENTS:",
      intents
        .map(x => `${x.name}=${x.score.toFixed(4)}`)
        .join(" | ")
    );

    console.log(
      "CONTEXTS:",
      contexts
        .map(x => `${x.name}=${x.score.toFixed(4)}`)
        .join(" | ")
    );
  }
}

main().catch((error) => {
  console.error("ERREUR :", error?.message || error);
  process.exit(1);
});
