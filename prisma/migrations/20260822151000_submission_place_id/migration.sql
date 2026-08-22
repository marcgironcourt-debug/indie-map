ALTER TABLE "Submission"
ADD COLUMN "placeId" TEXT;

CREATE INDEX "Submission_placeId_idx"
ON "Submission"("placeId");
