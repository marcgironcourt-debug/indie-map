import fs from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import {
  AnalyticsBars,
  AnalyticsDonut,
  AnalyticsLineChart,
} from "@/components/analytics/AnalyticsVisuals";
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
  sessionId?: string;
  tab?: string;
  token?: string;
  date?: string;
  month?: string;
  year?: string;
  traffic?: string;
  scope?: string;
  section?: string;
};

const EVENT_LABELS: Record<string, string> = {
  launch_started: "Ouverture Indie Map",
  click_explore_world: "Explorer le monde",
  click_recent_additions: "Ajouts récents",
  click_discovery_of_day: "Découverte du jour",
  search_ai_used: "Recherche IA",
  search_result_impression: "Résultat de recherche affiché",
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
  mark_place_visited: "Lieu marqué visité",
  unmark_place_visited: "Visite retirée",
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
  recent_additions_all: "Tous les ajouts récents",
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
  personal_space_saved_place: "Favori · espace perso",
  unknown: "Source inconnue",
};

const TABS = [
  { key: "daily", label: "Journée" },
  { key: "overview", label: "Vue d’ensemble" },
  { key: "actions", label: "Actions" },
  { key: "places", label: "Lieux" },
  { key: "users", label: "Utilisateurs" },
] as const;

const SECTION_TABS = {
  daily: [
    { key: "summary", label: "Synthèse" },
    { key: "activity", label: "Activité" },
    { key: "users", label: "Utilisateurs" },
    { key: "geography", label: "Connexions" },
    { key: "details", label: "Détails" },
  ],
  overview: [
    { key: "summary", label: "Synthèse" },
    { key: "activity", label: "Activité" },
    { key: "geography", label: "Géographie" },
    { key: "sources", label: "Sources" },
  ],
  actions: [
    { key: "summary", label: "Synthèse" },
    { key: "events", label: "Toutes les actions" },
    { key: "search", label: "Recherche" },
    { key: "origins", label: "Origines" },
  ],
  places: [
    { key: "summary", label: "Synthèse" },
    { key: "ranking", label: "Classement" },
    {
      key: "commercial",
      label: "Analyse commerciale",
    },
  ],
  users: [
    { key: "summary", label: "Synthèse" },
    { key: "accounts", label: "Comptes" },
    { key: "connections", label: "Connexions" },
    { key: "profiles", label: "Profils" },
  ],
} as const;

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


function normalizeDashboardDate(value: unknown) {
  const clean =
    typeof value === "string"
      ? value.trim()
      : "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return new Date().toISOString().slice(0, 10);
  }

  const parsed = new Date(`${clean}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== clean
  ) {
    return new Date().toISOString().slice(0, 10);
  }

  return clean;
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function localHourFromDate(
  date: Date,
  timeZone: string | null | undefined,
) {
  if (!timeZone) {
    return date.getUTCHours();
  }

  try {
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "2-digit",
        hourCycle: "h23",
      }).format(date),
    );

    return Number.isInteger(hour)
      ? hour
      : date.getUTCHours();
  } catch {
    return date.getUTCHours();
  }
}

function localTimeLabel(
  date: Date,
  timeZone: string | null | undefined,
) {
  const zone = timeZone || "UTC";

  try {
    const value = new Intl.DateTimeFormat("fr-FR", {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).format(date);

    return timeZone
      ? value
      : `${value} UTC*`;
  } catch {
    return `${date.toISOString().slice(11, 19)} UTC*`;
  }
}

function maskAnalyticsId(
  value: string | null | undefined,
) {
  if (!value) return "—";

  if (value.length <= 14) return value;

  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function rawInt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function rawRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
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

function dashboardHref(
  params: {
    tab?: string;
    userId?: string;
    sessionId?: string;
    date?: string;
    month?: string | number;
    year?: string | number;
    traffic?: string;
    scope?: string;
    section?: string;
  },
  token: string,
) {
  const query = new URLSearchParams();

  if (params.tab) query.set("tab", params.tab);
  if (params.userId) query.set("userId", params.userId);
  if (params.sessionId) query.set("sessionId", params.sessionId);
  if (params.date) query.set("date", params.date);
  if (params.month) query.set("month", String(params.month));
  if (params.year) query.set("year", String(params.year));
  if (params.traffic) query.set("traffic", params.traffic);
  if (params.scope) query.set("scope", params.scope);
  if (params.section) query.set("section", params.section);
  if (token) query.set("token", token);

  const suffix = query.toString();

  return suffix
    ? `/indie-analytics?${suffix}`
    : "/indie-analytics";
}

export default async function IndieAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolvedSearchParams = searchParams instanceof Promise ? await searchParams : searchParams;
  const selectedUserId = String(
    resolvedSearchParams?.userId ?? "",
  ).trim();

  const selectedSessionId = String(
    resolvedSearchParams?.sessionId ?? "",
  ).trim();

  const requestedTraffic = String(
    resolvedSearchParams?.traffic ?? "",
  ).trim();

  const trafficFilter:
    | "external"
    | "test"
    | "all" =
    requestedTraffic === "test"
      ? "test"
      : requestedTraffic === "all"
        ? "all"
        : "external";


  const requestedScope = String(
    resolvedSearchParams?.scope ?? "",
  ).trim();

  const scopeFilter:
    | "day"
    | "total" =
    requestedScope === "day"
      ? "day"
      : "total";

  const selectedDate =
    normalizeDashboardDate(
      resolvedSearchParams?.date,
    );

  const selectedDateMonth =
    Number(selectedDate.slice(5, 7));

  const selectedDateYear =
    Number(selectedDate.slice(0, 4));

  const requestedMonth =
    Number(resolvedSearchParams?.month);

  const requestedYear =
    Number(resolvedSearchParams?.year);

  const calendarMonth =
    Number.isInteger(requestedMonth) &&
    requestedMonth >= 1 &&
    requestedMonth <= 12
      ? requestedMonth
      : selectedDateMonth;

  const calendarYear =
    Number.isInteger(requestedYear) &&
    requestedYear >= 2020 &&
    requestedYear <= 2100
      ? requestedYear
      : selectedDateYear;

  const calendarMonthStart =
    new Date(
      Date.UTC(
        calendarYear,
        calendarMonth - 1,
        1,
      ),
    );

  const calendarDaysCount =
    new Date(
      Date.UTC(
        calendarYear,
        calendarMonth,
        0,
      ),
    ).getUTCDate();

  const calendarLeadingDays =
    (calendarMonthStart.getUTCDay() + 6) % 7;

  const calendarCells: Array<number | null> = [
    ...Array(calendarLeadingDays).fill(null),
    ...Array.from(
      { length: calendarDaysCount },
      (_, index) => index + 1,
    ),
  ];

  const calendarMonthName =
    new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(calendarMonthStart);

  const previousCalendarMonth =
    calendarMonth === 1
      ? {
          month: 12,
          year: calendarYear - 1,
        }
      : {
          month: calendarMonth - 1,
          year: calendarYear,
        };

  const nextCalendarMonth =
    calendarMonth === 12
      ? {
          month: 1,
          year: calendarYear + 1,
        }
      : {
          month: calendarMonth + 1,
          year: calendarYear,
        };

  const activeTab = TABS.some(
    (item) =>
      item.key === resolvedSearchParams?.tab,
  )
    ? String(resolvedSearchParams?.tab)
    : "daily";


  const sectionOptions =
    SECTION_TABS[
      activeTab as keyof typeof SECTION_TABS
    ] ?? SECTION_TABS.daily;

  const requestedSection = String(
    resolvedSearchParams?.section ?? "",
  ).trim();

  const activeSection =
    sectionOptions.some(
      (item) =>
        item.key === requestedSection,
    )
      ? requestedSection
      : sectionOptions[0].key;

  const providedToken = String(
    resolvedSearchParams?.token ?? "",
  ).trim();

  const dashboardToken = String(
    process.env.INDIE_ANALYTICS_TOKEN ?? "",
  ).trim();

  if (!dashboardToken || providedToken !== dashboardToken) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3eee5] px-6 text-black">
        <section className="max-w-md rounded-[30px] border border-black/10 bg-white p-6 text-center shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35">Dashboard privé</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Accès refusé</h1>
          <p className="mt-3 text-sm leading-relaxed text-black/50">
            Ce dashboard est privé. Ajoute le token autorisé dans l’URL pour y accéder.
          </p>
        </section>
      </main>
    );
  }

  const showingDetail =
    Boolean(selectedUserId || selectedSessionId);

  const needDaily =
    !showingDetail &&
    (
      activeTab === "daily" ||
      scopeFilter === "day"
    );

  const needOverview =
    !showingDetail && activeTab === "overview";

  const needActions =
    !showingDetail && activeTab === "actions";

  const needPlaces =
    !showingDetail && activeTab === "places";

  const needUsers =
    !showingDetail && activeTab === "users";

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


  const previousDate =
    shiftDate(selectedDate, -1);

  const nextDate =
    shiftDate(selectedDate, 1);

  const selectedDateLabelRaw =
    new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(
      new Date(
        `${selectedDate}T12:00:00.000Z`,
      ),
    );

  const selectedDateLabel =
    selectedDateLabelRaw.charAt(0).toUpperCase() +
    selectedDateLabelRaw.slice(1);

  /*
   * Analytics V2 :
   * - nouvelles données = clientLocalDate / clientLocalHour
   * - anciennes données = fallback UTC
   */
  const legacyStart =
    new Date(`${selectedDate}T00:00:00.000Z`);

  const legacyEnd =
    new Date(`${nextDate}T00:00:00.000Z`);

  type DailyRawEvent = {
    id: string;
    eventType: string;
    placeId: string | null;
    city: string | null;
    category: string | null;
    viewerCity: string | null;
    viewerCountry: string | null;
    sessionId: string | null;
    launchId: string | null;
    userId: string | null;
    platform: string | null;
    metadata: unknown;
    clientTimeZone: string | null;
    clientLocalHour: number | null;
    createdAt: string | Date;
  };

  type DailyRawLaunch = {
    id: string;
    launchId: string;
    sessionId: string;
    city: string | null;
    country: string | null;
    platform: string | null;
    clientTimeZone: string | null;
    createdAt: string | Date;
  };

  type DailyRawInstallation = {
    sessionId: string;
    userId: string | null;
    accountName: string | null;
    label: string | null;
    trafficClass: string;
    platform: string | null;
    deviceType: string | null;
    os: string | null;
    browser: string | null;
    clientTimeZone: string | null;
    firstSeenAt: string | Date;
    lastSeenAt: string | Date;
    firstSeenDate: string | null;
    totalActions: number;
    totalOpenings: number;
    totalViews: number;
    totalSearches: number;
    totalSaves: number;
    totalLists: number;
    totalWebsites: number;
    totalItineraries: number;
    totalShares: number;
    totalVisits: number;
  };

  const dailyRawRows = needDaily
    ? await prisma.$queryRaw<Array<{
        events: unknown;
        launches: unknown;
        installations: unknown;
        activeCount: number;
      }>>`
        SELECT
          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', e."id",
                  'eventType', e."eventType",
                  'placeId', e."placeId",
                  'city', e."city",
                  'category', e."category",
                  'viewerCity', e."viewerCity",
                  'viewerCountry', e."viewerCountry",
                  'sessionId', e."sessionId",
                  'launchId', e."launchId",
                  'userId', e."userId",
                  'platform', e."platform",
                  'metadata', e."metadata",
                  'clientTimeZone', e."clientTimeZone",
                  'clientLocalHour', e."clientLocalHour",
                  'createdAt', e."createdAt"
                )
                ORDER BY e."createdAt" ASC
              )
              FROM "Event" e
              LEFT JOIN "AnalyticsInstallation" ai
                ON ai."sessionId" = e."sessionId"
              WHERE
                (
                  e."clientLocalDate" = ${selectedDate}
                  OR (
                    e."clientLocalDate" IS NULL
                    AND e."createdAt" >= ${legacyStart}
                    AND e."createdAt" < ${legacyEnd}
                  )
                )
                AND (
                  ${trafficFilter} = 'all'
                  OR COALESCE(
                    ai."trafficClass",
                    'external'
                  ) = ${trafficFilter}
                )
            ),
            '[]'::jsonb
          ) AS "events",

          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', s."id",
                  'launchId', s."launchId",
                  'sessionId', s."sessionId",
                  'city', s."city",
                  'country', s."country",
                  'platform', s."platform",
                  'clientTimeZone', s."clientTimeZone",
                  'createdAt', s."createdAt"
                )
                ORDER BY s."createdAt" ASC
              )
              FROM "DailySession" s
              LEFT JOIN "AnalyticsInstallation" ai
                ON ai."sessionId" = s."sessionId"
              WHERE
                s."day" = ${selectedDate}
                AND (
                  ${trafficFilter} = 'all'
                  OR COALESCE(
                    ai."trafficClass",
                    'external'
                  ) = ${trafficFilter}
                )
            ),
            '[]'::jsonb
          ) AS "launches",

          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'sessionId', ai."sessionId",
                  'userId', ai."userId",
                  'accountName',
                    (
                      SELECT COALESCE(
                        NULLIF(
                          TRIM(u."displayName"),
                          ''
                        ),
                        u."username"
                      )
                      FROM "User" u
                      WHERE u."id" = ai."userId"
                      LIMIT 1
                    ),
                  'label', ai."label",
                  'trafficClass', ai."trafficClass",
                  'platform', ai."platform",
                  'deviceType', ai."deviceType",
                  'os', ai."os",
                  'browser', ai."browser",
                  'clientTimeZone', ai."clientTimeZone",
                  'firstSeenAt', ai."firstSeenAt",
                  'lastSeenAt', ai."lastSeenAt",
                  'firstSeenDate',
                    COALESCE(
                      stats."firstLocalDate",
                      TO_CHAR(
                        COALESCE(
                          stats."firstEventAt",
                          ai."firstSeenAt"
                        ) AT TIME ZONE 'UTC',
                        'YYYY-MM-DD'
                      )
                    ),
                  'totalActions',
                    COALESCE(stats."totalActions", 0),
                  'totalOpenings',
                    COALESCE(stats."totalOpenings", 0),
                  'totalViews',
                    COALESCE(stats."totalViews", 0),
                  'totalSearches',
                    COALESCE(stats."totalSearches", 0),
                  'totalSaves',
                    COALESCE(stats."totalSaves", 0),
                  'totalLists',
                    COALESCE(stats."totalLists", 0),
                  'totalWebsites',
                    COALESCE(stats."totalWebsites", 0),
                  'totalItineraries',
                    COALESCE(stats."totalItineraries", 0),
                  'totalShares',
                    COALESCE(stats."totalShares", 0),
                  'totalVisits',
                    COALESCE(stats."totalVisits", 0)
                )
                ORDER BY ai."lastSeenAt" DESC
              )
              FROM "AnalyticsInstallation" ai

              LEFT JOIN LATERAL (
                SELECT
                  MIN(e2."clientLocalDate")
                    FILTER (
                      WHERE e2."clientLocalDate" IS NOT NULL
                    ) AS "firstLocalDate",

                  MIN(e2."createdAt")
                    AS "firstEventAt",

                  COUNT(*) FILTER (
                    WHERE e2."eventType" <> 'launch_started'
                  )::int AS "totalActions",

                  COUNT(*) FILTER (
                    WHERE e2."eventType" = 'launch_started'
                  )::int AS "totalOpenings",

                  COUNT(*) FILTER (
                    WHERE e2."eventType" = 'view_place_detail'
                  )::int AS "totalViews",

                  COUNT(*) FILTER (
                    WHERE e2."eventType" = 'search_ai_used'
                  )::int AS "totalSearches",

                  COUNT(*) FILTER (
                    WHERE e2."eventType" = 'save_place'
                  )::int AS "totalSaves",

                  COUNT(*) FILTER (
                    WHERE e2."eventType" = 'add_place_to_shared_list'
                  )::int AS "totalLists",

                  COUNT(*) FILTER (
                    WHERE e2."eventType" = 'click_detail_website'
                  )::int AS "totalWebsites",

                  COUNT(*) FILTER (
                    WHERE e2."eventType" = 'click_detail_itinerary'
                  )::int AS "totalItineraries",

                  COUNT(*) FILTER (
                    WHERE e2."eventType" = 'click_detail_share'
                  )::int AS "totalShares",

                  COUNT(*) FILTER (
                    WHERE e2."eventType" = 'mark_place_visited'
                  )::int AS "totalVisits"

                FROM "Event" e2
                WHERE e2."sessionId" = ai."sessionId"
              ) stats ON TRUE

              WHERE
                (
                  ${trafficFilter} = 'all'
                  OR ai."trafficClass" = ${trafficFilter}
                )
                AND ai."sessionId" IN (
                  SELECT d2."sessionId"
                  FROM "DailyActiveUser" d2
                  WHERE d2."day" = ${selectedDate}

                  UNION

                  SELECT e3."sessionId"
                  FROM "Event" e3
                  WHERE
                    e3."sessionId" IS NOT NULL
                    AND (
                      e3."clientLocalDate" = ${selectedDate}
                      OR (
                        e3."clientLocalDate" IS NULL
                        AND e3."createdAt" >= ${legacyStart}
                        AND e3."createdAt" < ${legacyEnd}
                      )
                    )
                )
            ),
            '[]'::jsonb
          ) AS "installations",

          (
            SELECT COUNT(*)::int
            FROM "DailyActiveUser" d
            LEFT JOIN "AnalyticsInstallation" ai
              ON ai."sessionId" = d."sessionId"
            WHERE
              d."day" = ${selectedDate}
              AND (
                ${trafficFilter} = 'all'
                OR COALESCE(
                  ai."trafficClass",
                  'external'
                ) = ${trafficFilter}
              )
          ) AS "activeCount"
      `
    : [];

  const dailyRaw = dailyRawRows[0];

  const dailyEvents = rawRows<DailyRawEvent>(
    dailyRaw?.events,
  ).map((event) => ({
    ...event,
    createdAt: new Date(event.createdAt),
  }));

  const dailyLaunchRows = rawRows<DailyRawLaunch>(
    dailyRaw?.launches,
  ).map((launch) => ({
    ...launch,
    createdAt: new Date(launch.createdAt),
  }));

  const dailyActiveInstallations =
    rawInt(dailyRaw?.activeCount);

  const dailyInstallations =
    rawRows<DailyRawInstallation>(
      dailyRaw?.installations,
    ).map((installation) => ({
      ...installation,
      firstSeenAt:
        new Date(installation.firstSeenAt),
      lastSeenAt:
        new Date(installation.lastSeenAt),
      totalActions:
        rawInt(installation.totalActions),
      totalOpenings:
        rawInt(installation.totalOpenings),
      totalViews:
        rawInt(installation.totalViews),
      totalSearches:
        rawInt(installation.totalSearches),
      totalSaves:
        rawInt(installation.totalSaves),
      totalLists:
        rawInt(installation.totalLists),
      totalWebsites:
        rawInt(installation.totalWebsites),
      totalItineraries:
        rawInt(installation.totalItineraries),
      totalShares:
        rawInt(installation.totalShares),
      totalVisits:
        rawInt(installation.totalVisits),
    }));

  const dailyInstallationById =
    new Map(
      dailyInstallations.map(
        (installation) => [
          installation.sessionId,
          installation,
        ],
      ),
    );

  const dailyInstallationIds =
    new Set(
      dailyEvents
        .map((event) => event.sessionId)
        .filter(
          (value): value is string =>
            typeof value === "string" &&
            Boolean(value),
        ),
    );

  const dailyUserIds =
    new Set(
      dailyEvents
        .map((event) => event.userId)
        .filter(
          (value): value is string =>
            typeof value === "string" &&
            Boolean(value),
        ),
    );

  const dailyViewEvents =
    dailyEvents.filter(
      (event) =>
        event.eventType === "view_place_detail",
    );

  const dailySearchEvents =
    dailyEvents.filter(
      (event) =>
        event.eventType === "search_ai_used",
    );

  const dailySaveEvents =
    dailyEvents.filter(
      (event) =>
        event.eventType === "save_place",
    );

  const dailyVisitedEvents =
    dailyEvents.filter(
      (event) =>
        event.eventType === "mark_place_visited",
    );

  const dailyStrongIntentEvents =
    dailyEvents.filter((event) =>
      [
        "click_detail_website",
        "click_detail_itinerary",
        "click_detail_copy_address",
        "click_detail_phone",
      ].includes(event.eventType),
    );

  const dailyOpeningsByHour =
    Array.from(
      { length: 24 },
      (_, hour) => ({
        label: `${String(hour).padStart(2, "0")}h`,
        value: 0,
      }),
    );

  const dailyViewsByHour =
    Array.from(
      { length: 24 },
      (_, hour) => ({
        label: `${String(hour).padStart(2, "0")}h`,
        value: 0,
      }),
    );

  const dailySearchesByHour =
    Array.from(
      { length: 24 },
      (_, hour) => ({
        label: `${String(hour).padStart(2, "0")}h`,
        value: 0,
      }),
    );

  for (const launch of dailyLaunchRows) {
    const hour =
      localHourFromDate(
        launch.createdAt,
        launch.clientTimeZone,
      );

    if (hour >= 0 && hour <= 23) {
      dailyOpeningsByHour[hour].value += 1;
    }
  }

  for (const event of dailyViewEvents) {
    const hour =
      typeof event.clientLocalHour === "number"
        ? event.clientLocalHour
        : localHourFromDate(
            event.createdAt,
            event.clientTimeZone,
          );

    if (hour >= 0 && hour <= 23) {
      dailyViewsByHour[hour].value += 1;
    }
  }

  for (const event of dailySearchEvents) {
    const hour =
      typeof event.clientLocalHour === "number"
        ? event.clientLocalHour
        : localHourFromDate(
            event.createdAt,
            event.clientTimeZone,
          );

    if (hour >= 0 && hour <= 23) {
      dailySearchesByHour[hour].value += 1;
    }
  }

  const legacyDailyEvents =
    dailyEvents.filter(
      (event) => !event.clientTimeZone,
    ).length;

  const legacyDailyLaunches =
    dailyLaunchRows.filter(
      (launch) => !launch.clientTimeZone,
    ).length;

  const viewedPlacesByHourMap =
    new Map<
      number,
      Map<string, number>
    >();

  for (const event of dailyViewEvents) {
    if (!event.placeId) continue;

    const hour =
      typeof event.clientLocalHour === "number"
        ? event.clientLocalHour
        : event.createdAt.getUTCHours();

    const safeHour =
      Math.max(0, Math.min(23, hour));

    const placesForHour =
      viewedPlacesByHourMap.get(safeHour) ??
      new Map<string, number>();

    placesForHour.set(
      event.placeId,
      (placesForHour.get(event.placeId) || 0) + 1,
    );

    viewedPlacesByHourMap.set(
      safeHour,
      placesForHour,
    );
  }

  const viewedPlacesByHour =
    Array.from(
      viewedPlacesByHourMap.entries(),
    )
      .map(([hour, counts]) => {
        const places =
          Array.from(counts.entries())
            .map(([placeId, count]) => ({
              placeId,
              count,
              name: placeName(
                placeMap,
                placeId,
              ),
              city: placeCity(
                placeMap,
                placeId,
              ),
              category:
                placeMap.get(placeId)
                  ?.category || "",
            }))
            .sort(
              (a, b) =>
                b.count - a.count ||
                a.name.localeCompare(b.name),
            );

        return {
          hour,
          total: places.reduce(
            (sum, place) =>
              sum + place.count,
            0,
          ),
          places,
        };
      })
      .sort(
        (a, b) => a.hour - b.hour,
      );

  const maxViewedPlacesPerHour =
    Math.max(
      1,
      ...viewedPlacesByHour.map(
        (row) => row.total,
      ),
    );

  type DailyActor = {
    sessionId: string;
    events: number;
    openings: number;
    views: number;
    searches: number;
    saves: number;
    lists: number;
    websites: number;
    itineraries: number;
    shares: number;
    visits: number;
    userId: string | null;
    platform: string | null;
    city: string | null;
    country: string | null;
    lastAt: Date;
    installation:
      | (typeof dailyInstallations)[number]
      | null;
  };

  const dailyActorMap =
    new Map<string, DailyActor>();

  for (const launch of dailyLaunchRows) {
    if (!launch.sessionId) continue;

    const previous =
      dailyActorMap.get(launch.sessionId);

    const installation =
      dailyInstallationById.get(
        launch.sessionId,
      ) ?? null;

    dailyActorMap.set(
      launch.sessionId,
      {
        sessionId: launch.sessionId,
        events: previous?.events ?? 0,
        openings: previous?.openings ?? 0,
        views: previous?.views ?? 0,
        searches: previous?.searches ?? 0,
        saves: previous?.saves ?? 0,
        lists: previous?.lists ?? 0,
        websites: previous?.websites ?? 0,
        itineraries: previous?.itineraries ?? 0,
        shares: previous?.shares ?? 0,
        visits: previous?.visits ?? 0,

        userId:
          previous?.userId ??
          installation?.userId ??
          null,

        platform:
          previous?.platform ??
          launch.platform ??
          installation?.platform ??
          null,

        city:
          previous?.city ??
          launch.city ??
          null,

        country:
          previous?.country ??
          launch.country ??
          null,

        lastAt:
          previous &&
          previous.lastAt > launch.createdAt
            ? previous.lastAt
            : launch.createdAt,

        installation:
          previous?.installation ??
          installation,
      },
    );
  }

  for (const event of dailyEvents) {
    if (!event.sessionId) continue;

    const previous =
      dailyActorMap.get(event.sessionId);

    const installation =
      dailyInstallationById.get(
        event.sessionId,
      ) ?? null;

    dailyActorMap.set(
      event.sessionId,
      {
        sessionId: event.sessionId,

        events:
          (previous?.events ?? 0) +
          (
            event.eventType ===
            "launch_started"
              ? 0
              : 1
          ),

        openings:
          (previous?.openings ?? 0) +
          (
            event.eventType ===
            "launch_started"
              ? 1
              : 0
          ),

        views:
          (previous?.views ?? 0) +
          (
            event.eventType ===
            "view_place_detail"
              ? 1
              : 0
          ),

        searches:
          (previous?.searches ?? 0) +
          (
            event.eventType ===
            "search_ai_used"
              ? 1
              : 0
          ),

        saves:
          (previous?.saves ?? 0) +
          (
            event.eventType ===
            "save_place"
              ? 1
              : 0
          ),

        lists:
          (previous?.lists ?? 0) +
          (
            event.eventType ===
            "add_place_to_shared_list"
              ? 1
              : 0
          ),

        websites:
          (previous?.websites ?? 0) +
          (
            event.eventType ===
            "click_detail_website"
              ? 1
              : 0
          ),

        itineraries:
          (previous?.itineraries ?? 0) +
          (
            event.eventType ===
            "click_detail_itinerary"
              ? 1
              : 0
          ),

        shares:
          (previous?.shares ?? 0) +
          (
            event.eventType ===
            "click_detail_share"
              ? 1
              : 0
          ),

        visits:
          (previous?.visits ?? 0) +
          (
            event.eventType ===
            "mark_place_visited"
              ? 1
              : 0
          ),

        userId:
          event.userId ??
          previous?.userId ??
          installation?.userId ??
          null,

        platform:
          event.platform ??
          previous?.platform ??
          installation?.platform ??
          null,

        city:
          previous?.city ?? null,

        country:
          previous?.country ?? null,

        lastAt:
          previous &&
          previous.lastAt > event.createdAt
            ? previous.lastAt
            : event.createdAt,

        installation:
          installation ??
          previous?.installation ??
          null,
      },
    );
  }

  const dailyActors =
    Array.from(
      dailyActorMap.values(),
    ).sort(
      (a, b) =>
        b.lastAt.getTime() -
        a.lastAt.getTime(),
    );

  const dailyNewInstallations =
    dailyActors.filter(
      (actor) =>
        actor.installation?.firstSeenDate ===
        selectedDate,
    ).length;

  const dailyReturningInstallations =
    dailyActors.length -
    dailyNewInstallations;

  const dailyWithAccount =
    dailyActors.filter(
      (actor) => Boolean(actor.userId),
    ).length;

  const dailyWithoutAccount =
    dailyActors.length -
    dailyWithAccount;

  const dailyExactOpenings =
    dailyActors.reduce(
      (sum, actor) =>
        sum + actor.openings,
      0,
    );


  const dailyConnectionMap =
    new Map<
      string,
      {
        city: string;
        country: string;
        sessions: Set<string>;
        openings: number;
      }
    >();

  for (const launch of dailyLaunchRows) {
    const city =
      launch.city?.trim() ||
      "Localisation inconnue";

    const country =
      launch.country?.trim() || "";

    const key =
      `${city}|||${country}`;

    const previous =
      dailyConnectionMap.get(key) ?? {
        city,
        country,
        sessions: new Set<string>(),
        openings: 0,
      };

    previous.sessions.add(
      launch.sessionId,
    );

    previous.openings += 1;

    dailyConnectionMap.set(
      key,
      previous,
    );
  }

  const dailyConnectionRows =
    Array.from(
      dailyConnectionMap.values(),
    )
      .map((row) => ({
        city: row.city,
        country: row.country,
        users: row.sessions.size,
        openings: row.openings,
      }))
      .sort(
        (a, b) =>
          b.users - a.users ||
          b.openings - a.openings,
      );

  const dailyActionCount =
    dailyActors.reduce(
      (sum, actor) =>
        sum + actor.events,
      0,
    );

  const dailyPlaceCounts =
    new Map<string, number>();

  for (const event of dailyViewEvents) {
    if (!event.placeId) continue;

    dailyPlaceCounts.set(
      event.placeId,
      (
        dailyPlaceCounts.get(
          event.placeId,
        ) || 0
      ) + 1,
    );
  }

  const dailyTopPlaces =
    Array.from(
      dailyPlaceCounts.entries(),
    )
      .map(
        ([placeId, count]) => ({
          placeId,
          count,
        }),
      )
      .sort(
        (a, b) =>
          b.count - a.count,
      )
      .slice(0, 20);


  const dailyEventTypeCounts =
    new Map<string, number>();

  const dailyEventsByPlaceCounts =
    new Map<string, number>();

  type DailyCommercialEntry = {
    placeId: string;
    views: number;
    searchImpressions: number;
    geo: Map<
      string,
      {
        eventType: string;
        viewerCity: string;
        viewerCountry: string | null;
        source: string;
        count: number;
      }
    >;
  };

  const dailyCommercialMap =
    new Map<
      string,
      DailyCommercialEntry
    >();

  for (const event of dailyEvents) {
    dailyEventTypeCounts.set(
      event.eventType,
      (
        dailyEventTypeCounts.get(
          event.eventType,
        ) || 0
      ) + 1,
    );

    if (event.placeId) {
      dailyEventsByPlaceCounts.set(
        event.placeId,
        (
          dailyEventsByPlaceCounts.get(
            event.placeId,
          ) || 0
        ) + 1,
      );
    }

    if (
      !event.placeId ||
      ![
        "view_place_detail",
        "search_result_impression",
      ].includes(event.eventType)
    ) {
      continue;
    }

    const existing =
      dailyCommercialMap.get(
        event.placeId,
      ) ?? {
        placeId: event.placeId,
        views: 0,
        searchImpressions: 0,
        geo: new Map(),
      };

    if (
      event.eventType ===
      "view_place_detail"
    ) {
      existing.views += 1;
    } else {
      existing.searchImpressions += 1;
    }

    const viewerCity =
      event.viewerCity?.trim() ||
      "Localisation inconnue";

    const viewerCountry =
      event.viewerCountry?.trim() ||
      null;

    const source =
      event.eventType ===
      "view_place_detail"
        ? metadataSource(
            event.metadata,
          )
        : "search_result";

    const geoKey =
      [
        event.eventType,
        viewerCity,
        viewerCountry || "",
        source,
      ].join("|||");

    const previousGeo =
      existing.geo.get(geoKey);

    existing.geo.set(
      geoKey,
      {
        eventType:
          event.eventType,
        viewerCity,
        viewerCountry,
        source,
        count:
          (previousGeo?.count || 0) +
          1,
      },
    );

    dailyCommercialMap.set(
      event.placeId,
      existing,
    );
  }

  const dailyScopedEventTypes =
    Array.from(
      dailyEventTypeCounts.entries(),
    )
      .map(
        ([eventType, count]) => ({
          eventType,
          _count: {
            _all: count,
          },
        }),
      )
      .sort(
        (a, b) =>
          b._count._all -
          a._count._all,
      );

  const dailyScopedEventsByPlace =
    Array.from(
      dailyEventsByPlaceCounts.entries(),
    )
      .map(
        ([placeId, count]) => ({
          placeId,
          _count: {
            _all: count,
          },
        }),
      )
      .sort(
        (a, b) =>
          b._count._all -
          a._count._all,
      )
      .slice(0, 30);

  const dailyScopedPlaceCommercialRows =
    Array.from(
      dailyCommercialMap.values(),
    )
      .map((row) => ({
        placeId: row.placeId,
        views: row.views,
        searchImpressions:
          row.searchImpressions,
        geo:
          Array.from(
            row.geo.values(),
          ).sort(
            (a, b) =>
              b.count - a.count,
          ),
      }))
      .sort(
        (a, b) =>
          b.views - a.views ||
          b.searchImpressions -
            a.searchImpressions,
      )
      .slice(0, 20);

  const dailyTimeline = [
    ...dailyLaunchRows.map(
      (launch) => ({
        key: `launch-${launch.id}`,
        createdAt:
          launch.createdAt,
        localTime:
          localTimeLabel(
            launch.createdAt,
            launch.clientTimeZone,
          ),
        kind: "launch" as const,
        label: "Ouverture",
        detail:
          [
            launch.city,
            launch.country,
          ]
            .filter(Boolean)
            .join(" · ") ||
          "Localisation inconnue",
        secondary:
          maskAnalyticsId(
            launch.sessionId,
          ),
        sessionId: launch.sessionId,
        platform:
          launch.platform || "—",
        timeZone:
          launch.clientTimeZone ||
          "UTC*",
      }),
    ),

    ...dailyEvents.map(
      (event) => {
        const place =
          event.placeId
            ? placeName(
                placeMap,
                event.placeId,
              )
            : "";

        const searchQuery =
          event.eventType ===
          "search_ai_used"
            ? metadataText(
                event.metadata,
                "query",
              )
            : "";

        const source =
          metadataSource(
            event.metadata,
          );

        const detail =
          place && place !== "—"
            ? [
                place,
                event.category || "",
              ]
                .filter(Boolean)
                .join(" · ")
            : searchQuery
              ? `« ${searchQuery} »`
              : source !== "unknown"
                ? sourceLabel(source)
                : "—";

        return {
          key: `event-${event.id}`,
          createdAt:
            event.createdAt,
          localTime:
            localTimeLabel(
              event.createdAt,
              event.clientTimeZone,
            ),
          kind: "event" as const,
          label:
            eventLabel(
              event.eventType,
            ),
          detail,
          secondary:
            maskAnalyticsId(
              event.sessionId,
            ),
          sessionId: event.sessionId,
          platform:
            event.platform || "—",
          timeZone:
            event.clientTimeZone ||
            "UTC*",
        };
      },
    ),
  ].sort(
    (a, b) =>
      a.createdAt.getTime() -
      b.createdAt.getTime(),
  );

  let active5 = 0;
  let active15 = 0;
  let dau = 0;
  let sessions = 0;

  let locations: Array<{
    country: string | null;
    city: string | null;
    _count: { _all: number };
  }> = [];

  let usersCount = 0;
  let usersWithEmailCount = 0;
  let sharedListsCount = 0;
  let sharedListPlacesCount = 0;
  let savedPlacesCount = 0;
  let visitedPlacesCount = 0;
  let eventsCount = 0;

  let anonymousEventSessions: unknown[] = [];

  let eventTypes: Array<{
    eventType: string;
    _count: { _all: number };
  }> = [];

  let eventsByPlace: Array<{
    placeId: string | null;
    _count: { _all: number };
  }> = [];

  let placeCommercialRows: Array<{
    placeId: string;
    views: number;
    searchImpressions: number;
    geo: Array<{
      eventType: string;
      viewerCity: string;
      viewerCountry: string | null;
      source: string;
      count: number;
    }>;
  }> = [];

  let viewPlaceDetailEvents: Array<{
    metadata: unknown;
  }> = [];

  let searchEvents: Array<{
    createdAt: Date;
    city: string | null;
    category: string | null;
    metadata: unknown;
  }> = [];

  let searchDetailClicks = 0;
  let searchMapClicks = 0;

  let usersByAge: Array<{
    ageRange: string | null;
    _count: { _all: number };
  }> = [];

  let usersByHomeCity: Array<{
    homeCity: string | null;
    _count: { _all: number };
  }> = [];

  let users: Array<{
    id: string;
    username: string;
    email: string | null;
    displayName: string;
    preferredLocale: string;
    homeCity: string | null;
    ageRange: string | null;
    pushDevices: Array<{
      platform: string;
      updatedAt: Date;
    }>;
  }> = [];

  let savedByUser: Array<{
    userId: string;
    _count: { _all: number };
  }> = [];

  let visitedByUser: Array<{
    userId: string;
    _count: { _all: number };
  }> = [];

  let ownedListsByUser: Array<{
    ownerId: string;
    _count: { _all: number };
  }> = [];

  let memberListsByUser: Array<{
    userId: string;
    _count: { _all: number };
  }> = [];

  let eventsByUser: Array<{
    userId: string | null;
    _count: { _all: number };
  }> = [];


  let connectionLocations: Array<{
    city: string;
    country: string | null;
    users: number;
    openings: number;
  }> = [];

  if (needOverview) {
    const rows = await prisma.$queryRaw<Array<{
      active5: number;
      active15: number;
      dau: number;
      sessions: number;
      usersCount: number;
      usersWithEmailCount: number;
      sharedListsCount: number;
      sharedListPlacesCount: number;
      eventsCount: number;
      anonymousSessionCount: number;
      locations: unknown;
      eventTypes: unknown;
      viewMetadata: unknown;
    }>>`
      SELECT
        (
          SELECT COUNT(*)::int
          FROM "ActiveSession"
          WHERE "lastSeenAt" >= ${fiveMin}
        ) AS "active5",

        (
          SELECT COUNT(*)::int
          FROM "ActiveSession"
          WHERE "lastSeenAt" >= ${fifteenMin}
        ) AS "active15",

        (
          SELECT COUNT(*)::int
          FROM "DailyActiveUser"
          WHERE "day" = ${day}
        ) AS "dau",

        (
          SELECT COUNT(*)::int
          FROM "DailySession"
          WHERE "day" = ${day}
        ) AS "sessions",

        (
          SELECT COUNT(*)::int
          FROM "User"
        ) AS "usersCount",

        (
          SELECT COUNT(*)::int
          FROM "User"
          WHERE "email" IS NOT NULL
        ) AS "usersWithEmailCount",

        (
          SELECT COUNT(*)::int
          FROM "SharedList"
        ) AS "sharedListsCount",

        (
          SELECT COUNT(*)::int
          FROM "SharedListPlace"
        ) AS "sharedListPlacesCount",

        (
          SELECT COUNT(*)::int
          FROM "Event"
        ) AS "eventsCount",

        (
          SELECT COUNT(DISTINCT "sessionId")::int
          FROM "Event"
          WHERE
            "userId" IS NULL
            AND "sessionId" IS NOT NULL
        ) AS "anonymousSessionCount",

        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'country', q."country",
                'city', q."city",
                'count', q."count"
              )
              ORDER BY q."count" DESC
            )
            FROM (
              SELECT
                "country",
                "city",
                COUNT(*)::int AS "count"
              FROM "DailyActiveUser"
              WHERE "day" = ${day}
              GROUP BY "country", "city"
            ) q
          ),
          '[]'::jsonb
        ) AS "locations",

        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'eventType', q."eventType",
                'count', q."count"
              )
              ORDER BY q."count" DESC
            )
            FROM (
              SELECT
                "eventType",
                COUNT(*)::int AS "count"
              FROM "Event"
              GROUP BY "eventType"
            ) q
          ),
          '[]'::jsonb
        ) AS "eventTypes",

        COALESCE(
          (
            SELECT jsonb_agg(q."metadata")
            FROM (
              SELECT "metadata"
              FROM "Event"
              WHERE "eventType" = 'view_place_detail'
              ORDER BY "createdAt" DESC
              LIMIT 5000
            ) q
          ),
          '[]'::jsonb
        ) AS "viewMetadata"
    `;

    const row = rows[0];

    active5 = rawInt(row?.active5);
    active15 = rawInt(row?.active15);
    dau = rawInt(row?.dau);
    sessions = rawInt(row?.sessions);
    usersCount = rawInt(row?.usersCount);
    usersWithEmailCount =
      rawInt(row?.usersWithEmailCount);
    sharedListsCount =
      rawInt(row?.sharedListsCount);
    sharedListPlacesCount =
      rawInt(row?.sharedListPlacesCount);
    eventsCount =
      rawInt(row?.eventsCount);

    anonymousEventSessions =
      Array.from({
        length: rawInt(
          row?.anonymousSessionCount,
        ),
      });

    locations = rawRows<{
      country: string | null;
      city: string | null;
      count: number;
    }>(row?.locations).map((item) => ({
      country: item.country,
      city: item.city,
      _count: {
        _all: rawInt(item.count),
      },
    }));

    eventTypes = rawRows<{
      eventType: string;
      count: number;
    }>(row?.eventTypes).map((item) => ({
      eventType: item.eventType,
      _count: {
        _all: rawInt(item.count),
      },
    }));

    viewPlaceDetailEvents =
      rawRows<unknown>(
        row?.viewMetadata,
      ).map((metadata) => ({
        metadata,
      }));
  }

  if (needActions) {
    const rows = await prisma.$queryRaw<Array<{
      eventTypes: unknown;
      viewMetadata: unknown;
      searchEvents: unknown;
      searchDetailClicks: number;
      searchMapClicks: number;
    }>>`
      SELECT
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'eventType', q."eventType",
                'count', q."count"
              )
              ORDER BY q."count" DESC
            )
            FROM (
              SELECT
                "eventType",
                COUNT(*)::int AS "count"
              FROM "Event"
              GROUP BY "eventType"
            ) q
          ),
          '[]'::jsonb
        ) AS "eventTypes",

        COALESCE(
          (
            SELECT jsonb_agg(q."metadata")
            FROM (
              SELECT "metadata"
              FROM "Event"
              WHERE "eventType" = 'view_place_detail'
              ORDER BY "createdAt" DESC
              LIMIT 5000
            ) q
          ),
          '[]'::jsonb
        ) AS "viewMetadata",

        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'createdAt', q."createdAt",
                'city', q."city",
                'category', q."category",
                'metadata', q."metadata"
              )
              ORDER BY q."createdAt" DESC
            )
            FROM (
              SELECT
                "createdAt",
                "city",
                "category",
                "metadata"
              FROM "Event"
              WHERE "eventType" = 'search_ai_used'
              ORDER BY "createdAt" DESC
              LIMIT 5000
            ) q
          ),
          '[]'::jsonb
        ) AS "searchEvents",

        (
          SELECT COUNT(*)::int
          FROM "Event"
          WHERE "eventType" =
            'click_search_result_detail'
        ) AS "searchDetailClicks",

        (
          SELECT COUNT(*)::int
          FROM "Event"
          WHERE "eventType" =
            'click_search_results_map'
        ) AS "searchMapClicks"
    `;

    const row = rows[0];

    eventTypes = rawRows<{
      eventType: string;
      count: number;
    }>(row?.eventTypes).map((item) => ({
      eventType: item.eventType,
      _count: {
        _all: rawInt(item.count),
      },
    }));

    viewPlaceDetailEvents =
      rawRows<unknown>(
        row?.viewMetadata,
      ).map((metadata) => ({
        metadata,
      }));

    searchEvents = rawRows<{
      createdAt: string | Date;
      city: string | null;
      category: string | null;
      metadata: unknown;
    }>(row?.searchEvents).map((event) => ({
      ...event,
      createdAt: new Date(event.createdAt),
    }));

    searchDetailClicks =
      rawInt(row?.searchDetailClicks);

    searchMapClicks =
      rawInt(row?.searchMapClicks);
  }

  if (needPlaces) {
    const rows = await prisma.$queryRaw<Array<{
      sharedListPlacesCount: number;
      savedPlacesCount: number;
      visitedPlacesCount: number;
      eventsByPlace: unknown;
      placeCommercialRows: unknown;
    }>>`
      WITH "filteredCommercialPlaceEvents" AS (
        SELECT
          e."placeId",
          e."eventType",
          e."viewerCity",
          e."viewerCountry",
          e."metadata"
        FROM "Event" e
        LEFT JOIN "AnalyticsInstallation" ai
          ON ai."sessionId" = e."sessionId"
        WHERE
          e."placeId" IS NOT NULL
          AND e."eventType" IN (
            'view_place_detail',
            'search_result_impression'
          )
          AND (
            ${trafficFilter} = 'all'
            OR COALESCE(
              ai."trafficClass",
              'external'
            ) = ${trafficFilter}
          )
      ),

      "commercialTotals" AS (
        SELECT
          "placeId",

          COUNT(*) FILTER (
            WHERE "eventType" = 'view_place_detail'
          )::int AS "views",

          COUNT(*) FILTER (
            WHERE "eventType" = 'search_result_impression'
          )::int AS "searchImpressions"

        FROM "filteredCommercialPlaceEvents"
        GROUP BY "placeId"
      ),

      "commercialGeo" AS (
        SELECT
          "placeId",
          "eventType",

          COALESCE(
            NULLIF(
              TRIM("viewerCity"),
              ''
            ),
            'Localisation inconnue'
          ) AS "viewerCity",

          NULLIF(
            TRIM("viewerCountry"),
            ''
          ) AS "viewerCountry",

          CASE
            WHEN "eventType" = 'view_place_detail'
            THEN COALESCE(
              NULLIF(
                TRIM("metadata"->>'source'),
                ''
              ),
              'unknown'
            )
            ELSE 'search_result'
          END AS "source",

          COUNT(*)::int AS "count"

        FROM "filteredCommercialPlaceEvents"

        GROUP BY
          "placeId",
          "eventType",
          COALESCE(
            NULLIF(
              TRIM("viewerCity"),
              ''
            ),
            'Localisation inconnue'
          ),
          NULLIF(
            TRIM("viewerCountry"),
            ''
          ),
          CASE
            WHEN "eventType" = 'view_place_detail'
            THEN COALESCE(
              NULLIF(
                TRIM("metadata"->>'source'),
                ''
              ),
              'unknown'
            )
            ELSE 'search_result'
          END
      ),

      "commercialPlaces" AS (
        SELECT
          totals."placeId",
          totals."views",
          totals."searchImpressions",

          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'eventType',
                    geo."eventType",
                  'viewerCity',
                    geo."viewerCity",
                  'viewerCountry',
                    geo."viewerCountry",
                  'source',
                    geo."source",
                  'count',
                    geo."count"
                )
                ORDER BY
                  geo."count" DESC,
                  geo."viewerCity" ASC
              )
              FROM "commercialGeo" geo
              WHERE
                geo."placeId" =
                totals."placeId"
            ),
            '[]'::jsonb
          ) AS "geo"

        FROM "commercialTotals" totals

        ORDER BY
          totals."views" DESC,
          totals."searchImpressions" DESC

        LIMIT 20
      )

      SELECT
        (
          SELECT COUNT(*)::int
          FROM "SharedListPlace"
        ) AS "sharedListPlacesCount",

        (
          SELECT COUNT(*)::int
          FROM "UserPlace"
          WHERE "saved" = true
        ) AS "savedPlacesCount",

        (
          SELECT COUNT(*)::int
          FROM "UserPlace"
          WHERE "visited" = true
        ) AS "visitedPlacesCount",

        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'placeId', q."placeId",
                'count', q."count"
              )
              ORDER BY q."count" DESC
            )
            FROM (
              SELECT
                e."placeId",
                COUNT(*)::int AS "count"
              FROM "Event" e
              LEFT JOIN "AnalyticsInstallation" ai
                ON ai."sessionId" = e."sessionId"
              WHERE
                e."placeId" IS NOT NULL
                AND (
                  ${trafficFilter} = 'all'
                  OR COALESCE(
                    ai."trafficClass",
                    'external'
                  ) = ${trafficFilter}
                )
              GROUP BY e."placeId"
              ORDER BY COUNT(*) DESC
              LIMIT 30
            ) q
          ),
          '[]'::jsonb
        ) AS "eventsByPlace",

        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'placeId',
                  p."placeId",
                'views',
                  p."views",
                'searchImpressions',
                  p."searchImpressions",
                'geo',
                  p."geo"
              )
              ORDER BY
                p."views" DESC,
                p."searchImpressions" DESC
            )
            FROM "commercialPlaces" p
          ),
          '[]'::jsonb
        ) AS "placeCommercialRows"
    `;

    const row = rows[0];

    sharedListPlacesCount =
      rawInt(row?.sharedListPlacesCount);

    savedPlacesCount =
      rawInt(row?.savedPlacesCount);

    visitedPlacesCount =
      rawInt(row?.visitedPlacesCount);

    eventsByPlace = rawRows<{
      placeId: string | null;
      count: number;
    }>(row?.eventsByPlace).map((item) => ({
      placeId: item.placeId,
      _count: {
        _all: rawInt(item.count),
      },
    }));

    placeCommercialRows =
      rawRows<{
        placeId: string;
        views: number;
        searchImpressions: number;
        geo: unknown;
      }>(
        row?.placeCommercialRows,
      ).map((item) => ({
        placeId:
          String(item.placeId || ""),
        views:
          rawInt(item.views),
        searchImpressions:
          rawInt(item.searchImpressions),
        geo:
          rawRows<{
            eventType: string;
            viewerCity: string;
            viewerCountry: string | null;
            source: string;
            count: number;
          }>(item.geo).map((geo) => ({
            eventType:
              String(geo.eventType || ""),
            viewerCity:
              String(
                geo.viewerCity ||
                "Localisation inconnue",
              ),
            viewerCountry:
              geo.viewerCountry
                ? String(geo.viewerCountry)
                : null,
            source:
              String(
                geo.source ||
                "unknown",
              ),
            count:
              rawInt(geo.count),
          })),
      }));
  }

  if (needUsers) {
    const rows = await prisma.$queryRaw<Array<{
      usersByAge: unknown;
      usersByHomeCity: unknown;
      users: unknown;
      savedByUser: unknown;
      visitedByUser: unknown;
      ownedListsByUser: unknown;
      memberListsByUser: unknown;
      eventsByUser: unknown;
    }>>`
      SELECT
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'ageRange', q."ageRange",
                'count', q."count"
              )
              ORDER BY q."count" DESC
            )
            FROM (
              SELECT
                "ageRange",
                COUNT(*)::int AS "count"
              FROM "User"
              GROUP BY "ageRange"
            ) q
          ),
          '[]'::jsonb
        ) AS "usersByAge",

        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'homeCity', q."homeCity",
                'count', q."count"
              )
              ORDER BY q."count" DESC
            )
            FROM (
              SELECT
                "homeCity",
                COUNT(*)::int AS "count"
              FROM "User"
              GROUP BY "homeCity"
              ORDER BY COUNT(*) DESC
              LIMIT 30
            ) q
          ),
          '[]'::jsonb
        ) AS "usersByHomeCity",

        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', u."id",
                'username', u."username",
                'email', u."email",
                'displayName', u."displayName",
                'preferredLocale', u."preferredLocale",
                'homeCity', u."homeCity",
                'ageRange', u."ageRange",
                'pushDevices',
                  COALESCE(
                    (
                      SELECT jsonb_agg(
                        jsonb_build_object(
                          'platform', p."platform",
                          'updatedAt', p."updatedAt"
                        )
                        ORDER BY p."updatedAt" DESC
                      )
                      FROM "PushInstallation" p
                      WHERE p."userId" = u."id"
                    ),
                    '[]'::jsonb
                  )
              )
              ORDER BY u."createdAt" DESC
            )
            FROM "User" u
          ),
          '[]'::jsonb
        ) AS "users",

        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'userId', q."userId",
                'count', q."count"
              )
            )
            FROM (
              SELECT
                "userId",
                COUNT(*)::int AS "count"
              FROM "UserPlace"
              WHERE "saved" = true
              GROUP BY "userId"
            ) q
          ),
          '[]'::jsonb
        ) AS "savedByUser",

        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'userId', q."userId",
                'count', q."count"
              )
            )
            FROM (
              SELECT
                "userId",
                COUNT(*)::int AS "count"
              FROM "UserPlace"
              WHERE "visited" = true
              GROUP BY "userId"
            ) q
          ),
          '[]'::jsonb
        ) AS "visitedByUser",

        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'ownerId', q."ownerId",
                'count', q."count"
              )
            )
            FROM (
              SELECT
                "ownerId",
                COUNT(*)::int AS "count"
              FROM "SharedList"
              GROUP BY "ownerId"
            ) q
          ),
          '[]'::jsonb
        ) AS "ownedListsByUser",

        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'userId', q."userId",
                'count', q."count"
              )
            )
            FROM (
              SELECT
                "userId",
                COUNT(*)::int AS "count"
              FROM "SharedListMember"
              GROUP BY "userId"
            ) q
          ),
          '[]'::jsonb
        ) AS "memberListsByUser",

        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'userId', q."userId",
                'count', q."count"
              )
            )
            FROM (
              SELECT
                "userId",
                COUNT(*)::int AS "count"
              FROM "Event"
              WHERE "userId" IS NOT NULL
              GROUP BY "userId"
            ) q
          ),
          '[]'::jsonb
        ) AS "eventsByUser"
    `;

    const row = rows[0];

    usersByAge = rawRows<{
      ageRange: string | null;
      count: number;
    }>(row?.usersByAge).map((item) => ({
      ageRange: item.ageRange,
      _count: {
        _all: rawInt(item.count),
      },
    }));

    usersByHomeCity = rawRows<{
      homeCity: string | null;
      count: number;
    }>(row?.usersByHomeCity).map((item) => ({
      homeCity: item.homeCity,
      _count: {
        _all: rawInt(item.count),
      },
    }));

    users = rawRows<{
      id: string;
      username: string;
      email: string | null;
      displayName: string;
      preferredLocale: string;
      homeCity: string | null;
      ageRange: string | null;
      pushDevices: Array<{
        platform: string;
        updatedAt: string | Date;
      }>;
    }>(row?.users).map((user) => ({
      ...user,
      pushDevices: rawRows<{
        platform: string;
        updatedAt: string | Date;
      }>(user.pushDevices).map((device) => ({
        ...device,
        updatedAt: new Date(device.updatedAt),
      })),
    }));

    savedByUser = rawRows<{
      userId: string;
      count: number;
    }>(row?.savedByUser).map((item) => ({
      userId: item.userId,
      _count: {
        _all: rawInt(item.count),
      },
    }));

    visitedByUser = rawRows<{
      userId: string;
      count: number;
    }>(row?.visitedByUser).map((item) => ({
      userId: item.userId,
      _count: {
        _all: rawInt(item.count),
      },
    }));

    ownedListsByUser = rawRows<{
      ownerId: string;
      count: number;
    }>(row?.ownedListsByUser).map((item) => ({
      ownerId: item.ownerId,
      _count: {
        _all: rawInt(item.count),
      },
    }));

    memberListsByUser = rawRows<{
      userId: string;
      count: number;
    }>(row?.memberListsByUser).map((item) => ({
      userId: item.userId,
      _count: {
        _all: rawInt(item.count),
      },
    }));

    eventsByUser = rawRows<{
      userId: string | null;
      count: number;
    }>(row?.eventsByUser).map((item) => ({
      userId: item.userId,
      _count: {
        _all: rawInt(item.count),
      },
    }));
  }

  if (
    !showingDetail &&
    scopeFilter === "day" &&
    activeTab !== "daily"
  ) {
    eventTypes =
      dailyScopedEventTypes;

    viewPlaceDetailEvents =
      dailyViewEvents.map(
        (event) => ({
          metadata:
            event.metadata,
        }),
      );

    searchEvents =
      dailySearchEvents.map(
        (event) => ({
          createdAt:
            event.createdAt,
          city:
            event.city,
          category:
            event.category,
          metadata:
            event.metadata,
        }),
      );

    searchDetailClicks =
      dailyEvents.filter(
        (event) =>
          event.eventType ===
          "click_search_result_detail",
      ).length;

    searchMapClicks =
      dailyEvents.filter(
        (event) =>
          event.eventType ===
          "click_search_results_map",
      ).length;

    eventsByPlace =
      dailyScopedEventsByPlace;

    placeCommercialRows =
      dailyScopedPlaceCommercialRows;

    if (
      activeTab === "overview"
    ) {
      dau =
        dailyActors.length;

      sessions =
        dailyExactOpenings;

      eventsCount =
        dailyEvents.length;

      anonymousEventSessions =
        dailyActors.filter(
          (actor) =>
            !actor.userId,
        );

      const locationCounts =
        new Map<
          string,
          {
            city: string;
            country: string;
            count: number;
          }
        >();

      for (
        const actor of dailyActors
      ) {
        const city =
          actor.city ||
          "Localisation inconnue";

        const country =
          actor.country || "";

        const key =
          `${city}|||${country}`;

        const previous =
          locationCounts.get(key);

        locationCounts.set(
          key,
          {
            city,
            country,
            count:
              (previous?.count || 0) +
              1,
          },
        );
      }

      locations =
        Array.from(
          locationCounts.values(),
        )
          .sort(
            (a, b) =>
              b.count - a.count,
          )
          .map((row) => ({
            city: row.city,
            country:
              row.country || null,
            _count: {
              _all: row.count,
            },
          }));
    }
  }

  if (
    !showingDetail &&
    scopeFilter === "total" &&
    (
      activeTab === "overview" ||
      activeTab === "actions"
    )
  ) {
    const scopedRows =
      await prisma.$queryRaw<
        Array<{
          active5: number;
          active15: number;
          installationCount: number;
          sessionCount: number;
          eventsCount: number;
          anonymousCount: number;
          locations: unknown;
          eventTypes: unknown;
          viewMetadata: unknown;
          searchEvents: unknown;
          searchDetailClicks: number;
          searchMapClicks: number;
        }>
      >`
        SELECT
          (
            SELECT COUNT(*)::int
            FROM "ActiveSession" a
            LEFT JOIN "AnalyticsInstallation" ai
              ON ai."sessionId" = a."sessionId"
            WHERE
              a."lastSeenAt" >= ${fiveMin}
              AND (
                ${trafficFilter} = 'all'
                OR COALESCE(
                  ai."trafficClass",
                  'external'
                ) = ${trafficFilter}
              )
          ) AS "active5",

          (
            SELECT COUNT(*)::int
            FROM "ActiveSession" a
            LEFT JOIN "AnalyticsInstallation" ai
              ON ai."sessionId" = a."sessionId"
            WHERE
              a."lastSeenAt" >= ${fifteenMin}
              AND (
                ${trafficFilter} = 'all'
                OR COALESCE(
                  ai."trafficClass",
                  'external'
                ) = ${trafficFilter}
              )
          ) AS "active15",

          (
            SELECT COUNT(*)::int
            FROM "AnalyticsInstallation" ai
            WHERE
              ${trafficFilter} = 'all'
              OR ai."trafficClass" = ${trafficFilter}
          ) AS "installationCount",

          (
            SELECT COUNT(*)::int
            FROM "DailySession" s
            LEFT JOIN "AnalyticsInstallation" ai
              ON ai."sessionId" = s."sessionId"
            WHERE
              ${trafficFilter} = 'all'
              OR COALESCE(
                ai."trafficClass",
                'external'
              ) = ${trafficFilter}
          ) AS "sessionCount",

          (
            SELECT COUNT(*)::int
            FROM "Event" e
            LEFT JOIN "AnalyticsInstallation" ai
              ON ai."sessionId" = e."sessionId"
            WHERE
              ${trafficFilter} = 'all'
              OR COALESCE(
                ai."trafficClass",
                'external'
              ) = ${trafficFilter}
          ) AS "eventsCount",

          (
            SELECT COUNT(
              DISTINCT e."sessionId"
            )::int
            FROM "Event" e
            LEFT JOIN "AnalyticsInstallation" ai
              ON ai."sessionId" = e."sessionId"
            WHERE
              e."userId" IS NULL
              AND e."sessionId" IS NOT NULL
              AND (
                ${trafficFilter} = 'all'
                OR COALESCE(
                  ai."trafficClass",
                  'external'
                ) = ${trafficFilter}
              )
          ) AS "anonymousCount",

          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'city', q."city",
                  'country', q."country",
                  'count', q."count"
                )
                ORDER BY q."count" DESC
              )
              FROM (
                SELECT
                  COALESCE(
                    NULLIF(
                      TRIM(s."city"),
                      ''
                    ),
                    'Localisation inconnue'
                  ) AS "city",
                  NULLIF(
                    TRIM(s."country"),
                    ''
                  ) AS "country",
                  COUNT(
                    DISTINCT s."sessionId"
                  )::int AS "count"
                FROM "DailySession" s
                LEFT JOIN "AnalyticsInstallation" ai
                  ON ai."sessionId" = s."sessionId"
                WHERE
                  ${trafficFilter} = 'all'
                  OR COALESCE(
                    ai."trafficClass",
                    'external'
                  ) = ${trafficFilter}
                GROUP BY
                  COALESCE(
                    NULLIF(
                      TRIM(s."city"),
                      ''
                    ),
                    'Localisation inconnue'
                  ),
                  NULLIF(
                    TRIM(s."country"),
                    ''
                  )
              ) q
            ),
            '[]'::jsonb
          ) AS "locations",

          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'eventType',
                    q."eventType",
                  'count',
                    q."count"
                )
                ORDER BY q."count" DESC
              )
              FROM (
                SELECT
                  e."eventType",
                  COUNT(*)::int AS "count"
                FROM "Event" e
                LEFT JOIN "AnalyticsInstallation" ai
                  ON ai."sessionId" = e."sessionId"
                WHERE
                  ${trafficFilter} = 'all'
                  OR COALESCE(
                    ai."trafficClass",
                    'external'
                  ) = ${trafficFilter}
                GROUP BY e."eventType"
              ) q
            ),
            '[]'::jsonb
          ) AS "eventTypes",

          COALESCE(
            (
              SELECT jsonb_agg(
                q."metadata"
              )
              FROM (
                SELECT
                  e."metadata"
                FROM "Event" e
                LEFT JOIN "AnalyticsInstallation" ai
                  ON ai."sessionId" = e."sessionId"
                WHERE
                  e."eventType" =
                    'view_place_detail'
                  AND (
                    ${trafficFilter} = 'all'
                    OR COALESCE(
                      ai."trafficClass",
                      'external'
                    ) = ${trafficFilter}
                  )
                ORDER BY e."createdAt" DESC
                LIMIT 5000
              ) q
            ),
            '[]'::jsonb
          ) AS "viewMetadata",

          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'createdAt',
                    q."createdAt",
                  'city',
                    q."city",
                  'category',
                    q."category",
                  'metadata',
                    q."metadata"
                )
                ORDER BY
                  q."createdAt" DESC
              )
              FROM (
                SELECT
                  e."createdAt",
                  e."city",
                  e."category",
                  e."metadata"
                FROM "Event" e
                LEFT JOIN "AnalyticsInstallation" ai
                  ON ai."sessionId" = e."sessionId"
                WHERE
                  e."eventType" =
                    'search_ai_used'
                  AND (
                    ${trafficFilter} = 'all'
                    OR COALESCE(
                      ai."trafficClass",
                      'external'
                    ) = ${trafficFilter}
                  )
                ORDER BY e."createdAt" DESC
                LIMIT 5000
              ) q
            ),
            '[]'::jsonb
          ) AS "searchEvents",

          (
            SELECT COUNT(*)::int
            FROM "Event" e
            LEFT JOIN "AnalyticsInstallation" ai
              ON ai."sessionId" = e."sessionId"
            WHERE
              e."eventType" =
                'click_search_result_detail'
              AND (
                ${trafficFilter} = 'all'
                OR COALESCE(
                  ai."trafficClass",
                  'external'
                ) = ${trafficFilter}
              )
          ) AS "searchDetailClicks",

          (
            SELECT COUNT(*)::int
            FROM "Event" e
            LEFT JOIN "AnalyticsInstallation" ai
              ON ai."sessionId" = e."sessionId"
            WHERE
              e."eventType" =
                'click_search_results_map'
              AND (
                ${trafficFilter} = 'all'
                OR COALESCE(
                  ai."trafficClass",
                  'external'
                ) = ${trafficFilter}
              )
          ) AS "searchMapClicks"
      `;

    const scoped =
      scopedRows[0];

    active5 =
      rawInt(scoped?.active5);

    active15 =
      rawInt(scoped?.active15);

    if (
      activeTab === "overview"
    ) {
      dau =
        rawInt(
          scoped?.installationCount,
        );

      sessions =
        rawInt(
          scoped?.sessionCount,
        );

      eventsCount =
        rawInt(
          scoped?.eventsCount,
        );

      anonymousEventSessions =
        Array.from({
          length:
            rawInt(
              scoped?.anonymousCount,
            ),
        });

      locations =
        rawRows<{
          city: string | null;
          country: string | null;
          count: number;
        }>(
          scoped?.locations,
        ).map((row) => ({
          city: row.city,
          country: row.country,
          _count: {
            _all:
              rawInt(row.count),
          },
        }));
    }

    eventTypes =
      rawRows<{
        eventType: string;
        count: number;
      }>(
        scoped?.eventTypes,
      ).map((row) => ({
        eventType:
          row.eventType,
        _count: {
          _all:
            rawInt(row.count),
        },
      }));

    viewPlaceDetailEvents =
      rawRows<unknown>(
        scoped?.viewMetadata,
      ).map((metadata) => ({
        metadata,
      }));

    searchEvents =
      rawRows<{
        createdAt: string | Date;
        city: string | null;
        category: string | null;
        metadata: unknown;
      }>(
        scoped?.searchEvents,
      ).map((event) => ({
        ...event,
        createdAt:
          new Date(
            event.createdAt,
          ),
      }));

    searchDetailClicks =
      rawInt(
        scoped?.searchDetailClicks,
      );

    searchMapClicks =
      rawInt(
        scoped?.searchMapClicks,
      );
  }

  if (
    !showingDetail &&
    activeTab === "users"
  ) {
    const connectionRows =
      await prisma.$queryRaw<
        Array<{
          locations: unknown;
        }>
      >`
        SELECT
          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'city', q."city",
                  'country', q."country",
                  'users', q."users",
                  'openings', q."openings"
                )
                ORDER BY
                  q."users" DESC,
                  q."openings" DESC
              )
              FROM (
                SELECT
                  COALESCE(
                    NULLIF(
                      TRIM(s."city"),
                      ''
                    ),
                    'Localisation inconnue'
                  ) AS "city",

                  NULLIF(
                    TRIM(s."country"),
                    ''
                  ) AS "country",

                  COUNT(
                    DISTINCT s."sessionId"
                  )::int AS "users",

                  COUNT(*)::int
                    AS "openings"

                FROM "DailySession" s

                LEFT JOIN "AnalyticsInstallation" ai
                  ON ai."sessionId" =
                    s."sessionId"

                WHERE
                  (
                    ${scopeFilter} = 'total'
                    OR s."day" =
                      ${selectedDate}
                  )
                  AND (
                    ${trafficFilter} = 'all'
                    OR COALESCE(
                      ai."trafficClass",
                      'external'
                    ) = ${trafficFilter}
                  )

                GROUP BY
                  COALESCE(
                    NULLIF(
                      TRIM(s."city"),
                      ''
                    ),
                    'Localisation inconnue'
                  ),
                  NULLIF(
                    TRIM(s."country"),
                    ''
                  )
              ) q
            ),
            '[]'::jsonb
          ) AS "locations"
      `;

    connectionLocations =
      rawRows<{
        city: string;
        country: string | null;
        users: number;
        openings: number;
      }>(
        connectionRows[0]?.locations,
      ).map((row) => ({
        city:
          row.city ||
          "Localisation inconnue",
        country:
          row.country,
        users:
          rawInt(row.users),
        openings:
          rawInt(row.openings),
      }));
  }

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
          pushDevices: {
            orderBy: { updatedAt: "desc" },
          },
          events: {
            orderBy: { createdAt: "desc" },
            take: 500,
          },
        },
      })
    : null;

  const selectedUserScopedEvents =
    selectedUser
      ? await prisma.event.findMany({
          where:
            scopeFilter === "day"
              ? {
                  userId: selectedUser.id,
                  OR: [
                    {
                      clientLocalDate:
                        selectedDate,
                    },
                    {
                      clientLocalDate: null,
                      createdAt: {
                        gte: legacyStart,
                        lt: legacyEnd,
                      },
                    },
                  ],
                }
              : {
                  userId: selectedUser.id,
                },
          orderBy: {
            createdAt: "desc",
          },
          take: 500,
        })
      : [];

  const selectedUserScopedEventCount =
    selectedUser
      ? await prisma.event.count({
          where:
            scopeFilter === "day"
              ? {
                  userId: selectedUser.id,
                  OR: [
                    {
                      clientLocalDate:
                        selectedDate,
                    },
                    {
                      clientLocalDate: null,
                      createdAt: {
                        gte: legacyStart,
                        lt: legacyEnd,
                      },
                    },
                  ],
                }
              : {
                  userId: selectedUser.id,
                },
        })
      : 0;

  const selectedUserEventTypes =
    selectedUser
      ? await prisma.event.groupBy({
          by: ["eventType"],
          where:
            scopeFilter === "day"
              ? {
                  userId: selectedUser.id,
                  OR: [
                    {
                      clientLocalDate:
                        selectedDate,
                    },
                    {
                      clientLocalDate: null,
                      createdAt: {
                        gte: legacyStart,
                        lt: legacyEnd,
                      },
                    },
                  ],
                }
              : {
                  userId: selectedUser.id,
                },
          _count: {
            _all: true,
          },
          orderBy: {
            _count: {
              eventType: "desc",
            },
          },
        })
      : [];

  const maxEventCount = Math.max(1, ...eventTypes.map((row) => row._count._all));
  const maxPlaceCount = Math.max(1, ...eventsByPlace.map((row) => row._count._all));

  const eventCountByType =
    new Map(
      eventTypes.map(
        (row) => [
          row.eventType,
          row._count._all,
        ],
      ),
    );

  const groupedActionSegments = [
    {
      label: "Découverte",
      value:
        (eventCountByType.get("click_explore_world") || 0) +
        (eventCountByType.get("click_recent_additions") || 0) +
        (eventCountByType.get("click_discovery_of_day") || 0) +
        (eventCountByType.get("search_ai_used") || 0) +
        (eventCountByType.get("search_result_impression") || 0),
    },
    {
      label: "Consultation",
      value:
        (eventCountByType.get("view_place_detail") || 0) +
        (eventCountByType.get("click_search_result_detail") || 0) +
        (eventCountByType.get("click_search_results_map") || 0) +
        (eventCountByType.get("click_mini_more_info") || 0) +
        (eventCountByType.get("click_mini_immersion") || 0) +
        (eventCountByType.get("click_detail_view_on_map") || 0),
    },
    {
      label: "Intérêt",
      value:
        (eventCountByType.get("save_place") || 0) +
        (eventCountByType.get("unsave_place") || 0) +
        (eventCountByType.get("open_shared_list_picker") || 0) +
        (eventCountByType.get("add_place_to_shared_list") || 0) +
        (eventCountByType.get("create_shared_list") || 0) +
        (eventCountByType.get("click_detail_share") || 0),
    },
    {
      label: "Vers le lieu",
      value:
        (eventCountByType.get("click_detail_website") || 0) +
        (eventCountByType.get("click_detail_itinerary") || 0) +
        (eventCountByType.get("click_detail_copy_address") || 0) +
        (eventCountByType.get("click_detail_phone") || 0),
    },
    {
      label: "Visites déclarées",
      value:
        (eventCountByType.get("mark_place_visited") || 0) +
        (eventCountByType.get("unmark_place_visited") || 0),
    },
  ];

  const overviewSourceSegments =
    viewSources.map((row) => ({
      label: sourceLabel(row.source),
      value: row.count,
    }));

  const overviewCityBars =
    locations
      .slice(0, 12)
      .map((row) => ({
        label:
          `${row.city || "—"} · ${row.country || "—"}`,
        value: row._count._all,
      }));

  const actionTypeBars =
    eventTypes
      .slice(0, 12)
      .map((row) => ({
        label:
          eventLabel(row.eventType),
        value:
          row._count._all,
      }));

  const placeViewBars =
    placeCommercialRows
      .filter((row) => row.views > 0)
      .sort((a, b) => b.views - a.views)
      .slice(0, 12)
      .map((row) => ({
        label:
          placeName(
            placeMap,
            row.placeId,
          ),
        value:
          row.views,
        hint:
          placeCity(
            placeMap,
            row.placeId,
          ) || undefined,
      }));

  const placeSearchBars =
    placeCommercialRows
      .filter(
        (row) =>
          row.searchImpressions > 0,
      )
      .sort(
        (a, b) =>
          b.searchImpressions -
          a.searchImpressions,
      )
      .slice(0, 12)
      .map((row) => ({
        label:
          placeName(
            placeMap,
            row.placeId,
          ),
        value:
          row.searchImpressions,
        hint:
          placeCity(
            placeMap,
            row.placeId,
          ) || undefined,
      }));

  const userAgeSegments =
    usersByAge.map((row) => ({
      label:
        ageLabel(row.ageRange),
      value:
        row._count._all,
    }));

  const userCityBars =
    usersByHomeCity
      .slice(0, 12)
      .map((row) => ({
        label:
          row.homeCity ||
          "Non renseignée",
        value:
          row._count._all,
      }));
  const selectedUserViewEvents =
    selectedUserScopedEvents.filter(
      (event) =>
        event.eventType ===
        "view_place_detail",
    );
  const selectedUserViewSources = countSources(selectedUserViewEvents);
  const maxSelectedUserViewSourceCount = Math.max(1, ...selectedUserViewSources.map((item) => item.count));

  type SessionRawEvent = {
    id: string;
    eventType: string;
    placeId: string | null;
    city: string | null;
    category: string | null;
    userId: string | null;
    platform: string | null;
    metadata: unknown;
    clientTimeZone: string | null;
    createdAt: string | Date;
  };

  const sessionRawRows = selectedSessionId
    ? await prisma.$queryRaw<Array<{
        presence: unknown;
        installation: unknown;
        eventCount: number;
        eventTypes: unknown;
        views: unknown;
        searches: unknown;
        recentEvents: unknown;
        linkedUser: unknown;
        dayStats: unknown;
        totalStats: unknown;
        history: unknown;
      }>>`
        SELECT
          (
            SELECT jsonb_build_object(
              'sessionId', a."sessionId",
              'city', a."city",
              'country', a."country",
              'platform', a."platform",
              'clientTimeZone', a."clientTimeZone",
              'utcOffsetMinutes', a."utcOffsetMinutes",
              'lastSeenAt', a."lastSeenAt"
            )
            FROM "ActiveSession" a
            WHERE a."sessionId" = ${selectedSessionId}
            LIMIT 1
          ) AS "presence",

          (
            SELECT jsonb_build_object(
              'sessionId', ai."sessionId",
              'userId', ai."userId",
              'label', ai."label",
              'trafficClass', ai."trafficClass",
              'platform', ai."platform",
              'deviceType', ai."deviceType",
              'os', ai."os",
              'browser', ai."browser",
              'clientTimeZone', ai."clientTimeZone",
              'utcOffsetMinutes', ai."utcOffsetMinutes",
              'firstSeenAt', ai."firstSeenAt",
              'lastSeenAt', ai."lastSeenAt"
            )
            FROM "AnalyticsInstallation" ai
            WHERE ai."sessionId" = ${selectedSessionId}
            LIMIT 1
          ) AS "installation",

          (
            SELECT COUNT(*)::int
            FROM "Event"
            WHERE
              "sessionId" = ${selectedSessionId}
              AND "eventType" <> 'launch_started'
              AND (
                ${scopeFilter} = 'total'
                OR (
                  "clientLocalDate" =
                    ${selectedDate}
                )
                OR (
                  "clientLocalDate" IS NULL
                  AND "createdAt" >=
                    ${legacyStart}
                  AND "createdAt" <
                    ${legacyEnd}
                )
              )
          ) AS "eventCount",

          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'eventType', q."eventType",
                  'count', q."count"
                )
                ORDER BY q."count" DESC
              )
              FROM (
                SELECT
                  "eventType",
                  COUNT(*)::int AS "count"
                FROM "Event"
                WHERE
                  "sessionId" = ${selectedSessionId}
                  AND "eventType" <> 'launch_started'
                  AND (
                    ${scopeFilter} = 'total'
                    OR "clientLocalDate" =
                      ${selectedDate}
                    OR (
                      "clientLocalDate" IS NULL
                      AND "createdAt" >=
                        ${legacyStart}
                      AND "createdAt" <
                        ${legacyEnd}
                    )
                  )
                GROUP BY "eventType"
              ) q
            ),
            '[]'::jsonb
          ) AS "eventTypes",

          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', e."id",
                  'placeId', e."placeId",
                  'category', e."category",
                  'metadata', e."metadata",
                  'clientTimeZone', e."clientTimeZone",
                  'createdAt', e."createdAt"
                )
                ORDER BY e."createdAt" DESC
              )
              FROM "Event" e
              WHERE
                e."sessionId" = ${selectedSessionId}
                AND e."eventType" = 'view_place_detail'
                AND (
                  ${scopeFilter} = 'total'
                  OR e."clientLocalDate" =
                    ${selectedDate}
                  OR (
                    e."clientLocalDate" IS NULL
                    AND e."createdAt" >=
                      ${legacyStart}
                    AND e."createdAt" <
                      ${legacyEnd}
                  )
                )
            ),
            '[]'::jsonb
          ) AS "views",

          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', e."id",
                  'city', e."city",
                  'category', e."category",
                  'metadata', e."metadata",
                  'clientTimeZone', e."clientTimeZone",
                  'createdAt', e."createdAt"
                )
                ORDER BY e."createdAt" DESC
              )
              FROM "Event" e
              WHERE
                e."sessionId" = ${selectedSessionId}
                AND e."eventType" = 'search_ai_used'
                AND (
                  ${scopeFilter} = 'total'
                  OR e."clientLocalDate" =
                    ${selectedDate}
                  OR (
                    e."clientLocalDate" IS NULL
                    AND e."createdAt" >=
                      ${legacyStart}
                    AND e."createdAt" <
                      ${legacyEnd}
                  )
                )
            ),
            '[]'::jsonb
          ) AS "searches",

          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', q."id",
                  'eventType', q."eventType",
                  'placeId', q."placeId",
                  'city', q."city",
                  'category', q."category",
                  'userId', q."userId",
                  'platform', q."platform",
                  'metadata', q."metadata",
                  'clientTimeZone', q."clientTimeZone",
                  'createdAt', q."createdAt"
                )
                ORDER BY q."createdAt" DESC
              )
              FROM (
                SELECT
                  "id",
                  "eventType",
                  "placeId",
                  "city",
                  "category",
                  "userId",
                  "platform",
                  "metadata",
                  "clientTimeZone",
                  "createdAt"
                FROM "Event"
                WHERE
                  "sessionId" = ${selectedSessionId}
                  AND (
                    ${scopeFilter} = 'total'
                    OR "clientLocalDate" =
                      ${selectedDate}
                    OR (
                      "clientLocalDate" IS NULL
                      AND "createdAt" >=
                        ${legacyStart}
                      AND "createdAt" <
                        ${legacyEnd}
                    )
                  )
                ORDER BY "createdAt" DESC
                LIMIT 300
              ) q
            ),
            '[]'::jsonb
          ) AS "recentEvents",

          (
            SELECT jsonb_build_object(
              'id', u."id",
              'username', u."username",
              'displayName', u."displayName",
              'email', u."email"
            )
            FROM "User" u
            WHERE u."id" = COALESCE(
              (
                SELECT ai."userId"
                FROM "AnalyticsInstallation" ai
                WHERE
                  ai."sessionId" = ${selectedSessionId}
                  AND ai."userId" IS NOT NULL
                LIMIT 1
              ),
              (
                SELECT e."userId"
                FROM "Event" e
                WHERE
                  e."sessionId" = ${selectedSessionId}
                  AND e."userId" IS NOT NULL
                ORDER BY e."createdAt" DESC
                LIMIT 1
              )
            )
            LIMIT 1
          ) AS "linkedUser",

          (
            SELECT jsonb_build_object(
              'actions',
                COUNT(*) FILTER (
                  WHERE e."eventType" <> 'launch_started'
                )::int,

              'openings',
                COUNT(*) FILTER (
                  WHERE e."eventType" = 'launch_started'
                )::int,

              'views',
                COUNT(*) FILTER (
                  WHERE e."eventType" = 'view_place_detail'
                )::int,

              'searches',
                COUNT(*) FILTER (
                  WHERE e."eventType" = 'search_ai_used'
                )::int,

              'saves',
                COUNT(*) FILTER (
                  WHERE e."eventType" = 'save_place'
                )::int,

              'lists',
                COUNT(*) FILTER (
                  WHERE e."eventType" = 'add_place_to_shared_list'
                )::int,

              'websites',
                COUNT(*) FILTER (
                  WHERE e."eventType" = 'click_detail_website'
                )::int,

              'itineraries',
                COUNT(*) FILTER (
                  WHERE e."eventType" = 'click_detail_itinerary'
                )::int,

              'shares',
                COUNT(*) FILTER (
                  WHERE e."eventType" = 'click_detail_share'
                )::int,

              'visits',
                COUNT(*) FILTER (
                  WHERE e."eventType" = 'mark_place_visited'
                )::int
            )
            FROM "Event" e
            WHERE
              e."sessionId" = ${selectedSessionId}
              AND (
                e."clientLocalDate" = ${selectedDate}
                OR (
                  e."clientLocalDate" IS NULL
                  AND e."createdAt" >= ${legacyStart}
                  AND e."createdAt" < ${legacyEnd}
                )
              )
          ) AS "dayStats",

          (
            SELECT jsonb_build_object(
              'actions',
                COUNT(*) FILTER (
                  WHERE e."eventType" <> 'launch_started'
                )::int,

              'openings',
                COUNT(*) FILTER (
                  WHERE e."eventType" = 'launch_started'
                )::int,

              'views',
                COUNT(*) FILTER (
                  WHERE e."eventType" = 'view_place_detail'
                )::int,

              'searches',
                COUNT(*) FILTER (
                  WHERE e."eventType" = 'search_ai_used'
                )::int,

              'saves',
                COUNT(*) FILTER (
                  WHERE e."eventType" = 'save_place'
                )::int,

              'lists',
                COUNT(*) FILTER (
                  WHERE e."eventType" = 'add_place_to_shared_list'
                )::int,

              'websites',
                COUNT(*) FILTER (
                  WHERE e."eventType" = 'click_detail_website'
                )::int,

              'itineraries',
                COUNT(*) FILTER (
                  WHERE e."eventType" = 'click_detail_itinerary'
                )::int,

              'shares',
                COUNT(*) FILTER (
                  WHERE e."eventType" = 'click_detail_share'
                )::int,

              'visits',
                COUNT(*) FILTER (
                  WHERE e."eventType" = 'mark_place_visited'
                )::int
            )
            FROM "Event" e
            WHERE e."sessionId" = ${selectedSessionId}
          ) AS "totalStats",

          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'date', q."date",
                  'actions', q."actions",
                  'openings', q."openings",
                  'views', q."views",
                  'searches', q."searches",
                  'saves', q."saves",
                  'lists', q."lists",
                  'websites', q."websites",
                  'itineraries', q."itineraries",
                  'shares', q."shares",
                  'visits', q."visits"
                )
                ORDER BY q."date" DESC
              )
              FROM (
                SELECT
                  COALESCE(
                    e."clientLocalDate",
                    TO_CHAR(
                      e."createdAt" AT TIME ZONE 'UTC',
                      'YYYY-MM-DD'
                    )
                  ) AS "date",

                  COUNT(*) FILTER (
                    WHERE e."eventType" <> 'launch_started'
                  )::int AS "actions",

                  COUNT(*) FILTER (
                    WHERE e."eventType" = 'launch_started'
                  )::int AS "openings",

                  COUNT(*) FILTER (
                    WHERE e."eventType" = 'view_place_detail'
                  )::int AS "views",

                  COUNT(*) FILTER (
                    WHERE e."eventType" = 'search_ai_used'
                  )::int AS "searches",

                  COUNT(*) FILTER (
                    WHERE e."eventType" = 'save_place'
                  )::int AS "saves",

                  COUNT(*) FILTER (
                    WHERE e."eventType" = 'add_place_to_shared_list'
                  )::int AS "lists",

                  COUNT(*) FILTER (
                    WHERE e."eventType" = 'click_detail_website'
                  )::int AS "websites",

                  COUNT(*) FILTER (
                    WHERE e."eventType" = 'click_detail_itinerary'
                  )::int AS "itineraries",

                  COUNT(*) FILTER (
                    WHERE e."eventType" = 'click_detail_share'
                  )::int AS "shares",

                  COUNT(*) FILTER (
                    WHERE e."eventType" = 'mark_place_visited'
                  )::int AS "visits"

                FROM "Event" e
                WHERE e."sessionId" = ${selectedSessionId}

                GROUP BY COALESCE(
                  e."clientLocalDate",
                  TO_CHAR(
                    e."createdAt" AT TIME ZONE 'UTC',
                    'YYYY-MM-DD'
                  )
                )
              ) q
            ),
            '[]'::jsonb
          ) AS "history"
      `
    : [];

  const sessionRaw = sessionRawRows[0];

  type SessionStats = {
    actions: number;
    openings: number;
    views: number;
    searches: number;
    saves: number;
    lists: number;
    websites: number;
    itineraries: number;
    shares: number;
    visits: number;
  };

  function parseSessionStats(
    value: unknown,
  ): SessionStats {
    const raw =
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};

    return {
      actions: rawInt(raw.actions),
      openings: rawInt(raw.openings),
      views: rawInt(raw.views),
      searches: rawInt(raw.searches),
      saves: rawInt(raw.saves),
      lists: rawInt(raw.lists),
      websites: rawInt(raw.websites),
      itineraries: rawInt(raw.itineraries),
      shares: rawInt(raw.shares),
      visits: rawInt(raw.visits),
    };
  }

  const selectedSessionInstallation =
    sessionRaw?.installation &&
    typeof sessionRaw.installation === "object" &&
    !Array.isArray(sessionRaw.installation)
      ? {
          ...(sessionRaw.installation as {
            sessionId: string;
            userId: string | null;
            label: string | null;
            trafficClass: string;
            platform: string | null;
            deviceType: string | null;
            os: string | null;
            browser: string | null;
            clientTimeZone: string | null;
            utcOffsetMinutes: number | null;
            firstSeenAt: string | Date;
            lastSeenAt: string | Date;
          }),
          firstSeenAt: new Date(
            (
              sessionRaw.installation as {
                firstSeenAt: string | Date;
              }
            ).firstSeenAt,
          ),
          lastSeenAt: new Date(
            (
              sessionRaw.installation as {
                lastSeenAt: string | Date;
              }
            ).lastSeenAt,
          ),
        }
      : null;

  const selectedSessionDayStats =
    parseSessionStats(
      sessionRaw?.dayStats,
    );

  const selectedSessionTotalStats =
    parseSessionStats(
      sessionRaw?.totalStats,
    );

  const selectedSessionHistory =
    rawRows<{
      date: string;
      actions: number;
      openings: number;
      views: number;
      searches: number;
      saves: number;
      lists: number;
      websites: number;
      itineraries: number;
      shares: number;
      visits: number;
    }>(sessionRaw?.history).map(
      (row) => ({
        date: row.date,
        actions: rawInt(row.actions),
        openings: rawInt(row.openings),
        views: rawInt(row.views),
        searches: rawInt(row.searches),
        saves: rawInt(row.saves),
        lists: rawInt(row.lists),
        websites: rawInt(row.websites),
        itineraries: rawInt(row.itineraries),
        shares: rawInt(row.shares),
        visits: rawInt(row.visits),
      }),
    );

  const selectedSessionPresence =
    sessionRaw?.presence &&
    typeof sessionRaw.presence === "object" &&
    !Array.isArray(sessionRaw.presence)
      ? sessionRaw.presence as {
          sessionId: string;
          city: string | null;
          country: string | null;
          platform: string | null;
          clientTimeZone: string | null;
          utcOffsetMinutes: number | null;
          lastSeenAt: string | Date;
        }
      : null;

  const selectedSessionEventCount =
    rawInt(sessionRaw?.eventCount);

  const selectedSessionEventTypes =
    rawRows<{
      eventType: string;
      count: number;
    }>(sessionRaw?.eventTypes).map((item) => ({
      eventType: item.eventType,
      _count: {
        _all: rawInt(item.count),
      },
    }));

  const selectedSessionViewEvents =
    rawRows<{
      id: string;
      placeId: string | null;
      category: string | null;
      metadata: unknown;
      clientTimeZone: string | null;
      createdAt: string | Date;
    }>(sessionRaw?.views).map((event) => ({
      ...event,
      createdAt: new Date(event.createdAt),
    }));

  const selectedSessionSearchEvents =
    rawRows<{
      id: string;
      city: string | null;
      category: string | null;
      metadata: unknown;
      clientTimeZone: string | null;
      createdAt: string | Date;
    }>(sessionRaw?.searches).map((event) => ({
      ...event,
      createdAt: new Date(event.createdAt),
    }));

  const selectedSessionRecentEvents =
    rawRows<SessionRawEvent>(
      sessionRaw?.recentEvents,
    ).map((event) => ({
      ...event,
      createdAt: new Date(event.createdAt),
    }));

  const selectedSessionUser =
    sessionRaw?.linkedUser &&
    typeof sessionRaw.linkedUser === "object" &&
    !Array.isArray(sessionRaw.linkedUser)
      ? sessionRaw.linkedUser as {
          id: string;
          username: string;
          displayName: string;
          email: string | null;
        }
      : null;

  const sessionPlaceMap =
    new Map<
      string,
      {
        placeId: string;
        count: number;
        lastViewedAt: Date;
        timeZone: string | null;
      }
    >();

  for (const event of selectedSessionViewEvents) {
    if (!event.placeId) continue;

    const previous =
      sessionPlaceMap.get(event.placeId);

    sessionPlaceMap.set(
      event.placeId,
      {
        placeId: event.placeId,
        count:
          (previous?.count ?? 0) + 1,
        lastViewedAt:
          !previous ||
          event.createdAt >
            previous.lastViewedAt
            ? event.createdAt
            : previous.lastViewedAt,
        timeZone:
          event.clientTimeZone ??
          previous?.timeZone ??
          null,
      },
    );
  }

  const selectedSessionPlaces =
    Array.from(
      sessionPlaceMap.values(),
    ).sort(
      (a, b) =>
        b.lastViewedAt.getTime() -
        a.lastViewedAt.getTime(),
    );

  const maxSelectedSessionEventCount =
    Math.max(
      1,
      ...selectedSessionEventTypes.map(
        (item) => item._count._all,
      ),
    );

  return (
    <main className="h-screen overflow-y-auto bg-[#f3eee5] px-4 py-4 pb-16 text-black md:px-8 md:py-8 md:pb-20">
      <div className="mx-auto max-w-7xl">
        <header className="overflow-visible rounded-[34px] bg-black text-white shadow-sm">
          <div className="px-6 py-7 md:px-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">Dashboard privé</div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Indie Map Analytics</h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
                  Vue claire de l’usage réel : présence, recherches, fiches ouvertes, favoris, listes partagées et profils connectés.
                </p>
              </div>

              {!showingDetail && activeTab === "daily" ? (
                <details className="group relative w-full sm:w-auto">
                  <summary className="flex min-w-[250px] cursor-pointer list-none items-center justify-between gap-5 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-left transition hover:bg-white/12 [&::-webkit-details-marker]:hidden">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                        Journée analysée
                      </div>

                      <div className="mt-1 text-sm font-semibold text-white sm:text-base">
                        {selectedDateLabel}
                      </div>
                    </div>

                    <span className="text-lg text-white/55 transition group-open:rotate-180">
                      ▾
                    </span>
                  </summary>

                  <div className="absolute right-0 top-full z-50 mt-2 w-[min(340px,calc(100vw-32px))] rounded-[22px] border border-black/10 bg-white p-4 text-black shadow-xl">
                    <div className="flex items-center justify-between gap-3">
                      <a
                        href={dashboardHref(
                          {
                            tab: "daily",
                            date: selectedDate,
                            month:
                              previousCalendarMonth.month,
                            year:
                              previousCalendarMonth.year,
                            traffic: trafficFilter,
                          },
                          providedToken,
                        )}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f3eee5] text-sm font-semibold"
                        aria-label="Mois précédent"
                      >
                        ←
                      </a>

                      <div className="text-sm font-semibold capitalize">
                        {calendarMonthName}
                      </div>

                      <a
                        href={dashboardHref(
                          {
                            tab: "daily",
                            date: selectedDate,
                            month:
                              nextCalendarMonth.month,
                            year:
                              nextCalendarMonth.year,
                            traffic: trafficFilter,
                          },
                          providedToken,
                        )}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f3eee5] text-sm font-semibold"
                        aria-label="Mois suivant"
                      >
                        →
                      </a>
                    </div>

                    <form
                      method="get"
                      action="/indie-analytics"
                      className="mt-3 grid grid-cols-[1fr_90px_auto] gap-2"
                    >
                      <input
                        type="hidden"
                        name="tab"
                        value="daily"
                      />

                      <input
                        type="hidden"
                        name="date"
                        value={selectedDate}
                      />

                      <input
                        type="hidden"
                        name="token"
                        value={providedToken}
                      />

                      <input
                        type="hidden"
                        name="traffic"
                        value={trafficFilter}
                      />

                      <select
                        name="month"
                        aria-label="Mois"
                        defaultValue={String(calendarMonth)}
                        className="min-w-0 rounded-lg border border-black/10 bg-[#faf7f0] px-2 py-2 text-xs font-semibold"
                      >
                        {[
                          "Janvier",
                          "Février",
                          "Mars",
                          "Avril",
                          "Mai",
                          "Juin",
                          "Juillet",
                          "Août",
                          "Septembre",
                          "Octobre",
                          "Novembre",
                          "Décembre",
                        ].map((label, index) => (
                          <option
                            key={label}
                            value={index + 1}
                          >
                            {label}
                          </option>
                        ))}
                      </select>

                      <select
                        name="year"
                        aria-label="Année"
                        defaultValue={String(calendarYear)}
                        className="rounded-lg border border-black/10 bg-[#faf7f0] px-2 py-2 text-xs font-semibold"
                      >
                        {Array.from(
                          { length: 11 },
                          (_, index) =>
                            selectedDateYear -
                            5 +
                            index,
                        ).map((year) => (
                          <option
                            key={year}
                            value={year}
                          >
                            {year}
                          </option>
                        ))}
                      </select>

                      <button
                        type="submit"
                        className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white"
                      >
                        OK
                      </button>
                    </form>

                    <div className="mt-3 grid grid-cols-7 gap-1 text-center">
                      {[
                        "L",
                        "M",
                        "M",
                        "J",
                        "V",
                        "S",
                        "D",
                      ].map((label, index) => (
                        <div
                          key={`${label}-${index}`}
                          className="py-1 text-[10px] font-semibold text-black/35"
                        >
                          {label}
                        </div>
                      ))}

                      {calendarCells.map(
                        (dayNumber, index) => {
                          if (!dayNumber) {
                            return (
                              <div
                                key={`empty-${index}`}
                                className="h-9"
                              />
                            );
                          }

                          const dateValue =
                            `${calendarYear}-` +
                            `${String(calendarMonth).padStart(2, "0")}-` +
                            `${String(dayNumber).padStart(2, "0")}`;

                          const isSelected =
                            dateValue === selectedDate;

                          return (
                            <a
                              key={dateValue}
                              href={dashboardHref(
                                {
                                  tab: "daily",
                                  date: dateValue,
                                  month:
                                    calendarMonth,
                                  year:
                                    calendarYear,
                                  traffic: trafficFilter,
                                },
                                providedToken,
                              )}
                              className={
                                isSelected
                                  ? "flex h-9 items-center justify-center rounded-lg bg-black text-xs font-semibold text-white"
                                  : "flex h-9 items-center justify-center rounded-lg text-xs font-semibold hover:bg-[#f3eee5]"
                              }
                            >
                              {dayNumber}
                            </a>
                          );
                        },
                      )}
                    </div>
                  </div>
                </details>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-right">
                  <div className="text-xs uppercase tracking-[0.14em] text-white/35">
                    Jour courant
                  </div>

                  <div className="mt-1 text-lg font-semibold">
                    {day}
                  </div>
                </div>
              )}
            </div>

            {!selectedUser ? (
              <nav className="mt-7 flex gap-2 overflow-x-auto">
                {TABS.map((tab) => (
                  <a
                    key={tab.key}
                    href={dashboardHref(
                      {
                        tab: tab.key,
                        date: selectedDate,
                        traffic: trafficFilter,
                        scope:
                          tab.key === "daily"
                            ? "day"
                            : scopeFilter,
                      },
                      providedToken,
                    )}
                    className={activeTab === tab.key ? "shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black" : "shrink-0 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-semibold text-white/60"}
                  >
                    {tab.label}
                  </a>
                ))}
              </nav>
            ) : (
              <a
                href={dashboardHref(
                  {
                    date: selectedDate,
                    traffic: trafficFilter,
                  },
                  providedToken,
                )}
                className="mt-7 inline-flex rounded-full bg-white px-5 py-2 text-sm font-semibold text-black"
              >
                Retour au dashboard
              </a>
            )}
          </div>
        </header>

        {showingDetail ? (
          <section className="mt-4 rounded-[28px] border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                  Période d’activité
                </div>

                <div className="mt-1 text-sm font-semibold">
                  {scopeFilter === "day"
                    ? selectedDateLabel
                    : "Historique total"}
                </div>
              </div>

              <div className="flex items-center gap-1 rounded-full bg-[#f3eee5] p-1">
                {[
                  {
                    key: "day",
                    label: "Journée",
                  },
                  {
                    key: "total",
                    label: "Total",
                  },
                ].map((option) => (
                  <a
                    key={option.key}
                    href={dashboardHref(
                      {
                        tab:
                          selectedUserId
                            ? "users"
                            : "daily",
                        userId:
                          selectedUserId ||
                          undefined,
                        sessionId:
                          selectedSessionId ||
                          undefined,
                        date:
                          selectedDate,
                        traffic:
                          trafficFilter,
                        scope:
                          option.key,
                      },
                      providedToken,
                    )}
                    className={
                      scopeFilter ===
                      option.key
                        ? "rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
                        : "rounded-full px-4 py-2 text-xs font-semibold text-black/45"
                    }
                  >
                    {option.label}
                  </a>
                ))}
              </div>
            </div>

            {scopeFilter === "day" ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/7 pt-4">
                <a
                  href={dashboardHref(
                    {
                      tab:
                        selectedUserId
                          ? "users"
                          : "daily",
                      userId:
                        selectedUserId ||
                        undefined,
                      sessionId:
                        selectedSessionId ||
                        undefined,
                      date:
                        previousDate,
                      traffic:
                        trafficFilter,
                      scope: "day",
                    },
                    providedToken,
                  )}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3eee5] text-sm font-semibold"
                  aria-label="Jour précédent"
                >
                  ←
                </a>

                <form
                  method="get"
                  action="/indie-analytics"
                  className="flex flex-wrap items-center gap-2"
                >
                  <input
                    type="hidden"
                    name="tab"
                    value={
                      selectedUserId
                        ? "users"
                        : "daily"
                    }
                  />

                  {selectedUserId ? (
                    <input
                      type="hidden"
                      name="userId"
                      value={selectedUserId}
                    />
                  ) : null}

                  {selectedSessionId ? (
                    <input
                      type="hidden"
                      name="sessionId"
                      value={selectedSessionId}
                    />
                  ) : null}

                  <input
                    type="hidden"
                    name="traffic"
                    value={trafficFilter}
                  />

                  <input
                    type="hidden"
                    name="scope"
                    value="day"
                  />

                  <input
                    type="hidden"
                    name="token"
                    value={providedToken}
                  />

                  <input
                    type="date"
                    name="date"
                    defaultValue={selectedDate}
                    className="rounded-xl border border-black/10 bg-[#faf7f0] px-3 py-2 text-sm font-semibold"
                  />

                  <button
                    type="submit"
                    className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white"
                  >
                    Afficher
                  </button>
                </form>

                <a
                  href={dashboardHref(
                    {
                      tab:
                        selectedUserId
                          ? "users"
                          : "daily",
                      userId:
                        selectedUserId ||
                        undefined,
                      sessionId:
                        selectedSessionId ||
                        undefined,
                      date:
                        nextDate,
                      traffic:
                        trafficFilter,
                      scope: "day",
                    },
                    providedToken,
                  )}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3eee5] text-sm font-semibold"
                  aria-label="Jour suivant"
                >
                  →
                </a>
              </div>
            ) : null}
          </section>
        ) : null}

        {!showingDetail ? (
          <section className="mt-4 rounded-[28px] border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                  Trafic
                </div>

                {[
                  {
                    key: "external",
                    label: "Réel",
                  },
                  {
                    key: "test",
                    label: "Tests",
                  },
                  {
                    key: "all",
                    label: "Tout",
                  },
                ].map((option) => (
                  <a
                    key={option.key}
                    href={dashboardHref(
                      {
                        tab: activeTab,
                        date: selectedDate,
                        traffic: option.key,
                        scope:
                          activeTab === "daily"
                            ? "day"
                            : scopeFilter,
                        section: activeSection,
                      },
                      providedToken,
                    )}
                    className={
                      trafficFilter ===
                      option.key
                        ? "rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
                        : "rounded-full bg-[#f3eee5] px-4 py-2 text-xs font-semibold text-black/45 transition hover:text-black"
                    }
                  >
                    {option.label}
                  </a>
                ))}
              </div>

              {activeTab !== "daily" ? (
                <div className="flex items-center gap-1 rounded-full bg-[#f3eee5] p-1">
                  {[
                    {
                      key: "day",
                      label: "Journée",
                    },
                    {
                      key: "total",
                      label: "Total",
                    },
                  ].map((option) => (
                    <a
                      key={option.key}
                      href={dashboardHref(
                        {
                          tab: activeTab,
                          date: selectedDate,
                          traffic:
                            trafficFilter,
                          scope: option.key,
                          section:
                            activeSection,
                        },
                        providedToken,
                      )}
                      className={
                        scopeFilter ===
                        option.key
                          ? "rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
                          : "rounded-full px-4 py-2 text-xs font-semibold text-black/45"
                      }
                    >
                      {option.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>

            {activeTab !== "daily" &&
            scopeFilter === "day" ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <a
                  href={dashboardHref(
                    {
                      tab: activeTab,
                      date:
                        previousDate,
                      traffic:
                        trafficFilter,
                      scope: "day",
                      section:
                        activeSection,
                    },
                    providedToken,
                  )}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3eee5] text-sm font-semibold"
                >
                  ←
                </a>

                <div className="rounded-xl bg-[#faf7f0] px-4 py-2 text-sm font-semibold">
                  {selectedDateLabel}
                </div>

                <a
                  href={dashboardHref(
                    {
                      tab: activeTab,
                      date: nextDate,
                      traffic:
                        trafficFilter,
                      scope: "day",
                      section:
                        activeSection,
                    },
                    providedToken,
                  )}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3eee5] text-sm font-semibold"
                >
                  →
                </a>
              </div>
            ) : null}

            <nav className="mt-4 flex gap-2 overflow-x-auto border-t border-black/7 pt-4">
              {sectionOptions.map(
                (section) => (
                  <a
                    key={section.key}
                    href={dashboardHref(
                      {
                        tab: activeTab,
                        date: selectedDate,
                        traffic:
                          trafficFilter,
                        scope:
                          activeTab === "daily"
                            ? "day"
                            : scopeFilter,
                        section:
                          section.key,
                      },
                      providedToken,
                    )}
                    className={
                      activeSection ===
                      section.key
                        ? "shrink-0 rounded-full bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white"
                        : "shrink-0 rounded-full bg-[#f3eee5] px-4 py-2 text-xs font-semibold text-black/50 transition hover:text-black"
                    }
                  >
                    {section.label}
                  </a>
                ),
              )}
            </nav>
          </section>
        ) : null}

        {selectedSessionId ? (
          <div className="mt-6 space-y-6">
            <section className="rounded-[30px] border border-black/10 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-sm text-black/45">
                    Installation / navigateur
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-semibold">
                      {selectedSessionInstallation?.label ||
                        maskAnalyticsId(
                          selectedSessionId,
                        )}
                    </h2>

                    {selectedSessionInstallation?.trafficClass ===
                    "test" ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-800">
                        Test
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#f3eee5] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-black/45">
                        Réel
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-sm text-black/50">
                    {selectedSessionUser
                      ? `Compte associé : ${selectedSessionUser.displayName || selectedSessionUser.username}`
                      : "Utilisation anonyme · aucun compte associé"}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {[
                      selectedSessionInstallation?.platform ||
                        selectedSessionPresence?.platform,
                      selectedSessionInstallation?.deviceType,
                      selectedSessionInstallation?.os,
                      selectedSessionInstallation?.browser,
                      selectedSessionInstallation?.clientTimeZone ||
                        selectedSessionPresence?.clientTimeZone,
                    ]
                      .filter(Boolean)
                      .map((value) => (
                        <span
                          key={String(value)}
                          className="rounded-full bg-[#f3eee5] px-3 py-1 text-black/55"
                        >
                          {value}
                        </span>
                      ))}
                  </div>

                  {selectedSessionInstallation ? (
                    <div className="mt-4 text-xs leading-relaxed text-black/40">
                      Première utilisation :{" "}
                      <strong className="text-black/60">
                        {selectedSessionInstallation.firstSeenAt
                          .toISOString()
                          .slice(0, 10)}
                      </strong>
                      {" · "}
                      Dernière utilisation :{" "}
                      <strong className="text-black/60">
                        {selectedSessionInstallation.lastSeenAt
                          .toISOString()
                          .slice(0, 10)}
                      </strong>
                    </div>
                  ) : null}
                </div>

                <a
                  href={dashboardHref(
                    {
                      tab: "daily",
                      date: selectedDate,
                      traffic: trafficFilter,
                    },
                    providedToken,
                  )}
                  className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"
                >
                  Retour à la journée
                </a>
              </div>

              <div className="mt-6 overflow-hidden rounded-[24px] border border-black/10">
                <div className="grid grid-cols-[1fr_90px_90px] gap-3 bg-black px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-white/55">
                  <div>Activité</div>
                  <div className="text-right">
                    {selectedDate.slice(8, 10)}/
                    {selectedDate.slice(5, 7)}
                  </div>
                  <div className="text-right">
                    Total
                  </div>
                </div>

                {[
                  {
                    label: "Ouvertures exactes",
                    day: selectedSessionDayStats.openings,
                    total: selectedSessionTotalStats.openings,
                  },
                  {
                    label: "Actions",
                    day: selectedSessionDayStats.actions,
                    total: selectedSessionTotalStats.actions,
                  },
                  {
                    label: "Fiches consultées",
                    day: selectedSessionDayStats.views,
                    total: selectedSessionTotalStats.views,
                  },
                  {
                    label: "Recherches",
                    day: selectedSessionDayStats.searches,
                    total: selectedSessionTotalStats.searches,
                  },
                  {
                    label: "Favoris ajoutés",
                    day: selectedSessionDayStats.saves,
                    total: selectedSessionTotalStats.saves,
                  },
                  {
                    label: "Ajouts en liste",
                    day: selectedSessionDayStats.lists,
                    total: selectedSessionTotalStats.lists,
                  },
                  {
                    label: "Sites ouverts",
                    day: selectedSessionDayStats.websites,
                    total: selectedSessionTotalStats.websites,
                  },
                  {
                    label: "Itinéraires",
                    day: selectedSessionDayStats.itineraries,
                    total: selectedSessionTotalStats.itineraries,
                  },
                  {
                    label: "Partages initiés",
                    day: selectedSessionDayStats.shares,
                    total: selectedSessionTotalStats.shares,
                  },
                  {
                    label: "Visites déclarées",
                    day: selectedSessionDayStats.visits,
                    total: selectedSessionTotalStats.visits,
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-[1fr_90px_90px] gap-3 border-b border-black/7 px-4 py-3 text-sm last:border-b-0"
                  >
                    <div className="text-black/60">
                      {row.label}
                    </div>

                    <div
                      className={
                        scopeFilter === "day"
                          ? "rounded-lg bg-[#DBEAFE] px-2 py-1 text-right font-semibold text-[#1D4ED8]"
                          : "px-2 py-1 text-right font-semibold text-black/35"
                      }
                    >
                      {row.day}
                    </div>

                    <div
                      className={
                        scopeFilter === "total"
                          ? "rounded-lg bg-[#DBEAFE] px-2 py-1 text-right font-semibold text-[#1D4ED8]"
                          : "px-2 py-1 text-right font-semibold text-black/35"
                      }
                    >
                      {row.total}
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-xs leading-relaxed text-black/35">
                Les ouvertures exactes sont comptées avec
                launch_started et commencent donc à partir de
                l’activation de ce nouveau suivi. Les autres
                actions conservent leur historique antérieur.
              </p>
            </section>

            {panel(
              "Historique par journée",
              selectedSessionHistory.length === 0
                ? empty(
                    "Aucune activité quotidienne enregistrée.",
                  )
                : (
                  <div className="overflow-x-auto rounded-2xl border border-black/10">
                    <div className="min-w-[800px]">
                      <div className="grid grid-cols-[110px_repeat(6,1fr)] gap-2 bg-black px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/55">
                        <div>Date</div>
                        <div className="text-right">Ouvertures</div>
                        <div className="text-right">Actions</div>
                        <div className="text-right">Fiches</div>
                        <div className="text-right">Recherches</div>
                        <div className="text-right">Favoris</div>
                        <div className="text-right">Visites</div>
                      </div>

                      {selectedSessionHistory.map(
                        (row) => (
                          <a
                            key={row.date}
                            href={dashboardHref(
                              {
                                sessionId:
                                  selectedSessionId,
                                date: row.date,
                                traffic:
                                  trafficFilter,
                              },
                              providedToken,
                            )}
                            className={
                              row.date === selectedDate
                                ? "grid grid-cols-[110px_repeat(6,1fr)] gap-2 border-b border-black/7 bg-[#f3eee5] px-4 py-3 text-sm last:border-b-0"
                                : "grid grid-cols-[110px_repeat(6,1fr)] gap-2 border-b border-black/7 px-4 py-3 text-sm transition last:border-b-0 hover:bg-[#faf7f0]"
                            }
                          >
                            <div className="font-semibold">
                              {row.date}
                            </div>
                            <div className="text-right">
                              {row.openings}
                            </div>
                            <div className="text-right">
                              {row.actions}
                            </div>
                            <div className="text-right">
                              {row.views}
                            </div>
                            <div className="text-right">
                              {row.searches}
                            </div>
                            <div className="text-right">
                              {row.saves}
                            </div>
                            <div className="text-right">
                              {row.visits}
                            </div>
                          </a>
                        ),
                      )}
                    </div>
                  </div>
                ),
              "Clique sur une journée pour comparer son activité avec le total historique de cette installation.",
            )}

            {panel(
              scopeFilter === "day"
                ? "Fiches consultées cette journée"
                : "Tout ce que cette installation a consulté",
              selectedSessionPlaces.length === 0
                ? empty(
                    "Aucune fiche de lieu consultée.",
                  )
                : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {selectedSessionPlaces.map(
                      (item) => (
                        <div
                          key={item.placeId}
                          className="rounded-2xl border border-black/10 bg-[#faf7f0] p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold">
                                {placeName(
                                  placeMap,
                                  item.placeId,
                                )}
                              </div>

                              <div className="mt-1 text-xs text-black/45">
                                {[
                                  placeMap.get(
                                    item.placeId,
                                  )?.category,
                                  placeCity(
                                    placeMap,
                                    item.placeId,
                                  ),
                                ]
                                  .filter(Boolean)
                                  .join(" · ") ||
                                  "—"}
                              </div>
                            </div>

                            <div className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
                              {item.count} vue
                              {item.count > 1
                                ? "s"
                                : ""}
                            </div>
                          </div>

                          <div className="mt-3 text-xs text-black/40">
                            Dernière consultation :{" "}
                            {localTimeLabel(
                              item.lastViewedAt,
                              item.timeZone,
                            )}
                            {" · "}
                            {item.lastViewedAt
                              .toISOString()
                              .slice(0, 10)}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                ),
              "Toutes les fiches ouvertes depuis cette installation, avec ou sans compte.",
            )}

            {panel(
              scopeFilter === "day"
                ? "Actions de cette installation · journée"
                : "Actions de cette installation · total",
              selectedSessionEventTypes.length === 0
                ? empty(
                    "Aucune action enregistrée.",
                  )
                : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {selectedSessionEventTypes.map(
                      (row) => (
                        <div key={row.eventType}>
                          {progressRow(
                            eventLabel(
                              row.eventType,
                            ),
                            row._count._all,
                            maxSelectedSessionEventCount,
                          )}
                        </div>
                      ),
                    )}
                  </div>
                ),
            )}

            {panel(
              scopeFilter === "day"
                ? "Recherches de la journée"
                : "Recherches · total",
              selectedSessionSearchEvents.length === 0
                ? empty(
                    "Aucune recherche enregistrée.",
                  )
                : (
                  <div className="grid gap-2">
                    {selectedSessionSearchEvents.map(
                      (event) => (
                        <div
                          key={event.id}
                          className="grid gap-2 rounded-2xl border border-black/10 bg-[#faf7f0] p-4 text-sm md:grid-cols-[110px_1fr_140px]"
                        >
                          <div className="font-semibold">
                            {localTimeLabel(
                              event.createdAt,
                              event.clientTimeZone,
                            )}
                          </div>

                          <div>
                            {metadataText(
                              event.metadata,
                              "query",
                            ) || "—"}
                          </div>

                          <div className="text-black/45">
                            {event.city ||
                              metadataText(
                                event.metadata,
                                "detectedCity",
                              ) ||
                              "—"}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                ),
            )}

            {panel(
              scopeFilter === "day"
                ? "Historique de la journée"
                : "Historique récent",
              selectedSessionRecentEvents.length === 0
                ? empty(
                    "Aucun événement.",
                  )
                : (
                  <div className="grid gap-2">
                    {selectedSessionRecentEvents.map(
                      (event) => (
                        <div
                          key={event.id}
                          className="grid gap-2 rounded-2xl border border-black/10 bg-[#faf7f0] p-4 text-sm md:grid-cols-[110px_190px_1fr]"
                        >
                          <div className="font-semibold">
                            {localTimeLabel(
                              event.createdAt,
                              event.clientTimeZone,
                            )}
                          </div>

                          <div className="font-semibold">
                            {eventLabel(
                              event.eventType,
                            )}
                          </div>

                          <div>
                            {event.placeId
                              ? placeName(
                                  placeMap,
                                  event.placeId,
                                )
                              : event.eventType ===
                                  "search_ai_used"
                                ? metadataText(
                                    event.metadata,
                                    "query",
                                  ) || "—"
                                : "—"}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                ),
              "Les 300 actions les plus récentes sont affichées ici ; la liste complète des lieux consultés ci-dessus n'est pas limitée.",
            )}
          </div>
        ) : selectedUser ? (
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
                {metric("Appareils", selectedUser.pushDevices.length, selectedUser.pushDevices.map((device) => device.platform).join(", ") || "aucun appareil")}
                {metric(
                  "Événements",
                  selectedUserScopedEventCount,
                  scopeFilter === "day"
                    ? selectedDateLabel
                    : "historique total",
                )}
              </div>
            </section>

            {panel(
              "Appareils de cet utilisateur",
              selectedUser.pushDevices.length === 0 ? empty("Aucun appareil enregistré.") : (
                <div className="grid gap-3 md:grid-cols-2">
                  {selectedUser.pushDevices.map((device) => (
                    <div key={device.id} className="rounded-2xl border border-black/10 bg-[#faf7f0] p-4">
                      <div className="text-lg font-semibold text-black">{device.platform}</div>
                      <div className="mt-1 text-xs text-black/45">Dernière mise à jour : {device.updatedAt.toISOString().replace("T", " ").slice(0, 16)}</div>
                    </div>
                  ))}
                </div>
              )
            )}

            {panel(
              scopeFilter === "day"
                ? "Actions de cet utilisateur · journée"
                : "Actions de cet utilisateur · total",
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
              scopeFilter === "day"
                ? "Sources des vues fiche · journée"
                : "Sources des vues fiche · total",
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
              scopeFilter === "day"
                ? "Événements de la journée"
                : "Derniers événements",
              selectedUserScopedEvents.length === 0 ? empty("Aucun événement sur cette période.") : (
                <div className="grid gap-2">
                  {selectedUserScopedEvents.slice(0, 40).map((event) => (
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
            {activeTab === "daily" ? (
              <>
                <div className={
                  activeSection === "summary"
                    ? "space-y-6"
                    : "hidden"
                }>




                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {metric(
                    "Installations actives",
                    dailyActors.length,
                    "avec ou sans compte",
                    "dark",
                  )}

                  {metric(
                    "Nouvelles",
                    dailyNewInstallations,
                    "première utilisation ce jour",
                  )}

                  {metric(
                    "De retour",
                    dailyReturningInstallations,
                    "déjà vues avant cette journée",
                  )}

                  {metric(
                    "Ouvertures exactes",
                    dailyExactOpenings,
                    "depuis le nouveau suivi",
                  )}

                  {metric(
                    "Avec compte",
                    dailyWithAccount,
                    "installations associées à un compte",
                  )}

                  {metric(
                    "Sans compte",
                    dailyWithoutAccount,
                    "installations anonymes",
                  )}

                  {metric(
                    "Actions",
                    dailyActionCount,
                    "hors ouvertures Indie Map",
                  )}

                  {metric(
                    "Fiches consultées",
                    dailyViewEvents.length,
                    "ouvertures de fiches",
                  )}

                  {metric(
                    "Recherches",
                    dailySearchEvents.length,
                    "requêtes enregistrées",
                  )}

                  {metric(
                    "Favoris ajoutés",
                    dailySaveEvents.length,
                    "événements save_place",
                  )}

                  {metric(
                    "Visites déclarées",
                    dailyVisitedEvents.length,
                    "déclarations explicites",
                  )}

                  {metric(
                    "Intentions fortes",
                    dailyStrongIntentEvents.length,
                    "site · itinéraire · téléphone · adresse",
                  )}
                </div>

                <div className="grid gap-6 xl:grid-cols-3">
                  <AnalyticsLineChart
                    title="Ouvertures par heure"
                    subtitle="Rythme d’ouverture d’Indie Map"
                    points={dailyOpeningsByHour}
                    colorIndex={0}
                    eventLabel="Ouvertures Indie Map"
                  />

                  <AnalyticsLineChart
                    title="Fiches vues par heure"
                    subtitle="Consultations réelles de lieux"
                    points={dailyViewsByHour}
                    colorIndex={1}
                    eventLabel="Fiches consultées"
                  />

                  <AnalyticsLineChart
                    title="Recherches par heure"
                    subtitle="Requêtes effectuées"
                    points={dailySearchesByHour}
                    colorIndex={2}
                    eventLabel="Recherches"
                  />
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  {panel(
                    "Nouveaux / de retour",
                    <AnalyticsDonut
                      title="Installations"
                      subtitle="Première utilisation ou installation déjà connue"
                      segments={[
                        {
                          label: "Nouvelles",
                          value:
                            dailyNewInstallations,
                        },
                        {
                          label: "De retour",
                          value:
                            dailyReturningInstallations,
                        },
                      ]}
                    />,
                  )}

                  {panel(
                    "Compte / anonyme",
                    <AnalyticsDonut
                      title="Type d’utilisation"
                      subtitle="Installations associées ou non à un compte"
                      segments={[
                        {
                          label: "Avec compte",
                          value:
                            dailyWithAccount,
                        },
                        {
                          label: "Sans compte",
                          value:
                            dailyWithoutAccount,
                        },
                      ]}
                    />,
                  )}
                </div>


                </div>
                {activeSection === "activity" ? panel(
                  "Lieux consultés par heure",
                  viewedPlacesByHour.length === 0
                    ? empty(
                        "Aucune fiche de lieu consultée cette journée.",
                      )
                    : (
                      <div className="overflow-hidden rounded-2xl border border-black/10">
                        <div className="hidden grid-cols-[110px_190px_1fr] gap-4 bg-black px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-white/55 md:grid">
                          <div>Horaire</div>
                          <div>Consultations</div>
                          <div>Lieux consultés</div>
                        </div>

                        {viewedPlacesByHour.map(
                          (row) => {
                            const width =
                              Math.max(
                                7,
                                Math.round(
                                  (
                                    row.total /
                                    maxViewedPlacesPerHour
                                  ) * 100,
                                ),
                              );

                            return (
                              <div
                                key={row.hour}
                                className="grid gap-3 border-b border-black/8 px-4 py-4 last:border-b-0 md:grid-cols-[110px_190px_1fr] md:items-center"
                              >
                                <div>
                                  <div className="font-semibold">
                                    {String(row.hour).padStart(2, "0")}h
                                    {" – "}
                                    {String(
                                      (row.hour + 1) % 24,
                                    ).padStart(2, "0")}h
                                  </div>
                                </div>

                                <div>
                                  <div className="mb-2 text-xs text-black/45">
                                    {row.total} fiche
                                    {row.total > 1 ? "s" : ""}
                                  </div>

                                  <div className="h-2.5 overflow-hidden rounded-full bg-black/8">
                                    <div
                                      className="h-full rounded-full bg-black"
                                      style={{
                                        width: `${width}%`,
                                      }}
                                    />
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  {row.places.map(
                                    (place) => (
                                      <div
                                        key={place.placeId}
                                        className="rounded-xl bg-[#faf7f0] px-3 py-2"
                                      >
                                        <div className="text-sm font-semibold">
                                          {place.name}
                                          {place.count > 1
                                            ? ` ×${place.count}`
                                            : ""}
                                        </div>

                                        <div className="mt-0.5 text-xs text-black/40">
                                          {[
                                            place.category,
                                            place.city,
                                          ]
                                            .filter(Boolean)
                                            .join(" · ") ||
                                            "—"}
                                        </div>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            );
                          },
                        )}
                      </div>
                    ),
                  "Toutes les fiches réellement ouvertes : carte, recherche, ajouts récents, listes, favoris, amis, etc.",
                ) : null}

                {activeSection === "geography"
                  ? panel(
                      "Connexions de la journée",
                      dailyConnectionRows.length === 0
                        ? empty(
                            "Aucune localisation de connexion enregistrée.",
                          )
                        : (
                            <div className="grid gap-6 xl:grid-cols-2">
                              <AnalyticsBars
                                title="Utilisateurs par ville"
                                subtitle="Installations uniques ayant ouvert Indie Map"
                                rows={dailyConnectionRows.map(
                                  (row) => ({
                                    label:
                                      [
                                        row.city,
                                        row.country,
                                      ]
                                        .filter(Boolean)
                                        .join(" · "),
                                    value:
                                      row.users,
                                    hint:
                                      `${row.openings} ouverture${
                                        row.openings > 1
                                          ? "s"
                                          : ""
                                      }`,
                                  }),
                                )}
                              />

                              <div className="grid gap-2">
                                {dailyConnectionRows.map(
                                  (row) => (
                                    <div
                                      key={`${row.city}-${row.country || ""}`}
                                      className="grid grid-cols-[1fr_auto_auto] gap-4 rounded-2xl bg-[#faf7f0] px-4 py-3 text-sm"
                                    >
                                      <div className="font-semibold">
                                        {row.city}
                                        {row.country
                                          ? ` · ${row.country}`
                                          : ""}
                                      </div>

                                      <div className="text-right">
                                        <strong>
                                          {row.users}
                                        </strong>{" "}
                                        util.
                                      </div>

                                      <div className="text-right text-black/45">
                                        {row.openings} ouv.
                                      </div>
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                          ),
                      "La ville vient des ouvertures Indie Map enregistrées par DailySession, jamais de la ville du lieu consulté.",
                    )
                  : null}

                {activeSection === "users" ? panel(
                  "Utilisateurs / installations de la journée",
                  dailyActors.length === 0
                    ? empty(
                        "Aucune installation enregistrée cette journée.",
                      )
                    : (
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {dailyActors.map((actor) => {
                          const installation =
                            actor.installation;

                          const isNew =
                            installation?.firstSeenDate ===
                            selectedDate;

                          const title =
                            installation?.accountName ||
                            installation?.label ||
                            (
                              actor.userId
                                ? "Compte connecté"
                                : "Utilisateur sans compte"
                            );

                          const secondary = [
                            actor.userId
                              ? "Compte"
                              : "Sans compte",
                            installation?.deviceType ||
                              actor.platform,
                            installation?.os,
                          ]
                            .filter(Boolean)
                            .join(" · ");

                          return (
                            <a
                              key={actor.sessionId}
                              href={dashboardHref(
                                {
                                  sessionId:
                                    actor.sessionId,
                                  date:
                                    selectedDate,
                                  traffic:
                                    trafficFilter,
                                },
                                providedToken,
                              )}
                              className="group flex min-h-[86px] items-center justify-between gap-4 rounded-[20px] border border-black/10 bg-[#faf7f0] px-4 py-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="truncate font-semibold text-black">
                                    {title}
                                  </div>

                                  {installation?.trafficClass ===
                                  "test" ? (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-amber-800">
                                      Test
                                    </span>
                                  ) : null}
                                </div>

                                <div className="mt-1 truncate text-xs text-black/40">
                                  {secondary || "—"}
                                  {" · "}
                                  {maskAnalyticsId(
                                    actor.sessionId,
                                  )}
                                </div>

                                <div className="mt-1 truncate text-xs font-medium text-[#2563EB]">
                                  {[
                                    actor.city,
                                    actor.country,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ") ||
                                    "Localisation de connexion inconnue"}
                                </div>
                              </div>

                              <div
                                className={
                                  isNew
                                    ? "shrink-0 rounded-full bg-black px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white"
                                    : "shrink-0 rounded-full bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-black/45"
                                }
                              >
                                {isNew
                                  ? "Nouveau"
                                  : "De retour"}
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    ),
                  "Clique sur un utilisateur pour afficher toute son activité, ses ouvertures et son historique détaillé.",
                ) : null}

                {activeSection === "details" ? (
                  <>
                <div className="grid gap-6 xl:grid-cols-2">
                  {panel(
                    "Lieux les plus consultés",
                    dailyTopPlaces.length === 0
                      ? empty("Aucune fiche consultée.")
                      : (
                        <div className="grid gap-3">
                          {dailyTopPlaces.map((row) => (
                            <div key={row.placeId}>
                              {progressRow(
                                placeName(placeMap, row.placeId),
                                row.count,
                                Math.max(
                                  1,
                                  ...dailyTopPlaces.map((item) => item.count),
                                ),
                                placeCity(placeMap, row.placeId) || "—",
                              )}
                            </div>
                          ))}
                        </div>
                      ),
                  )}

                  {panel(
                    "Recherches de la journée",
                    dailySearchEvents.length === 0
                      ? empty("Aucune recherche cette journée.")
                      : (
                        <div className="grid gap-2">
                          {dailySearchEvents.map((event) => (
                            <div
                              key={event.id}
                              className="rounded-2xl border border-black/10 bg-[#faf7f0] p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="font-semibold">
                                    {metadataText(event.metadata, "query") || "—"}
                                  </div>

                                  <div className="mt-1 text-xs text-black/45">
                                    {event.category ||
                                      metadataFirstText(event.metadata, "targetCategories") ||
                                      metadataText(event.metadata, "explicitCategory") ||
                                      "catégorie non détectée"}
                                  </div>
                                </div>

                                <div className="text-right">
                                  <div className="font-semibold">
                                    {localTimeLabel(
                                      event.createdAt,
                                      event.clientTimeZone,
                                    )}
                                  </div>

                                  <div className="mt-1 text-xs text-black/40">
                                    {metadataNumber(event.metadata, "resultsCount") ?? "—"} résultat(s)
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ),
                  )}
                </div>

                {panel(
                  "Timeline complète de la journée",
                  dailyTimeline.length === 0
                    ? empty("Aucune activité enregistrée cette journée.")
                    : (
                      <div className="grid gap-2">
                        {dailyTimeline.map((item) => (
                          <div
                            key={item.key}
                            className="grid gap-2 rounded-2xl border border-black/10 bg-[#faf7f0] p-4 text-sm md:grid-cols-[105px_150px_1fr_130px_150px]"
                          >
                            <div>
                              <div className="font-semibold">
                                {item.localTime}
                              </div>

                              <div className="mt-0.5 text-[10px] text-black/35">
                                {item.timeZone}
                              </div>
                            </div>

                            <div className="font-semibold">
                              {item.label}
                            </div>

                            <div className="min-w-0">
                              <div className="truncate">
                                {item.detail}
                              </div>

                              <div className="mt-0.5 text-xs text-black/35">
                                {item.kind === "launch"
                                  ? "connexion / ouverture"
                                  : "action"}
                              </div>
                            </div>

                            <div className="text-black/45">
                              {item.platform}
                            </div>

                            <div className="font-mono text-xs text-black/40">
                              {item.sessionId ? (
                                <a
                                  href={dashboardHref(
                                    {
                                      sessionId:
                                        item.sessionId,
                                      date:
                                        selectedDate,
                                    },
                                    providedToken,
                                  )}
                                  className="underline decoration-black/20 underline-offset-2 hover:text-black"
                                >
                                  {item.secondary}
                                </a>
                              ) : (
                                item.secondary
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ),
                  "Les identifiants d’installation sont volontairement masqués. Les lignes « Ouverture » utilisent la géolocalisation approximative du heartbeat ; la ville d’une fiche n’est jamais présentée comme la localisation de l’utilisateur.",
                )}

                  </>
                ) : null}
              </>
            ) : null}

            {activeTab === "overview" ? (
              <>
                <div className={
                  activeSection === "summary"
                    ? "grid gap-6 xl:grid-cols-2"
                    : "hidden"
                }>
                  {panel(
                    "Répartition des sources",
                    <AnalyticsDonut
                      title="Origine des vues fiche"
                      subtitle="Ce qui conduit à l’ouverture d’un lieu"
                      segments={overviewSourceSegments}
                    />,
                  )}

                  {panel(
                    "Géographie active",
                    <AnalyticsBars
                      title="Principales villes"
                      subtitle="Présence enregistrée aujourd’hui"
                      rows={overviewCityBars}
                    />,
                  )}
                </div>

                {activeSection === "summary" ? (
                  <>
<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {metric("Actifs maintenant", active5, "présence 5 min", "dark")}
                  {metric("Actifs 15 min", active15, "fenêtre élargie")}
                  {metric(
                    scopeFilter === "day"
                      ? "Installations de la journée"
                      : "Installations suivies",
                    dau,
                    scopeFilter === "day"
                      ? selectedDateLabel
                      : "historique total",
                  )}

                  {metric(
                    scopeFilter === "day"
                      ? "Ouvertures de la journée"
                      : "Ouvertures totales",
                    sessions,
                    scopeFilter === "day"
                      ? selectedDateLabel
                      : "depuis le nouveau suivi",
                  )}
                  {metric("Comptes", usersCount, `${usersWithEmailCount} avec email`)}
                  {metric("Anonymes suivis", anonymousEventSessions.length, "via im_session_id")}
                  {metric("Événements", eventsCount, "clics et vues")}
                  {metric("Listes partagées", sharedListsCount, `${sharedListPlacesCount} lieux ajoutés`)}
                </div>

                                  </>
                ) : null}

                <div className="grid gap-6 xl:grid-cols-2">
                  {activeSection === "activity" ? panel(
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
                  ) : null}

                  {activeSection === "geography" ? panel(
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
                  ) : null}

                  {activeSection === "sources" ? panel(
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
                  ) : null}
                </div>
              </>
            ) : null}

            {activeTab === "actions" ? (
              <>
                <div className={
                  activeSection === "summary"
                    ? "grid gap-6 xl:grid-cols-2"
                    : "hidden"
                }>
                  {panel(
                    "Lecture des comportements",
                    <AnalyticsDonut
                      title="Grandes familles d’actions"
                      subtitle="Vue synthétique ; le détail complet reste affiché dessous"
                      segments={groupedActionSegments}
                    />,
                  )}

                  {panel(
                    "Actions dominantes",
                    <AnalyticsBars
                      title="Top des événements"
                      subtitle="Interactions les plus fréquentes"
                      rows={actionTypeBars}
                    />,
                  )}
                </div>

                {activeSection === "events" ? panel(
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
                ) : null}

                {activeSection === "origins" ? panel(
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
                ) : null}

                {activeSection === "search" ? panel(
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
                ) : null}
              </>
            ) : null}

            {activeTab === "places" ? (
              <>
                <div className={
                  activeSection === "summary"
                    ? "grid gap-6 xl:grid-cols-2"
                    : "hidden"
                }>
                  {panel(
                    "Consultations",
                    <AnalyticsBars
                      title="Lieux les plus consultés"
                      subtitle="Ouvertures réelles de fiche"
                      rows={placeViewBars}
                    />,
                  )}

                  {panel(
                    "Visibilité en recherche",
                    <AnalyticsBars
                      title="Lieux les plus affichés"
                      subtitle="Résultats réellement visibles dans les recherches"
                      rows={placeSearchBars}
                    />,
                  )}
                </div>

                <div className={
                  activeSection === "ranking"
                    ? "grid gap-6 xl:grid-cols-2"
                    : "hidden"
                }>
                  {panel(
                    "Lieux les plus actifs",
                    eventsByPlace.length === 0
                      ? empty("Aucun lieu suivi pour le moment.")
                      : (
                          <div className="grid gap-3">
                            {eventsByPlace.map((row) => (
                              <div key={row.placeId || "unknown"}>
                                {progressRow(
                                  placeName(
                                    placeMap,
                                    row.placeId,
                                  ),
                                  row._count._all,
                                  maxPlaceCount,
                                  placeCity(
                                    placeMap,
                                    row.placeId,
                                  ) || "—",
                                )}
                              </div>
                            ))}
                          </div>
                        ),
                  )}

                  <div className="grid gap-4">
                    {metric(
                      "Lieux favoris",
                      savedPlacesCount,
                      "tous comptes",
                    )}

                    {metric(
                      "Lieux visités",
                      visitedPlacesCount,
                      "tous comptes",
                    )}

                    {metric(
                      "Lieux en listes",
                      sharedListPlacesCount,
                      "ajouts cumulés",
                    )}
                  </div>
                </div>

                {activeSection === "commercial" ? panel(
                  "Analyse commerciale interne",
                  placeCommercialRows.length === 0
                    ? empty(
                        "Aucune donnée de visibilité disponible.",
                      )
                    : (
                        <div className="grid gap-4">
                          {placeCommercialRows.map((row) => {
                            const consultationGeo =
                              row.geo
                                .filter(
                                  (item) =>
                                    item.eventType ===
                                    "view_place_detail",
                                )
                                .slice(0, 8);

                            const searchGeo =
                              row.geo
                                .filter(
                                  (item) =>
                                    item.eventType ===
                                    "search_result_impression",
                                )
                                .slice(0, 8);

                            return (
                              <div
                                key={row.placeId}
                                className="rounded-[24px] border border-black/10 bg-[#faf7f0] p-5"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                  <div>
                                    <div className="text-lg font-semibold">
                                      {placeName(
                                        placeMap,
                                        row.placeId,
                                      )}
                                    </div>

                                    <div className="mt-1 text-xs text-black/45">
                                      {[
                                        placeMap.get(
                                          row.placeId,
                                        )?.category,
                                        placeCity(
                                          placeMap,
                                          row.placeId,
                                        ),
                                      ]
                                        .filter(Boolean)
                                        .join(" · ") ||
                                        "—"}
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <div className="rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white">
                                      {row.views} consultation
                                      {row.views > 1
                                        ? "s"
                                        : ""}
                                    </div>

                                    <div className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black/60">
                                      {row.searchImpressions} affichage
                                      {row.searchImpressions > 1
                                        ? "s"
                                        : ""}{" "}
                                      recherche
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-5 grid gap-5 xl:grid-cols-2">
                                  <div>
                                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/35">
                                      Consultations · ville × origine
                                    </div>

                                    {consultationGeo.length === 0 ? (
                                      <div className="text-sm text-black/35">
                                        Aucune localisation disponible.
                                      </div>
                                    ) : (
                                      <div className="grid gap-2">
                                        {consultationGeo.map(
                                          (
                                            item,
                                            index,
                                          ) => (
                                            <div
                                              key={`${row.placeId}-view-${item.viewerCity}-${item.source}-${index}`}
                                              className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl bg-white px-3 py-2 text-sm"
                                            >
                                              <div className="min-w-0">
                                                <div className="truncate font-medium">
                                                  {item.viewerCity}
                                                  {item.viewerCountry
                                                    ? ` · ${item.viewerCountry}`
                                                    : ""}
                                                </div>

                                                <div className="mt-0.5 truncate text-[11px] text-black/40">
                                                  {sourceLabel(
                                                    item.source,
                                                  )}
                                                </div>
                                              </div>

                                              <div className="font-semibold">
                                                {item.count}
                                              </div>
                                            </div>
                                          ),
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/35">
                                      Vu dans les résultats de recherche
                                    </div>

                                    {searchGeo.length === 0 ? (
                                      <div className="text-sm text-black/35">
                                        Aucun affichage de recherche géolocalisé.
                                      </div>
                                    ) : (
                                      <div className="grid gap-2">
                                        {searchGeo.map(
                                          (
                                            item,
                                            index,
                                          ) => (
                                            <div
                                              key={`${row.placeId}-search-${item.viewerCity}-${index}`}
                                              className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl bg-white px-3 py-2 text-sm"
                                            >
                                              <div className="truncate font-medium">
                                                {item.viewerCity}
                                                {item.viewerCountry
                                                  ? ` · ${item.viewerCountry}`
                                                  : ""}
                                              </div>

                                              <div className="font-semibold">
                                                {item.count}
                                              </div>
                                            </div>
                                          ),
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ),
                  "Données strictement internes Indie Map. Les consultations croisent la ville estimée de l’utilisateur avec la surface qui a conduit à l’ouverture de la fiche. Les affichages recherche correspondent aux résultats réellement visibles. Les anciens événements peuvent avoir une localisation inconnue.",
                ) : null}
              </>
            ) : null}

            {activeTab === "users" ? (
              <>
                {activeSection === "connections"
                  ? panel(
                      scopeFilter === "day"
                        ? "Connexions de la journée"
                        : "Connexions · historique total",
                      connectionLocations.length === 0
                        ? empty(
                            "Aucune localisation de connexion disponible.",
                          )
                        : (
                            <div className="grid gap-6 xl:grid-cols-2">
                              <AnalyticsBars
                                title="Utilisateurs par ville"
                                subtitle={
                                  scopeFilter === "day"
                                    ? selectedDateLabel
                                    : "Historique complet"
                                }
                                rows={connectionLocations.map(
                                  (row) => ({
                                    label:
                                      [
                                        row.city,
                                        row.country,
                                      ]
                                        .filter(Boolean)
                                        .join(" · "),
                                    value:
                                      row.users,
                                    hint:
                                      `${row.openings} ouverture${
                                        row.openings > 1
                                          ? "s"
                                          : ""
                                      }`,
                                  }),
                                )}
                              />

                              <AnalyticsBars
                                title="Ouvertures par ville"
                                subtitle="Nombre total d’ouvertures Indie Map"
                                rows={connectionLocations.map(
                                  (row) => ({
                                    label:
                                      [
                                        row.city,
                                        row.country,
                                      ]
                                        .filter(Boolean)
                                        .join(" · "),
                                    value:
                                      row.openings,
                                    hint:
                                      `${row.users} installation${
                                        row.users > 1
                                          ? "s"
                                          : ""
                                      }`,
                                  }),
                                )}
                              />
                            </div>
                          ),
                      "Localisation approximative enregistrée lors de l’ouverture de l’application.",
                    )
                  : null}

                <div className={
                  activeSection === "summary"
                    ? "grid gap-6 xl:grid-cols-2"
                    : "hidden"
                }>
                  {panel(
                    "Profil des comptes",
                    <AnalyticsDonut
                      title="Tranches d’âge"
                      subtitle="Informations déclarées dans les profils"
                      segments={userAgeSegments}
                    />,
                  )}

                  {panel(
                    "Répartition géographique",
                    <AnalyticsBars
                      title="Villes associées aux comptes"
                      subtitle="Informations déclarées dans les profils"
                      rows={userCityBars}
                    />,
                  )}
                </div>

                <div className={
                  activeSection === "profiles"
                    ? "grid gap-6 xl:grid-cols-2"
                    : "hidden"
                }>
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

                {activeSection === "accounts" ? panel(
                  "Utilisateurs",
                  users.length === 0 ? empty("Aucun utilisateur.") : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {users.map((user) => (
                        <a key={user.id} href={dashboardHref({ userId: user.id, date: selectedDate }, providedToken)} className="block rounded-[24px] border border-black/10 bg-[#faf7f0] p-5 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-lg font-semibold">{user.displayName || user.username}</div>
                              <div className="mt-1 truncate text-sm text-black/45">@{user.username} · {user.email || "—"}</div>
                            </div>
                            <div className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">{user.preferredLocale || "—"}</div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-white px-3 py-1 text-black/60">{user.homeCity || "ville —"}</span>
                            <span className="rounded-full bg-white px-3 py-1 text-black/60">{ageLabel(user.ageRange)}</span>
                            {user.pushDevices.length === 0 ? (
                              <span className="rounded-full bg-white px-3 py-1 text-black/35">aucun appareil</span>
                            ) : (
                              user.pushDevices.map((device, index) => (
                                <span key={`${user.id}-${device.platform}-${index}`} className="rounded-full bg-black px-3 py-1 text-white">
                                  {device.platform}
                                </span>
                              ))
                            )}
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
                ) : null}
              </>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
