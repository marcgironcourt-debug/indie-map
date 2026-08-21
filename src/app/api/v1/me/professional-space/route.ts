import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProfessionalAccessForUser } from "@/lib/professionalAccess";

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

    const access =
      await getProfessionalAccessForUser(
        {
          userId:
            currentUser.id,

          requestedPlaceId,

          capability: "space",
        },
      );

    if (
      !access ||
      !access.selected
    ) {
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
        places:
          access.places,
        selected:
          access.selected,
      },
      {
        headers: V1_HEADERS,
      },
    );
  } catch (error) {
    console.error(
      "[professional-space] error",
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
