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
  "un café à Montréal",
  "un café ouvert samedi à Paris",
  "un restaurant ouvert samedi à 19h30 à Paris",
  "Trouve-moi un endroit pour boire une bière à Paris",
  "Patoche",
];

for (const query of queries) {
  const result =
    localSearch(query, places);

  console.log();
  console.log(
    "=".repeat(75)
  );

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
    "TOKENS :",
    result.meaningfulTokens
  );

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
      place.city
    );
  }
}
