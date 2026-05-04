CREATE TABLE IF NOT EXISTS "AppUpdateNotificationLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AppUpdateNotificationLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AppUpdateNotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AppUpdateNotificationLog_userId_version_platform_key" ON "AppUpdateNotificationLog"("userId", "version", "platform");
CREATE INDEX IF NOT EXISTS "AppUpdateNotificationLog_userId_sentAt_idx" ON "AppUpdateNotificationLog"("userId", "sentAt");
CREATE INDEX IF NOT EXISTS "AppUpdateNotificationLog_version_idx" ON "AppUpdateNotificationLog"("version");
CREATE INDEX IF NOT EXISTS "AppUpdateNotificationLog_platform_idx" ON "AppUpdateNotificationLog"("platform");
