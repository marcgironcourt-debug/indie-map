CREATE TABLE IF NOT EXISTS "ContextualNotificationLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "categoryKey" TEXT NOT NULL,
  "placeId" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "openedAt" TIMESTAMP(3),
  CONSTRAINT "ContextualNotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ContextualNotificationLog_userId_sentAt_idx" ON "ContextualNotificationLog"("userId", "sentAt");
CREATE INDEX IF NOT EXISTS "ContextualNotificationLog_userId_categoryKey_sentAt_idx" ON "ContextualNotificationLog"("userId", "categoryKey", "sentAt");
CREATE INDEX IF NOT EXISTS "ContextualNotificationLog_placeId_idx" ON "ContextualNotificationLog"("placeId");
