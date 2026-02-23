import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    const filePath = path.join(process.cwd(), "data", "places.json");
    const raw = await fs.promises.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return NextResponse.json({ error: "Invalid data" }, { status: 500 });
    const found = parsed.find((x: any) => x && typeof x === "object" && x.id === id);
    if (!found) return NextResponse.json({ error: "Not Found" }, { status: 404 });
    return NextResponse.json(found);
  } catch (err) {
    console.error("[/api/v1/places/[id]] error", err);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
