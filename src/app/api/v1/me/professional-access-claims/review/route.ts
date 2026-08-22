import { NextResponse } from "next/server";
import { Resend } from "resend";

import { prisma } from "@/lib/prisma";

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

function page(
  title: string,
  message: string,
  status = 200,
) {
  return new NextResponse(
    `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
</head>
<body style="margin:0;background:#111;color:#fff;font-family:Arial,Helvetica,sans-serif">
<main style="max-width:620px;margin:0 auto;padding:48px 20px;line-height:1.6">
<h1>${esc(title)}</h1>
<p style="color:rgba(255,255,255,.75)">${esc(message)}</p>
</main>
</body>
</html>`,
    {
      status,
      headers: {
        ...V1_HEADERS,
        "Content-Type":
          "text/html; charset=utf-8",
      },
    },
  );
}

async function getRequest(
  id: string,
) {
  return prisma
    .professionalPlaceChangeRequest
    .findUnique({
      where: {
        id,
      },

      include: {
        user: {
          select: {
            email: true,
            username: true,
            preferredLocale:
              true,
          },
        },

        professionalPlace:
          true,
      },
    });
}

function validToken(
  request: {
    kind: string;
    value: unknown;
  },
  token: string,
) {
  if (
    request.kind !==
    "accessClaim" ||
    !isObj(request.value)
  ) {
    return false;
  }

  return (
    cleanText(
      request.value
        .reviewToken,
    ) === token
  );
}

async function notifyUser(
  request: Awaited<
    ReturnType<
      typeof getRequest
    >
  >,
  approved: boolean,
  reason?: string,
) {
  if (
    !request?.user.email
  ) {
    return;
  }

  const apiKey =
    process.env
      .RESEND_API_KEY || "";

  const from =
    process.env
      .RESEND_FROM || "";

  if (
    !apiKey ||
    !from
  ) {
    return;
  }

  const value =
    isObj(request.value)
      ? request.value
      : {};

  const placeName =
    cleanText(
      value.placeName,
    ) ||
    "votre établissement";

  const isFr =
    request.user
      .preferredLocale !==
    "en";

  const subject =
    isFr
      ? approved
        ? "Votre accès à l’Espace Pro Indie Map est validé"
        : "Votre demande d’accès Pro Indie Map"
      : approved
        ? "Your Indie Map Professional access is approved"
        : "Your Indie Map Professional access request";

  const body =
    approved
      ? isFr
        ? `Votre demande d’accès à la fiche « ${placeName} » a été validée. Vous pouvez maintenant ouvrir l’Espace Pro avec votre compte Indie Map.`
        : `Your request to access “${placeName}” has been approved. You can now open the Professional space with your Indie Map account.`
      : isFr
        ? `Votre demande d’accès à la fiche « ${placeName} » n’a pas été validée.${reason ? `\n\nMotif : ${reason}` : ""}`
        : `Your request to access “${placeName}” was not approved.${reason ? `\n\nReason: ${reason}` : ""}`;

  const resend =
    new Resend(
      apiKey,
    );

  await resend
    .emails.send({
      from:
        formatSender(
          from,
        ),

      to: [
        request.user.email,
      ],

      subject,

      html:
        `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111">` +
        `<p>${esc(body).replaceAll("\n", "<br>")}</p>` +
        `<p style="margin-top:24px">Marc<br>${isFr ? "Fondateur d’Indie Map" : "Founder of Indie Map"}</p>` +
        `</div>`,
    })
    .catch(
      (error) => {
        console.error(
          "[professional-access-claims/review] user email error",
          error,
        );
      },
    );
}

function rejectionForm(
  id: string,
  token: string,
  placeName: string,
) {
  return new NextResponse(
    `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Refuser l’accès</title>
</head>
<body style="margin:0;background:#111;color:#fff;font-family:Arial,Helvetica,sans-serif">
<main style="max-width:620px;margin:0 auto;padding:40px 20px;line-height:1.6">
<p style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:.12em">Indie Map · Espace Pro</p>
<h1>Refuser l’accès</h1>
<p style="color:#bbb">${esc(placeName)}</p>

<form method="post" action="/api/v1/me/professional-access-claims/review">
<input type="hidden" name="id" value="${esc(id)}">
<input type="hidden" name="token" value="${esc(token)}">

<label for="reason" style="display:block;margin:28px 0 8px;font-weight:700">
Motif du refus
</label>

<textarea
id="reason"
name="reason"
required
minlength="3"
maxlength="1000"
rows="6"
style="box-sizing:border-box;width:100%;border:1px solid #444;border-radius:12px;background:#1b1b1b;color:#fff;padding:14px;font:inherit"
></textarea>

<button
type="submit"
style="margin-top:16px;width:100%;border:0;border-radius:12px;background:#fff;color:#111;padding:14px;font-weight:700"
>
Confirmer le refus
</button>
</form>
</main>
</body>
</html>`,
    {
      headers: {
        ...V1_HEADERS,
        "Content-Type":
          "text/html; charset=utf-8",
      },
    },
  );
}

export async function GET(
  req: Request,
) {
  try {
    const url =
      new URL(req.url);

    const id =
      cleanText(
        url.searchParams.get(
          "id",
        ),
      );

    const token =
      cleanText(
        url.searchParams.get(
          "token",
        ),
      );

    const action =
      cleanText(
        url.searchParams.get(
          "action",
        ),
      );

    if (
      !id ||
      !token ||
      (
        action !==
          "approve" &&
        action !==
          "reject"
      )
    ) {
      return page(
        "Lien invalide",
        "Ce lien est invalide.",
        400,
      );
    }

    const request =
      await getRequest(
        id,
      );

    if (!request) {
      return page(
        "Demande introuvable",
        "Cette demande est introuvable.",
        404,
      );
    }

    if (
      !validToken(
        request,
        token,
      )
    ) {
      return page(
        "Lien invalide",
        "Ce lien est invalide.",
        403,
      );
    }

    if (
      request.status ===
        "approved" ||
      request.status ===
        "rejected"
    ) {
      return page(
        "Déjà traité",
        "Cette demande a déjà été traitée.",
      );
    }

    const value =
      isObj(request.value)
        ? request.value
        : {};

    const placeName =
      cleanText(
        value.placeName,
      ) ||
      request
        .professionalPlace
        .placeId;

    if (
      action ===
      "reject"
    ) {
      return rejectionForm(
        id,
        token,
        placeName,
      );
    }

    const role =
      cleanText(
        value.role,
      );

    if (
      role !== "owner" &&
      role !== "manager"
    ) {
      return page(
        "Rôle non autorisé",
        "Cette demande ne peut pas être validée automatiquement. Seuls un propriétaire ou un gérant autorisé peuvent obtenir l’accès principal à cette fiche.",
        400,
      );
    }

    const membershipRole =
      role;

    await prisma
      .$transaction([
        prisma
          .professionalPlaceMember
          .upsert({
            where: {
              professionalPlaceId_userId:
                {
                  professionalPlaceId:
                    request
                      .professionalPlaceId,

                  userId:
                    request.userId,
                },
            },

            create: {
              professionalPlaceId:
                request
                  .professionalPlaceId,

              userId:
                request.userId,

              role:
                membershipRole,
            },

            update: {
              role:
                membershipRole,
            },
          }),

        prisma
          .professionalPlace
          .update({
            where: {
              id:
                request
                  .professionalPlaceId,
            },

            data: {
              status:
                "verified",

              accessStatus:
                "active",

              verifiedAt:
                new Date(),

              plan:
                request
                  .professionalPlace
                  .plan ||
                "free",
            },
          }),

        prisma
          .professionalPlaceChangeRequest
          .update({
            where: {
              id:
                request.id,
            },

            data: {
              status:
                "approved",

              reviewedAt:
                new Date(),

              note:
                null,
            },
          }),
      ]);

    await notifyUser(
      request,
      true,
    );

    return page(
      "Accès validé",
      `Le compte Indie Map a maintenant accès à l’Espace Pro de ${placeName}.`,
    );
  } catch (error) {
    console.error(
      "[professional-access-claims/review] GET error",
      error,
    );

    return page(
      "Erreur",
      "Impossible de traiter cette demande.",
      500,
    );
  }
}

export async function POST(
  req: Request,
) {
  try {
    const form =
      await req.formData();

    const id =
      cleanText(
        form.get("id"),
      );

    const token =
      cleanText(
        form.get("token"),
      );

    const reason =
      cleanText(
        form.get("reason"),
      ).slice(
        0,
        1000,
      );

    if (
      !id ||
      !token ||
      reason.length < 3
    ) {
      return page(
        "Demande invalide",
        "Un motif de refus est requis.",
        400,
      );
    }

    const request =
      await getRequest(
        id,
      );

    if (
      !request ||
      !validToken(
        request,
        token,
      )
    ) {
      return page(
        "Lien invalide",
        "Cette demande est introuvable ou le lien est invalide.",
        403,
      );
    }

    if (
      request.status !==
      "pending"
    ) {
      return page(
        "Déjà traité",
        "Cette demande a déjà été traitée.",
      );
    }

    await prisma
      .professionalPlaceChangeRequest
      .update({
        where: {
          id:
            request.id,
        },

        data: {
          status:
            "rejected",

          note:
            reason,

          reviewedAt:
            new Date(),
        },
      });

    await notifyUser(
      request,
      false,
      reason,
    );

    return page(
      "Accès refusé",
      "Le refus et son motif ont été enregistrés.",
    );
  } catch (error) {
    console.error(
      "[professional-access-claims/review] POST error",
      error,
    );

    return page(
      "Erreur",
      "Impossible de traiter cette demande.",
      500,
    );
  }
}
