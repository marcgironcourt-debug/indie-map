import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getProfessionalPlaceAuthorization,
  resolveProfessionalPlan,
} from "@/lib/professionalAccess";

const V1_HEADERS = {
  "X-API-Version": "1",
  "Cache-Control": "no-store",
} as const;

function cleanText(
  value: unknown,
  max: number,
) {
  if (typeof value !== "string") {
    return null;
  }

  const clean = value.trim();

  if (!clean) {
    return null;
  }

  return clean.slice(0, max);
}

function cleanDate(
  value: unknown,
) {
  const raw =
    cleanText(value, 80);

  if (!raw) {
    return null;
  }

  const date =
    new Date(raw);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return date;
}

export async function GET(
  req: Request,
) {
  try {
    const currentUser =
      await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        {
          ok: false,
          error: "authentication_required",
        },
        {
          status: 401,
          headers: V1_HEADERS,
        },
      );
    }

    const url =
      new URL(req.url);

    const placeId =
      cleanText(
        url.searchParams.get("placeId"),
        200,
      );

    if (!placeId) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_place",
        },
        {
          status: 400,
          headers: V1_HEADERS,
        },
      );
    }

    const authorization =
      await getProfessionalPlaceAuthorization(
        {
          userId:
            currentUser.id,

          placeId,
        },
      );

    if (!authorization) {
      return NextResponse.json(
        {
          ok: false,
          error: "forbidden",
        },
        {
          status: 403,
          headers: V1_HEADERS,
        },
      );
    }

    const promotions =
      await prisma.professionalEventPromotion.findMany(
        {
          where: {
            professionalPlaceId:
              authorization
                .professionalPlace.id,

            userId:
              currentUser.id,
          },

          orderBy: {
            createdAt: "desc",
          },

          take: 30,
        },
      );

    return NextResponse.json(
      {
        ok: true,
        promotions,
      },
      {
        headers: V1_HEADERS,
      },
    );
  } catch (error) {
    console.error(
      "[professional-event-promotions] GET error",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: "server_error",
      },
      {
        status: 500,
        headers: V1_HEADERS,
      },
    );
  }
}

export async function POST(
  req: Request,
) {
  try {
    const currentUser =
      await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        {
          ok: false,
          error: "authentication_required",
        },
        {
          status: 401,
          headers: V1_HEADERS,
        },
      );
    }

    const body =
      await req
        .json()
        .catch(() => null);

    const placeId =
      cleanText(
        body?.placeId,
        200,
      );

    const title =
      cleanText(
        body?.title,
        160,
      );

    const eventType =
      cleanText(
        body?.eventType,
        80,
      );

    const description =
      cleanText(
        body?.description,
        1500,
      );

    const imageUrl =
      cleanText(
        body?.imageUrl,
        500,
      );

    const linkUrl =
      cleanText(
        body?.linkUrl,
        500,
      );

    const eventStartsAt =
      cleanDate(
        body?.eventStartsAt,
      );

    const eventEndsAt =
      body?.eventEndsAt
        ? cleanDate(
            body.eventEndsAt,
          )
        : null;

    const promotionDays =
      Number(
        body?.promotionDays,
      );

    if (
      !placeId ||
      !title ||
      !eventType ||
      !eventStartsAt ||
      ![7, 14, 30].includes(
        promotionDays,
      )
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

    const authorization =
      await getProfessionalPlaceAuthorization(
        {
          userId:
            currentUser.id,

          placeId,
        },
      );

    if (!authorization) {
      return NextResponse.json(
        {
          ok: false,
          error: "forbidden",
        },
        {
          status: 403,
          headers: V1_HEADERS,
        },
      );
    }

    const plan =
      resolveProfessionalPlan(
        authorization
          .professionalPlace,
      );

    /*
     * Premium :
     * promotion incluse.
     *
     * Gratuit + Pro :
     * paiement ponctuel.
     *
     * Aucun prix n'est codé ici pour
     * pouvoir définir les packs plus tard.
     */
    const billingMode =
      plan === "premium"
        ? "included"
        : "one_time";

    const status =
      plan === "premium"
        ? "pending"
        : "payment_required";

    const promotion =
      await prisma.professionalEventPromotion.create(
        {
          data: {
            professionalPlaceId:
              authorization
                .professionalPlace.id,

            userId:
              currentUser.id,

            title,
            eventType,
            description,
            eventStartsAt,
            eventEndsAt,
            promotionDays,
            imageUrl,
            linkUrl,
            billingMode,
            status,
          },
        },
      );

    return NextResponse.json(
      {
        ok: true,
        promotion,
        plan,
      },
      {
        headers: V1_HEADERS,
      },
    );
  } catch (error) {
    console.error(
      "[professional-event-promotions] POST error",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: "server_error",
      },
      {
        status: 500,
        headers: V1_HEADERS,
      },
    );
  }
}
