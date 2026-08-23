import { NextResponse } from "next/server";

import {
  AUTH_COOKIE,
  hashPassword,
  hashToken,
  makeSessionExpiresAt,
  makeToken,
  normalizeEmail,
  normalizePassword,
  normalizeUsername,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  REFERRAL_SIGNUP_REWARD_POINTS,
} from "@/lib/rewardPoints";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

function serializeUser(user: {
  id: string;
  email: string | null;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  avatarColor: string | null;
  homeCity: string | null;
  ageRange: string | null;
  profileCompletedAt: Date | null;
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    avatarColor: user.avatarColor,
    homeCity: user.homeCity,
    ageRange: user.ageRange,
    profileCompleted: Boolean(
      user.profileCompletedAt,
    ),
  };
}

function normalizeReferralToken(
  value: unknown,
) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, 200);
}

export async function POST(
  req: Request,
) {
  try {
    const body =
      await req.json().catch(
        () => null,
      );

    const email =
      normalizeEmail(body?.email);

    const username =
      normalizeUsername(
        body?.username,
      );

    const password =
      normalizePassword(
        body?.password,
      );

    const referralToken =
      normalizeReferralToken(
        body?.referralToken,
      );

    if (
      !email ||
      !username ||
      !password
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_input",
        },
        {
          status: 400,
          headers: V1_HEADERS,
        },
      );
    }

    const existingEmail =
      await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

    if (existingEmail) {
      return NextResponse.json(
        {
          ok: false,
          error: "email_taken",
        },
        {
          status: 409,
          headers: V1_HEADERS,
        },
      );
    }

    const existingUsername =
      await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });

    if (existingUsername) {
      return NextResponse.json(
        {
          ok: false,
          error: "username_taken",
        },
        {
          status: 409,
          headers: V1_HEADERS,
        },
      );
    }

    const passwordHash =
      await hashPassword(password);

    const rawSession =
      makeToken();

    const sessionToken =
      hashToken(rawSession);

    const expiresAt =
      makeSessionExpiresAt();

    const user =
      await prisma.$transaction(
        async (tx) => {
          const createdUser =
            await tx.user.create({
              data: {
                email,
                username,
                passwordHash,
                displayName: username,
              },
            });

          await tx.userSession.create({
            data: {
              userId: createdUser.id,
              token: sessionToken,
              expiresAt,
            },
          });

          /*
           * Le parrain n'est récompensé
           * que lorsqu'un VRAI nouveau
           * compte est créé.
           */
          if (referralToken) {
            const invite =
              await tx.invite.findUnique({
                where: {
                  token: referralToken,
                },
                select: {
                  id: true,
                  senderId: true,
                  status: true,
                  acceptedAt: true,
                  acceptedUserId: true,
                },
              });

            if (
              invite &&
              invite.status ===
                "pending" &&
              !invite.acceptedAt &&
              !invite.acceptedUserId
            ) {
              /*
               * updateMany protège aussi
               * contre deux inscriptions
               * simultanées avec le même
               * lien.
               */
              const claimed =
                await tx.invite.updateMany({
                  where: {
                    id: invite.id,
                    status: "pending",
                    acceptedUserId: null,
                  },
                  data: {
                    status: "accepted",
                    acceptedAt: new Date(),
                    acceptedUserId:
                      createdUser.id,
                  },
                });

              if (claimed.count === 1) {
                /*
                 * Les +50 de création de compte
                 * sont supplémentaires aux +50
                 * d'installation réelle.
                 *
                 * Si le Push API AppsFlyer est
                 * déjà arrivé, on peut les
                 * créditer immédiatement.
                 *
                 * Sinon, le webhook AppsFlyer
                 * les créditera lorsqu'il
                 * confirmera l'installation.
                 */
                const installReward =
                  await tx.rewardPointLedger.findUnique({
                    where: {
                      sourceKey:
                        `referral_install:${invite.id}`,
                    },
                    select: {
                      id: true,
                    },
                  });

                if (installReward) {
                  await tx.rewardPointLedger.upsert({
                    where: {
                      sourceKey:
                        `referral_signup:${invite.id}`,
                    },
                    update: {},
                    create: {
                      userId:
                        invite.senderId,
                      points:
                        REFERRAL_SIGNUP_REWARD_POINTS,
                      reason:
                        "referral_signup",
                      sourceKey:
                        `referral_signup:${invite.id}`,
                      inviteId:
                        invite.id,
                    },
                  });
                }
              }
            }
          }

          return createdUser;
        },
      );

    const res =
      NextResponse.json(
        {
          ok: true,
          user:
            serializeUser(user),
        },
        {
          headers: V1_HEADERS,
        },
      );

    res.cookies.set(
      AUTH_COOKIE,
      rawSession,
      {
        httpOnly: true,
        sameSite: "lax",
        secure:
          process.env.NODE_ENV ===
          "production",
        path: "/",
        expires: expiresAt,
      },
    );

    return res;
  } catch (err) {
    console.error(
      "[/api/v1/auth/signup] error",
      err,
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
