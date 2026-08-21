ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS "searchId" TEXT;

ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS "searchRank" INTEGER;

CREATE INDEX IF NOT EXISTS
  "Event_searchId_idx"
ON "Event" ("searchId");

CREATE INDEX IF NOT EXISTS
  "Event_placeId_searchId_idx"
ON "Event" ("placeId", "searchId");
