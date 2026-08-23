import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const APPS_FLYER_ONE_LINK_BASE =
  "https://indie-map.onelink.me/HxW0";

const APPS_FLYER_REFERRAL_MEDIA_SOURCE =
  "User_invite";

const APPS_FLYER_REFERRAL_CAMPAIGN =
  "referral";

function normalizeToken(
  value: unknown,
) {
  if (typeof value !== "string") {
    return "";
  }

  const token = value.trim();

  if (
    token.length < 10 ||
    token.length > 200 ||
    !/^[A-Za-z0-9_-]+$/.test(token)
  ) {
    return "";
  }

  return token;
}

export async function GET(
  req: Request,
  context: {
    params: Promise<{
      token: string;
    }>;
  },
) {
  const { token: rawToken } =
    await context.params;

  const token =
    normalizeToken(rawToken);

  const requestUrl =
    new URL(req.url);

  const locale =
    requestUrl.searchParams.get("lang") === "en"
      ? "en"
      : "fr";

  const destination =
    new URL(
      `/${locale}`,
      requestUrl.origin,
    );

  if (!token) {
    return NextResponse.redirect(
      destination,
    );
  }

  const invite =
    await prisma.invite.findUnique({
      where: {
        token,
      },
      select: {
        id: true,
      },
    });

  if (!invite) {
    return NextResponse.redirect(
      destination,
    );
  }

  /*
   * La route /r/[token] reste le lien public stable :
   *
   * 1. Indie Map valide d'abord que le token existe.
   * 2. Le clic est ensuite transmis à AppsFlyer OneLink.
   * 3. OneLink gère :
   *    - ouverture de l'app si elle est installée ;
   *    - App Store / Google Play sinon ;
   *    - deferred deep linking après installation.
   *
   * Le token reste dans deep_link_sub1 afin que les
   * wrappers iOS / Android puissent le restituer à Indie Map.
   */
  destination.searchParams.set(
    "panel",
    "personalSpace",
  );

  destination.searchParams.set(
    "invite",
    token,
  );

  const oneLink =
    new URL(
      APPS_FLYER_ONE_LINK_BASE,
    );

  oneLink.searchParams.set(
    "pid",
    APPS_FLYER_REFERRAL_MEDIA_SOURCE,
  );

  oneLink.searchParams.set(
    "c",
    APPS_FLYER_REFERRAL_CAMPAIGN,
  );

  oneLink.searchParams.set(
    "deep_link_value",
    "referral",
  );

  oneLink.searchParams.set(
    "deep_link_sub1",
    token,
  );

  /*
   * Même token dans af_sub1 pour qu'il soit disponible
   * dans les données brutes d'installation AppsFlyer.
   *
   * deep_link_sub1 = routage dans l'app
   * af_sub1        = rapprochement serveur / attribution
   */
  oneLink.searchParams.set(
    "af_sub1",
    token,
  );

  /*
   * Sur desktop, conserver l'expérience web Indie Map
   * et le token de parrainage.
   */
  oneLink.searchParams.set(
    "af_web_dp",
    destination.toString(),
  );

  /*
   * Empêche AppsFlyer de recopier pid/c/deep_link_*
   * dans l'URL web finale.
   */
  oneLink.searchParams.set(
    "af_param_forwarding",
    "false",
  );

  return NextResponse.redirect(
    oneLink,
  );
}
