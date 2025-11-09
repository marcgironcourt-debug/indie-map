import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();
  const { id, data } = body;
  if (!id || !data) {
    return NextResponse.json({ error: "Missing id or data" }, { status: 400 });
  }
  const updated = await prisma.place.update({
    where: { id },
    data
  });
  return NextResponse.json(updated);
}
