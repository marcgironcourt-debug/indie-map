import { NextResponse } from "next/server";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;
import fs from "node:fs";
import path from "node:path";
import { normalizePlace } from "../_normalize";

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    const filePath = path.join(process.cwd(), "data", "places.json");
    const raw = await fs.promises.readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 500, headers: V1_HEADERS });
    }

    const found = parsed.find((x: unknown) => isObj(x) && x.id === id);

    if (!found) {
      return NextResponse.json({ error: "Not Found" }, { status: 404, headers: V1_HEADERS });
    }

    return NextResponse.json(normalizePlace(found), { headers: V1_HEADERS });
  } catch (err) {
    console.error("[/api/v1/places/[id]] error", err);
    return NextResponse.json({ error: "Server Error" }, { status: 500, headers: V1_HEADERS });
  }
}
