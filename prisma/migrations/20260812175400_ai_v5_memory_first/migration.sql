-- CreateTable
CREATE TABLE "AiVerifiedFact" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "placeName" TEXT,
    "placeAddress" TEXT,
    "scope" TEXT NOT NULL,
    "sourceDomain" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "evidenceText" TEXT NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "verificationQuestion" TEXT,
    "sourceContentHash" TEXT,
    "verifierVersion" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiVerifiedFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiOfficialPageCache" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "finalUrl" TEXT,
    "contentType" TEXT,
    "httpStatus" INTEGER,
    "body" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "etag" TEXT,
    "lastModified" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiOfficialPageCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSearchSignal" (
    "id" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "normalizedQuery" TEXT NOT NULL,
    "queryHash" TEXT NOT NULL,
    "placeId" TEXT,
    "signal" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSearchSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiVerifiedFact_placeId_expiresAt_idx" ON "AiVerifiedFact"("placeId", "expiresAt");

-- CreateIndex
CREATE INDEX "AiVerifiedFact_sourceDomain_idx" ON "AiVerifiedFact"("sourceDomain");

-- CreateIndex
CREATE INDEX "AiVerifiedFact_expiresAt_idx" ON "AiVerifiedFact"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiVerifiedFact_placeId_sourceUrl_evidenceHash_key" ON "AiVerifiedFact"("placeId", "sourceUrl", "evidenceHash");

-- CreateIndex
CREATE UNIQUE INDEX "AiOfficialPageCache_url_key" ON "AiOfficialPageCache"("url");

-- CreateIndex
CREATE INDEX "AiOfficialPageCache_expiresAt_idx" ON "AiOfficialPageCache"("expiresAt");

-- CreateIndex
CREATE INDEX "AiOfficialPageCache_contentHash_idx" ON "AiOfficialPageCache"("contentHash");

-- CreateIndex
CREATE INDEX "AiSearchSignal_queryHash_idx" ON "AiSearchSignal"("queryHash");

-- CreateIndex
CREATE INDEX "AiSearchSignal_placeId_idx" ON "AiSearchSignal"("placeId");

-- CreateIndex
CREATE INDEX "AiSearchSignal_signal_idx" ON "AiSearchSignal"("signal");

-- CreateIndex
CREATE INDEX "AiSearchSignal_source_idx" ON "AiSearchSignal"("source");

-- CreateIndex
CREATE INDEX "AiSearchSignal_observedAt_idx" ON "AiSearchSignal"("observedAt");

