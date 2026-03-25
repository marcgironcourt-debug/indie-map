import { geolocation } from "@vercel/functions";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const sessionId = req.headers.get("x-session-id") || "unknown";
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
      req.headers.get("user-agent")?.includes("Mobile") ? "mobile" : "desktop";

    await prisma.activeSession.upsert({
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
    });

    return Response.json({ ok: true, sessionId, city, country, platform });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
