import {
  createHash,
  timingSafeEqual,
} from "node:crypto";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  REFERRAL_INSTALL_REWARD_POINTS,
  REFERRAL_SIGNUP_REWARD_POINTS,
} from "@/lib/rewardPoints";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IOS_APP_ID = "id6761104779";
const ANDROID_APP_ID = "com.indiemap.app";

const ALLOWED_APP_IDS =
  new Set([
    IOS_APP_ID,
    ANDROID_APP_ID,
  ]);

function normalizeString(
  value: unknown,
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeReferralToken(
  value: unknown,
) {
  const token =
    normalizeString(value);

  if (
    token.length < 10 ||
    token.length > 200 ||
    !/^[A-Za-z0-9_-]+$/.test(token)
  ) {
    return "";
  }

  return token;
}

function safeEqual(
  left: string,
  right: string,
) {
  const a =
    Buffer.from(left);
  const b =
    Buffer.from(right);

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

function getAuthorizationToken(
  req: Request,
) {
  const authorization =
    normalizeString(
      req.headers.get(
        "authorization",
      ),
    );

  if (!authorization) {
    return "";
  }

  /*
   * AppsFlyer peut envoyer la valeur
   * directement dans Authorization.
   *
   * On accepte aussi Bearer afin de
   * garder l'endpoint tolérant aux deux
   * formes sans affaiblir la comparaison.
   */
  if (
    authorization
      .toLowerCase()
      .startsWith("bearer ")
  ) {
    return authorization
      .slice(7)
      .trim();
  }

  return authorization;
}

function response(
  data: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(
    data,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}

export async function POST(
  req: Request,
) {
  /*
   * Important :
   * le bouton "Send test" d'AppsFlyer
   * n'envoie PAS le token Authorization.
   *
   * Une requête sans Authorization reçoit
   * donc HTTP 200 pour permettre ce test,
   * mais elle ne touche jamais aux points.
   */
  const receivedToken =
    getAuthorizationToken(req);

  if (!receivedToken) {
    return response({
      ok: true,
      test: true,
      credited: false,
    });
  }

  const expectedToken =
    normalizeString(
      process.env
        .APPSFLYER_PUSH_API_TOKEN,
    );

  if (!expectedToken) {
    console.error(
      "[AppsFlyer] Push API token serveur absent",
    );

    return response(
      {
        ok: false,
        error:
          "server_not_configured",
      },
      503,
    );
  }

  if (
    !safeEqual(
      receivedToken,
      expectedToken,
    )
  ) {
    return response(
      {
        ok: false,
        error:
          "unauthorized",
      },
      401,
    );
  }

  const body =
    await req.json().catch(
      () => null,
    );

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return response(
      {
        ok: false,
        error:
          "invalid_payload",
      },
      400,
    );
  }

  const payload =
    body as Record<
      string,
      unknown
    >;

  const appId =
    normalizeString(
      payload.app_id,
    );

  const eventName =
    normalizeString(
      payload.event_name,
    ).toLowerCase();

  const eventType =
    normalizeString(
      payload.event_type,
    ).toLowerCase();

  const conversionType =
    normalizeString(
      payload.conversion_type,
    ).toLowerCase();

  const campaignType =
    normalizeString(
      payload.campaign_type,
    ).toLowerCase();

  const mediaSource =
    normalizeString(
      payload.media_source,
    );

  const campaign =
    normalizeString(
      payload.campaign,
    );

  const referralToken =
    normalizeReferralToken(
      payload.af_sub1,
    );

  const appsFlyerId =
    normalizeString(
      payload.appsflyer_id,
    );

  /*
   * Ce endpoint ne doit jamais traiter
   * autre chose que les deux apps Indie Map.
   */
  if (
    !ALLOWED_APP_IDS.has(appId)
  ) {
    return response({
      ok: true,
      ignored:
        "unknown_app",
    });
  }

  /*
   * On configure AppsFlyer pour n'envoyer
   * que Install / Non-organic.
   *
   * event_name=install est obligatoire.
   * Si event_type est présent, il doit lui
   * aussi correspondre à un install.
   */
  if (
    eventName !== "install" ||
    (
      eventType &&
      eventType !== "install"
    ) ||
    (
      conversionType &&
      conversionType !== "install"
    ) ||
    (
      campaignType &&
      campaignType !== "ua"
    )
  ) {
    return response({
      ok: true,
      ignored:
        "not_install",
    });
  }

  if (
    mediaSource !== "User_invite" ||
    campaign !== "referral"
  ) {
    return response({
      ok: true,
      ignored:
        "not_referral",
    });
  }

  if (!referralToken) {
    return response({
      ok: true,
      ignored:
        "invalid_referral_token",
    });
  }

  if (!appsFlyerId) {
    return response({
      ok: true,
      ignored:
        "missing_appsflyer_id",
    });
  }

  /*
   * On ne conserve pas l'AppsFlyer ID brut
   * dans le ledger.
   *
   * Il sert à fabriquer une empreinte unique
   * de cette installation et de cette app.
   */
  const installationHash =
    createHash("sha256")
      .update(
        `${appId}:${appsFlyerId}`,
      )
      .digest("hex");

  const installationKey =
    `appsflyer:${installationHash}`;

  try {
    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
           * Sérialise le webhook AppsFlyer
           * avec une éventuelle inscription
           * simultanée utilisant la même
           * invitation.
           */
          await tx.$queryRaw`
            SELECT "id"
            FROM "Invite"
            WHERE "token" = ${referralToken}
            FOR UPDATE
          `;

          const invite =
            await tx.invite.findUnique({
              where: {
                token:
                  referralToken,
              },
              select: {
                id: true,
                senderId: true,
                status: true,
                acceptedUserId:
                  true,
              },
            });

          if (!invite) {
            return {
              credited: false,
              ignored:
                "invite_not_found",
            };
          }

          if (
            invite.status !==
              "pending" &&
            invite.status !==
              "accepted"
          ) {
            return {
              credited: false,
              ignored:
                "invite_inactive",
            };
          }

          /*
           * Une même installation AppsFlyer
           * ne peut créditer deux invitations.
           */
          const existingInstallation =
            await tx
              .rewardPointLedger
              .findUnique({
                where: {
                  installationKey,
                },
                select: {
                  id: true,
                },
              });

          if (existingInstallation) {
            return {
              credited: false,
              duplicate: true,
            };
          }

          /*
           * Une invitation ne peut recevoir
           * qu'une seule récompense install,
           * même en cas de réinstallation.
           */
          const installSourceKey =
            `referral_install:${invite.id}`;

          const existingInviteInstall =
            await tx
              .rewardPointLedger
              .findUnique({
                where: {
                  sourceKey:
                    installSourceKey,
                },
                select: {
                  id: true,
                },
              });

          if (existingInviteInstall) {
            return {
              credited: false,
              duplicate: true,
            };
          }

          await tx
            .rewardPointLedger
            .create({
              data: {
                userId:
                  invite.senderId,
                points:
                  REFERRAL_INSTALL_REWARD_POINTS,
                reason:
                  "referral_install",
                sourceKey:
                  installSourceKey,
                inviteId:
                  invite.id,
                installationKey,
              },
            });

          /*
           * Cas 1 :
           * installation AppsFlyer avant signup
           * -> +50 install maintenant.
           *
           * Cas 2 :
           * signup a eu lieu avant l'arrivée
           * du Push API
           * -> on crédite aussi les +50 signup
           * maintenant.
           */
          if (
            invite.acceptedUserId
          ) {
            await tx
              .rewardPointLedger
              .upsert({
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

          return {
            credited: true,
            inviteId:
              invite.id,
          };
        },
      );

    return response({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "[AppsFlyer] install webhook error",
      error,
    );

    return response(
      {
        ok: false,
        error:
          "processing_failed",
      },
      500,
    );
  }
}
