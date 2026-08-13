import fs from "node:fs";
import path from "node:path";
import {
  localSearch,
  type SearchPlace,
} from "../src/lib/placeSearch";

const places = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "data", "places.json"),
    "utf8"
  )
) as SearchPlace[];

const cases = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "scripts", "search-regression-cases.json"),
    "utf8"
  )
) as Array<{ query: string; expect: string }>;

let failures = 0;

function names(result: ReturnType<typeof localSearch>) {
  return result.results.slice(0, 8).map((place) => place.name);
}

function evaluate(
  expect: string,
  result: ReturnType<typeof localSearch>
) {
  const resultNames = result.results.map((place) => place.name);
  const topNames = resultNames.slice(0, 10);

  switch (expect) {
    case "semantic_bar_sydney":
      return (
        result.detectedCity === "Sydney" &&
        result.results.length > 0
      );

    case "bondi_area_typo":
      return topNames.some((name) =>
        name.toLowerCase().includes("bondi")
      );

    case "bondi_markets":
      return topNames.includes("Bondi Markets");

    case "brittany_content":
      return (
        resultNames.includes("Marché des Lices") ||
        resultNames.includes("Maison Bretonne")
      );

    case "must_not_ignore_breizh":
      return (
        result.results.length < 50 &&
        resultNames.includes("Maison Bretonne")
      );

    case "semantic_brittany":
      return (
        resultNames.includes("Marché des Lices") ||
        resultNames.includes("Maison Bretonne")
      );

    case "food_near_coogee":
      return (
        result.results.length > 0 &&
        result.searchMode === "geo_nearby_v2"
      );

    case "quick_food_paris":
      return (
        result.results.length > 0 &&
        result.results
          .slice(0, 20)
          .every((place) => place.city === "Paris")
      );

    case "snack_near_porte_maillot":
      // Tant qu'on n'a pas de vrai géocodeur de quartiers,
      // zéro résultat est préférable aux 6 faux résultats historiques.
      return result.results.length <= 5;

    case "city_hoi_an":
      return (
        result.detectedCity === "Hoi An" &&
        result.results.length > 0
      );

    case "city_chiang_mai":
      return (
        result.detectedCity === "Chiang Mai" &&
        result.results.length > 0
      );

    case "city_paris":
      return (
        result.detectedCity === "Paris" &&
        result.results.length > 0
      );

    case "bories_address_fuzzy":
      return resultNames.includes(
        "Les Jardins Garonnais - Vente à la ferme"
      );

    case "do_not_match_random_partial_places":
      return result.results.length <= 3;

    case "do_not_return_wrong_oxford_address":
      return result.results.length === 0;

    case "do_not_ignore_regina_canada":
      return result.results.length === 0;

    default:
      return true;
  }
}

for (const test of cases) {
  const result = localSearch(test.query, places);
  const pass = evaluate(test.expect, result);

  if (!pass) failures += 1;

  console.log("");
  console.log(pass ? "PASS" : "FAIL", "—", test.query);
  console.log("  mode:", result.searchMode);
  console.log("  city:", result.detectedCity || "—");
  console.log("  categories:", result.targetCategories.join(", ") || "—");
  console.log("  tokens:", result.meaningfulTokens.join(", ") || "—");
  console.log("  count:", result.results.length);
  console.log("  top:", names(result).join(" | ") || "—");
}

console.log("");
console.log("================================");
console.log("TESTS:", cases.length);
console.log("PASS:", cases.length - failures);
console.log("FAIL:", failures);
console.log("================================");

if (failures > 0) {
  process.exitCode = 1;
}
