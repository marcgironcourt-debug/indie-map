CREATE TABLE IF NOT EXISTS "AnalyticsInstallation" (
  "sessionId" TEXT NOT NULL,
  "userId" TEXT,
  "label" TEXT,
  "trafficClass" TEXT NOT NULL DEFAULT 'external',
  "platform" TEXT,
  "deviceType" TEXT,
  "os" TEXT,
  "browser" TEXT,
  "clientTimeZone" TEXT,
  "utcOffsetMinutes" INTEGER,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AnalyticsInstallation_pkey"
    PRIMARY KEY ("sessionId"),

  CONSTRAINT "AnalyticsInstallation_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS
  "AnalyticsInstallation_userId_idx"
  ON "AnalyticsInstallation"("userId");

CREATE INDEX IF NOT EXISTS
  "AnalyticsInstallation_trafficClass_idx"
  ON "AnalyticsInstallation"("trafficClass");

CREATE INDEX IF NOT EXISTS
  "AnalyticsInstallation_lastSeenAt_idx"
  ON "AnalyticsInstallation"("lastSeenAt");

-- Backfill des installations déjà connues par la présence.
INSERT INTO "AnalyticsInstallation" (
  "sessionId",
  "trafficClass",
  "platform",
  "clientTimeZone",
  "utcOffsetMinutes",
  "firstSeenAt",
  "lastSeenAt",
  "createdAt",
  "updatedAt"
)
SELECT
  a."sessionId",
  'external',
  a."platform",
  a."clientTimeZone",
  a."utcOffsetMinutes",
  a."createdAt",
  a."lastSeenAt",
  a."createdAt",
  a."updatedAt"
FROM "ActiveSession" a
WHERE a."sessionId" <> 'unknown'
ON CONFLICT ("sessionId") DO NOTHING;

-- Backfill des installations présentes uniquement dans Event.
WITH event_agg AS (
  SELECT
    "sessionId",
    MIN("createdAt") AS "firstSeenAt",
    MAX("createdAt") AS "lastSeenAt"
  FROM "Event"
  WHERE "sessionId" IS NOT NULL
  GROUP BY "sessionId"
),
latest_event AS (
  SELECT DISTINCT ON ("sessionId")
    "sessionId",
    "userId",
    "platform",
    "clientTimeZone",
    "utcOffsetMinutes"
  FROM "Event"
  WHERE "sessionId" IS NOT NULL
  ORDER BY "sessionId", "createdAt" DESC
)
INSERT INTO "AnalyticsInstallation" (
  "sessionId",
  "userId",
  "trafficClass",
  "platform",
  "clientTimeZone",
  "utcOffsetMinutes",
  "firstSeenAt",
  "lastSeenAt",
  "createdAt",
  "updatedAt"
)
SELECT
  a."sessionId",
  e."userId",
  'external',
  e."platform",
  e."clientTimeZone",
  e."utcOffsetMinutes",
  a."firstSeenAt",
  a."lastSeenAt",
  a."firstSeenAt",
  a."lastSeenAt"
FROM event_agg a
LEFT JOIN latest_event e
  ON e."sessionId" = a."sessionId"
ON CONFLICT ("sessionId") DO NOTHING;

-- Une ouverture explicite maximum par launchId.
CREATE UNIQUE INDEX IF NOT EXISTS
  "Event_launch_started_launchId_key"
  ON "Event"("launchId")
  WHERE
    "eventType" = 'launch_started'
    AND "launchId" IS NOT NULL;
