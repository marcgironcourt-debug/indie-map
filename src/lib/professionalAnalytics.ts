import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ProfessionalAnalyticsRange =
  | "7d"
  | "30d"
  | "all";

export const PROFESSIONAL_AUDIENCE_MIN_SAMPLE = 10;

type CataloguePlace = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  category: string | null;
  timeZone: string | null;
};

type RawAnalyticsPayload = {
  summary?: Record<string, unknown>;
  daily?: unknown[];
  sources?: unknown[];
  hours?: unknown[];
  weekdays?: unknown[];
};

type RawAnalyticsRow = {
  payload: RawAnalyticsPayload | null;
};

function cleanText(
  value: unknown,
): string | null {
  if (typeof value !== "string") return null;

  const clean = value.trim();

  return clean || null;
}

function safeTimeZone(
  value: unknown,
) {
  const candidate =
    cleanText(value) || "UTC";

  try {
    new Intl.DateTimeFormat(
      "en-US",
      { timeZone: candidate },
    ).format(new Date());

    return candidate;
  } catch {
    return "UTC";
  }
}

function readCataloguePlaces() {
  const filePath =
    path.join(
      process.cwd(),
      "data",
      "places.json",
    );

  const parsed: unknown =
    JSON.parse(
      fs.readFileSync(
        filePath,
        "utf8",
      ),
    );

  if (!Array.isArray(parsed)) {
    return [] as CataloguePlace[];
  }

  return parsed
    .filter(
      (
        item,
      ): item is Record<string, unknown> =>
        Boolean(
          item &&
          typeof item === "object" &&
          !Array.isArray(item),
        ),
    )
    .map(
      (item): CataloguePlace => ({
        id:
          cleanText(item.id) || "",
        name:
          cleanText(item.name) ||
          "Lieu Indie Map",
        city:
          cleanText(item.city),
        country:
          cleanText(item.country),
        category:
          cleanText(item.category),
        timeZone:
          cleanText(item.timeZone),
      }),
    )
    .filter(
      (place) =>
        Boolean(place.id),
    );
}

export function normalizeProfessionalAnalyticsRange(
  value: unknown,
): ProfessionalAnalyticsRange {
  if (value === "7d") return "7d";
  if (value === "all") return "all";

  return "30d";
}

function getRangeStart(
  range: ProfessionalAnalyticsRange,
  now: Date,
) {
  if (range === "all") {
    return null;
  }

  const days =
    range === "7d" ? 7 : 30;

  return new Date(
    now.getTime() -
      days *
        24 *
        60 *
        60 *
        1000,
  );
}

function numberValue(
  value: unknown,
) {
  const number =
    Number(value ?? 0);

  return Number.isFinite(number)
    ? number
    : 0;
}

function normalizeSummary(
  raw: Record<string, unknown> | undefined,
) {
  return {
    views:
      numberValue(raw?.views),

    uniqueVisitors:
      numberValue(
        raw?.uniqueVisitors,
      ),

    repeatVisitors:
      numberValue(
        raw?.repeatVisitors,
      ),

    interestVisitors:
      numberValue(
        raw?.interestVisitors,
      ),

    strongIntentViewers:
      numberValue(
        raw?.strongIntentViewers,
      ),

    visitViewers:
      numberValue(
        raw?.visitViewers,
      ),

    newVisitors:
      raw?.newVisitors === null ||
      raw?.newVisitors === undefined
        ? null
        : numberValue(
            raw.newVisitors,
          ),

    returningVisitors:
      raw?.returningVisitors === null ||
      raw?.returningVisitors === undefined
        ? null
        : numberValue(
            raw.returningVisitors,
          ),

    withAccountVisitors:
      numberValue(
        raw?.withAccountVisitors,
      ),

    anonymousVisitors:
      numberValue(
        raw?.anonymousVisitors,
      ),

    saves:
      numberValue(raw?.saves),

    lists:
      numberValue(raw?.lists),

    shares:
      numberValue(raw?.shares),

    websites:
      numberValue(raw?.websites),

    itineraries:
      numberValue(
        raw?.itineraries,
      ),

    phones:
      numberValue(raw?.phones),

    copiedAddresses:
      numberValue(
        raw?.copiedAddresses,
      ),

    viewOnMap:
      numberValue(
        raw?.viewOnMap,
      ),

    strongIntents:
      numberValue(
        raw?.strongIntents,
      ),

    strongIntentVisitors:
      numberValue(
        raw?.strongIntentVisitors,
      ),

    visitDeclarations:
      numberValue(
        raw?.visitDeclarations,
      ),

    visitVisitors:
      numberValue(
        raw?.visitVisitors,
      ),
  };
}

function normalizeSeries(
  value: unknown,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      item,
    ): item is Record<string, unknown> =>
      Boolean(
        item &&
        typeof item === "object" &&
        !Array.isArray(item),
      ),
  );
}

export async function getProfessionalPlaceAnalyticsForUser(
  options: {
    userId: string;
    requestedPlaceId?: string | null;
    range?: ProfessionalAnalyticsRange;
  },
) {
  const now = new Date();

  const memberships =
    await prisma.professionalPlaceMember.findMany(
      {
        where: {
          userId: options.userId,
        },
        include: {
          professionalPlace: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    );

  const accessibleMemberships =
    memberships.filter(
      ({ professionalPlace }) => {
        if (
          professionalPlace.status !==
          "verified"
        ) {
          return false;
        }

        if (
          ![
            "active",
            "trial",
          ].includes(
            professionalPlace.accessStatus,
          )
        ) {
          return false;
        }

        if (
          professionalPlace.accessStartsAt &&
          professionalPlace.accessStartsAt >
            now
        ) {
          return false;
        }

        if (
          professionalPlace.accessEndsAt &&
          professionalPlace.accessEndsAt <
            now
        ) {
          return false;
        }

        return true;
      },
    );

  if (
    accessibleMemberships.length === 0
  ) {
    return {
      places: [],
      selected: null,
      stats: null,
    };
  }

  const requestedPlaceId =
    cleanText(
      options.requestedPlaceId,
    );

  const selectedMembership =
    requestedPlaceId
      ? accessibleMemberships.find(
          ({ professionalPlace }) =>
            professionalPlace.placeId ===
            requestedPlaceId,
        ) ?? null
      : accessibleMemberships[0] ??
        null;

  if (!selectedMembership) {
    return null;
  }

  const catalogue =
    readCataloguePlaces();

  const catalogueById =
    new Map(
      catalogue.map(
        (place) => [
          place.id,
          place,
        ],
      ),
    );

  const places =
    accessibleMemberships.map(
      ({
        professionalPlace,
        role,
      }) => {
        const place =
          catalogueById.get(
            professionalPlace.placeId,
          );

        return {
          id:
            professionalPlace.id,

          placeId:
            professionalPlace.placeId,

          role,

          plan:
            professionalPlace.plan,

          accessStatus:
            professionalPlace.accessStatus,

          name:
            place?.name ||
            "Lieu Indie Map",

          city:
            place?.city ??
            null,

          country:
            place?.country ??
            null,

          category:
            place?.category ??
            null,
        };
      },
    );

  const professionalPlace =
    selectedMembership.professionalPlace;

  const cataloguePlace =
    catalogueById.get(
      professionalPlace.placeId,
    );

  if (!cataloguePlace) {
    throw new Error(
      `professional_place_missing_from_catalogue:${professionalPlace.placeId}`,
    );
  }

  const range =
    options.range ?? "30d";

  const rangeStart =
    getRangeStart(
      range,
      now,
    );

  const placeTimeZone =
    safeTimeZone(
      cataloguePlace.timeZone,
    );

  const periodCondition =
    rangeStart
      ? Prisma.sql`
          "createdAt" >= ${rangeStart}
        `
      : Prisma.sql`TRUE`;

  const priorCondition =
    rangeStart
      ? Prisma.sql`
          "createdAt" < ${rangeStart}
        `
      : Prisma.sql`FALSE`;

  const rows =
    await prisma.$queryRaw<
      RawAnalyticsRow[]
    >(Prisma.sql`
      WITH external_events AS (
        SELECT
          e.*,

          COALESCE(
            e."userId",
            ai."userId"
          ) AS "actorUserId",

          CASE
            WHEN COALESCE(
              e."userId",
              ai."userId"
            ) IS NOT NULL
              THEN
                'u:' ||
                COALESCE(
                  e."userId",
                  ai."userId"
                )

            WHEN e."sessionId"
              IS NOT NULL
              THEN
                's:' ||
                e."sessionId"

            ELSE
              'e:' ||
              e."id"
          END AS "actorKey"

        FROM "Event" e

        LEFT JOIN
          "AnalyticsInstallation" ai
          ON ai."sessionId" =
            e."sessionId"

        WHERE
          e."placeId" =
            ${professionalPlace.placeId}

          AND COALESCE(
            ai."trafficClass",
            'external'
          ) = 'external'
      ),

      period_events AS (
        SELECT *
        FROM external_events
        WHERE ${periodCondition}
      ),

      period_view_actors AS (
        SELECT
          "actorKey",

          BOOL_OR(
            "actorUserId"
            IS NOT NULL
          ) AS "hasAccount",

          COUNT(*)::int
            AS "viewCount"

        FROM period_events

        WHERE
          "eventType" =
            'view_place_detail'

        GROUP BY
          "actorKey"
      ),

      prior_view_actors AS (
        SELECT DISTINCT
          "actorKey"

        FROM external_events

        WHERE
          "eventType" =
            'view_place_detail'

          AND ${priorCondition}
      ),

      summary AS (
        SELECT
          COUNT(*) FILTER (
            WHERE
              "eventType" =
                'view_place_detail'
          )::int AS "views",

          (
            SELECT COUNT(*)::int
            FROM period_view_actors
          ) AS "uniqueVisitors",

          (
            SELECT COUNT(*)::int
            FROM period_view_actors
            WHERE "viewCount" >= 2
          ) AS "repeatVisitors",

          (
            SELECT
              COUNT(
                DISTINCT pe."actorKey"
              )::int

            FROM period_events pe

            INNER JOIN
              period_view_actors pv
              ON pv."actorKey" =
                pe."actorKey"

            WHERE
              pe."eventType" IN (
                'save_place',
                'add_place_to_shared_list',
                'click_detail_share'
              )
          ) AS "interestVisitors",

          (
            SELECT
              COUNT(
                DISTINCT pe."actorKey"
              )::int

            FROM period_events pe

            INNER JOIN
              period_view_actors pv
              ON pv."actorKey" =
                pe."actorKey"

            WHERE
              pe."eventType" IN (
                'click_detail_website',
                'click_detail_itinerary',
                'click_detail_copy_address',
                'click_detail_phone'
              )
          ) AS "strongIntentViewers",

          (
            SELECT
              COUNT(
                DISTINCT pe."actorKey"
              )::int

            FROM period_events pe

            INNER JOIN
              period_view_actors pv
              ON pv."actorKey" =
                pe."actorKey"

            WHERE
              pe."eventType" =
                'mark_place_visited'
          ) AS "visitViewers",

          ${
            rangeStart
              ? Prisma.sql`
                  (
                    SELECT COUNT(*)::int
                    FROM period_view_actors p
                    WHERE NOT EXISTS (
                      SELECT 1
                      FROM prior_view_actors prior
                      WHERE
                        prior."actorKey" =
                          p."actorKey"
                    )
                  )
                `
              : Prisma.sql`NULL`
          } AS "newVisitors",

          ${
            rangeStart
              ? Prisma.sql`
                  (
                    SELECT COUNT(*)::int
                    FROM period_view_actors p
                    WHERE EXISTS (
                      SELECT 1
                      FROM prior_view_actors prior
                      WHERE
                        prior."actorKey" =
                          p."actorKey"
                    )
                  )
                `
              : Prisma.sql`NULL`
          } AS "returningVisitors",

          (
            SELECT COUNT(*)::int
            FROM period_view_actors
            WHERE "hasAccount" = true
          ) AS "withAccountVisitors",

          (
            SELECT COUNT(*)::int
            FROM period_view_actors
            WHERE "hasAccount" = false
          ) AS "anonymousVisitors",

          COUNT(*) FILTER (
            WHERE
              "eventType" =
                'save_place'
          )::int AS "saves",

          COUNT(*) FILTER (
            WHERE
              "eventType" =
                'add_place_to_shared_list'
          )::int AS "lists",

          COUNT(*) FILTER (
            WHERE
              "eventType" =
                'click_detail_share'
          )::int AS "shares",

          COUNT(*) FILTER (
            WHERE
              "eventType" =
                'click_detail_website'
          )::int AS "websites",

          COUNT(*) FILTER (
            WHERE
              "eventType" =
                'click_detail_itinerary'
          )::int AS "itineraries",

          COUNT(*) FILTER (
            WHERE
              "eventType" =
                'click_detail_phone'
          )::int AS "phones",

          COUNT(*) FILTER (
            WHERE
              "eventType" =
                'click_detail_copy_address'
          )::int AS "copiedAddresses",

          COUNT(*) FILTER (
            WHERE
              "eventType" =
                'click_detail_view_on_map'
          )::int AS "viewOnMap",

          COUNT(*) FILTER (
            WHERE
              "eventType" IN (
                'click_detail_website',
                'click_detail_itinerary',
                'click_detail_copy_address',
                'click_detail_phone'
              )
          )::int AS "strongIntents",

          COUNT(
            DISTINCT "actorKey"
          ) FILTER (
            WHERE
              "eventType" IN (
                'click_detail_website',
                'click_detail_itinerary',
                'click_detail_copy_address',
                'click_detail_phone'
              )
          )::int
            AS "strongIntentVisitors",

          COUNT(*) FILTER (
            WHERE
              "eventType" =
                'mark_place_visited'
          )::int
            AS "visitDeclarations",

          COUNT(
            DISTINCT "actorKey"
          ) FILTER (
            WHERE
              "eventType" =
                'mark_place_visited'
          )::int
            AS "visitVisitors"

        FROM period_events
      ),

      daily_rows AS (
        SELECT
          TO_CHAR(
            "createdAt"
              AT TIME ZONE
              ${placeTimeZone},
            'YYYY-MM-DD'
          ) AS "day",

          COUNT(*) FILTER (
            WHERE
              "eventType" =
                'view_place_detail'
          )::int AS "views",

          COUNT(
            DISTINCT "actorKey"
          ) FILTER (
            WHERE
              "eventType" =
                'view_place_detail'
          )::int
            AS "visitors",

          COUNT(*) FILTER (
            WHERE
              "eventType" =
                'save_place'
          )::int AS "saves",

          COUNT(*) FILTER (
            WHERE
              "eventType" IN (
                'click_detail_website',
                'click_detail_itinerary',
                'click_detail_copy_address',
                'click_detail_phone'
              )
          )::int
            AS "strongIntents",

          COUNT(*) FILTER (
            WHERE
              "eventType" =
                'mark_place_visited'
          )::int
            AS "visits"

        FROM period_events

        GROUP BY
          "day"
      ),

      source_rows AS (
        SELECT
          COALESCE(
            NULLIF(
              TRIM(
                "metadata"->>'source'
              ),
              ''
            ),
            'other'
          ) AS "source",

          COUNT(*)::int
            AS "views",

          COUNT(
            DISTINCT "actorKey"
          )::int
            AS "visitors"

        FROM period_events

        WHERE
          "eventType" =
            'view_place_detail'

        GROUP BY
          "source"
      ),

      hour_rows AS (
        SELECT
          EXTRACT(
            HOUR FROM
              "createdAt"
                AT TIME ZONE
                ${placeTimeZone}
          )::int AS "hour",

          COUNT(*) FILTER (
            WHERE
              "eventType" =
                'view_place_detail'
          )::int AS "views",

          COUNT(*) FILTER (
            WHERE
              "eventType" IN (
                'click_detail_website',
                'click_detail_itinerary',
                'click_detail_copy_address',
                'click_detail_phone'
              )
          )::int
            AS "strongIntents"

        FROM period_events

        GROUP BY
          "hour"
      ),

      weekday_rows AS (
        SELECT
          EXTRACT(
            ISODOW FROM
              "createdAt"
                AT TIME ZONE
                ${placeTimeZone}
          )::int
            AS "weekday",

          COUNT(*) FILTER (
            WHERE
              "eventType" =
                'view_place_detail'
          )::int AS "views",

          COUNT(*) FILTER (
            WHERE
              "eventType" IN (
                'click_detail_website',
                'click_detail_itinerary',
                'click_detail_copy_address',
                'click_detail_phone'
              )
          )::int
            AS "strongIntents"

        FROM period_events

        GROUP BY
          "weekday"
      )

      SELECT
        JSONB_BUILD_OBJECT(
          'summary',
          (
            SELECT
              TO_JSONB(summary)
            FROM summary
          ),

          'daily',
          COALESCE(
            (
              SELECT
                JSONB_AGG(
                  TO_JSONB(d)
                  ORDER BY
                    d."day"
                )
              FROM daily_rows d
            ),
            '[]'::jsonb
          ),

          'sources',
          COALESCE(
            (
              SELECT
                JSONB_AGG(
                  TO_JSONB(s)
                  ORDER BY
                    s."views" DESC,
                    s."source"
                )
              FROM source_rows s
            ),
            '[]'::jsonb
          ),

          'hours',
          COALESCE(
            (
              SELECT
                JSONB_AGG(
                  TO_JSONB(h)
                  ORDER BY
                    h."hour"
                )
              FROM hour_rows h
            ),
            '[]'::jsonb
          ),

          'weekdays',
          COALESCE(
            (
              SELECT
                JSONB_AGG(
                  TO_JSONB(w)
                  ORDER BY
                    w."weekday"
                )
              FROM weekday_rows w
            ),
            '[]'::jsonb
          )
        ) AS "payload"
    `);

  const payload =
    rows[0]?.payload ?? {};

  const summary =
    normalizeSummary(
      payload.summary,
    );

  const daily =
    normalizeSeries(
      payload.daily,
    ).map((row) => ({
      date:
        cleanText(row.day) || "",

      views:
        numberValue(row.views),

      visitors:
        numberValue(
          row.visitors,
        ),

      saves:
        numberValue(row.saves),

      strongIntents:
        numberValue(
          row.strongIntents,
        ),

      visits:
        numberValue(row.visits),
    }));

  const sources =
    normalizeSeries(
      payload.sources,
    ).map((row) => ({
      source:
        cleanText(row.source) ||
        "other",

      views:
        numberValue(row.views),

      visitors:
        numberValue(
          row.visitors,
        ),
    }));

  const hours =
    normalizeSeries(
      payload.hours,
    ).map((row) => ({
      hour:
        numberValue(row.hour),

      views:
        numberValue(row.views),

      strongIntents:
        numberValue(
          row.strongIntents,
        ),
    }));

  const weekdays =
    normalizeSeries(
      payload.weekdays,
    ).map((row) => ({
      weekday:
        numberValue(
          row.weekday,
        ),

      views:
        numberValue(row.views),

      strongIntents:
        numberValue(
          row.strongIntents,
        ),
    }));

  const audiencePeriodCondition =
    rangeStart
      ? Prisma.sql`
          e."createdAt" >= ${rangeStart}
        `
      : Prisma.sql`TRUE`;

  const audienceRawRows =
    await prisma.$queryRaw<
      Array<{
        homeCitySample: number;
        ageSample: number;
        consultationCitySample: number;
        homeCities: unknown;
        ageRanges: unknown;
        consultationCities: unknown;
      }>
    >(Prisma.sql`
      WITH view_events AS (
        SELECT
          COALESCE(
            e."userId",
            ai."userId"
          ) AS "actorUserId",

          CASE
            WHEN COALESCE(
              e."userId",
              ai."userId"
            ) IS NOT NULL
              THEN
                'u:' ||
                COALESCE(
                  e."userId",
                  ai."userId"
                )

            WHEN e."sessionId"
              IS NOT NULL
              THEN
                's:' ||
                e."sessionId"

            ELSE
              'e:' ||
              e."id"
          END AS "actorKey",

          COALESCE(
            e."viewerCity",
            ds."city"
          ) AS "consultationCity",

          COALESCE(
            e."viewerCountry",
            ds."country"
          ) AS "consultationCountry"

        FROM "Event" e

        LEFT JOIN
          "AnalyticsInstallation" ai
          ON ai."sessionId" =
            e."sessionId"

        LEFT JOIN
          "DailySession" ds
          ON ds."launchId" =
            e."launchId"
          AND ds."day" =
            e."clientLocalDate"

        WHERE
          e."placeId" =
            ${professionalPlace.placeId}

          AND e."eventType" =
            'view_place_detail'

          AND COALESCE(
            ai."trafficClass",
            'external'
          ) = 'external'

          AND ${audiencePeriodCondition}
      ),

      viewer_users AS (
        SELECT DISTINCT
          "actorUserId"

        FROM view_events

        WHERE
          "actorUserId"
          IS NOT NULL
      ),

      profiled_viewers AS (
        SELECT
          v."actorUserId",
          u."homeCity",
          u."ageRange"

        FROM viewer_users v

        INNER JOIN "User" u
          ON u."id" =
            v."actorUserId"
      ),

      home_city_rows AS (
        SELECT
          TRIM("homeCity")
            AS "label",

          COUNT(*)::int
            AS "visitors"

        FROM profiled_viewers

        WHERE
          NULLIF(
            TRIM("homeCity"),
            ''
          ) IS NOT NULL

        GROUP BY
          TRIM("homeCity")
      ),

      age_rows AS (
        SELECT
          "ageRange"
            AS "label",

          COUNT(*)::int
            AS "visitors"

        FROM profiled_viewers

        WHERE
          "ageRange"
          IS NOT NULL

          AND "ageRange" <>
            'prefer_not_to_say'

        GROUP BY
          "ageRange"
      ),

      consultation_actor_rows AS (
        SELECT DISTINCT
          "actorKey",
          TRIM(
            "consultationCity"
          ) AS "city",
          NULLIF(
            TRIM(
              COALESCE(
                "consultationCountry",
                ''
              )
            ),
            ''
          ) AS "country"

        FROM view_events

        WHERE
          NULLIF(
            TRIM(
              COALESCE(
                "consultationCity",
                ''
              )
            ),
            ''
          ) IS NOT NULL
      ),

      consultation_city_rows AS (
        SELECT
          "city",
          "country",

          COUNT(*)::int
            AS "visitors"

        FROM consultation_actor_rows

        GROUP BY
          "city",
          "country"
      )

      SELECT
        (
          SELECT
            COUNT(*)::int

          FROM profiled_viewers

          WHERE
            NULLIF(
              TRIM("homeCity"),
              ''
            ) IS NOT NULL
        ) AS "homeCitySample",

        (
          SELECT
            COUNT(*)::int

          FROM profiled_viewers

          WHERE
            "ageRange"
            IS NOT NULL

            AND "ageRange" <>
              'prefer_not_to_say'
        ) AS "ageSample",

        (
          SELECT
            COUNT(
              DISTINCT "actorKey"
            )::int

          FROM consultation_actor_rows
        ) AS "consultationCitySample",

        COALESCE(
          (
            SELECT
              JSONB_AGG(
                JSONB_BUILD_OBJECT(
                  'label',
                  h."label",
                  'visitors',
                  h."visitors"
                )
                ORDER BY
                  h."visitors" DESC,
                  h."label"
              )

            FROM home_city_rows h
          ),
          '[]'::jsonb
        ) AS "homeCities",

        COALESCE(
          (
            SELECT
              JSONB_AGG(
                JSONB_BUILD_OBJECT(
                  'label',
                  a."label",
                  'visitors',
                  a."visitors"
                )
                ORDER BY
                  a."visitors" DESC,
                  a."label"
              )

            FROM age_rows a
          ),
          '[]'::jsonb
        ) AS "ageRanges",

        COALESCE(
          (
            SELECT
              JSONB_AGG(
                JSONB_BUILD_OBJECT(
                  'city',
                  c."city",
                  'country',
                  c."country",
                  'visitors',
                  c."visitors"
                )
                ORDER BY
                  c."visitors" DESC,
                  c."city"
              )

            FROM consultation_city_rows c
          ),
          '[]'::jsonb
        ) AS "consultationCities"
    `);

  const audienceRaw =
    audienceRawRows[0];

  const homeCitySample =
    numberValue(
      audienceRaw?.homeCitySample,
    );

  const ageSample =
    numberValue(
      audienceRaw?.ageSample,
    );

  const consultationCitySample =
    numberValue(
      audienceRaw?.consultationCitySample,
    );

  const rawHomeCities =
    normalizeSeries(
      audienceRaw?.homeCities,
    ).map((row) => ({
      label:
        cleanText(row.label) ||
        "—",

      visitors:
        numberValue(
          row.visitors,
        ),
    }));

  const rawAgeRanges =
    normalizeSeries(
      audienceRaw?.ageRanges,
    ).map((row) => ({
      label:
        cleanText(row.label) ||
        "unknown",

      visitors:
        numberValue(
          row.visitors,
        ),
    }));

  const rawConsultationCities =
    normalizeSeries(
      audienceRaw?.consultationCities,
    ).map((row) => ({
      city:
        cleanText(row.city) ||
        "—",

      country:
        cleanText(
          row.country,
        ),

      visitors:
        numberValue(
          row.visitors,
        ),
    }));

  const audience = {
    privacyMinimum:
      PROFESSIONAL_AUDIENCE_MIN_SAMPLE,

    homeCities: {
      sampleSize:
        homeCitySample,

      available:
        homeCitySample >=
        PROFESSIONAL_AUDIENCE_MIN_SAMPLE,

      rows:
        homeCitySample >=
        PROFESSIONAL_AUDIENCE_MIN_SAMPLE
          ? rawHomeCities
          : [],
    },

    ageRanges: {
      sampleSize:
        ageSample,

      available:
        ageSample >=
        PROFESSIONAL_AUDIENCE_MIN_SAMPLE,

      rows:
        ageSample >=
        PROFESSIONAL_AUDIENCE_MIN_SAMPLE
          ? rawAgeRanges
          : [],
    },

    consultationCities: {
      sampleSize:
        consultationCitySample,

      available:
        consultationCitySample >=
        PROFESSIONAL_AUDIENCE_MIN_SAMPLE,

      rows:
        consultationCitySample >=
        PROFESSIONAL_AUDIENCE_MIN_SAMPLE
          ? rawConsultationCities
          : [],
    },
  };

  return {
    places,

    selected: {
      id:
        professionalPlace.id,

      placeId:
        professionalPlace.placeId,

      role:
        selectedMembership.role,

      plan:
        professionalPlace.plan,

      accessStatus:
        professionalPlace.accessStatus,

      name:
        cataloguePlace.name,

      city:
        cataloguePlace.city,

      country:
        cataloguePlace.country,

      category:
        cataloguePlace.category,

      timeZone:
        placeTimeZone,
    },

    stats: {
      range,
      rangeStart:
        rangeStart?.toISOString() ??
        null,

      generatedAt:
        now.toISOString(),

      summary,
      daily,
      sources,
      hours,
      weekdays,
      audience,
    },
  };
}
