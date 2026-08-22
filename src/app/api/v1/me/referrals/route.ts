import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  REFERRAL_INSTALL_REWARD_POINTS,
  REFERRAL_SIGNUP_REWARD_POINTS,
  REFERRAL_TOTAL_REWARD_POINTS,
} from "@/lib/rewardPoints";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

export async function POST(
  req: Request,
) {
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

    const body =
      await req.json().catch(
        () => null,
      );

    const locale =
      body?.locale === "en"
        ? "en"
        : "fr";

    const token =
      randomBytes(18).toString(
        "base64url",
      );

    const invite =
      await prisma.invite.create({
        data: {
          senderId: user.id,
          token,
          status: "pending",
        },
        select: {
          id: true,
          token: true,
        },
      });

    const requestUrl =
      new URL(req.url);

    const origin =
      process.env.NODE_ENV ===
      "production"
        ? "https://www.indie-map.com"
        : requestUrl.origin;

    /*
     * L'utilisateur partage toujours
     * UN lien Indie Map.
     *
     * /r/... choisira ensuite Apple,
     * Android ou le web.
     */
    const shareUrl =
      `${origin}/r/` +
      `${encodeURIComponent(invite.token)}` +
      `?lang=${locale}`;

    return NextResponse.json(
      {
        ok: true,
        inviteId: invite.id,
        shareUrl,
        installPoints:
          REFERRAL_INSTALL_REWARD_POINTS,
        signupPoints:
          REFERRAL_SIGNUP_REWARD_POINTS,
        totalPoints:
          REFERRAL_TOTAL_REWARD_POINTS,
      },
      {
        headers: V1_HEADERS,
      },
    );
  } catch (error) {
    console.error(
      "[/api/v1/me/referrals] POST error",
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
