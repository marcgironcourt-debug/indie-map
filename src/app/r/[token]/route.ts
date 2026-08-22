import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

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
   * TEMPORAIRE :
   *
   * tant que OneLink n'est pas branché,
   * le lien personnel ouvre Indie Map
   * avec le token de parrainage.
   *
   * OneLink remplacera cette redirection
   * pour gérer App Store / Google Play
   * et l'attribution d'installation.
   */
  destination.searchParams.set(
    "panel",
    "personalSpace",
  );

  destination.searchParams.set(
    "invite",
    token,
  );

  return NextResponse.redirect(
    destination,
  );
}
