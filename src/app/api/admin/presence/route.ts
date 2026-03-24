import { prisma } from "@/lib/prisma";

export async function GET() {
  const now = new Date();

  const fiveMin = new Date(now.getTime() - 5 * 60 * 1000);
  const fifteenMin = new Date(now.getTime() - 15 * 60 * 1000);

  const active5 = await prisma.activeSession.count({
    where: {
      lastSeenAt: { gte: fiveMin },
    },
  });

  const active15 = await prisma.activeSession.count({
    where: {
      lastSeenAt: { gte: fifteenMin },
    },
  });

  const byLocation = await prisma.activeSession.groupBy({
    by: ["country", "city"],
    where: {
      lastSeenAt: { gte: fifteenMin },
    },
    _count: true,
  });

  return new Response(
    JSON.stringify({
      active5min: active5,
      active15min: active15,
      locations: byLocation,
    }),
    { status: 200 }
  );
}
