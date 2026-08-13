-- CreateTable
CREATE TABLE "ActiveSession" (
    "sessionId" TEXT NOT NULL PRIMARY KEY,
    "city" TEXT,
    "country" TEXT,
    "platform" TEXT,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
