ALTER TABLE "RewardPointLedger"
ADD COLUMN "installationKey" TEXT;

CREATE UNIQUE INDEX "RewardPointLedger_installationKey_key"
ON "RewardPointLedger"("installationKey");
