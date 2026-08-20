
ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS "launchId" TEXT,
  ADD COLUMN IF NOT EXISTS "clientTimeZone" TEXT,
  ADD COLUMN IF NOT EXISTS "utcOffsetMinutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "clientLocalDate" TEXT,
  ADD COLUMN IF NOT EXISTS "clientLocalHour" INTEGER;

CREATE INDEX IF NOT EXISTS "Event_launchId_idx"
  ON "Event"("launchId");

CREATE INDEX IF NOT EXISTS "Event_clientLocalDate_idx"
  ON "Event"("clientLocalDate");

CREATE INDEX IF NOT EXISTS "Event_clientLocalDate_eventType_idx"
  ON "Event"("clientLocalDate", "eventType");

ALTER TABLE "ActiveSession"
  ADD COLUMN IF NOT EXISTS "clientTimeZone" TEXT,
  ADD COLUMN IF NOT EXISTS "utcOffsetMinutes" INTEGER;

ALTER TABLE "DailyActiveUser"
  ADD COLUMN IF NOT EXISTS "clientTimeZone" TEXT,
  ADD COLUMN IF NOT EXISTS "utcOffsetMinutes" INTEGER;

ALTER TABLE "DailySession"
  ADD COLUMN IF NOT EXISTS "clientTimeZone" TEXT,
  ADD COLUMN IF NOT EXISTS "utcOffsetMinutes" INTEGER;

CREATE INDEX IF NOT EXISTS "Event_sessionId_createdAt_idx"
  ON "Event"("sessionId", "createdAt");

CREATE INDEX IF NOT EXISTS "Event_clientLocalDate_createdAt_idx"
  ON "Event"("clientLocalDate", "createdAt");
