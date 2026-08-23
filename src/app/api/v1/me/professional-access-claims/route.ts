import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { Resend } from "resend";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readPlaceCatalogueWithProfessionalOverrides } from "@/lib/placeCatalogue";

const V1_HEADERS = {
  "X-API-Version": "1",
  "Cache-Control": "no-store",
} as const;

type Obj = Record<string, unknown>;

function isObj(
  value: unknown,
): value is Obj {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value),
  );
}

function cleanText(
  value: unknown,
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeSearch(
  value: unknown,
) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^a-z0-9]+/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
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

function formatSender(
  from: string,
) {
  const clean =
    from.trim();

  if (
    clean.includes("<") &&
    clean.includes(">")
  ) {
    return clean;
  }

  return `Indie Map <${clean}>`;
}

function normalizeDomain(
  value: string,
) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
}

function getEmailDomain(
  email: string,
) {
  const parts =
    email
      .trim()
      .toLowerCase()
      .split("@");

  return parts.length === 2
    ? normalizeDomain(
        parts[1] || "",
      )
    : "";
}

function getWebsiteDomain(
  website: string,
) {
  const clean =
    website.trim();

  if (!clean) {
    return "";
  }

  try {
    const url =
      new URL(
        /^https?:\/\//i.test(
          clean,
        )
          ? clean
          : `https://${clean}`,
      );

    return normalizeDomain(
      url.hostname,
    );
  } catch {
    return "";
  }
}

function domainsCorrespond(
  emailDomain: string,
  websiteDomain: string,
) {
  if (
    !emailDomain ||
    !websiteDomain
  ) {
    return false;
  }

  return (
    emailDomain ===
      websiteDomain ||
    emailDomain.endsWith(
      `.${websiteDomain}`,
    ) ||
    websiteDomain.endsWith(
      `.${emailDomain}`,
    )
  );
}

function claimPublicValue(
  request: {
    id: string;
    status: string;
    note: string | null;
    createdAt: Date;
    value: unknown;
  } | null,
) {
  if (!request) {
    return null;
  }

  const value =
    isObj(request.value)
      ? request.value
      : {};

  return {
    id:
      request.id,

    status:
      request.status,

    note:
      request.note,

    createdAt:
      request.createdAt,

    placeId:
      cleanText(
        value.placeId,
      ),

    placeName:
      cleanText(
        value.placeName,
      ),

    city:
      cleanText(
        value.city,
      ),

    role:
      cleanText(
        value.role,
      ),

    firstName:
      cleanText(
        value.firstName,
      ),

    lastName:
      cleanText(
        value.lastName,
      ),

    professionalEmail:
      cleanText(
        value.professionalEmail,
      ),
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

    const query =
      cleanText(
        url.searchParams.get(
          "q",
        ),
      );

    if (query) {
      if (query.length < 2) {
        return NextResponse.json(
          {
            ok: true,
            places: [],
          },
          {
            headers: V1_HEADERS,
          },
        );
      }

      const needle =
        normalizeSearch(
          query,
        );

      const [
        catalogue,
        memberships,
      ] =
        await Promise.all([
          readPlaceCatalogueWithProfessionalOverrides(),

          prisma
            .professionalPlaceMember
            .findMany({
              where: {
                userId:
                  currentUser.id,
              },

              select: {
                professionalPlace: {
                  select: {
                    placeId: true,
                  },
                },
              },
            }),
        ]);

      const linkedPlaceIds =
        new Set(
          memberships
            .map(
              (membership) =>
                cleanText(
                  membership
                    .professionalPlace
                    .placeId,
                ),
            )
            .filter(Boolean),
        );

      const matchingPlaces =
        catalogue
          .filter(
            (item) =>
              !linkedPlaceIds.has(
                cleanText(
                  item.id,
                ),
              ),
          )
          .filter(
            (item) => {
              const haystack =
                [
                  item.name,
                  item.city,
                  item.address,
                  item.category,
                ]
                  .map(
                    normalizeSearch,
                  )
                  .join(" ");

              return haystack
                .includes(
                  needle,
                );
            },
          );

      const total =
        matchingPlaces.length;

      const places =
        matchingPlaces
          .slice(
            0,
            40,
          )
          .map(
            (item) => ({
              id:
                cleanText(
                  item.id,
                ),

              name:
                cleanText(
                  item.name,
                ),

              city:
                cleanText(
                  item.city,
                ),

              category:
                cleanText(
                  item.category,
                ),

              address:
                cleanText(
                  item.address,
                ),

              panoramaImage:
                cleanText(
                  item.panoramaImage,
                ),
            }),
          )
          .filter(
            (item) =>
              item.id &&
              item.name,
          );

      return NextResponse.json(
        {
          ok: true,
          places,
          total,
          limit: 40,
        },
        {
          headers: V1_HEADERS,
        },
      );
    }

    const latestClaim =
      await prisma
        .professionalPlaceChangeRequest
        .findFirst({
          where: {
            userId:
              currentUser.id,

            kind:
              "accessClaim",
          },

          select: {
            id: true,
            status: true,
            note: true,
            createdAt: true,
            value: true,
          },

          orderBy: {
            createdAt:
              "desc",
          },
        });

    return NextResponse.json(
      {
        ok: true,
        claim:
          claimPublicValue(
            latestClaim,
          ),
      },
      {
        headers: V1_HEADERS,
      },
    );
  } catch (error) {
    console.error(
      "[professional-access-claims] GET error",
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

export async function POST(
  req: Request,
) {
  let createdProfessionalPlaceId:
    string | null = null;

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

    const body =
      await req
        .json()
        .catch(
          () => null,
        );

    const placeId =
      cleanText(
        body?.placeId,
      );

    const role =
      cleanText(
        body?.role,
      );

    const firstName =
      cleanText(
        body?.firstName,
      ).slice(
        0,
        80,
      );

    const lastName =
      cleanText(
        body?.lastName,
      ).slice(
        0,
        80,
      );

    const professionalEmail =
      cleanText(
        body?.professionalEmail,
      );

    const message =
      cleanText(
        body?.message,
      ).slice(
        0,
        1000,
      );

    const authorized =
      body?.authorized === true;

    const allowedRoles =
      new Set([
        "owner",
        "manager",
      ]);

    if (
      !placeId ||
      !allowedRoles.has(role) ||
      !authorized ||
      firstName.length < 2 ||
      lastName.length < 2 ||
      !professionalEmail ||
      professionalEmail.length >
        254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        professionalEmail,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "invalid_request",
        },
        {
          status: 400,
          headers: V1_HEADERS,
        },
      );
    }

    const catalogue =
      await readPlaceCatalogueWithProfessionalOverrides();

    const cataloguePlace =
      catalogue.find(
        (item) =>
          cleanText(
            item.id,
          ) === placeId,
      );

    if (!cataloguePlace) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "place_not_found",
        },
        {
          status: 404,
          headers: V1_HEADERS,
        },
      );
    }

    const apiKey =
      process.env
        .RESEND_API_KEY || "";

    const from =
      process.env
        .RESEND_FROM || "";

    const to =
      process.env
        .RESEND_TO || "";

    if (
      !apiKey ||
      !from ||
      !to
    ) {
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

    let professionalPlace =
      await prisma
        .professionalPlace
        .findUnique({
          where: {
            placeId,
          },
        });

    if (!professionalPlace) {
      professionalPlace =
        await prisma
          .professionalPlace
          .create({
            data: {
              placeId,
              status:
                "pending",
              plan:
                "free",
              accessStatus:
                "inactive",
            },
          });

      createdProfessionalPlaceId =
        professionalPlace.id;
    }

    const existingMembership =
      await prisma
        .professionalPlaceMember
        .findFirst({
          where: {
            userId:
              currentUser.id,

            professionalPlaceId:
              professionalPlace.id,
          },

          select: {
            id: true,
          },
        });

    if (existingMembership) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "already_has_access",
        },
        {
          status: 409,
          headers: V1_HEADERS,
        },
      );
    }

    const existingPending =
      await prisma
        .professionalPlaceChangeRequest
        .findFirst({
          where: {
            userId:
              currentUser.id,

            professionalPlaceId:
              professionalPlace.id,

            kind:
              "accessClaim",

            status:
              "pending",
          },

          select: {
            id: true,
          },
        });

    if (existingPending) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "claim_pending",
        },
        {
          status: 409,
          headers: V1_HEADERS,
        },
      );
    }

    const reviewToken =
      randomBytes(32)
        .toString("hex");

    const request =
      await prisma
        .professionalPlaceChangeRequest
        .create({
          data: {
            professionalPlaceId:
              professionalPlace.id,

            userId:
              currentUser.id,

            kind:
              "accessClaim",

            status:
              "pending",

            billingMode:
              "included",

            value: {
              reviewToken,
              placeId,
              placeName:
                cleanText(
                  cataloguePlace.name,
                ),
              city:
                cleanText(
                  cataloguePlace.city,
                ),
              address:
                cleanText(
                  cataloguePlace.address,
                ),
              role,
              firstName,
              lastName,
              professionalEmail,
              authorized: true,
              message,
            },
          },
        });

    const origin =
      (
        process.env
          .SUBMISSION_REVIEW_BASE_URL ||
        new URL(req.url)
          .origin
      ).replace(
        /\/$/,
        "",
      );

    const approveUrl =
      `${origin}/api/v1/me/professional-access-claims/review` +
      `?id=${encodeURIComponent(request.id)}` +
      `&action=approve` +
      `&token=${encodeURIComponent(reviewToken)}`;

    const rejectUrl =
      `${origin}/api/v1/me/professional-access-claims/review` +
      `?id=${encodeURIComponent(request.id)}` +
      `&action=reject` +
      `&token=${encodeURIComponent(reviewToken)}`;

    const roleLabel =
      role === "owner"
        ? "Propriétaire"
        : "Gérant / responsable";

    const account =
      currentUser.email ||
      currentUser.username;

    const officialWebsite =
      cleanText(
        cataloguePlace.website,
      );

    const officialPhone =
      cleanText(
        cataloguePlace.phone,
      );

    const officialAddress =
      cleanText(
        cataloguePlace.address,
      );

    const emailDomain =
      getEmailDomain(
        professionalEmail,
      );

    /*
     * Indication interne uniquement :
     * on regarde si l'adresse fournie est
     * déjà connue pour CE lieu dans les
     * contacts privés Indie Map.
     *
     * Cela n'accorde aucun accès
     * automatiquement.
     */
    const knownProfessionalContact =
      await prisma
        .placePrivateContact
        .findFirst({
          where: {
            placeId,
            normalizedEmail:
              professionalEmail
                .trim()
                .toLowerCase(),
            active: true,
            verificationStatus: {
              not:
                "invalid",
            },
          },

          select: {
            verificationStatus:
              true,
          },
        });

    const emailKnownStatus =
      knownProfessionalContact
        ? "✅ Email déjà connu pour ce lieu dans Indie Map"
        : "⚠️ Email non retrouvé parmi les contacts connus de ce lieu";

    const websiteDomain =
      getWebsiteDomain(
        officialWebsite,
      );

    const domainCorresponds =
      domainsCorrespond(
        emailDomain,
        websiteDomain,
      );

    const domainStatus =
      !websiteDomain
        ? "Aucun site officiel disponible — vérification manuelle nécessaire"
        : domainCorresponds
          ? "✅ Le domaine de l’email correspond au site officiel"
          : "Domaine différent du site officiel — vérification manuelle nécessaire";

    const html =
      `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111">` +
      `<h2>Demande d’accès à un Espace Pro</h2>` +
      `<p><strong>Établissement :</strong> ${esc(cleanText(cataloguePlace.name))}</p>` +
      `<p><strong>Ville :</strong> ${esc(cleanText(cataloguePlace.city) || "—")}</p>` +
      `<p><strong>Compte Indie Map :</strong> ${esc(account)}</p>` +
      `<p><strong>Demandeur :</strong> ${esc(`${firstName} ${lastName}`)}</p>` +
      `<p><strong>Rôle déclaré :</strong> ${esc(roleLabel)}</p>` +
      `<p><strong>Email professionnel fourni :</strong> ${esc(professionalEmail)}</p>` +
      `<p><strong>Concordance avec les contacts Indie Map :</strong> ${esc(emailKnownStatus)}</p>` +
      `<p><strong>Domaine email :</strong> ${esc(emailDomain || "—")}</p>` +
      `<p><strong>Domaine du site :</strong> ${esc(websiteDomain || "—")}</p>` +
      `<p><strong>Contrôle automatique :</strong> ${esc(domainStatus)}</p>` +
      `<hr style="border:0;border-top:1px solid #ddd;margin:24px 0">` +
      `<p><strong>Coordonnées officielles déjà présentes sur Indie Map</strong></p>` +
      `<p><strong>Site :</strong> ${esc(officialWebsite || "—")}</p>` +
      `<p><strong>Téléphone :</strong> ${esc(officialPhone || "—")}</p>` +
      `<p><strong>Adresse :</strong> ${esc(officialAddress || "—")}</p>` +
      `<p><strong>Déclaration :</strong> Le demandeur confirme être propriétaire ou autorisé par le propriétaire à gérer cette fiche.</p>` +
      (
        message
          ? `<p><strong>Message :</strong><br>${esc(message).replaceAll("\n", "<br>")}</p>`
          : ""
      ) +
      `<div style="margin-top:28px">` +
      `<a href="${esc(approveUrl)}" style="display:inline-block;margin-right:10px;padding:12px 18px;border-radius:9px;background:#566b3c;color:#fff;text-decoration:none;font-weight:700">Valider l’accès</a>` +
      `<a href="${esc(rejectUrl)}" style="display:inline-block;padding:12px 18px;border-radius:9px;background:#222;color:#fff;text-decoration:none;font-weight:700">Refuser</a>` +
      `</div>` +
      `</div>`;

    const resend =
      new Resend(
        apiKey,
      );

    const {
      error: resendError,
    } =
      await resend
        .emails.send({
          from:
            formatSender(
              from,
            ),

          to: [
            to,
          ],

          subject:
            `Demande d’accès Pro — ${cleanText(cataloguePlace.name)}`,

          html,
        });

    if (resendError) {
      await prisma
        .professionalPlaceChangeRequest
        .delete({
          where: {
            id:
              request.id,
          },
        });

      if (
        createdProfessionalPlaceId
      ) {
        await prisma
          .professionalPlace
          .delete({
            where: {
              id:
                createdProfessionalPlaceId,
            },
          })
          .catch(
            () => undefined,
          );
      }

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
        claim:
          claimPublicValue(
            request,
          ),
      },
      {
        headers: V1_HEADERS,
      },
    );
  } catch (error) {
    console.error(
      "[professional-access-claims] POST error",
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
