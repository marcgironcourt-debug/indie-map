import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const data = await prisma.place.findMany();
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const body = await req.json();
  const created = await prisma.place.create({ data: body });
  return NextResponse.json({ data: created }, { status: 201 });
}
