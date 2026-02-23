import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Deprecated. Use /api/v1/places instead." },
    { status: 410 }
  );
}
