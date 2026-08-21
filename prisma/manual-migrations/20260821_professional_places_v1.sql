CREATE TABLE IF NOT EXISTS "ProfessionalPlace" (
  "id" TEXT PRIMARY KEY,
  "placeId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "plan" TEXT,
  "accessStatus" TEXT NOT NULL DEFAULT 'inactive',
  "accessStartsAt" TIMESTAMP(3),
  "accessEndsAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS
  "ProfessionalPlace_placeId_key"
  ON "ProfessionalPlace"("placeId");

CREATE INDEX IF NOT EXISTS
  "ProfessionalPlace_status_idx"
  ON "ProfessionalPlace"("status");

CREATE INDEX IF NOT EXISTS
  "ProfessionalPlace_accessStatus_idx"
  ON "ProfessionalPlace"("accessStatus");

CREATE TABLE IF NOT EXISTS "ProfessionalPlaceMember" (
  "id" TEXT PRIMARY KEY,
  "professionalPlaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'owner',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProfessionalPlaceMember_professionalPlaceId_fkey"
    FOREIGN KEY ("professionalPlaceId")
    REFERENCES "ProfessionalPlace"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT "ProfessionalPlaceMember_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS
  "ProfessionalPlaceMember_professionalPlaceId_userId_key"
  ON "ProfessionalPlaceMember"(
    "professionalPlaceId",
    "userId"
  );

CREATE INDEX IF NOT EXISTS
  "ProfessionalPlaceMember_userId_idx"
  ON "ProfessionalPlaceMember"("userId");

CREATE INDEX IF NOT EXISTS
  "ProfessionalPlaceMember_professionalPlaceId_role_idx"
  ON "ProfessionalPlaceMember"(
    "professionalPlaceId",
    "role"
  );
