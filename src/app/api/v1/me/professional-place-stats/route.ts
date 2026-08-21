import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getProfessionalPlaceAnalyticsForUser,
  normalizeProfessionalAnalyticsRange,
} from "@/lib/professionalAnalytics";

const V1_HEADERS = {
  "X-API-Version": "1",
  "Cache-Control": "no-store",
} as const;

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
          error:
            "authentication_required",
        },
        {
          status: 401,
          headers: V1_HEADERS,
        },
      );
    }

    const url =
      new URL(req.url);

    const requestedPlaceId =
      url.searchParams.get(
        "placeId",
      );

    const range =
      normalizeProfessionalAnalyticsRange(
        url.searchParams.get(
          "range",
        ),
      );

    const result =
      await getProfessionalPlaceAnalyticsForUser(
        {
          userId:
            currentUser.id,

          requestedPlaceId,
          range,
        },
      );

    if (!result) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "professional_place_not_found",
        },
        {
          status: 404,
          headers: V1_HEADERS,
        },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        ...result,
      },
      {
        headers: V1_HEADERS,
      },
    );
  } catch (error) {
    console.error(
      "[professional-place-stats] error",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "server_error",
      },
      {
        status: 500,
        headers: V1_HEADERS,
      },
    );
  }
}
