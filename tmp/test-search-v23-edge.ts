import fs from "node:fs";

import {
  localSearch,
  type SearchPlace,
} from "../src/lib/placeSearch";

const places =
  JSON.parse(
    fs.readFileSync(
      "data/places.json",
      "utf8"
    )
  ) as SearchPlace[];

const queries = [
  // Doit exclure les lieux fermés à cette heure
  "un café ouvert samedi à 22h à Paris",

  // Test d'une heure avant ouverture
  "un restaurant ouvert samedi à 8h à Paris",

  // Test après minuit pour un lieu qui ferme à 1h/2h
  "une brasserie ouverte samedi à 23h30 à Paris",

  // Ville + catégorie sans horaires
  "une épicerie à Meudon",

  // Recherche avec accents retirés
  "un cafe a Montreal",

  // Faute légère dans un nom
  "Patochee",

  // Catégorie inexistante dans une ville
  "une librairie à Meudon",

  // Jour fermé
  "un restaurant ouvert dimanche à Paris",
];

for (const query of queries) {
  const result =
    localSearch(query, places);

  console.log();
  console.log("=".repeat(75));
  console.log(query);
  console.log(
    "RESULTATS :",
    result.results.length
  );

  for (
    const place of
      result.results.slice(0, 30)
  ) {
    console.log(
      "-",
      place.name,
      "|",
      place.category,
      "|",
      place.city,
      "|",
      String(
        place.openingHours || ""
      ).replace(/\n/g, " / ")
    );
  }
}
