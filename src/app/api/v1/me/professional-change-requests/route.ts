import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";
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

const MAX_IMAGE_BYTES =
  3 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

const FIELD_LIMITS = {
  name: 200,
  address: 300,
  openingHours: 1200,
  phone: 100,
  website: 500,
  miniText: 1200,
} as const;

type EditableField =
  keyof typeof FIELD_LIMITS;

type RequestValue = {
  groupId?: string;
  currentValue?: string | null;
  proposedValue?: string | null;
  reviewToken?: string;
  proposedFile?: {
    name?: string;
    type?: string;
    size?: number;
    base64?: string;
  };
};

function cleanText(
  value: unknown,
  max: number,
) {
  if (typeof value !== "string") {
    return null;
  }

  return value
    .trim()
    .slice(0, max);
}

function formText(
  fd: FormData,
  key: string,
  max: number,
) {
  const value =
    fd.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .slice(0, max);
}

function formatSender(
  from: string,
) {
  const clean =
    from.trim();

  if (!clean) {
    return clean;
  }

  if (
    clean.includes("<") &&
    clean.includes(">")
  ) {
    return clean;
  }

  return `Indie Map <${clean}>`;
}

function esc(
  value: string,
) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function labelForKind(
  kind: string,
) {
  const labels: Record<
    string,
    string
  > = {
    name: "Nom",
    address: "Adresse",
    openingHours: "Horaires",
    phone: "Téléphone",
    website: "Site web",
    miniText: "miniText",
    panoramaImage: "Image",
  };

  return labels[kind] || kind;
}

function safeRequestValue(
  value: unknown,
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return value;
  }

  const source =
    value as RequestValue;

  return {
    groupId:
      source.groupId,

    currentValue:
      source.currentValue,

    proposedValue:
      source.proposedValue,

    proposedFile:
      source.proposedFile
        ? {
            name:
              source.proposedFile.name,
            type:
              source.proposedFile.type,
            size:
              source.proposedFile.size,
          }
        : undefined,
  };
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

    const placeId =
      cleanText(
        url.searchParams.get(
          "placeId",
        ),
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

    const requests =
      await prisma
        .professionalPlaceChangeRequest
        .findMany({
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

          take: 50,
        });

    return NextResponse.json(
      {
        ok: true,

        requests:
          requests.map(
            ({
              value,
              ...request
            }) => ({
              ...request,
              value:
                safeRequestValue(
                  value,
                ),
            }),
          ),
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
          error:
            "authentication_required",
        },
        {
          status: 401,
          headers: V1_HEADERS,
        },
      );
    }

    const contentType =
      req.headers.get(
        "content-type",
      ) || "";

    if (
      !contentType
        .toLowerCase()
        .includes(
          "multipart/form-data",
        )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "invalid_content_type",
        },
        {
          status: 400,
          headers: V1_HEADERS,
        },
      );
    }

    const fd =
      await req.formData();

    const placeId =
      formText(
        fd,
        "placeId",
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

    const plan =
      resolveProfessionalPlan(
        authorization
          .professionalPlace,
      );

    const cataloguePlace =
      authorization
        .cataloguePlace;

    if (!cataloguePlace) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "catalogue_place_not_found",
        },
        {
          status: 404,
          headers: V1_HEADERS,
        },
      );
    }

    const proposedValues:
      Record<
        EditableField,
        string
      > = {
      name:
        formText(
          fd,
          "name",
          FIELD_LIMITS.name,
        ),
      address:
        formText(
          fd,
          "address",
          FIELD_LIMITS.address,
        ),
      openingHours:
        formText(
          fd,
          "openingHours",
          FIELD_LIMITS.openingHours,
        ),
      phone:
        formText(
          fd,
          "phone",
          FIELD_LIMITS.phone,
        ),
      website:
        formText(
          fd,
          "website",
          FIELD_LIMITS.website,
        ),
      miniText:
        formText(
          fd,
          "miniText",
          FIELD_LIMITS.miniText,
        ),
    };

    if (
      proposedValues.name.length <
      2
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_name",
        },
        {
          status: 400,
          headers: V1_HEADERS,
        },
      );
    }

    const currentValues:
      Record<
        EditableField,
        string
      > = {
      name:
        cataloguePlace.name || "",
      address:
        cataloguePlace.address || "",
      openingHours:
        cataloguePlace.openingHours || "",
      phone:
        cataloguePlace.phone || "",
      website:
        cataloguePlace.website || "",
      miniText:
        cataloguePlace.miniText || "",
    };

    const textChanges =
      (
        Object.keys(
          proposedValues,
        ) as EditableField[]
      )
        .filter(
          (kind) =>
            proposedValues[
              kind
            ].trim() !==
            currentValues[
              kind
            ].trim(),
        )
        .map((kind) => ({
          kind,
          currentValue:
            currentValues[kind],
          proposedValue:
            proposedValues[kind],
        }));

    const imageEntry =
      fd.get("image");

    let imageChange:
      | {
          kind:
            "panoramaImage";
          currentValue:
            string;
          proposedFile: {
            name: string;
            type: string;
            size: number;
            base64: string;
          };
          buffer: Buffer;
        }
      | null = null;

    if (
      imageEntry instanceof File &&
      imageEntry.size > 0
    ) {
      if (
        imageEntry.size >
        MAX_IMAGE_BYTES
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "image_too_large",
          },
          {
            status: 400,
            headers: V1_HEADERS,
          },
        );
      }

      if (
        !ALLOWED_IMAGE_TYPES.has(
          imageEntry.type,
        )
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "invalid_image",
          },
          {
            status: 400,
            headers: V1_HEADERS,
          },
        );
      }

      const buffer =
        Buffer.from(
          await imageEntry
            .arrayBuffer(),
        );

      imageChange = {
        kind:
          "panoramaImage",

        currentValue:
          cataloguePlace
            .panoramaImage || "",

        proposedFile: {
          name:
            imageEntry.name ||
            "image",
          type:
            imageEntry.type,
          size:
            imageEntry.size,
          base64:
            buffer.toString(
              "base64",
            ),
        },

        buffer,
      };
    }

    if (
      textChanges.length === 0 &&
      !imageChange
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "no_changes",
        },
        {
          status: 400,
          headers: V1_HEADERS,
        },
      );
    }

    const apiKey =
      process.env
        .RESEND_API_KEY || "";

    const from =
      process.env.RESEND_FROM || "";

    const to =
      process.env.RESEND_TO || "";

    if (
      !apiKey ||
      !from ||
      !to
    ) {
      console.error(
        "[professional-change-requests] missing email env",
        {
          hasApiKey:
            Boolean(apiKey),
          hasFrom:
            Boolean(from),
          hasTo:
            Boolean(to),
        },
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "email_not_configured",
        },
        {
          status: 500,
          headers: V1_HEADERS,
        },
      );
    }

    const groupId =
      randomBytes(12)
        .toString("hex");

    const created: Array<{
      id: string;
      kind: string;
      reviewToken: string;
      currentValue?: string;
      proposedValue?: string;
      proposedFile?: {
        name: string;
        type: string;
        size: number;
        base64: string;
      };
    }> = [];

    for (
      const change of
      textChanges
    ) {
      const reviewToken =
        randomBytes(32)
          .toString("hex");

      const request =
        await prisma
          .professionalPlaceChangeRequest
          .create({
            data: {
              professionalPlaceId:
                authorization
                  .professionalPlace.id,

              userId:
                currentUser.id,

              kind:
                change.kind,

              value: {
                groupId,
                currentValue:
                  change.currentValue,
                proposedValue:
                  change.proposedValue,
                reviewToken,
              },

              status:
                "pending",

              billingMode:
                "included",
            },

            select: {
              id: true,
              kind: true,
            },
          });

      created.push({
        id:
          request.id,
        kind:
          request.kind,
        reviewToken,
        currentValue:
          change.currentValue,
        proposedValue:
          change.proposedValue,
      });
    }

    if (imageChange) {
      const reviewToken =
        randomBytes(32)
          .toString("hex");

      const request =
        await prisma
          .professionalPlaceChangeRequest
          .create({
            data: {
              professionalPlaceId:
                authorization
                  .professionalPlace.id,

              userId:
                currentUser.id,

              kind:
                imageChange.kind,

              value: {
                groupId,
                currentValue:
                  imageChange
                    .currentValue,
                proposedFile:
                  imageChange
                    .proposedFile,
                reviewToken,
              },

              status:
                "pending",

              billingMode:
                "included",
            },

            select: {
              id: true,
              kind: true,
            },
          });

      created.push({
        id:
          request.id,
        kind:
          request.kind,
        reviewToken,
        currentValue:
          imageChange
            .currentValue,
        proposedFile:
          imageChange
            .proposedFile,
      });
    }

    const reviewBaseUrl =
      process.env
        .SUBMISSION_REVIEW_BASE_URL ||
      new URL(req.url).origin;

    const blocks =
      created.map(
        (change) => {
          const approveUrl =
            `${reviewBaseUrl.replace(/\/$/, "")}/api/v1/me/professional-change-requests/review?id=${encodeURIComponent(change.id)}&action=approve&token=${encodeURIComponent(change.reviewToken)}`;

          const rejectUrl =
            `${reviewBaseUrl.replace(/\/$/, "")}/api/v1/me/professional-change-requests/review?id=${encodeURIComponent(change.id)}&action=reject&token=${encodeURIComponent(change.reviewToken)}`;

          const valueHtml =
            change.kind ===
            "panoramaImage"
              ? (
                  "<p><strong>Image actuelle :</strong> " +
                  esc(
                    change.currentValue ||
                    "—",
                  ) +
                  "</p>" +
                  "<p><strong>Nouvelle image :</strong> " +
                  esc(
                    change
                      .proposedFile
                      ?.name ||
                    "Image jointe",
                  ) +
                  "</p>"
                )
              : (
                  "<p><strong>Actuel :</strong><br>" +
                  esc(
                    change.currentValue ||
                    "—",
                  )
                    .replaceAll(
                      "\n",
                      "<br>",
                    ) +
                  "</p>" +
                  "<p><strong>Proposé :</strong><br>" +
                  esc(
                    change.proposedValue ||
                    "—",
                  )
                    .replaceAll(
                      "\n",
                      "<br>",
                    ) +
                  "</p>"
                );

          return (
            "<div style=\"margin:24px 0;padding:18px;border:1px solid #ddd;border-radius:14px\">" +
            "<h3 style=\"margin:0 0 12px\">" +
            esc(
              labelForKind(
                change.kind,
              ),
            ) +
            "</h3>" +
            valueHtml +
            "<p style=\"margin-top:16px\">" +
            "<a href=\"" +
            esc(approveUrl) +
            "\" style=\"display:inline-block;margin-right:10px;padding:10px 14px;border-radius:10px;background:#5C6E3B;color:#fff;text-decoration:none;font-weight:700\">Valider</a>" +
            "<a href=\"" +
            esc(rejectUrl) +
            "\" style=\"display:inline-block;padding:10px 14px;border-radius:10px;background:#111;color:#fff;text-decoration:none;font-weight:700\">Refuser avec motif</a>" +
            "</p>" +
            "</div>"
          );
        },
      )
        .join("");

    const subject =
      `Modifications Espace Pro — ${cataloguePlace.name}`;

    const html =
      "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111\">" +
      "<h2 style=\"margin:0 0 16px\">" +
      esc(subject) +
      "</h2>" +
      "<p><strong>Établissement :</strong> " +
      esc(
        cataloguePlace.name,
      ) +
      "</p>" +
      "<p><strong>Compte :</strong> " +
      esc(
        currentUser.email ||
        currentUser.username,
      ) +
      "</p>" +
      "<p><strong>Plan :</strong> " +
      esc(plan) +
      "</p>" +
      "<p><strong>Groupe :</strong> " +
      esc(groupId) +
      "</p>" +
      "<p>Chaque modification peut être validée ou refusée indépendamment.</p>" +
      blocks +
      "</div>";

    const resend =
      new Resend(apiKey);

    const attachments =
      imageChange
        ? [
            {
              filename:
                imageChange
                  .proposedFile
                  .name,
              content:
                imageChange
                  .buffer,
            },
          ]
        : undefined;

    const {
      error: resendError,
    } =
      await resend
        .emails.send({
          from:
            formatSender(
              from,
            ),
          to: [to],
          subject,
          html,
          attachments,
        });

    if (resendError) {
      console.error(
        "[professional-change-requests] resend error",
        resendError,
      );

      await prisma
        .professionalPlaceChangeRequest
        .deleteMany({
          where: {
            id: {
              in:
                created.map(
                  (request) =>
                    request.id,
                ),
            },
          },
        });

      return NextResponse.json(
        {
          ok: false,
          error:
            "email_send_failed",
        },
        {
          status: 500,
          headers: V1_HEADERS,
        },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        groupId,
        count:
          created.length,
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
