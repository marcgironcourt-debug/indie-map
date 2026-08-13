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
  "un café ouvert samedi à Paris",
  "un café à Montréal",
  "une librairie ouverte dimanche à Paris",
  "Patoche",
  "un restaurant ouvert samedi à 19h30 à Paris",
];

for (const query of queries) {
  const result =
    localSearch(query, places);

  console.log();
  console.log("=".repeat(70));
  console.log(query);

  console.log(
    "VILLE :",
    result.detectedCity
  );

  console.log(
    "CATEGORIE :",
    result.explicitCategory
  );

  console.log(
    "MODE :",
    result.searchMode
  );

  console.log(
    "RESULTATS :",
    result.results.length
  );

  for (
    const place of result.results.slice(0, 30)
  ) {
    console.log(
      "-",
      place.name,
      "|",
      place.category,
      "|",
      place.city,
      "|",
      String(place.openingHours || "")
        .replace(/\n/g, " / ")
    );
  }
}
