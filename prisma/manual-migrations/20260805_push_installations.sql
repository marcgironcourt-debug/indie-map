CREATE TABLE IF NOT EXISTS "PushInstallation" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT,
  "platform" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "subscription" TEXT,
  "locale" TEXT NOT NULL DEFAULT 'fr',
  "lastSeenAt" TIMESTAMP(3) NOT NULL
    DEFAULT CURRENT_TIMESTAMP,
  "lastReactivationAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL
    DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PushInstallation_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS
  "PushInstallation_sessionId_key"
  ON "PushInstallation"("sessionId");

CREATE UNIQUE INDEX IF NOT EXISTS
  "PushInstallation_token_key"
  ON "PushInstallation"("token");

CREATE INDEX IF NOT EXISTS
  "PushInstallation_userId_idx"
  ON "PushInstallation"("userId");

CREATE INDEX IF NOT EXISTS
  "PushInstallation_platform_idx"
  ON "PushInstallation"("platform");

CREATE INDEX IF NOT EXISTS
  "PushInstallation_lastSeenAt_idx"
  ON "PushInstallation"("lastSeenAt");

CREATE INDEX IF NOT EXISTS
  "PushInstallation_lastReactivationAt_idx"
  ON "PushInstallation"("lastReactivationAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'PushInstallation_userId_fkey'
  ) THEN
    ALTER TABLE "PushInstallation"
      ADD CONSTRAINT
        "PushInstallation_userId_fkey"
      FOREIGN KEY ("userId")
      REFERENCES "User"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END
$$;

INSERT INTO "PushInstallation" (
  "id",
  "sessionId",
  "userId",
  "platform",
  "token",
  "subscription",
  "locale",
  "lastSeenAt",
  "lastReactivationAt",
  "createdAt",
  "updatedAt"
)
SELECT
  pd."id",
  'legacy-push-device:' || pd."id",
  pd."userId",
  pd."platform",
  pd."token",
  pd."subscription",
  CASE
    WHEN u."preferredLocale" = 'en' THEN 'en'
    ELSE 'fr'
  END,
  COALESCE(
    u."lastSeenAt",
    pd."updatedAt",
    pd."createdAt"
  ),
  (
    SELECT MAX(log."sentAt")
    FROM "ContextualNotificationLog" log
    WHERE
      log."userId" = pd."userId"
      AND log."categoryKey" = 'reactivation'
  ),
  pd."createdAt",
  pd."updatedAt"
FROM "PushDevice" pd
JOIN "User" u
  ON u."id" = pd."userId"
ON CONFLICT ("token") DO NOTHING;
