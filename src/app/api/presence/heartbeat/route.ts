import { geolocation } from "@vercel/functions";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const sessionId = req.headers.get("x-session-id") || "unknown";
    const launchId = req.headers.get("x-launch-id") || "unknown";
    const now = new Date();
const day = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(now);

    const geo = geolocation(req);

    const city =
      geo.city ||
      req.headers.get("x-vercel-ip-city") ||
      null;

    const country =
      geo.country ||
      req.headers.get("x-vercel-ip-country") ||
      null;

    const platform =
      req.headers.get("x-platform") ||
      (req.headers.get("user-agent")?.includes("Android")
        ? "android"
        : req.headers.get("user-agent")?.match(/iPhone|iPad|iPod/i)
          ? "ios"
          : "web");

    await prisma.$transaction([
      prisma.activeSession.upsert({
        where: { sessionId },
        update: {
          lastSeenAt: new Date(),
          city,
          country,
          platform,
        },
        create: {
          sessionId,
          lastSeenAt: new Date(),
          city,
          country,
          platform,
        },
      }),
      prisma.dailyActiveUser.upsert({
        where: {
          day_sessionId: {
            day,
            sessionId,
          },
        },
        update: {
          city,
          country,
          platform,
        },
        create: {
          day,
          sessionId,
          city,
          country,
          platform,
        },
      }),
      prisma.dailySession.upsert({
        where: {
          day_launchId: {
            day,
            launchId,
          },
        },
        update: {
          sessionId,
          city,
          country,
          platform,
        },
        create: {
          day,
          launchId,
          sessionId,
          city,
          country,
          platform,
        },
      }),
    ]);

    return Response.json({ ok: true, sessionId, launchId, day, city, country, platform });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
