import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

export async function GET() {
  try {
    const user = await getCurrentUser({
      refreshSession: true,
    });

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: "unauthorized",
        },
        {
          status: 401,
          headers: V1_HEADERS,
        },
      );
    }

    const submissions =
      await prisma.submission.findMany({
        where: {
          userId: user.id,
          status: "approved",
          placeId: {
            not: null,
          },
        },
        orderBy: [
          {
            reviewedAt: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
        select: {
          placeId: true,
          reviewedAt: true,
        },
      });

    const contributions =
      submissions.flatMap((submission) => {
        if (!submission.placeId) {
          return [];
        }

        return [
          {
            placeId: submission.placeId,
            approvedAt:
              submission.reviewedAt?.toISOString() ??
              null,
          },
        ];
      });

    return NextResponse.json(
      {
        ok: true,
        contributions,
      },
      {
        headers: V1_HEADERS,
      },
    );
  } catch (error) {
    console.error(
      "[/api/v1/me/contributions] GET error",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
      },
      {
        status: 500,
        headers: V1_HEADERS,
      },
    );
  }
}
