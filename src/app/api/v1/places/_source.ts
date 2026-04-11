import fs from "node:fs";
import path from "node:path";

const REMOTE_PLACES_URL =
  process.env.PLACES_DATA_URL ||
  "https://raw.githubusercontent.com/marcgironcourt-debug/indie-map-data/main/data/places.json";

export async function readPlacesSource(): Promise<unknown> {
  try {
    const res = await fetch(REMOTE_PLACES_URL, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`remote places fetch failed: ${res.status}`);
    }
    return JSON.parse(await res.text());
  } catch {
    const filePath = path.join(process.cwd(), "data", "places.json");
    const raw = await fs.promises.readFile(filePath, "utf8");
    return JSON.parse(raw);
  }
}
