import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {

  const body = await req.json();
  const updated = await prisma.place.update({
    where: { id: (await params).id },
    data: body,
  });
  return NextResponse.json({ data: updated });
}
