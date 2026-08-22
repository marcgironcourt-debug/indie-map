import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RequestValue = {
  proposedFile?: {
    type?: unknown;
    base64?: unknown;
  };
};

const ALLOWED_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

function isObj(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return Boolean(
    value &&
      typeof value ===
        "object" &&
      !Array.isArray(value),
  );
}

export async function GET(
  _req: Request,
  context: {
    params:
      Promise<{
        requestId:
          string;
      }>;
  },
) {
  try {
    const {
      requestId,
    } =
      await context.params;

    const cleanId =
      String(
        requestId || "",
      ).trim();

    if (!cleanId) {
      return new NextResponse(
        null,
        {
          status: 404,
        },
      );
    }

    const request =
      await prisma
        .professionalPlaceChangeRequest
        .findUnique({
          where: {
            id: cleanId,
          },

          select: {
            kind: true,
            status: true,
            value: true,
          },
        });

    if (
      !request ||
      request.kind !==
        "panoramaImage" ||
      request.status !==
        "approved" ||
      !isObj(request.value)
    ) {
      return new NextResponse(
        null,
        {
          status: 404,
        },
      );
    }

    const value =
      request.value as
        RequestValue;

    const file =
      value.proposedFile;

    if (
      !file ||
      typeof file.type !==
        "string" ||
      typeof file.base64 !==
        "string" ||
      !ALLOWED_TYPES.has(
        file.type,
      )
    ) {
      return new NextResponse(
        null,
        {
          status: 404,
        },
      );
    }

    const buffer =
      Buffer.from(
        file.base64,
        "base64",
      );

    if (
      buffer.length === 0 ||
      buffer.length >
        3 * 1024 * 1024
    ) {
      return new NextResponse(
        null,
        {
          status: 404,
        },
      );
    }

    return new NextResponse(
      new Uint8Array(
        buffer,
      ),
      {
        headers: {
          "Content-Type":
            file.type,

          "Cache-Control":
            "public, max-age=300, s-maxage=3600",
        },
      },
    );
  } catch (error) {
    console.error(
      "[professional-place-images] error",
      error,
    );

    return new NextResponse(
      null,
      {
        status: 500,
      },
    );
  }
}
