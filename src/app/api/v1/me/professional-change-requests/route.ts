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

const FREE_KINDS = new Set([
  "name",
  "address",
  "openingHours",
  "phone",
  "website",
]);

const PRO_KINDS = new Set([
  ...FREE_KINDS,
  "miniText",
  "panoramaImage",
  "gallery",
]);

const PREMIUM_KINDS = new Set([
  ...PRO_KINDS,
  "immersionVideo",
]);

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

function allowedKindsForPlan(
  plan: "free" | "pro" | "premium",
) {
  if (plan === "premium") {
    return PREMIUM_KINDS;
  }

  if (plan === "pro") {
    return PRO_KINDS;
  }

  return FREE_KINDS;
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
          userId: currentUser.id,
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

    const requests =
      await prisma.professionalPlaceChangeRequest.findMany(
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
        requests,
      },
      {
        headers: V1_HEADERS,
      },
    );
  } catch (error) {
    console.error(
      "[professional-change-requests] GET error",
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

    const kind =
      cleanText(
        body?.kind,
        80,
      );

    const note =
      cleanText(
        body?.note,
        1000,
      );

    if (
      !placeId ||
      !kind ||
      body?.value === undefined
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

    const allowedKinds =
      allowedKindsForPlan(plan);

    /*
     * La vidéo est incluse en Premium,
     * mais uniquement en paiement
     * ponctuel pour Pro.
     *
     * En Gratuit elle n'est pas
     * disponible.
     */
    let billingMode =
      "included";

    let status =
      "pending";

    if (
      kind === "immersionVideo" &&
      plan === "pro"
    ) {
      billingMode =
        "one_time";

      status =
        "payment_required";
    } else if (
      !allowedKinds.has(kind)
    ) {
      if (
        kind === "immersionVideo" &&
        plan === "free"
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "upgrade_required",
          },
          {
            status: 403,
            headers: V1_HEADERS,
          },
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: "plan_required",
        },
        {
          status: 403,
          headers: V1_HEADERS,
        },
      );
    }

    const request =
      await prisma.professionalPlaceChangeRequest.create(
        {
          data: {
            professionalPlaceId:
              authorization
                .professionalPlace.id,

            userId:
              currentUser.id,

            kind,

            value:
              body.value,

            note,

            status,

            billingMode,
          },
        },
      );

    return NextResponse.json(
      {
        ok: true,
        request,
        plan,
      },
      {
        headers: V1_HEADERS,
      },
    );
  } catch (error) {
    console.error(
      "[professional-change-requests] POST error",
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
