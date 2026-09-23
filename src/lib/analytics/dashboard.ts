import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { type Filters, periodRange } from "./filters";

export const EVENT_NAMES: Record<string, string> = {
  view_place_detail: "Fiche consultée", search_ai_used: "Recherche IA", search_result_impression: "Résultat de recherche affiché",
  click_detail_website: "Clic vers le site", click_detail_itinerary: "Demande d’itinéraire", click_detail_phone: "Clic téléphone",
  save_place: "Favori ajouté", unsave_place: "Favori retiré", add_place_to_shared_list: "Ajout dans une liste", create_shared_list: "Liste créée",
  click_explore_world: "Explorer le monde", click_recent_additions: "Ajouts récents", click_mini_immersion: "Immersion",
  click_mini_more_info: "Plus d’informations", launch_started: "Ouverture", click_detail_share: "Partage initié",
  click_search_result_detail: "Fiche depuis une recherche", click_search_results_map: "Résultats sur la carte",
};
export type Metrics = { actions: number; actors: number; views: number; searches: number; saves: number; intent: number; unknown: number };
export type PlaceStats = { placeId: string; views: number; actors: number; saves: number; lists: number; websites: number; routes: number; phones: number; impressions: number };
export type AccountRow = {
  id: string; username: string; email: string | null; displayName: string; preferredLocale: string;
  homeCity: string | null; ageRange: string | null; createdAt: Date; lastSeenAt: Date | null;
  favorites: number; visited: number; lists: number; actions: number; pushEnabled: boolean;
};
const metrics = Prisma.sql`COUNT(*)::int AS actions,
  COUNT(DISTINCT CASE WHEN e."userId" IS NOT NULL THEN 'u:' || e."userId" WHEN e."sessionId" IS NOT NULL THEN 's:' || e."sessionId" END)::int AS actors,
  COUNT(*) FILTER (WHERE e."eventType" = 'view_place_detail')::int AS views,
  COUNT(*) FILTER (WHERE e."eventType" = 'search_ai_used')::int AS searches,
  COUNT(*) FILTER (WHERE e."eventType" = 'save_place')::int AS saves,
  COUNT(*) FILTER (WHERE e."eventType" IN ('click_detail_website','click_detail_itinerary','click_detail_phone'))::int AS intent,
  COUNT(*) FILTER (WHERE e."userId" IS NULL AND e."sessionId" IS NULL)::int AS unknown`;

export async function loadDashboard(filters: Filters, now = new Date()) {
  const range = periodRange(filters, now);
  const traffic = filters.traffic === "all" ? Prisma.sql`TRUE` : Prisma.sql`COALESCE(ai."trafficClass", 'external') = ${filters.traffic}`;
  const platform = filters.platform === "all" ? Prisma.sql`TRUE` : Prisma.sql`COALESCE(e.platform, ai.platform, 'unknown') = ${filters.platform}`;
  const common = Prisma.sql`${traffic} AND ${platform}`;
  const window = (start: Date | null, end: Date) => Prisma.sql`${start ? Prisma.sql`e."createdAt" >= ${start} AND` : Prisma.empty} e."createdAt" < ${end}`;
  const selected = Prisma.sql`${common} AND ${window(range.start, range.end)}`;
  const join = Prisma.sql`FROM "Event" e LEFT JOIN "AnalyticsInstallation" ai ON ai."sessionId" = e."sessionId"`;
  const userWindow = range.start
    ? Prisma.sql`u."createdAt" >= ${range.start} AND u."createdAt" < ${range.end}`
    : Prisma.sql`u."createdAt" < ${range.end}`;
  const previousUserWindow = range.previousStart && range.previousEnd
    ? Prisma.sql`u."createdAt" >= ${range.previousStart} AND u."createdAt" < ${range.previousEnd}`
    : null;
  const [current, previous, types, trend, places, sources, devices, journal, professionalPlans, trackedAccounts,
    accountOverview, newAccounts, previousNewAccounts, accountCities, accountAges, accountLocales, accounts] = await Promise.all([
    prisma.$queryRaw<Metrics[]>(Prisma.sql`SELECT ${metrics} ${join} WHERE ${selected}`),
    range.previousEnd ? prisma.$queryRaw<Metrics[]>(Prisma.sql`SELECT ${metrics} ${join} WHERE ${common} AND ${window(range.previousStart, range.previousEnd)}`) : Promise.resolve([]),
    prisma.$queryRaw<{eventType: string; count: number; actors: number}[]>(Prisma.sql`SELECT e."eventType", COUNT(*)::int AS count, COUNT(DISTINCT COALESCE('u:' || e."userId", 's:' || e."sessionId"))::int AS actors ${join} WHERE ${selected} GROUP BY e."eventType" ORDER BY count DESC`),
    prisma.$queryRaw<{day: string; actors: number; actions: number}[]>(Prisma.sql`SELECT to_char(e."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, COUNT(DISTINCT COALESCE('u:' || e."userId", 's:' || e."sessionId"))::int AS actors, COUNT(*)::int AS actions ${join} WHERE ${selected} GROUP BY day ORDER BY day DESC LIMIT 90`),
    prisma.$queryRaw<PlaceStats[]>(Prisma.sql`SELECT e."placeId", COUNT(*) FILTER (WHERE e."eventType"='view_place_detail')::int AS views,
      COUNT(DISTINCT COALESCE('u:' || e."userId", 's:' || e."sessionId"))::int AS actors,
      COUNT(*) FILTER (WHERE e."eventType"='save_place')::int AS saves,
      COUNT(*) FILTER (WHERE e."eventType"='add_place_to_shared_list')::int AS lists,
      COUNT(*) FILTER (WHERE e."eventType"='click_detail_website')::int AS websites,
      COUNT(*) FILTER (WHERE e."eventType"='click_detail_itinerary')::int AS routes,
      COUNT(*) FILTER (WHERE e."eventType"='click_detail_phone')::int AS phones,
      COUNT(*) FILTER (WHERE e."eventType"='search_result_impression')::int AS impressions
      ${join} WHERE ${selected} AND e."placeId" IS NOT NULL GROUP BY e."placeId" ORDER BY views DESC, actors DESC`),
    prisma.$queryRaw<{source: string; count: number}[]>(Prisma.sql`SELECT COALESCE(NULLIF(e.metadata->>'source',''), 'unknown') AS source, COUNT(*)::int AS count ${join} WHERE ${selected} AND e."eventType"='view_place_detail' GROUP BY source ORDER BY count DESC`),
    prisma.$queryRaw<{platform: string; actors: number}[]>(Prisma.sql`SELECT COALESCE(e.platform, ai.platform, 'unknown') AS platform, COUNT(DISTINCT COALESCE('u:' || e."userId", 's:' || e."sessionId"))::int AS actors ${join} WHERE ${selected} GROUP BY COALESCE(e.platform, ai.platform, 'unknown') ORDER BY actors DESC`),
    filters.place ? prisma.$queryRaw<{day: string; eventType: string; count: number}[]>(Prisma.sql`SELECT to_char(e."createdAt" AT TIME ZONE 'UTC','YYYY-MM-DD') AS day, e."eventType", COUNT(*)::int AS count ${join} WHERE ${selected} AND e."placeId"=${filters.place} GROUP BY day, e."eventType" ORDER BY day DESC, count DESC LIMIT 200`) : Promise.resolve([]),
    prisma.professionalPlace.groupBy({by: ["plan", "accessStatus"], _count: {_all: true}}),
    prisma.$queryRaw<{count: number}[]>(Prisma.sql`SELECT COUNT(DISTINCT e."userId")::int AS count ${join} WHERE ${selected} AND e."userId" IS NOT NULL`),
    prisma.$queryRaw<{total: number; withEmail: number; completedProfiles: number; active30d: number; pushEnabled: number}[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE u.email IS NOT NULL)::int AS "withEmail",
        COUNT(*) FILTER (WHERE u."profileCompletedAt" IS NOT NULL)::int AS "completedProfiles",
        COUNT(*) FILTER (WHERE u."lastSeenAt" >= ${new Date(+now - 30 * 86_400_000)})::int AS "active30d",
        COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "PushDevice" pd WHERE pd."userId"=u.id)
          OR EXISTS (SELECT 1 FROM "PushInstallation" pi WHERE pi."userId"=u.id))::int AS "pushEnabled"
      FROM "User" u`),
    prisma.$queryRaw<{count: number}[]>(Prisma.sql`SELECT COUNT(*)::int AS count FROM "User" u WHERE ${userWindow}`),
    previousUserWindow
      ? prisma.$queryRaw<{count: number}[]>(Prisma.sql`SELECT COUNT(*)::int AS count FROM "User" u WHERE ${previousUserWindow}`)
      : Promise.resolve([]),
    prisma.$queryRaw<{label: string; count: number}[]>(Prisma.sql`SELECT COALESCE(NULLIF(TRIM(u."homeCity"),''),'Non renseignée') AS label, COUNT(*)::int AS count FROM "User" u GROUP BY label ORDER BY count DESC LIMIT 12`),
    prisma.$queryRaw<{label: string; count: number}[]>(Prisma.sql`SELECT COALESCE(NULLIF(TRIM(u."ageRange"),''),'Non renseignée') AS label, COUNT(*)::int AS count FROM "User" u GROUP BY label ORDER BY count DESC`),
    prisma.$queryRaw<{label: string; count: number}[]>(Prisma.sql`SELECT COALESCE(NULLIF(TRIM(u."preferredLocale"),''),'Non renseignée') AS label, COUNT(*)::int AS count FROM "User" u GROUP BY label ORDER BY count DESC`),
    prisma.$queryRaw<AccountRow[]>(Prisma.sql`
      SELECT u.id, u.username, u.email, u."displayName", u."preferredLocale", u."homeCity", u."ageRange",
        u."createdAt", u."lastSeenAt",
        (SELECT COUNT(*)::int FROM "UserPlace" up WHERE up."userId"=u.id AND up.saved=true) AS favorites,
        (SELECT COUNT(*)::int FROM "UserPlace" up WHERE up."userId"=u.id AND up.visited=true) AS visited,
        ((SELECT COUNT(*)::int FROM "SharedList" sl WHERE sl."ownerId"=u.id) +
         (SELECT COUNT(*)::int FROM "SharedListMember" sm WHERE sm."userId"=u.id))::int AS lists,
        (SELECT COUNT(*)::int FROM "Event" ue WHERE ue."userId"=u.id) AS actions,
        (EXISTS (SELECT 1 FROM "PushDevice" pd WHERE pd."userId"=u.id)
          OR EXISTS (SELECT 1 FROM "PushInstallation" pi WHERE pi."userId"=u.id)) AS "pushEnabled"
      FROM "User" u ORDER BY u."createdAt" DESC LIMIT 100`),
  ]);
  return {range, current: current[0], previous: previous[0] ?? null, types, trend, places, sources, devices, journal,
    professionalPlans, trackedAccounts: trackedAccounts[0].count,
    accountOverview: accountOverview[0], newAccounts: newAccounts[0].count,
    previousNewAccounts: previousNewAccounts[0]?.count,
    accountCities, accountAges, accountLocales, accounts};
}
