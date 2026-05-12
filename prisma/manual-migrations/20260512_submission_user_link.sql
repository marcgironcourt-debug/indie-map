ALTER TABLE "Submission" ADD COLUMN "userId" TEXT;
CREATE INDEX "Submission_userId_idx" ON "Submission"("userId");
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
