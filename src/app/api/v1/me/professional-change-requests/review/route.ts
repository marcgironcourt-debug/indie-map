import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const V1_HEADERS = {
  "X-API-Version": "1",
  "Cache-Control": "no-store",
} as const;

type RequestValue = {
  groupId?: unknown;
  reviewToken?: unknown;
  currentValue?: unknown;
  proposedValue?: unknown;
  proposedFile?: {
    name?: unknown;
  };
};

type ReviewRequest = {
  id: string;
  professionalPlaceId: string;
  userId: string;
  kind: string;
  value: unknown;
  note: string | null;
  status: string;
  createdAt: Date;
  user: {
    email: string | null;
    preferredLocale: string | null;
  };
};

function isObj(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value),
  );
}

function requestValue(
  value: unknown,
): RequestValue {
  return isObj(value)
    ? (value as RequestValue)
    : {};
}

function textValue(
  value: unknown,
) {
  return typeof value === "string"
    ? value
    : "";
}

function getGroupId(
  value: unknown,
) {
  const parsed =
    requestValue(value);

  return textValue(
    parsed.groupId,
  ).trim();
}

function getReviewToken(
  value: unknown,
) {
  const parsed =
    requestValue(value);

  return textValue(
    parsed.reviewToken,
  ).trim();
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
  isFr: boolean,
) {
  const fr: Record<string, string> = {
    name: "Nom",
    address: "Adresse",
    openingHours: "Horaires",
    phone: "Téléphone",
    website: "Site web",
    miniText: "miniText",
    panoramaImage: "Image",
  };

  const en: Record<string, string> = {
    name: "Name",
    address: "Address",
    openingHours: "Opening hours",
    phone: "Phone",
    website: "Website",
    miniText: "miniText",
    panoramaImage: "Image",
  };

  return (
    (isFr ? fr : en)[kind] ||
    kind
  );
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
  <meta
    name="viewport"
    content="width=device-width,initial-scale=1"
  >
  <title>${esc(title)}</title>
</head>
<body style="margin:0;background:#111;color:#fff;font-family:Arial,Helvetica,sans-serif">
  <main style="max-width:620px;margin:0 auto;padding:48px 20px;line-height:1.6">
    <h1 style="font-size:28px;margin:0 0 16px">
      ${esc(title)}
    </h1>

    <p style="font-size:16px;color:rgba(255,255,255,.78)">
      ${esc(message)}
    </p>
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

function rejectionForm(
  request: ReviewRequest,
  token: string,
) {
  const value =
    requestValue(
      request.value,
    );

  const current =
    textValue(
      value.currentValue,
    );

  const proposed =
    textValue(
      value.proposedValue,
    );

  const proposedFile =
    isObj(value.proposedFile)
      ? textValue(
          value.proposedFile.name,
        )
      : "";

  const proposedDisplay =
    request.kind ===
    "panoramaImage"
      ? proposedFile ||
        "Nouvelle image"
      : proposed || "—";

  return new NextResponse(
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width,initial-scale=1"
  >
  <title>Refuser la modification</title>
</head>

<body style="margin:0;background:#111;color:#fff;font-family:Arial,Helvetica,sans-serif">
  <main style="max-width:620px;margin:0 auto;padding:40px 20px;line-height:1.6">

    <p style="margin:0 0 8px;color:#aaa;font-size:12px;text-transform:uppercase;letter-spacing:.12em">
      Espace Pro · Indie Map
    </p>

    <h1 style="font-size:28px;margin:0 0 24px">
      Refuser ${esc(
        labelForKind(
          request.kind,
          true,
        ),
      )}
    </h1>

    ${
      request.kind !==
      "panoramaImage"
        ? `
          <div style="margin-bottom:14px;padding:16px;border:1px solid #333;border-radius:12px">
            <strong style="display:block;margin-bottom:6px;color:#aaa">
              Valeur actuelle
            </strong>
            <div style="white-space:pre-wrap">
              ${esc(current || "—")}
            </div>
          </div>
        `
        : ""
    }

    <div style="margin-bottom:24px;padding:16px;border:1px solid #444;border-radius:12px">
      <strong style="display:block;margin-bottom:6px;color:#aaa">
        Proposition
      </strong>

      <div style="white-space:pre-wrap">
        ${esc(proposedDisplay)}
      </div>
    </div>

    <form
      method="post"
      action="/api/v1/me/professional-change-requests/review"
    >
      <input
        type="hidden"
        name="id"
        value="${esc(request.id)}"
      >

      <input
        type="hidden"
        name="token"
        value="${esc(token)}"
      >

      <label
        for="reason"
        style="display:block;margin-bottom:8px;font-weight:700"
      >
        Motif du refus
      </label>

      <textarea
        id="reason"
        name="reason"
        required
        minlength="3"
        maxlength="1000"
        rows="6"
        placeholder="Explique pourquoi cette modification n'est pas retenue…"
        style="box-sizing:border-box;width:100%;padding:14px;border-radius:12px;border:1px solid #444;background:#1b1b1b;color:#fff;font:inherit;resize:vertical"
      ></textarea>

      <button
        type="submit"
        style="margin-top:16px;width:100%;padding:14px;border:0;border-radius:12px;background:#fff;color:#111;font-weight:700;font-size:14px;cursor:pointer"
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

async function getRequest(
  id: string,
) {
  return prisma
    .professionalPlaceChangeRequest
    .findUnique({
      where: {
        id,
      },

      select: {
        id: true,
        professionalPlaceId:
          true,
        userId: true,
        kind: true,
        value: true,
        note: true,
        status: true,
        createdAt: true,

        user: {
          select: {
            email: true,
            preferredLocale:
              true,
          },
        },
      },
    });
}

function validateRequest(
  request: ReviewRequest | null,
  token: string,
) {
  if (!request) {
    return {
      ok: false as const,
      response: page(
        "Demande introuvable",
        "Cette modification est introuvable.",
        404,
      ),
    };
  }

  if (
    !token ||
    getReviewToken(
      request.value,
    ) !== token
  ) {
    return {
      ok: false as const,
      response: page(
        "Lien invalide",
        "Ce lien de validation est invalide.",
        403,
      ),
    };
  }

  if (
    request.status ===
      "approved" ||
    request.status ===
      "rejected"
  ) {
    return {
      ok: false as const,
      response: page(
        "Déjà traité",
        request.status ===
        "approved"
          ? "Cette modification a déjà été validée."
          : "Cette modification a déjà été refusée.",
      ),
    };
  }

  return {
    ok: true as const,
  };
}

async function groupRequestsFor(
  request: ReviewRequest,
) {
  const groupId =
    getGroupId(
      request.value,
    );

  if (!groupId) {
    return [
      request,
    ];
  }

  const allRequests =
    await prisma
      .professionalPlaceChangeRequest
      .findMany({
        where: {
          professionalPlaceId:
            request
              .professionalPlaceId,

          userId:
            request.userId,
        },

        select: {
          id: true,
          kind: true,
          status: true,
          note: true,
          value: true,
          createdAt: true,
        },

        orderBy: {
          createdAt:
            "asc",
        },
      });

  return allRequests.filter(
    (item) =>
      getGroupId(
        item.value,
      ) === groupId,
  );
}

async function sendGroupedResultIfComplete(
  request: ReviewRequest,
) {
  const group =
    await groupRequestsFor(
      request,
    );

  const unfinished =
    group.filter(
      (item) =>
        ![
          "approved",
          "rejected",
        ].includes(
          item.status,
        ),
    );

  if (
    unfinished.length > 0
  ) {
    return {
      complete:
        false,
      remaining:
        unfinished.length,
      emailSent:
        false,
    };
  }

  if (
    !request.user.email
  ) {
    return {
      complete:
        true,
      remaining:
        0,
      emailSent:
        false,
    };
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
    console.error(
      "[professional-change-requests/review] missing email env",
    );

    return {
      complete:
        true,
      remaining:
        0,
      emailSent:
        false,
    };
  }

  const isFr =
    request.user
      .preferredLocale !==
    "en";

  const approved =
    group.filter(
      (item) =>
        item.status ===
        "approved",
    );

  const rejected =
    group.filter(
      (item) =>
        item.status ===
        "rejected",
    );

  const approvedHtml =
    approved.length > 0
      ? `
        <h3 style="margin:24px 0 10px">
          ${
            isFr
              ? "Modifications validées"
              : "Approved changes"
          }
        </h3>

        <ul>
          ${approved
            .map(
              (item) =>
                `<li style="margin-bottom:7px"><strong>${esc(
                  labelForKind(
                    item.kind,
                    isFr,
                  ),
                )}</strong></li>`,
            )
            .join("")}
        </ul>
      `
      : "";

  const rejectedHtml =
    rejected.length > 0
      ? `
        <h3 style="margin:24px 0 10px">
          ${
            isFr
              ? "Modifications non retenues"
              : "Changes not approved"
          }
        </h3>

        <ul>
          ${rejected
            .map(
              (item) => {
                const reason =
                  item.note?.trim() ||
                  (
                    isFr
                      ? "Aucun motif précisé."
                      : "No reason provided."
                  );

                return `
                  <li style="margin-bottom:14px">
                    <strong>${esc(
                      labelForKind(
                        item.kind,
                        isFr,
                      ),
                    )}</strong>
                    <br>
                    <span style="color:#555">
                      ${
                        isFr
                          ? "Motif : "
                          : "Reason: "
                      }${esc(reason)}
                    </span>
                  </li>
                `;
              },
            )
            .join("")}
        </ul>
      `
      : "";

  const subject =
    isFr
      ? "Mise à jour de votre fiche Indie Map"
      : "Your Indie Map listing update";

  const intro =
    isFr
      ? "Nous avons terminé l’examen des modifications que vous nous avez envoyées."
      : "We have finished reviewing the changes you submitted.";

  const outro =
    isFr
      ? "Les modifications validées sont désormais prises en compte sur votre fiche Indie Map."
      : "Approved changes are now reflected on your Indie Map listing.";

  const html =
    `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111">
        <p>${esc(intro)}</p>

        ${approvedHtml}

        ${rejectedHtml}

        <p style="margin-top:28px">
          ${esc(outro)}
        </p>

        <p style="margin-top:28px">
          Marc<br>
          ${
            isFr
              ? "Fondateur d’Indie Map"
              : "Founder of Indie Map"
          }
        </p>
      </div>
    `;

  const resend =
    new Resend(
      apiKey,
    );

  const {
    error,
  } =
    await resend
      .emails.send({
        from:
          formatSender(
            from,
          ),

        to: [
          request.user
            .email,
        ],

        subject,
        html,
      });

  if (error) {
    console.error(
      "[professional-change-requests/review] grouped resend error",
      error,
    );

    return {
      complete:
        true,
      remaining:
        0,
      emailSent:
        false,
    };
  }

  return {
    complete:
      true,
    remaining:
      0,
    emailSent:
      true,
  };
}

async function processDecision(
  request: ReviewRequest,
  action:
    | "approve"
    | "reject",
  reason?: string,
) {
  const nextStatus =
    action ===
    "approve"
      ? "approved"
      : "rejected";

  await prisma
    .professionalPlaceChangeRequest
    .update({
      where: {
        id:
          request.id,
      },

      data: {
        status:
          nextStatus,

        reviewedAt:
          new Date(),

        note:
          action ===
          "reject"
            ? (
                reason
                  ?.trim()
                  .slice(
                    0,
                    1000,
                  ) ||
                null
              )
            : null,
      },
    });

  /*
   * Important :
   *
   * aucun email n'est envoyé ici
   * pour cette décision seule.
   *
   * On attend que TOUT le groupe
   * soit traité.
   */
  const refreshed =
    await getRequest(
      request.id,
    );

  if (!refreshed) {
    throw new Error(
      "review_request_missing_after_update",
    );
  }

  return sendGroupedResultIfComplete(
    refreshed,
  );
}

export async function GET(
  req: Request,
) {
  try {
    const url =
      new URL(
        req.url,
      );

    const id =
      url.searchParams
        .get("id")
        ?.trim() ||
      "";

    const token =
      url.searchParams
        .get("token")
        ?.trim() ||
      "";

    const action =
      url.searchParams
        .get("action")
        ?.trim() ||
      "";

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
        "Ce lien de validation est invalide.",
        400,
      );
    }

    const request =
      await getRequest(
        id,
      );

    const validation =
      validateRequest(
        request,
        token,
      );

    if (
      !validation.ok
    ) {
      return validation
        .response;
    }

    if (!request) {
      return page(
        "Demande introuvable",
        "Cette modification est introuvable.",
        404,
      );
    }

    /*
     * Un refus nécessite toujours
     * un motif.
     *
     * Le lien "Refuser" ouvre donc
     * le formulaire au lieu de
     * modifier immédiatement le statut.
     */
    if (
      action ===
      "reject"
    ) {
      return rejectionForm(
        request,
        token,
      );
    }

    const result =
      await processDecision(
        request,
        "approve",
      );

    if (
      !result.complete
    ) {
      return page(
        "Modification validée",
        `La modification est validée. ${result.remaining} modification${result.remaining > 1 ? "s restent" : " reste"} à traiter dans cet envoi.`,
      );
    }

    return page(
      "Modification validée",
      result.emailSent
        ? "La modification est validée. Toutes les modifications de cet envoi sont maintenant traitées et un seul récapitulatif a été envoyé au professionnel."
        : "La modification est validée. Toutes les modifications de cet envoi sont maintenant traitées, mais l’email récapitulatif n’a pas pu être envoyé.",
    );
  } catch (error) {
    console.error(
      "[professional-change-requests/review] GET error",
      error,
    );

    return page(
      "Erreur",
      "Impossible de traiter cette modification pour le moment.",
      500,
    );
  }
}

export async function POST(
  req: Request,
) {
  try {
    const fd =
      await req.formData();

    const id =
      textValue(
        fd.get("id"),
      ).trim();

    const token =
      textValue(
        fd.get("token"),
      ).trim();

    const reason =
      textValue(
        fd.get("reason"),
      )
        .trim()
        .slice(
          0,
          1000,
        );

    if (
      !id ||
      !token
    ) {
      return page(
        "Lien invalide",
        "Cette demande de refus est invalide.",
        400,
      );
    }

    if (
      reason.length <
      3
    ) {
      return page(
        "Motif requis",
        "Indique un motif de refus avant de confirmer.",
        400,
      );
    }

    const request =
      await getRequest(
        id,
      );

    const validation =
      validateRequest(
        request,
        token,
      );

    if (
      !validation.ok
    ) {
      return validation
        .response;
    }

    if (!request) {
      return page(
        "Demande introuvable",
        "Cette modification est introuvable.",
        404,
      );
    }

    const result =
      await processDecision(
        request,
        "reject",
        reason,
      );

    if (
      !result.complete
    ) {
      return page(
        "Modification refusée",
        `Le refus et son motif sont enregistrés. ${result.remaining} modification${result.remaining > 1 ? "s restent" : " reste"} à traiter dans cet envoi.`,
      );
    }

    return page(
      "Modification refusée",
      result.emailSent
        ? "Le refus et son motif sont enregistrés. Toutes les modifications de cet envoi sont maintenant traitées et un seul récapitulatif a été envoyé au professionnel."
        : "Le refus et son motif sont enregistrés. Toutes les modifications de cet envoi sont maintenant traitées, mais l’email récapitulatif n’a pas pu être envoyé.",
    );
  } catch (error) {
    console.error(
      "[professional-change-requests/review] POST error",
      error,
    );

    return page(
      "Erreur",
      "Impossible de traiter ce refus pour le moment.",
      500,
    );
  }
}
