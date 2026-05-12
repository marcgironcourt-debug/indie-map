import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PlaceLite = {
  id: string;
  name: string;
  city?: string;
  country?: string;
  category?: string;
};

type SearchParams = {
  userId?: string;
};

const EVENT_LABELS: Record<string, string> = {
  click_explore_world: "Explorer le monde",
  click_recent_additions: "Ajouts récents",
  click_discovery_of_day: "Découverte du jour",
  search_ai_used: "Recherche IA",
  click_search_result_detail: "Fiche depuis résultat recherche",
  click_search_results_map: "Voir résultats sur la carte",
  click_mini_immersion: "Immersion mini-fenêtre",
  click_mini_more_info: "Plus d’infos mini-fenêtre",
  save_place: "Lieu mis en favori",
  unsave_place: "Lieu retiré des favoris",
  open_shared_list_picker: "Ouverture ajout liste partagée",
  add_place_to_shared_list: "Lieu ajouté à une liste partagée",
  create_shared_list: "Liste partagée créée",
  click_detail_website: "Clic site web grande fiche",
  click_detail_itinerary: "Clic itinéraire grande fiche",
  click_detail_copy_address: "Copie adresse grande fiche",
  click_detail_view_on_map: "Voir sur la carte grande fiche",
  click_detail_phone: "Clic téléphone grande fiche",
  view_place_detail: "Vue grande fiche",
};

const AGE_LABELS: Record<string, string> = {
  "18_24": "18–24",
  "25_34": "25–34",
  "35_44": "35–44",
  "45_54": "45–54",
  "55_64": "55–64",
  "65_plus": "65+",
  prefer_not_to_say: "Préfère ne pas dire",
};

function readPlacesMap() {
  const map = new Map<string, PlaceLite>();

  try {
    const filePath = path.join(process.cwd(), "data", "places.json");
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return map;

    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;

      const id = String((item as { id?: unknown }).id ?? "").trim();
      if (!id) continue;

      map.set(id, {
        id,
        name: String((item as { name?: unknown }).name ?? id),
        city: String((item as { city?: unknown }).city ?? ""),
        country: String((item as { country?: unknown }).country ?? ""),
        category: String((item as { category?: unknown }).category ?? ""),
      });
    }
  } catch {}

  return map;
}

function placeName(placeMap: Map<string, PlaceLite>, placeId: string | null | undefined) {
  if (!placeId) return "—";
  return placeMap.get(placeId)?.name || placeId;
}

function placeCity(placeMap: Map<string, PlaceLite>, placeId: string | null | undefined) {
  if (!placeId) return "";
  return placeMap.get(placeId)?.city || "";
}

function eventLabel(eventType: string) {
  return EVENT_LABELS[eventType] || eventType;
}

function ageLabel(ageRange: string | null) {
  if (!ageRange) return "—";
  return AGE_LABELS[ageRange] || ageRange;
}

function card(title: string, value: string | number, subtitle?: string) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="text-sm text-black/60">{title}</div>
      <div className="mt-2 text-4xl font-semibold tracking-tight text-black">{value}</div>
      {subtitle ? <div className="mt-2 text-sm text-black/50">{subtitle}</div> : null}
    </div>
  );
}

function smallCard(title: string, value: string | number, subtitle?: string) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <div className="text-xs uppercase tracking-[0.12em] text-black/40">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-black">{value}</div>
      {subtitle ? <div className="mt-1 text-xs text-black/45">{subtitle}</div> : null}
    </div>
  );
}

function section(title: string, children: React.ReactNode) {
  return (
    <section className="mt-8 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function tableEmpty(text: string) {
  return <p className="text-sm text-black/55">{text}</p>;
}

export default async function IndieAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolvedSearchParams = searchParams instanceof Promise ? await searchParams : searchParams;
  const selectedUserId = String(resolvedSearchParams?.userId ?? "").trim();

  const placeMap = readPlacesMap();
  const now = new Date();
  const fiveMin = new Date(now.getTime() - 5 * 60 * 1000);
  const fifteenMin = new Date(now.getTime() - 15 * 60 * 1000);
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const [
    active5,
    active15,
    dau,
    sessions,
    locations,
    usersCount,
    usersWithEmailCount,
    sharedListsCount,
    sharedListPlacesCount,
    savedPlacesCount,
    visitedPlacesCount,
    eventsCount,
    anonymousEventSessions,
    eventTypes,
    eventsByPlace,
    usersByAge,
    usersByHomeCity,
    users,
  ] = await Promise.all([
    prisma.activeSession.count({ where: { lastSeenAt: { gte: fiveMin } } }),
    prisma.activeSession.count({ where: { lastSeenAt: { gte: fifteenMin } } }),
    prisma.dailyActiveUser.count({ where: { day } }),
    prisma.dailySession.count({ where: { day } }),
    prisma.dailyActiveUser.groupBy({
      by: ["country", "city"],
      where: { day },
      _count: { _all: true },
      orderBy: { _count: { city: "desc" } },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { email: { not: null } } }),
    prisma.sharedList.count(),
    prisma.sharedListPlace.count(),
    prisma.userPlace.count({ where: { saved: true } }),
    prisma.userPlace.count({ where: { visited: true } }),
    prisma.event.count(),
    prisma.event.groupBy({
      by: ["sessionId"],
      where: { userId: null, sessionId: { not: null } },
      _count: { _all: true },
    }),
    prisma.event.groupBy({
      by: ["eventType"],
      _count: { _all: true },
      orderBy: { _count: { eventType: "desc" } },
    }),
    prisma.event.groupBy({
      by: ["placeId"],
      where: { placeId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { placeId: "desc" } },
      take: 30,
    }),
    prisma.user.groupBy({
      by: ["ageRange"],
      _count: { _all: true },
      orderBy: { _count: { ageRange: "desc" } },
    }),
    prisma.user.groupBy({
      by: ["homeCity"],
      _count: { _all: true },
      orderBy: { _count: { homeCity: "desc" } },
      take: 30,
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        places: true,
        ownedLists: { include: { places: true, members: true } },
        listMemberships: { include: { list: true } },
        events: {
          orderBy: { createdAt: "desc" },
          take: 200,
        },
      },
    }),
  ]);

  const selectedUser = selectedUserId
    ? await prisma.user.findUnique({
        where: { id: selectedUserId },
        include: {
          places: true,
          comments: true,
          ownedLists: { include: { places: true, members: true } },
          listMemberships: { include: { list: true } },
          events: {
            orderBy: { createdAt: "desc" },
            take: 500,
          },
        },
      })
    : null;

  const selectedUserEventTypes = selectedUser
    ? await prisma.event.groupBy({
        by: ["eventType"],
        where: { userId: selectedUser.id },
        _count: { _all: true },
        orderBy: { _count: { eventType: "desc" } },
      })
    : [];

  return (
    <main className="h-screen overflow-y-auto bg-[#f6f1e8] px-6 py-8 text-black">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Indie Map Analytics</h1>
            <p className="mt-2 text-sm text-black/60">Jour calendaire: {day}</p>
          </div>
          {selectedUser ? (
            <a href="/indie-analytics" className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white">
              Retour dashboard
            </a>
          ) : null}
        </div>

        {selectedUser ? (
          <>
            <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
              <div className="text-sm text-black/50">Utilisateur</div>
              <h2 className="mt-1 text-3xl font-semibold">{selectedUser.displayName || selectedUser.username}</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {smallCard("Pseudo", selectedUser.username)}
                {smallCard("Email", selectedUser.email || "—")}
                {smallCard("Langue app", selectedUser.preferredLocale || "—")}
                {smallCard("Ville compte", selectedUser.homeCity || "—")}
                {smallCard("Tranche d’âge", ageLabel(selectedUser.ageRange))}
                {smallCard("Favoris", selectedUser.places.filter((item) => item.saved).length)}
                {smallCard("Lieux visités", selectedUser.places.filter((item) => item.visited).length)}
                {smallCard("Événements suivis", selectedUser.events.length)}
              </div>
            </div>

            {section(
              "Actions de cet utilisateur",
              selectedUserEventTypes.length === 0 ? (
                tableEmpty("Aucun événement enregistré.")
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-black/10 text-black/50">
                        <th className="py-2 pr-4 font-medium">Action</th>
                        <th className="py-2 pr-4 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedUserEventTypes.map((row) => (
                        <tr key={row.eventType} className="border-b border-black/5">
                          <td className="py-2 pr-4">{eventLabel(row.eventType)}</td>
                          <td className="py-2 pr-4">{row._count._all}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {section(
              "Lieux favoris",
              selectedUser.places.filter((item) => item.saved).length === 0 ? (
                tableEmpty("Aucun lieu favori.")
              ) : (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {selectedUser.places.filter((item) => item.saved).map((item) => (
                    <div key={item.id} className="rounded-xl border border-black/10 p-3">
                      <div className="font-semibold">{placeName(placeMap, item.placeId)}</div>
                      <div className="mt-1 text-xs text-black/45">{placeCity(placeMap, item.placeId) || "—"}</div>
                    </div>
                  ))}
                </div>
              )
            )}

            {section(
              "Lieux visités",
              selectedUser.places.filter((item) => item.visited).length === 0 ? (
                tableEmpty("Aucun lieu visité.")
              ) : (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {selectedUser.places.filter((item) => item.visited).map((item) => (
                    <div key={item.id} className="rounded-xl border border-black/10 p-3">
                      <div className="font-semibold">{placeName(placeMap, item.placeId)}</div>
                      <div className="mt-1 text-xs text-black/45">
                        {placeCity(placeMap, item.placeId) || "—"} · {item.visitedAt ? item.visitedAt.toISOString().slice(0, 10) : "date inconnue"}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {section(
              "Listes partagées",
              selectedUser.ownedLists.length === 0 && selectedUser.listMemberships.length === 0 ? (
                tableEmpty("Aucune liste partagée.")
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {selectedUser.ownedLists.map((list) => (
                    <div key={list.id} className="rounded-xl border border-black/10 p-4">
                      <div className="font-semibold">{list.title}</div>
                      <div className="mt-1 text-sm text-black/50">
                        Propriétaire · {list.places.length} lieux · {list.members.length} membres
                      </div>
                    </div>
                  ))}
                  {selectedUser.listMemberships.map((membership) => (
                    <div key={membership.id} className="rounded-xl border border-black/10 p-4">
                      <div className="font-semibold">{membership.list.title}</div>
                      <div className="mt-1 text-sm text-black/50">Membre</div>
                    </div>
                  ))}
                </div>
              )
            )}

            {section(
              "Derniers événements",
              selectedUser.events.length === 0 ? (
                tableEmpty("Aucun événement.")
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-black/10 text-black/50">
                        <th className="py-2 pr-4 font-medium">Date</th>
                        <th className="py-2 pr-4 font-medium">Action</th>
                        <th className="py-2 pr-4 font-medium">Lieu</th>
                        <th className="py-2 pr-4 font-medium">Ville</th>
                        <th className="py-2 pr-4 font-medium">Plateforme</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedUser.events.map((event) => (
                        <tr key={event.id} className="border-b border-black/5">
                          <td className="py-2 pr-4 whitespace-nowrap">{event.createdAt.toISOString().replace("T", " ").slice(0, 16)}</td>
                          <td className="py-2 pr-4">{eventLabel(event.eventType)}</td>
                          <td className="py-2 pr-4">{placeName(placeMap, event.placeId)}</td>
                          <td className="py-2 pr-4">{event.city || placeCity(placeMap, event.placeId) || "—"}</td>
                          <td className="py-2 pr-4">{event.platform || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {card("Actifs 5 min", active5, "présence récente")}
              {card("Actifs 15 min", active15, "fenêtre élargie")}
              {card("Utilisateurs uniques du jour", dau, "connectés ou non")}
              {card("Sessions du jour", sessions, "ouvertures du jour")}
              {card("Comptes utilisateurs", usersCount, `${usersWithEmailCount} avec email`)}
              {card("Sessions anonymes suivies", anonymousEventSessions.length, "via im_session_id")}
              {card("Événements enregistrés", eventsCount, "clics et vues")}
              {card("Listes partagées", sharedListsCount, `${sharedListPlacesCount} lieux ajoutés`)}
              {card("Lieux favoris", savedPlacesCount, "tous comptes")}
              {card("Lieux visités", visitedPlacesCount, "tous comptes")}
            </div>

            {section(
              "Actifs par ville",
              locations.length === 0 ? (
                tableEmpty("Aucune présence récente.")
              ) : (
                <div className="overflow-x-auto">
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
              )
            )}

            {section(
              "Actions suivies",
              eventTypes.length === 0 ? (
                tableEmpty("Aucun événement enregistré pour le moment.")
              ) : (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {eventTypes.map((row) => (
                    <div key={row.eventType} className="rounded-xl border border-black/10 p-4">
                      <div className="text-sm font-semibold">{eventLabel(row.eventType)}</div>
                      <div className="mt-2 text-3xl font-semibold">{row._count._all}</div>
                    </div>
                  ))}
                </div>
              )
            )}

            {section(
              "Lieux les plus actifs",
              eventsByPlace.length === 0 ? (
                tableEmpty("Aucun lieu suivi pour le moment.")
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-black/10 text-black/50">
                        <th className="py-2 pr-4 font-medium">Lieu</th>
                        <th className="py-2 pr-4 font-medium">Ville</th>
                        <th className="py-2 pr-4 font-medium">Événements</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventsByPlace.map((row) => (
                        <tr key={row.placeId || "unknown"} className="border-b border-black/5">
                          <td className="py-2 pr-4">{placeName(placeMap, row.placeId)}</td>
                          <td className="py-2 pr-4">{placeCity(placeMap, row.placeId) || "—"}</td>
                          <td className="py-2 pr-4">{row._count._all}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {section(
              "Profils connectés",
              <div className="grid gap-6 xl:grid-cols-2">
                <div>
                  <h3 className="font-semibold">Tranches d’âge</h3>
                  <div className="mt-3 space-y-2">
                    {usersByAge.map((row) => (
                      <div key={row.ageRange || "unknown"} className="flex justify-between rounded-xl border border-black/10 px-4 py-2 text-sm">
                        <span>{ageLabel(row.ageRange)}</span>
                        <span className="font-semibold">{row._count._all}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold">Villes associées aux comptes</h3>
                  <div className="mt-3 space-y-2">
                    {usersByHomeCity.map((row) => (
                      <div key={row.homeCity || "unknown"} className="flex justify-between rounded-xl border border-black/10 px-4 py-2 text-sm">
                        <span>{row.homeCity || "—"}</span>
                        <span className="font-semibold">{row._count._all}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {section(
              "Utilisateurs",
              users.length === 0 ? (
                tableEmpty("Aucun utilisateur.")
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-black/10 text-black/50">
                        <th className="py-2 pr-4 font-medium">Pseudo</th>
                        <th className="py-2 pr-4 font-medium">Email</th>
                        <th className="py-2 pr-4 font-medium">Langue</th>
                        <th className="py-2 pr-4 font-medium">Ville compte</th>
                        <th className="py-2 pr-4 font-medium">Âge</th>
                        <th className="py-2 pr-4 font-medium">Favoris</th>
                        <th className="py-2 pr-4 font-medium">Visités</th>
                        <th className="py-2 pr-4 font-medium">Listes</th>
                        <th className="py-2 pr-4 font-medium">Événements</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b border-black/5">
                          <td className="py-2 pr-4">
                            <a href={`/indie-analytics?userId=${encodeURIComponent(user.id)}`} className="font-semibold underline underline-offset-2">
                              {user.username}
                            </a>
                          </td>
                          <td className="py-2 pr-4">{user.email || "—"}</td>
                          <td className="py-2 pr-4">{user.preferredLocale || "—"}</td>
                          <td className="py-2 pr-4">{user.homeCity || "—"}</td>
                          <td className="py-2 pr-4">{ageLabel(user.ageRange)}</td>
                          <td className="py-2 pr-4">{user.places.filter((item) => item.saved).length}</td>
                          <td className="py-2 pr-4">{user.places.filter((item) => item.visited).length}</td>
                          <td className="py-2 pr-4">{user.ownedLists.length + user.listMemberships.length}</td>
                          <td className="py-2 pr-4">{user.events.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </>
        )}
      </div>
    </main>
  );
}
