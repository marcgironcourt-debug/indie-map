ALTER TABLE "Submission" ADD COLUMN "reviewToken" TEXT;
CREATE UNIQUE INDEX "Submission_reviewToken_key" ON "Submission"("reviewToken");
