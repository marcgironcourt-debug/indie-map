ALTER TABLE "Event" ALTER COLUMN "placeId" DROP NOT NULL;
ALTER TABLE "Event" ALTER COLUMN "city" DROP NOT NULL;
ALTER TABLE "Event" ALTER COLUMN "category" DROP NOT NULL;

ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "locale" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "platform" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Event_userId_fkey'
  ) THEN
    ALTER TABLE "Event"
    ADD CONSTRAINT "Event_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Event_eventType_idx" ON "Event"("eventType");
CREATE INDEX IF NOT EXISTS "Event_createdAt_idx" ON "Event"("createdAt");
CREATE INDEX IF NOT EXISTS "Event_userId_idx" ON "Event"("userId");
CREATE INDEX IF NOT EXISTS "Event_sessionId_idx" ON "Event"("sessionId");
CREATE INDEX IF NOT EXISTS "Event_placeId_idx" ON "Event"("placeId");
