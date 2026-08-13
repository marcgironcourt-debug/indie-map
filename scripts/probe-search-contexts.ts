import fs from "node:fs";
import {
  localSearch,
  type SearchPlace,
} from "../src/lib/placeSearch";

const places = JSON.parse(
  fs.readFileSync("data/places.json", "utf8")
) as SearchPlace[];

const queries = [
  "restaurant vegan à Sydney",
  "café sans gluten à Sydney",
  "restaurant inclusif à Bois-Colombes",
  "crêperie bretonne à Paris",
  "produits locaux à Sydney",
  "ferme bio",
  "vrac à Paris",
  "circuit court à Paris",
  "fait maison à Paris",
  "manger sur le pouce à Paris",
  "rooftop à Sydney",
  "bar avec terrasse à Sydney",
  "restaurant avec jardin",
  "café calme à Paris",
  "café cosy à Paris",
  "lieu pour travailler à Paris",
  "endroit en famille à Paris",
  "restaurant romantique à Paris",
  "concert à Paris",
  "bière artisanale à Sydney",
  "vin naturel à Paris",
  "cocktail à Sydney",
  "petit déjeuner à Sydney",
  "pâtisserie à Paris",
  "atelier réparation à Paris",
  "faire un atelier à Paris",
  "seconde main à Paris",
  "mode éthique à Paris",
  "artisanat indépendant à Paris",
  "zéro déchet à Paris",
  "vente directe producteur",
  "produits de saison à Paris",
  "Bretagne",
  "Food breizh",
  "Maison nouvelle"
];

for (const query of queries) {
  const r = localSearch(query, places);

  console.log("");
  console.log("QUERY:", query);
  console.log(" mode:", r.searchMode);
  console.log(" city:", r.detectedCity || "—");
  console.log(" categories:", r.targetCategories.join(", ") || "—");
  console.log(" contexts:", r.detectedConcepts.join(", ") || "—");
  console.log(" tokens:", r.meaningfulTokens.join(", ") || "—");
  console.log(" count:", r.results.length);
  console.log(
    " top:",
    r.results
      .slice(0, 8)
      .map((p) => `${p.name} [${p.city || "?"}]`)
      .join(" | ") || "—"
  );
}
