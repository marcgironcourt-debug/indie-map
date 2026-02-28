/*
  Warnings:

  - You are about to drop the column `ip` on the `Submission` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `Submission` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "openingHours" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "photoMime" TEXT,
    "photoBase64" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" DATETIME
);
INSERT INTO "new_Submission" ("address", "createdAt", "id", "locale", "name", "openingHours", "phone", "photoBase64", "photoMime", "reviewedAt", "status", "website") SELECT "address", "createdAt", "id", "locale", "name", "openingHours", "phone", "photoBase64", "photoMime", "reviewedAt", "status", "website" FROM "Submission";
DROP TABLE "Submission";
ALTER TABLE "new_Submission" RENAME TO "Submission";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
