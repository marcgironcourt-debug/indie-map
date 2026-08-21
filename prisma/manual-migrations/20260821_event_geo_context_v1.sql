ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS "viewerCity" TEXT;

ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS "viewerCountry" TEXT;

ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS "viewerDistanceKm" DOUBLE PRECISION;

ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS "viewerDistanceBucket" TEXT;

CREATE INDEX IF NOT EXISTS
  "Event_placeId_eventType_createdAt_idx"
ON "Event" (
  "placeId",
  "eventType",
  "createdAt"
);
