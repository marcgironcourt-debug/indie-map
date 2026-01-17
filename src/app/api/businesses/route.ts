import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const data = await prisma.place.findMany({ select: { id: true, name: true, lat: true, lng: true, address: true, city: true, category: true, description: true, openingHours: true, website: true, createdAt: true, updatedAt: true } });
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const body = await req.json();
  const created = await prisma.place.create({ data: body });
  return NextResponse.json({ data: created }, { status: 201 });
}
