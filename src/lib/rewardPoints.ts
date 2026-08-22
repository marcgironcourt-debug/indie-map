import { prisma } from "@/lib/prisma";

export const CONTRIBUTION_REWARD_POINTS = 100;

export const REFERRAL_INSTALL_REWARD_POINTS = 50;
export const REFERRAL_SIGNUP_REWARD_POINTS = 50;

export const REFERRAL_TOTAL_REWARD_POINTS =
  REFERRAL_INSTALL_REWARD_POINTS +
  REFERRAL_SIGNUP_REWARD_POINTS;

export async function getRewardPointsBalance(
  userId: string,
) {
  const result =
    await prisma.rewardPointLedger.aggregate({
      where: {
        userId,
      },
      _sum: {
        points: true,
      },
    });

  return result._sum.points ?? 0;
}
