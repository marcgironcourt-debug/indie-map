import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import {
  getRewardPointsBalance,
  REFERRAL_INSTALL_REWARD_POINTS,
  REFERRAL_SIGNUP_REWARD_POINTS,
  REFERRAL_TOTAL_REWARD_POINTS,
} from "@/lib/rewardPoints";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

export async function GET() {
  try {
    const user =
      await getCurrentUser({
        refreshSession: true,
      });

    if (!user) {
      return NextResponse.json(
        { ok: false },
        {
          status: 401,
          headers: V1_HEADERS,
        },
      );
    }

    const balance =
      await getRewardPointsBalance(
        user.id,
      );

    return NextResponse.json(
      {
        ok: true,
        balance,
        referral: {
          installPoints:
            REFERRAL_INSTALL_REWARD_POINTS,
          signupPoints:
            REFERRAL_SIGNUP_REWARD_POINTS,
          totalPoints:
            REFERRAL_TOTAL_REWARD_POINTS,

          /*
           * L'attribution native d'installation
           * sera activée séparément.
           */
          installAttributionEnabled:
            Boolean(
              process.env
                .APPSFLYER_PUSH_API_TOKEN,
            ),
        },
      },
      {
        headers: V1_HEADERS,
      },
    );
  } catch (error) {
    console.error(
      "[/api/v1/me/rewards] GET error",
      error,
    );

    return NextResponse.json(
      { ok: false },
      {
        status: 500,
        headers: V1_HEADERS,
      },
    );
  }
}
