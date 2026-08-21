CREATE TABLE IF NOT EXISTS "ProfessionalPlaceChangeRequest" (
  "id" TEXT PRIMARY KEY,
  "professionalPlaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "billingMode" TEXT NOT NULL DEFAULT 'included',
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProfessionalPlaceChangeRequest_professionalPlaceId_fkey"
    FOREIGN KEY ("professionalPlaceId")
    REFERENCES "ProfessionalPlace"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT "ProfessionalPlaceChangeRequest_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS
  "ProfessionalPlaceChangeRequest_professionalPlaceId_status_idx"
  ON "ProfessionalPlaceChangeRequest"(
    "professionalPlaceId",
    "status"
  );

CREATE INDEX IF NOT EXISTS
  "ProfessionalPlaceChangeRequest_userId_createdAt_idx"
  ON "ProfessionalPlaceChangeRequest"(
    "userId",
    "createdAt"
  );

CREATE INDEX IF NOT EXISTS
  "ProfessionalPlaceChangeRequest_kind_status_idx"
  ON "ProfessionalPlaceChangeRequest"(
    "kind",
    "status"
  );


CREATE TABLE IF NOT EXISTS "ProfessionalEventPromotion" (
  "id" TEXT PRIMARY KEY,
  "professionalPlaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "description" TEXT,
  "eventStartsAt" TIMESTAMP(3) NOT NULL,
  "eventEndsAt" TIMESTAMP(3),
  "promotionDays" INTEGER NOT NULL,
  "imageUrl" TEXT,
  "linkUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "billingMode" TEXT NOT NULL DEFAULT 'one_time',
  "priceCents" INTEGER,
  "currency" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProfessionalEventPromotion_professionalPlaceId_fkey"
    FOREIGN KEY ("professionalPlaceId")
    REFERENCES "ProfessionalPlace"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT "ProfessionalEventPromotion_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS
  "ProfessionalEventPromotion_professionalPlaceId_status_idx"
  ON "ProfessionalEventPromotion"(
    "professionalPlaceId",
    "status"
  );

CREATE INDEX IF NOT EXISTS
  "ProfessionalEventPromotion_userId_createdAt_idx"
  ON "ProfessionalEventPromotion"(
    "userId",
    "createdAt"
  );

CREATE INDEX IF NOT EXISTS
  "ProfessionalEventPromotion_eventStartsAt_idx"
  ON "ProfessionalEventPromotion"(
    "eventStartsAt"
  );
