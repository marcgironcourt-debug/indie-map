
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { geolocation } from "@vercel/functions";
import { AUTH_COOKIE, hashToken } from "@/lib/auth";
import {
  localDateAndHour,
  normalizeTimeZone,
  parseUtcOffsetMinutes,
} from "@/lib/analyticsTime";
import { prisma } from "@/lib/prisma";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

const ALLOWED = new Set([
  "click_explore_world",
  "click_recent_additions",
  "click_discovery_of_day",
  "search_ai_used",
  "search_result_impression",
  "click_search_result_detail",
  "click_search_results_map",
  "click_mini_immersion",
  "click_mini_more_info",
  "save_place",
  "unsave_place",
  "open_shared_list_picker",
  "add_place_to_shared_list",
  "create_shared_list",
  "click_detail_website",
  "click_detail_itinerary",
  "click_detail_copy_address",
  "click_detail_share",
  "click_detail_view_on_map",
  "click_detail_phone",
  "view_place_detail",
  "mark_place_visited",
  "unmark_place_visited",
]);

type EventPayload = {
  eventType?: unknown;
  placeId?: unknown;
  city?: unknown;
  country?: unknown;
  category?: unknown;
  searchId?: unknown;
  searchRank?: unknown;
  sessionId?: unknown;
  launchId?: unknown;
  locale?: unknown;
  platform?: unknown;
  clientTimeZone?: unknown;
  utcOffsetMinutes?: unknown;
  viewerLocation?: unknown;
  metadata?: unknown;
};

function isObject(
  v: unknown,
): v is Record<string, unknown> {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v)
  );
}

function cleanString(
  value: unknown,
  max = 200,
) {
  if (typeof value !== "string") return null;

  const clean = value.trim();
  if (!clean) return null;

  return clean.slice(0, max);
}

type PlaceCoordinates = {
  lat: number;
  lng: number;
};

let placeCoordinatesCache:
  Map<string, PlaceCoordinates> | null =
    null;

function cleanCoordinate(
  value: unknown,
  min: number,
  max: number,
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number) ||
    number < min ||
    number > max
  ) {
    return null;
  }

  return number;
}

function cleanPositiveInt(
  value: unknown,
  max = 1000,
) {
  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number < 1 ||
    number > max
  ) {
    return null;
  }

  return number;
}

function viewerCoordinates(
  value: unknown,
) {
  if (!isObject(value)) {
    return null;
  }

  const lat =
    cleanCoordinate(
      value.lat,
      -90,
      90,
    );

  const lng =
    cleanCoordinate(
      value.lng,
      -180,
      180,
    );

  if (
    lat === null ||
    lng === null
  ) {
    return null;
  }

  return {
    lat,
    lng,
  };
}

function getPlaceCoordinates(
  placeId: string | null,
) {
  if (!placeId) {
    return null;
  }

  if (!placeCoordinatesCache) {
    placeCoordinatesCache =
      new Map();

    try {
      const filePath =
        path.join(
          process.cwd(),
          "data",
          "places.json",
        );

      const parsed =
        JSON.parse(
          fs.readFileSync(
            filePath,
            "utf8",
          ),
        );

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (
            !item ||
            typeof item !==
              "object"
          ) {
            continue;
          }

          const id =
            cleanString(
              item.id,
              120,
            );

          const lat =
            cleanCoordinate(
              item.lat,
              -90,
              90,
            );

          const lng =
            cleanCoordinate(
              item.lng,
              -180,
              180,
            );

          if (
            id &&
            lat !== null &&
            lng !== null
          ) {
            placeCoordinatesCache.set(
              id,
              {
                lat,
                lng,
              },
            );
          }
        }
      }
    } catch (error) {
      console.error(
        "[/api/v1/event] place coordinates error",
        error,
      );
    }
  }

  return (
    placeCoordinatesCache.get(
      placeId,
    ) ?? null
  );
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const radians =
    (degrees: number) =>
      degrees *
      (Math.PI / 180);

  const dLat =
    radians(
      lat2 - lat1,
    );

  const dLng =
    radians(
      lng2 - lng1,
    );

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(
      radians(lat1),
    ) *
      Math.cos(
        radians(lat2),
      ) *
      Math.sin(
        dLng / 2,
      ) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a),
    );

  return 6371 * c;
}

function distanceBucket(
  distanceKm: number | null,
) {
  if (
    distanceKm === null ||
    !Number.isFinite(
      distanceKm,
    )
  ) {
    return null;
  }

  if (distanceKm < 5) {
    return "lt_5";
  }

  if (distanceKm < 25) {
    return "5_25";
  }

  if (distanceKm < 100) {
    return "25_100";
  }

  return "gte_100";
}

function cleanMetadata(
  value: unknown,
): Prisma.InputJsonValue | undefined {
  if (!isObject(value)) return undefined;

  return JSON.parse(
    JSON.stringify(value),
  ) as Prisma.InputJsonValue;
}

export async function POST(req: Request) {
  try {
    const raw =
      await req.text().catch(() => "");

    const bodyUnknown: unknown = (() => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })();

    if (!isObject(bodyUnknown)) {
      return NextResponse.json(
        { ok: false },
        {
          status: 400,
          headers: V1_HEADERS,
        },
      );
    }

    const body =
      bodyUnknown as EventPayload;

    const eventType =
      cleanString(body.eventType, 80);

    if (
      !eventType ||
      !ALLOWED.has(eventType)
    ) {
      return NextResponse.json(
        { ok: false },
        {
          status: 400,
          headers: V1_HEADERS,
        },
      );
    }

    const jar = await cookies();

    const rawAuthToken =
      jar.get(AUTH_COOKIE)?.value ?? null;

    const authToken = rawAuthToken
      ? hashToken(rawAuthToken)
      : null;

    const headerSessionId = cleanString(
      req.headers.get("x-session-id"),
      120,
    );

    const headerLaunchId = cleanString(
      req.headers.get("x-launch-id"),
      120,
    );

    const headerLocale = cleanString(
      req.headers.get("x-locale"),
      12,
    );

    const headerPlatform = cleanString(
      req.headers.get("x-platform"),
      40,
    );

    const deviceType = cleanString(
      req.headers.get("x-device-type"),
      40,
    );

    const deviceOs = cleanString(
      req.headers.get("x-device-os"),
      40,
    );

    const deviceBrowser = cleanString(
      req.headers.get("x-device-browser"),
      40,
    );

    const bodyTimeZone =
      normalizeTimeZone(
        body.clientTimeZone,
      );

    const headerTimeZone =
      normalizeTimeZone(
        req.headers.get(
          "x-client-time-zone",
        ),
      );

    const clientTimeZone =
      bodyTimeZone || headerTimeZone;

    const bodyOffset =
      parseUtcOffsetMinutes(
        body.utcOffsetMinutes,
      );

    const headerOffset =
      parseUtcOffsetMinutes(
        req.headers.get(
          "x-utc-offset-minutes",
        ),
      );

    const utcOffsetMinutes =
      bodyOffset ?? headerOffset;

    const finalSessionId =
      cleanString(
        body.sessionId,
        120,
      ) || headerSessionId;

    const finalLaunchId =
      cleanString(
        body.launchId,
        120,
      ) || headerLaunchId;

    const defaultTrafficClass =
      process.env.NODE_ENV === "production"
        ? "external"
        : "test";

    const now = new Date();

    const {
      localDate: clientLocalDate,
      localHour: clientLocalHour,
    } = localDateAndHour(
      now,
      clientTimeZone,
    );

    const staleUserCutoff =
      new Date(
        now.getTime() -
          5 * 60 * 1000,
      );

    const metadata =
      cleanMetadata(body.metadata);

    const placeId =
      cleanString(
        body.placeId,
        120,
      );

    const searchId =
      cleanString(
        body.searchId,
        120,
      );

    const searchRank =
      cleanPositiveInt(
        body.searchRank,
      );

    const geo =
      geolocation(req);

    const viewerCity =
      cleanString(
        geo.city ||
          req.headers.get(
            "x-vercel-ip-city",
          ),
        120,
      );

    const viewerCountry =
      cleanString(
        geo.country ||
          req.headers.get(
            "x-vercel-ip-country",
          ),
        120,
      );

    const coordinates =
      viewerCoordinates(
        body.viewerLocation,
      );

    const placeCoordinates =
      getPlaceCoordinates(
        placeId,
      );

    const rawViewerDistanceKm =
      coordinates &&
      placeCoordinates
        ? haversineKm(
            coordinates.lat,
            coordinates.lng,
            placeCoordinates.lat,
            placeCoordinates.lng,
          )
        : null;

    const viewerDistanceKm =
      rawViewerDistanceKm === null
        ? null
        : Math.round(
            rawViewerDistanceKm *
              10,
          ) / 10;

    const viewerDistanceBucket =
      distanceBucket(
        viewerDistanceKm,
      );

    const metadataJson =
      metadata === undefined
        ? null
        : JSON.stringify(metadata);

    await prisma.$executeRaw`
      WITH session_match AS (
        SELECT "id", "userId", "expiresAt"
        FROM "UserSession"
        WHERE "token" = ${authToken}
        LIMIT 1
      ),
      delete_expired_session AS (
        DELETE FROM "UserSession"
        WHERE "id" = (
          SELECT "id"
          FROM session_match
          WHERE "expiresAt" <= ${now}
        )
        RETURNING "id"
      ),
      valid_session AS (
        SELECT "userId"
        FROM session_match
        WHERE "expiresAt" > ${now}
      ),
      touch_user AS (
        UPDATE "User"
        SET
          "lastSeenAt" = ${now},
          "updatedAt" = ${now}
        WHERE "id" = (
          SELECT "userId"
          FROM valid_session
        )
          AND (
            "lastSeenAt" IS NULL
            OR "lastSeenAt" < ${staleUserCutoff}
          )
        RETURNING "id"
      ),

      upsert_installation AS (
        INSERT INTO "AnalyticsInstallation" (
          "sessionId",
          "userId",
          "trafficClass",
          "platform",
          "deviceType",
          "os",
          "browser",
          "clientTimeZone",
          "utcOffsetMinutes",
          "firstSeenAt",
          "lastSeenAt",
          "createdAt",
          "updatedAt"
        )
        SELECT
          ${finalSessionId},
          (
            SELECT "userId"
            FROM valid_session
          ),
          ${defaultTrafficClass},
          ${cleanString(body.platform, 40) || headerPlatform},
          ${deviceType},
          ${deviceOs},
          ${deviceBrowser},
          ${clientTimeZone},
          ${utcOffsetMinutes},
          ${now},
          ${now},
          ${now},
          ${now}
        WHERE ${finalSessionId} IS NOT NULL
        ON CONFLICT ("sessionId")
        DO UPDATE SET
          "userId" = COALESCE(
            EXCLUDED."userId",
            "AnalyticsInstallation"."userId"
          ),
          "platform" = COALESCE(
            EXCLUDED."platform",
            "AnalyticsInstallation"."platform"
          ),
          "deviceType" = COALESCE(
            EXCLUDED."deviceType",
            "AnalyticsInstallation"."deviceType"
          ),
          "os" = COALESCE(
            EXCLUDED."os",
            "AnalyticsInstallation"."os"
          ),
          "browser" = COALESCE(
            EXCLUDED."browser",
            "AnalyticsInstallation"."browser"
          ),
          "clientTimeZone" = COALESCE(
            EXCLUDED."clientTimeZone",
            "AnalyticsInstallation"."clientTimeZone"
          ),
          "utcOffsetMinutes" = COALESCE(
            EXCLUDED."utcOffsetMinutes",
            "AnalyticsInstallation"."utcOffsetMinutes"
          ),
          "lastSeenAt" = EXCLUDED."lastSeenAt",
          "updatedAt" = EXCLUDED."updatedAt"
        RETURNING "sessionId"
      )

      INSERT INTO "Event" (
        "id",
        "eventType",
        "placeId",
        "city",
        "country",
        "category",
        "searchId",
        "searchRank",
        "viewerCity",
        "viewerCountry",
        "viewerDistanceKm",
        "viewerDistanceBucket",
        "sessionId",
        "launchId",
        "userId",
        "locale",
        "platform",
        "clientTimeZone",
        "utcOffsetMinutes",
        "clientLocalDate",
        "clientLocalHour",
        "metadata",
        "createdAt"
      )
      VALUES (
        ${randomUUID()},
        ${eventType},
        ${placeId},
        ${cleanString(body.city, 120)},
        ${cleanString(body.country, 120)},
        ${cleanString(body.category, 120)},
        ${searchId},
        ${searchRank},
        ${viewerCity},
        ${viewerCountry},
        ${viewerDistanceKm},
        ${viewerDistanceBucket},
        ${finalSessionId},
        ${finalLaunchId},
        (SELECT "userId" FROM valid_session),
        ${cleanString(body.locale, 12) || headerLocale},
        ${cleanString(body.platform, 40) || headerPlatform},
        ${clientTimeZone},
        ${utcOffsetMinutes},
        ${clientLocalDate},
        ${clientLocalHour},
        CAST(${metadataJson} AS jsonb),
        ${now}
      )
    `;

    return NextResponse.json(
      { ok: true },
      { headers: V1_HEADERS },
    );
  } catch (err) {
    console.error(
      "[/api/v1/event] error",
      err,
    );

    return NextResponse.json(
      { ok: false },
      {
        status: 500,
        headers: V1_HEADERS,
      },
    );
  }
}
