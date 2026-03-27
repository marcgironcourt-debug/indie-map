import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function card(title: string, value: string | number, subtitle?: string) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="text-sm text-black/60">{title}</div>
      <div className="mt-2 text-4xl font-semibold tracking-tight text-black">{value}</div>
      {subtitle ? <div className="mt-2 text-sm text-black/50">{subtitle}</div> : null}
    </div>
  );
}

export default async function IndieAnalyticsPage() {
  const now = new Date();
  const fiveMin = new Date(now.getTime() - 5 * 60 * 1000);
  const fifteenMin = new Date(now.getTime() - 15 * 60 * 1000);
  const nowDay = new Date();
const day = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(nowDay);

  const [active5, active15, dau, sessions, locations] = await Promise.all([
    prisma.activeSession.count({
      where: { lastSeenAt: { gte: fiveMin } },
    }),
    prisma.activeSession.count({
      where: { lastSeenAt: { gte: fifteenMin } },
    }),
    prisma.dailyActiveUser.count({
      where: { day },
    }),
    prisma.dailySession.count({
      where: { day },
    }),
    prisma.dailyActiveUser.groupBy({
      by: ["country", "city"],
      where: { day },
      _count: { _all: true },
      orderBy: { _count: { city: "desc" } },
    }),
  ]);

  return (
    <main className="h-screen overflow-y-auto bg-[#f6f1e8] px-6 py-8 text-black">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Indie Map Analytics</h1>
          <p className="mt-2 text-sm text-black/60">Jour calendaire: {day}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {card("Actifs 5 min", active5, "présence récente")}
          {card("Actifs 15 min", active15, "fenêtre élargie")}
          {card("Utilisateurs uniques du jour", dau, "daily active users")}
          {card("Sessions du jour", sessions, "ouvertures du jour")}
        </div>

        <div className="mt-8 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Actifs par lieu (24h)</h2>
          {locations.length === 0 ? (
            <p className="mt-4 text-sm text-black/60">Aucune présence récente.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-black/50">
                    <th className="py-2 pr-4 font-medium">Pays</th>
                    <th className="py-2 pr-4 font-medium">Ville</th>
                    <th className="py-2 pr-4 font-medium">Actifs</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((row, i) => (
                    <tr key={`${row.country ?? "?"}-${row.city ?? "?"}-${i}`} className="border-b border-black/5">
                      <td className="py-2 pr-4">{row.country || "—"}</td>
                      <td className="py-2 pr-4">{row.city || "—"}</td>
                      <td className="py-2 pr-4">{row._count._all}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Les métriques de clics (téléphone, site, adresse, itinéraire, vues) ne sont pas affichées ici pour le moment, car la table Event est vide et le tracking front n'est pas branché actuellement.
        </div>
      </div>
    </main>
  );
}
