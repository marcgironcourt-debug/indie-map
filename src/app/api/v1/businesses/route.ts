import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const data = await prisma.place.findMany({ select: { id: true, name: true, lat: true, lng: true, address: true, city: true, category: true, description: true, openingHours: true, website: true, createdAt: true, updatedAt: true } });
  return NextResponse.json({ data });
}
