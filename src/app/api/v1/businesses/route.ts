import { NextResponse } from "next/server";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

export async function GET() {
  return NextResponse.json(
    { error: "Deprecated. Use /api/v1/places instead." },
    { status: 410, headers: V1_HEADERS }
  );
}
