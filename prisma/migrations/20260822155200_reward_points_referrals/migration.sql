ALTER TABLE "Invite"
ADD COLUMN "acceptedUserId" TEXT;

CREATE UNIQUE INDEX "Invite_acceptedUserId_key"
ON "Invite"("acceptedUserId");

ALTER TABLE "Invite"
ADD CONSTRAINT "Invite_acceptedUserId_fkey"
FOREIGN KEY ("acceptedUserId")
REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE TABLE "RewardPointLedger" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "submissionId" TEXT,
  "placeId" TEXT,
  "inviteId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RewardPointLedger_pkey"
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RewardPointLedger_sourceKey_key"
ON "RewardPointLedger"("sourceKey");

CREATE INDEX "RewardPointLedger_userId_createdAt_idx"
ON "RewardPointLedger"("userId", "createdAt");

CREATE INDEX "RewardPointLedger_reason_idx"
ON "RewardPointLedger"("reason");

CREATE INDEX "RewardPointLedger_placeId_idx"
ON "RewardPointLedger"("placeId");

CREATE INDEX "RewardPointLedger_inviteId_idx"
ON "RewardPointLedger"("inviteId");

ALTER TABLE "RewardPointLedger"
ADD CONSTRAINT "RewardPointLedger_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;


/*
 * HISTORIQUE :
 * +100 points par lieu distinct validé.
 */
INSERT INTO "RewardPointLedger" (
  "id",
  "userId",
  "points",
  "reason",
  "sourceKey",
  "submissionId",
  "placeId",
  "inviteId",
  "createdAt"
)
SELECT
  md5(
    'reward-contribution:' ||
    historical."userId" ||
    ':' ||
    historical."placeId"
  ),
  historical."userId",
  100,
  'contribution_approved',
  'contribution:' ||
    historical."userId" ||
    ':' ||
    historical."placeId",
  historical."id",
  historical."placeId",
  NULL,
  COALESCE(
    historical."reviewedAt",
    historical."createdAt"
  )
FROM (
  SELECT DISTINCT ON (
    "userId",
    "placeId"
  )
    "id",
    "userId",
    "placeId",
    "createdAt",
    "reviewedAt"
  FROM "Submission"
  WHERE "userId" IS NOT NULL
    AND "status" = 'approved'
    AND "placeId" IS NOT NULL
  ORDER BY
    "userId",
    "placeId",
    COALESCE(
      "reviewedAt",
      "createdAt"
    ) ASC,
    "id" ASC
) AS historical;
