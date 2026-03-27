import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const cutoff = new Date(now.getTime() - 5 * 60 * 1000);

    const active = await prisma.activeSession.count({
      where: {
        lastSeenAt: {
          gte: cutoff,
        },
      },
    });

    const dau = await prisma.dailyActiveUser.count({
      where: {
        day,
      },
    });

    const sessions = await prisma.dailySession.count({
      where: {
        day,
      },
    });

    return Response.json({
      day,
      active_last_5min: active,
      daily_active_users: dau,
      daily_sessions: sessions,
    });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
