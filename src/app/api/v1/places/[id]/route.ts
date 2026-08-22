import { NextResponse } from "next/server";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;
import { normalizePlace } from "../_normalize";
import { readPlaceCatalogueWithProfessionalOverrides } from "@/lib/placeCatalogue";

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    const parsed: unknown =
      await readPlaceCatalogueWithProfessionalOverrides();

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
