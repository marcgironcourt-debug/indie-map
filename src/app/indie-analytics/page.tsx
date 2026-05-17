import fs from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
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
  tab?: string;
};

const EVENT_LABELS: Record<string, string> = {
  click_explore_world: "Explorer le monde",
  click_recent_additions: "Ajouts récents",
  click_discovery_of_day: "Découverte du jour",
  search_ai_used: "Recherche IA",
  click_search_result_detail: "Fiche depuis recherche",
  click_search_results_map: "Résultats sur carte",
  click_mini_immersion: "Immersion",
  click_mini_more_info: "Plus d’infos",
  save_place: "Favori ajouté",
  unsave_place: "Favori retiré",
  open_shared_list_picker: "Ajout à une liste",
  add_place_to_shared_list: "Lieu ajouté à une liste",
  create_shared_list: "Liste créée",
  click_detail_website: "Site web",
  click_detail_itinerary: "Itinéraire",
  click_detail_copy_address: "Adresse copiée",
  click_detail_share: "Partager",
  click_detail_view_on_map: "Voir sur carte",
  click_detail_phone: "Téléphone",
  view_place_detail: "Vue fiche",
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

const SOURCE_LABELS: Record<string, string> = {
  recent_additions: "Ajouts récents",
  discovery_of_day: "Découverte du jour",
  search_result: "Recherche",
  mini_window: "Mini-fenêtre carte",
  map: "Carte",
  map_detail: "Fiche carte",
  home_detail: "Fiche accueil",
  home_detail_create: "Création depuis fiche accueil",
  shared_list: "Liste partagée",
  shared_list_search: "Recherche dans liste",
  friend_visited_place: "Lieu visité par un ami",
  personal_space: "Espace perso",
  unknown: "Source inconnue",
};

const TABS = [
  { key: "overview", label: "Vue d’ensemble" },
  { key: "actions", label: "Actions" },
  { key: "places", label: "Lieux" },
  { key: "users", label: "Utilisateurs" },
] as const;

function readPlacesMap() {
  const map = new Map<string, PlaceLite>();

  try {
    const filePath = path.join(process.cwd(), "data", "places.json");
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));

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

function sourceLabel(source: string) {
  return SOURCE_LABELS[source] || source || "—";
}

function metadataSource(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "unknown";
  const raw = (metadata as { source?: unknown }).source;
  if (typeof raw !== "string") return "unknown";
  const clean = raw.trim();
  return clean || "unknown";
}

function countSources(events: { metadata: unknown }[]) {
  const counts = new Map<string, number>();

  for (const event of events) {
    const source = metadataSource(event.metadata);
    counts.set(source, (counts.get(source) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

function metadataText(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function metadataNumber(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metadataBoolean(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : null;
}

function metadataFirstText(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const value = (metadata as Record<string, unknown>)[key];

  if (typeof value === "string") return value.trim();

  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string" && item.trim());
    return typeof first === "string" ? first.trim() : "";
  }

  return "";
}

function countTexts(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    const clean = value.trim();
    if (!clean) continue;
    counts.set(clean, (counts.get(clean) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function ageLabel(ageRange: string | null) {
  if (!ageRange) return "—";
  return AGE_LABELS[ageRange] || ageRange;
}

function metric(title: string, value: string | number, subtitle: string, tone: "dark" | "light" = "light") {
  return (
    <div className={tone === "dark" ? "rounded-[28px] bg-black p-5 text-white shadow-sm" : "rounded-[28px] border border-black/10 bg-white p-5 text-black shadow-sm"}>
      <div className={tone === "dark" ? "text-[12px] font-medium uppercase tracking-[0.14em] text-white/45" : "text-[12px] font-medium uppercase tracking-[0.14em] text-black/40"}>{title}</div>
      <div className="mt-3 text-4xl font-semibold tracking-tight">{value}</div>
      <div className={tone === "dark" ? "mt-2 text-sm text-white/50" : "mt-2 text-sm text-black/45"}>{subtitle}</div>
    </div>
  );
}

function panel(title: string, children: ReactNode, subtitle?: string) {
  return (
    <section className="rounded-[30px] border border-black/10 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-black">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-black/45">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function empty(text: string) {
  return <div className="rounded-2xl border border-dashed border-black/15 bg-black/[0.025] p-5 text-sm text-black/45">{text}</div>;
}

function progressRow(label: string, value: number, max: number, hint?: string) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;

  return (
    <div className="rounded-2xl border border-black/8 bg-[#faf7f0] p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-black">{label}</div>
          {hint ? <div className="mt-0.5 truncate text-xs text-black/40">{hint}</div> : null}
        </div>
        <div className="text-lg font-semibold text-black">{value}</div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/8">
        <div className="h-full rounded-full bg-black" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function tabHref(tab: string) {
  return `/indie-analytics?tab=${encodeURIComponent(tab)}`;
}

export default async function IndieAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolvedSearchParams = searchParams instanceof Promise ? await searchParams : searchParams;
  const selectedUserId = String(resolvedSearchParams?.userId ?? "").trim();
  const activeTab = TABS.some((item) => item.key === resolvedSearchParams?.tab) ? String(resolvedSearchParams?.tab) : "overview";

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
    viewPlaceDetailEvents,
    searchEvents,
    searchDetailClicks,
    searchMapClicks,
    usersByAge,
    usersByHomeCity,
    users,
    savedByUser,
    visitedByUser,
    ownedListsByUser,
    memberListsByUser,
    eventsByUser,
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
    prisma.event.findMany({
      where: { eventType: "view_place_detail" },
      select: { metadata: true },
      take: 5000,
      orderBy: { createdAt: "desc" },
    }),
    prisma.event.findMany({
      where: { eventType: "search_ai_used" },
      select: { createdAt: true, city: true, category: true, metadata: true },
      take: 5000,
      orderBy: { createdAt: "desc" },
    }),
    prisma.event.count({
      where: { eventType: "click_search_result_detail" },
    }),
    prisma.event.count({
      where: { eventType: "click_search_results_map" },
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
      select: {
        id: true,
        username: true,
        email: true,
        preferredLocale: true,
        homeCity: true,
        ageRange: true,
      },
    }),
    prisma.userPlace.groupBy({
      by: ["userId"],
      where: { saved: true },
      _count: { _all: true },
    }),
    prisma.userPlace.groupBy({
      by: ["userId"],
      where: { visited: true },
      _count: { _all: true },
    }),
    prisma.sharedList.groupBy({
      by: ["ownerId"],
      _count: { _all: true },
    }),
    prisma.sharedListMember.groupBy({
      by: ["userId"],
      _count: { _all: true },
    }),
    prisma.event.groupBy({
      by: ["userId"],
      where: { userId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const viewSources = countSources(viewPlaceDetailEvents);
  const maxViewSourceCount = Math.max(1, ...viewSources.map((item) => item.count));

  const searchTotal = searchEvents.length;
  const searchesWithResults = searchEvents.filter((event) => metadataBoolean(event.metadata, "hasResults") === true).length;
  const searchToDetailRate = searchTotal > 0 ? Math.round((searchDetailClicks / searchTotal) * 100) : 0;
  const searchToMapRate = searchTotal > 0 ? Math.round((searchMapClicks / searchTotal) * 100) : 0;
  const searchesNoResults = searchEvents.filter((event) => {
    const hasResults = metadataBoolean(event.metadata, "hasResults");
    const resultsCount = metadataNumber(event.metadata, "resultsCount");
    return hasResults === false || resultsCount === 0;
  });
  const searchesWithoutResults = searchesNoResults.length;
  const searchResultCounts = searchEvents.map((event) => metadataNumber(event.metadata, "resultsCount")).filter((value): value is number => typeof value === "number");
  const averageSearchResults = searchResultCounts.length > 0 ? Math.round(searchResultCounts.reduce((sum, value) => sum + value, 0) / searchResultCounts.length) : 0;
  const searchCities = countTexts(searchEvents.map((event) => event.city || metadataText(event.metadata, "detectedCity")));
  const searchCategories = countTexts(searchEvents.map((event) => event.category || metadataFirstText(event.metadata, "targetCategories") || metadataText(event.metadata, "explicitCategory")));
  const maxSearchCityCount = Math.max(1, ...searchCities.map((item) => item.count));
  const maxSearchCategoryCount = Math.max(1, ...searchCategories.map((item) => item.count));

  const savedByUserMap = new Map(savedByUser.map((row) => [row.userId, row._count._all]));
  const visitedByUserMap = new Map(visitedByUser.map((row) => [row.userId, row._count._all]));
  const ownedListsByUserMap = new Map(ownedListsByUser.map((row) => [row.ownerId, row._count._all]));
  const memberListsByUserMap = new Map(memberListsByUser.map((row) => [row.userId, row._count._all]));
  const eventsByUserMap = new Map(eventsByUser.map((row) => [row.userId, row._count._all]));


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

  const maxEventCount = Math.max(1, ...eventTypes.map((row) => row._count._all));
  const maxPlaceCount = Math.max(1, ...eventsByPlace.map((row) => row._count._all));
  const selectedUserViewEvents = selectedUser?.events.filter((event) => event.eventType === "view_place_detail") ?? [];
  const selectedUserViewSources = countSources(selectedUserViewEvents);
  const maxSelectedUserViewSourceCount = Math.max(1, ...selectedUserViewSources.map((item) => item.count));

  return (
    <main className="h-screen overflow-y-auto bg-[#f3eee5] px-4 py-4 pb-16 text-black md:px-8 md:py-8 md:pb-20">
      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-[34px] bg-black text-white shadow-sm">
          <div className="px-6 py-7 md:px-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">Dashboard privé</div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Indie Map Analytics</h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
                  Vue claire de l’usage réel : présence, recherches, fiches ouvertes, favoris, listes partagées et profils connectés.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-right">
                <div className="text-xs uppercase tracking-[0.14em] text-white/35">Jour</div>
                <div className="mt-1 text-lg font-semibold">{day}</div>
              </div>
            </div>

            {!selectedUser ? (
              <nav className="mt-7 flex gap-2 overflow-x-auto">
                {TABS.map((tab) => (
                  <a
                    key={tab.key}
                    href={tabHref(tab.key)}
                    className={activeTab === tab.key ? "shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black" : "shrink-0 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-semibold text-white/60"}
                  >
                    {tab.label}
                  </a>
                ))}
              </nav>
            ) : (
              <a href="/indie-analytics" className="mt-7 inline-flex rounded-full bg-white px-5 py-2 text-sm font-semibold text-black">
                Retour au dashboard
              </a>
            )}
          </div>
        </header>

        {selectedUser ? (
          <div className="mt-6 space-y-6">
            <section className="rounded-[30px] border border-black/10 bg-white p-6 shadow-sm">
              <div className="text-sm text-black/45">Utilisateur</div>
              <h2 className="mt-1 text-3xl font-semibold">{selectedUser.displayName || selectedUser.username}</h2>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {metric("Pseudo", selectedUser.username, "identifiant public")}
                {metric("Email", selectedUser.email || "—", "compte")}
                {metric("Langue", selectedUser.preferredLocale || "—", "interface")}
                {metric("Ville", selectedUser.homeCity || "—", "profil")}
                {metric("Âge", ageLabel(selectedUser.ageRange), "tranche déclarée")}
                {metric("Favoris", selectedUser.places.filter((item) => item.saved).length, "lieux sauvegardés")}
                {metric("Visités", selectedUser.places.filter((item) => item.visited).length, "lieux marqués")}
                {metric("Événements", selectedUser.events.length, "dernières actions")}
              </div>
            </section>

            {panel(
              "Actions de cet utilisateur",
              selectedUserEventTypes.length === 0 ? empty("Aucun événement enregistré.") : (
                <div className="grid gap-3 md:grid-cols-2">
                  {selectedUserEventTypes.map((row) => (
                    <div key={row.eventType}>
                      {progressRow(eventLabel(row.eventType), row._count._all, Math.max(1, ...selectedUserEventTypes.map((item) => item._count._all)))}
                    </div>
                  ))}
                </div>
              )
            )}

            {panel(
              "Sources des vues fiche",
              selectedUserViewSources.length === 0 ? empty("Aucune vue fiche enregistrée pour cet utilisateur.") : (
                <div className="grid gap-3 md:grid-cols-2">
                  {selectedUserViewSources.map((row) => (
                    <div key={row.source}>
                      {progressRow(sourceLabel(row.source), row.count, maxSelectedUserViewSourceCount)}
                    </div>
                  ))}
                </div>
              )
            )}

            <div className="grid gap-6 xl:grid-cols-2">
              {panel(
                "Lieux favoris",
                selectedUser.places.filter((item) => item.saved).length === 0 ? empty("Aucun lieu favori.") : (
                  <div className="grid gap-3">
                    {selectedUser.places.filter((item) => item.saved).map((item) => (
                      <div key={item.id} className="rounded-2xl border border-black/10 bg-[#faf7f0] p-4">
                        <div className="font-semibold">{placeName(placeMap, item.placeId)}</div>
                        <div className="mt-1 text-xs text-black/45">{placeCity(placeMap, item.placeId) || "—"}</div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {panel(
                "Lieux visités",
                selectedUser.places.filter((item) => item.visited).length === 0 ? empty("Aucun lieu visité.") : (
                  <div className="grid gap-3">
                    {selectedUser.places.filter((item) => item.visited).map((item) => (
                      <div key={item.id} className="rounded-2xl border border-black/10 bg-[#faf7f0] p-4">
                        <div className="font-semibold">{placeName(placeMap, item.placeId)}</div>
                        <div className="mt-1 text-xs text-black/45">
                          {placeCity(placeMap, item.placeId) || "—"} · {item.visitedAt ? item.visitedAt.toISOString().slice(0, 10) : "date inconnue"}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>

            {panel(
              "Derniers événements",
              selectedUser.events.length === 0 ? empty("Aucun événement.") : (
                <div className="grid gap-2">
                  {selectedUser.events.slice(0, 40).map((event) => (
                    <div key={event.id} className="grid gap-2 rounded-2xl border border-black/10 bg-[#faf7f0] p-4 text-sm md:grid-cols-[170px_1fr_1fr_90px]">
                      <div className="text-black/45">{event.createdAt.toISOString().replace("T", " ").slice(0, 16)}</div>
                      <div className="font-semibold">{eventLabel(event.eventType)}</div>
                      <div>
                        <div>{placeName(placeMap, event.placeId)}</div>
                        {event.eventType === "view_place_detail" ? (
                          <div className="mt-0.5 text-xs text-black/40">{sourceLabel(metadataSource(event.metadata))}</div>
                        ) : null}
                      </div>
                      <div className="text-black/45">{event.platform || "—"}</div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {activeTab === "overview" ? (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {metric("Actifs maintenant", active5, "présence 5 min", "dark")}
                  {metric("Actifs 15 min", active15, "fenêtre élargie")}
                  {metric("Utilisateurs du jour", dau, "connectés ou non")}
                  {metric("Sessions du jour", sessions, "ouvertures")}
                  {metric("Comptes", usersCount, `${usersWithEmailCount} avec email`)}
                  {metric("Anonymes suivis", anonymousEventSessions.length, "via im_session_id")}
                  {metric("Événements", eventsCount, "clics et vues")}
                  {metric("Listes partagées", sharedListsCount, `${sharedListPlacesCount} lieux ajoutés`)}
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  {panel(
                    "Actions principales",
                    eventTypes.length === 0 ? empty("Aucun événement enregistré pour le moment.") : (
                      <div className="grid gap-3">
                        {eventTypes.slice(0, 8).map((row) => (
                          <div key={row.eventType}>
                            {progressRow(eventLabel(row.eventType), row._count._all, maxEventCount)}
                          </div>
                        ))}
                      </div>
                    )
                  )}

                  {panel(
                    "Actifs par ville",
                    locations.length === 0 ? empty("Aucune présence récente.") : (
                      <div className="grid gap-3">
                        {locations.map((row, i) => (
                          <div key={`${row.country || "unknown"}-${row.city || "unknown"}-${i}`}>
                            {progressRow(`${row.city || "—"} · ${row.country || "—"}`, row._count._all, Math.max(1, ...locations.map((item) => item._count._all)), i === 0 ? "ville la plus active aujourd’hui" : undefined)}
                          </div>
                        ))}
                      </div>
                    )
                  )}

                  {panel(
                    "Sources des vues fiche",
                    viewSources.length === 0 ? empty("Aucune source de vue fiche enregistrée.") : (
                      <div className="grid gap-3">
                        {viewSources.slice(0, 8).map((row) => (
                          <div key={row.source}>
                            {progressRow(sourceLabel(row.source), row.count, maxViewSourceCount)}
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              </>
            ) : null}

            {activeTab === "actions" ? (
              <>
                {panel(
                  "Actions suivies",
                  eventTypes.length === 0 ? empty("Aucun événement enregistré pour le moment.") : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {eventTypes.map((row) => (
                        <div key={row.eventType}>
                          {progressRow(eventLabel(row.eventType), row._count._all, maxEventCount)}
                        </div>
                      ))}
                    </div>
                  ),
                  "Chaque ligne correspond à une interaction réellement envoyée à /api/v1/event."
                )}

                {panel(
                  "Sources des vues fiche",
                  viewSources.length === 0 ? empty("Aucune source de vue fiche enregistrée.") : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {viewSources.map((row) => (
                        <div key={row.source}>
                          {progressRow(sourceLabel(row.source), row.count, maxViewSourceCount)}
                        </div>
                      ))}
                    </div>
                  ),
                  "Permet de comprendre pourquoi une fiche est ouverte : recherche, carte, mini-fenêtre, liste partagée ou ami."
                )}

                {panel(
                  "Recherches",
                  searchTotal === 0 ? empty("Aucune recherche enregistrée pour le moment.") : (
                    <div className="space-y-5">
                      <div className="grid gap-4 md:grid-cols-4">
                        {metric("Recherches", searchTotal, "requêtes tapées")}
                        {metric("Avec résultat", searchesWithResults, "au moins un lieu")}
                        {metric("Sans résultat", searchesWithoutResults, "manques de couverture")}
                        {metric("Résultats moyens", averageSearchResults, "par recherche")}
                        {metric("Fiches depuis recherche", searchDetailClicks, `${searchToDetailRate}% des recherches`)}
                        {metric("Carte depuis recherche", searchMapClicks, `${searchToMapRate}% des recherches`)}
                      </div>

                      <div className="grid gap-5 xl:grid-cols-2">
                        <div className="grid gap-3">
                          <div className="text-sm font-semibold text-black/55">Villes recherchées</div>
                          {searchCities.length === 0 ? empty("Aucune ville détectée.") : searchCities.slice(0, 8).map((row) => (
                            <div key={row.label}>
                              {progressRow(row.label, row.count, maxSearchCityCount)}
                            </div>
                          ))}
                        </div>

                        <div className="grid gap-3">
                          <div className="text-sm font-semibold text-black/55">Catégories demandées</div>
                          {searchCategories.length === 0 ? empty("Aucune catégorie détectée.") : searchCategories.slice(0, 8).map((row) => (
                            <div key={row.label}>
                              {progressRow(row.label, row.count, maxSearchCategoryCount)}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <div className="text-sm font-semibold text-black/55">Dernières recherches</div>
                        {searchEvents.slice(0, 12).map((event, index) => (
                          <div key={`${event.createdAt.toISOString()}-${index}`} className="grid gap-2 rounded-2xl border border-black/10 bg-[#faf7f0] p-4 text-sm md:grid-cols-[150px_1fr_110px_90px]">
                            <div className="text-black/45">{event.createdAt.toISOString().replace("T", " ").slice(0, 16)}</div>
                            <div className="font-semibold">{metadataText(event.metadata, "query") || "—"}</div>
                            <div className="text-black/55">{event.city || metadataText(event.metadata, "detectedCity") || "ville —"}</div>
                            <div className="text-black/55">{metadataNumber(event.metadata, "resultsCount") ?? "—"} résultat(s)</div>
                          </div>
                        ))}
                      </div>

                      <div className="grid gap-2">
                        <div className="text-sm font-semibold text-black/55">Recherches sans résultat</div>
                        {searchesNoResults.length === 0 ? empty("Aucune recherche sans résultat.") : searchesNoResults.slice(0, 12).map((event, index) => (
                          <div key={`${event.createdAt.toISOString()}-empty-${index}`} className="grid gap-2 rounded-2xl border border-black/10 bg-[#faf7f0] p-4 text-sm md:grid-cols-[150px_1fr_110px_110px]">
                            <div className="text-black/45">{event.createdAt.toISOString().replace("T", " ").slice(0, 16)}</div>
                            <div className="font-semibold">{metadataText(event.metadata, "query") || "—"}</div>
                            <div className="text-black/55">{event.city || metadataText(event.metadata, "detectedCity") || "ville —"}</div>
                            <div className="text-black/55">{event.category || metadataFirstText(event.metadata, "targetCategories") || metadataText(event.metadata, "explicitCategory") || "catégorie —"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                  "Permet de voir ce que les gens cherchent, les villes demandées et les recherches sans résultat."
                )}
              </>
            ) : null}

            {activeTab === "places" ? (
              <div className="grid gap-6 xl:grid-cols-2">
                {panel(
                  "Lieux les plus actifs",
                  eventsByPlace.length === 0 ? empty("Aucun lieu suivi pour le moment.") : (
                    <div className="grid gap-3">
                      {eventsByPlace.map((row) => (
                        <div key={row.placeId || "unknown"}>
                          {progressRow(placeName(placeMap, row.placeId), row._count._all, maxPlaceCount, placeCity(placeMap, row.placeId) || "—")}
                        </div>
                      ))}
                    </div>
                  )
                )}

                <div className="grid gap-4">
                  {metric("Lieux favoris", savedPlacesCount, "tous comptes")}
                  {metric("Lieux visités", visitedPlacesCount, "tous comptes")}
                  {metric("Lieux en listes", sharedListPlacesCount, "ajouts cumulés")}
                </div>
              </div>
            ) : null}

            {activeTab === "users" ? (
              <>
                <div className="grid gap-6 xl:grid-cols-2">
                  {panel(
                    "Tranches d’âge",
                    usersByAge.length === 0 ? empty("Aucune tranche d’âge renseignée.") : (
                      <div className="grid gap-3">
                        {usersByAge.map((row) => (
                        <div key={row.ageRange || "unknown"}>
                          {progressRow(ageLabel(row.ageRange), row._count._all, Math.max(1, ...usersByAge.map((item) => item._count._all)))}
                        </div>
                      ))}
                      </div>
                    )
                  )}

                  {panel(
                    "Villes associées aux comptes",
                    usersByHomeCity.length === 0 ? empty("Aucune ville renseignée.") : (
                      <div className="grid gap-3">
                        {usersByHomeCity.map((row) => (
                        <div key={row.homeCity || "unknown"}>
                          {progressRow(row.homeCity || "—", row._count._all, Math.max(1, ...usersByHomeCity.map((item) => item._count._all)))}
                        </div>
                      ))}
                      </div>
                    )
                  )}
                </div>

                {panel(
                  "Utilisateurs",
                  users.length === 0 ? empty("Aucun utilisateur.") : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {users.map((user) => (
                        <a key={user.id} href={`/indie-analytics?userId=${encodeURIComponent(user.id)}`} className="block rounded-[24px] border border-black/10 bg-[#faf7f0] p-5 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-lg font-semibold">{user.username}</div>
                              <div className="mt-1 truncate text-sm text-black/45">{user.email || "—"}</div>
                            </div>
                            <div className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">{user.preferredLocale || "—"}</div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-white px-3 py-1 text-black/60">{user.homeCity || "ville —"}</span>
                            <span className="rounded-full bg-white px-3 py-1 text-black/60">{ageLabel(user.ageRange)}</span>
                          </div>

                          <div className="mt-5 grid grid-cols-4 gap-2 text-center">
                            <div className="rounded-2xl bg-white p-2">
                              <div className="text-lg font-semibold">{savedByUserMap.get(user.id) || 0}</div>
                              <div className="text-[10px] uppercase tracking-[0.1em] text-black/35">Favoris</div>
                            </div>
                            <div className="rounded-2xl bg-white p-2">
                              <div className="text-lg font-semibold">{visitedByUserMap.get(user.id) || 0}</div>
                              <div className="text-[10px] uppercase tracking-[0.1em] text-black/35">Visités</div>
                            </div>
                            <div className="rounded-2xl bg-white p-2">
                              <div className="text-lg font-semibold">{(ownedListsByUserMap.get(user.id) || 0) + (memberListsByUserMap.get(user.id) || 0)}</div>
                              <div className="text-[10px] uppercase tracking-[0.1em] text-black/35">Listes</div>
                            </div>
                            <div className="rounded-2xl bg-white p-2">
                              <div className="text-lg font-semibold">{eventsByUserMap.get(user.id) || 0}</div>
                              <div className="text-[10px] uppercase tracking-[0.1em] text-black/35">Actions</div>
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  )
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
