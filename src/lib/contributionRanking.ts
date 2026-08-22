import { prisma } from "@/lib/prisma";

type ContributionRankingRow = {
  userId: string;
  contributionsCount: number;
  reachedAt: Date | null;
};

export type ContributionRanking = {
  contributionsCount: number;
  contributionRank: number | null;
};

export async function getContributionRankingMap() {
  const rows = await prisma.$queryRaw<ContributionRankingRow[]>`
    SELECT
      "userId",
      COUNT(DISTINCT "placeId")::int AS "contributionsCount",
      MAX(COALESCE("reviewedAt", "createdAt")) AS "reachedAt"
    FROM "Submission"
    WHERE "userId" IS NOT NULL
      AND "status" = 'approved'
      AND "placeId" IS NOT NULL
    GROUP BY "userId"
    ORDER BY
      "contributionsCount" DESC,
      "reachedAt" ASC,
      "userId" ASC
  `;

  const ranking = new Map<string, ContributionRanking>();

  rows.forEach((row, index) => {
    ranking.set(row.userId, {
      contributionsCount: row.contributionsCount,
      contributionRank: index + 1,
    });
  });

  return ranking;
}

export async function getContributionRankForUser(
  userId: string,
): Promise<ContributionRanking> {
  const ranking = await getContributionRankingMap();

  return (
    ranking.get(userId) ?? {
      contributionsCount: 0,
      contributionRank: null,
    }
  );
}
