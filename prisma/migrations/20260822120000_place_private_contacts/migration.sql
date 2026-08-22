-- CreateTable
CREATE TABLE "PlacePrivateContact" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "emailDomain" TEXT,
    "contactRole" TEXT NOT NULL DEFAULT 'unknown',
    "verificationStatus" TEXT NOT NULL DEFAULT 'manual_verified',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlacePrivateContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacePrivateContactEvidence" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceContentHash" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "PlacePrivateContactEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlacePrivateContact_placeId_idx"
ON "PlacePrivateContact"("placeId");

-- CreateIndex
CREATE INDEX "PlacePrivateContact_normalizedEmail_idx"
ON "PlacePrivateContact"("normalizedEmail");

-- CreateIndex
CREATE INDEX "PlacePrivateContact_emailDomain_idx"
ON "PlacePrivateContact"("emailDomain");

-- CreateIndex
CREATE INDEX "PlacePrivateContact_verificationStatus_idx"
ON "PlacePrivateContact"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "PlacePrivateContact_placeId_normalizedEmail_key"
ON "PlacePrivateContact"("placeId", "normalizedEmail");

-- CreateIndex
CREATE INDEX "PlacePrivateContactEvidence_contactId_idx"
ON "PlacePrivateContactEvidence"("contactId");

-- CreateIndex
CREATE INDEX "PlacePrivateContactEvidence_sourceKind_idx"
ON "PlacePrivateContactEvidence"("sourceKind");

-- CreateIndex
CREATE INDEX "PlacePrivateContactEvidence_expiresAt_idx"
ON "PlacePrivateContactEvidence"("expiresAt");

-- AddForeignKey
ALTER TABLE "PlacePrivateContactEvidence"
ADD CONSTRAINT "PlacePrivateContactEvidence_contactId_fkey"
FOREIGN KEY ("contactId")
REFERENCES "PlacePrivateContact"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
