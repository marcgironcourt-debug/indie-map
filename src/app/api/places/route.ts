import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "places.json");
    const raw = await fs.promises.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      console.error("[/api/places] places.json n'est pas un tableau");
      return NextResponse.json([]);
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[/api/places] Erreur de lecture places.json", err);
    return NextResponse.json([]);
  }
}
