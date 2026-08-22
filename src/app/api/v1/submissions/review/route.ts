import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { Resend } from "resend";

import { prisma } from "@/lib/prisma";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

type CataloguePlace = {
  id: string;
  name: string;
  city?: string;
  address?: string;
};

function formatSender(from: string) {
  const clean = from.trim();

  if (!clean) {
    return clean;
  }

  if (
    clean.includes("<") &&
    clean.includes(">")
  ) {
    return clean;
  }

  return "Indie Map <" + clean + ">";
}

function esc(value: string): string {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
<body
  style="
    margin:0;
    background:#111;
    color:#fff;
    font-family:Arial,Helvetica,sans-serif;
  "
>
<main
  style="
    max-width:620px;
    margin:0 auto;
    padding:48px 20px;
    line-height:1.6;
  "
>
<h1
  style="
    font-size:28px;
    margin:0 0 16px;
  "
>
${esc(title)}
</h1>

<p
  style="
    font-size:16px;
    color:rgba(255,255,255,.78);
  "
>
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

async function readCataloguePlaces() {
  const filePath = path.join(
    process.cwd(),
    "data",
    "places.json",
  );

  const raw = await fs.readFile(
    filePath,
    "utf8",
  );

  const parsed: unknown =
    JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(
      "Catalogue Indie Map invalide.",
    );
  }

  return parsed
    .filter(
      (
        place,
      ): place is Record<
        string,
        unknown
      > =>
        Boolean(
          place &&
            typeof place === "object" &&
            !Array.isArray(place),
        ),
    )
    .map((place) => ({
      id: String(
        place.id || "",
      ).trim(),

      name: String(
        place.name || "",
      ).trim(),

      city: String(
        place.city || "",
      ).trim(),

      address: String(
        place.address || "",
      ).trim(),
    }))
    .filter(
      (place) =>
        Boolean(
          place.id &&
            place.name,
        ),
    )
    .sort((a, b) =>
      a.name.localeCompare(
        b.name,
        "fr",
        {
          sensitivity: "base",
        },
      ),
    );
}

function approvalForm(
  submission: {
    name: string;
    website: string | null;
    address: string;
  },
  token: string,
  places: CataloguePlace[],
) {
  const options =
    places
      .map((place) => {
        const label = [
          place.name,
          place.city,
          place.address,
        ]
          .filter(Boolean)
          .join(" — ");

        const search = [
          place.name,
          place.city,
          place.address,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return `
<option
  value="${esc(place.id)}"
  data-search="${esc(search)}"
>
${esc(label)}
</option>`;
      })
      .join("");

  return new NextResponse(
    `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>
<title>Valider la contribution</title>
</head>

<body
  style="
    margin:0;
    background:#111;
    color:#fff;
    font-family:Arial,Helvetica,sans-serif;
  "
>
<main
  style="
    max-width:720px;
    margin:0 auto;
    padding:40px 20px 60px;
    line-height:1.5;
  "
>
<p
  style="
    margin:0 0 8px;
    color:#9b9b9b;
    font-size:12px;
    font-weight:700;
    letter-spacing:.12em;
    text-transform:uppercase;
  "
>
Indie Map · Contribution
</p>

<h1
  style="
    margin:0 0 8px;
    font-size:30px;
  "
>
Valider la contribution
</h1>

<p
  style="
    margin:0 0 28px;
    color:#aaa;
  "
>
La contribution ne sera validée qu’après
son rattachement à un lieu réellement
présent dans Indie Map.
</p>

<div
  style="
    padding:18px;
    margin-bottom:24px;
    background:#1b1b1b;
    border:1px solid #333;
    border-radius:16px;
  "
>
<strong
  style="
    display:block;
    margin-bottom:6px;
    font-size:18px;
  "
>
${esc(submission.name)}
</strong>

<div style="color:#aaa;font-size:14px">
${esc(submission.address || "Adresse non fournie")}
</div>

${
  submission.website
    ? `
<div
  style="
    margin-top:6px;
    color:#aaa;
    font-size:14px;
    word-break:break-all;
  "
>
${esc(submission.website)}
</div>`
    : ""
}
</div>

<form
  method="post"
  action="/api/v1/submissions/review"
>
<input
  type="hidden"
  name="token"
  value="${esc(token)}"
>

<input
  type="hidden"
  name="action"
  value="approve"
>

<label
  for="placeSearch"
  style="
    display:block;
    margin-bottom:8px;
    font-weight:700;
  "
>
Rechercher le lieu Indie Map
</label>

<input
  id="placeSearch"
  type="search"
  placeholder="Nom, ville ou adresse…"
  autocomplete="off"
  style="
    box-sizing:border-box;
    width:100%;
    margin-bottom:12px;
    padding:13px 14px;
    border:1px solid #444;
    border-radius:12px;
    background:#1b1b1b;
    color:#fff;
    font:inherit;
  "
>

<label
  for="placeId"
  style="
    display:block;
    margin-bottom:8px;
    font-weight:700;
  "
>
Lieu correspondant
</label>

<select
  id="placeId"
  name="placeId"
  required
  size="12"
  style="
    box-sizing:border-box;
    width:100%;
    min-height:300px;
    padding:8px;
    border:1px solid #444;
    border-radius:12px;
    background:#1b1b1b;
    color:#fff;
    font:inherit;
  "
>
<option value="">
Choisir un lieu…
</option>

${options}
</select>

<button
  type="submit"
  style="
    width:100%;
    margin-top:18px;
    padding:14px 18px;
    border:0;
    border-radius:12px;
    background:#5C6E3B;
    color:#fff;
    font:inherit;
    font-weight:800;
    cursor:pointer;
  "
>
Confirmer la validation
</button>
</form>

<script>
(function () {
  var search =
    document.getElementById(
      "placeSearch"
    );

  var select =
    document.getElementById(
      "placeId"
    );

  if (!search || !select) {
    return;
  }

  var options =
    Array.prototype.slice.call(
      select.options
    );

  search.addEventListener(
    "input",
    function () {
      var query =
        String(search.value || "")
          .toLowerCase()
          .trim();

      options.forEach(
        function (option, index) {
          if (index === 0) {
            option.hidden = false;
            return;
          }

          var haystack =
            String(
              option.dataset.search || ""
            );

          option.hidden =
            Boolean(query) &&
            !haystack.includes(query);
        }
      );
    }
  );
})();
</script>
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

async function notifyUser(
  updated: {
    name: string;
    user: {
      email: string | null;
      preferredLocale: string;
    } | null;
  },
  approved: boolean,
) {
  if (!updated.user?.email) {
    return;
  }

  const apiKey =
    process.env.RESEND_API_KEY || "";

  const from =
    process.env.RESEND_FROM || "";

  if (
    !apiKey ||
    !from
  ) {
    return;
  }

  const resend =
    new Resend(apiKey);

  const isFr =
    updated.user.preferredLocale !==
    "en";

  const subject =
    isFr
      ? approved
        ? "Ta contribution Indie Map a été validée"
        : "Ta contribution Indie Map n’a pas été retenue"
      : approved
        ? "Your Indie Map contribution was approved"
        : "Your Indie Map contribution was not approved";

  const body =
    isFr
      ? approved
        ? `Merci pour ta participation à faire grandir Indie Map. Ta dernière contribution, “${updated.name}”, a été validée et compte maintenant dans ton espace personnel.

Marc
Fondateur d’Indie Map`
        : `Merci pour ta participation à faire grandir Indie Map. Ta dernière contribution, “${updated.name}”, n’a malheureusement pas été retenue, car le lieu ne correspond pas suffisamment aux valeurs ou aux critères d’Indie Map.

Marc
Fondateur d’Indie Map`
      : approved
        ? `Thank you for helping Indie Map grow. Your latest contribution, “${updated.name}”, has been approved and now counts in your personal space.

Marc
Founder of Indie Map`
        : `Thank you for helping Indie Map grow. Your latest contribution, “${updated.name}”, was unfortunately not accepted because the place does not fully match Indie Map’s values or criteria.

Marc
Founder of Indie Map`;

  await resend.emails.send({
    from: formatSender(from),
    to: [
      updated.user.email,
    ],
    subject,
    html:
      `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111">` +
      `<p>${esc(body).replaceAll("\n", "<br>")}</p>` +
      `</div>`,
  });
}

async function loadSubmission(
  token: string,
) {
  return prisma.submission.findUnique({
    where: {
      reviewToken: token,
    },
    include: {
      user: {
        select: {
          email: true,
          username: true,
          displayName: true,
          preferredLocale: true,
        },
      },
    },
  });
}

export async function GET(
  req: Request,
) {
  try {
    const url =
      new URL(req.url);

    const token =
      url.searchParams
        .get("token")
        ?.trim() || "";

    const action =
      url.searchParams
        .get("action")
        ?.trim() || "";

    if (
      !token ||
      (
        action !== "approve" &&
        action !== "reject"
      )
    ) {
      return page(
        "Lien invalide",
        "Ce lien de validation est invalide.",
        400,
      );
    }

    const submission =
      await loadSubmission(token);

    if (!submission) {
      return page(
        "Lien introuvable",
        "Cette proposition est introuvable ou le lien n’est plus valide.",
        404,
      );
    }

    if (
      submission.status ===
        "approved" ||
      submission.status ===
        "rejected"
    ) {
      return page(
        "Déjà traité",
        "Cette proposition a déjà été traitée.",
      );
    }

    /*
     * Une approbation ne se fait plus
     * directement depuis le lien du mail.
     *
     * On exige d'abord le vrai placeId
     * du lieu déjà présent dans Indie Map.
     */
    if (action === "approve") {
      const places =
        await readCataloguePlaces();

      return approvalForm(
        submission,
        token,
        places,
      );
    }

    /*
     * Un refus n'attribue évidemment
     * aucun placeId.
     */
    const result =
      await prisma.submission.updateMany({
        where: {
          id: submission.id,
          status: "pending",
        },
        data: {
          status: "rejected",
          reviewedAt: new Date(),
          placeId: null,
        },
      });

    if (result.count !== 1) {
      return page(
        "Déjà traité",
        "Cette proposition a déjà été traitée.",
      );
    }

    const updated =
      await loadSubmission(token);

    if (!updated) {
      throw new Error(
        "Submission introuvable après refus.",
      );
    }

    await notifyUser(
      updated,
      false,
    );

    return page(
      "Contribution refusée",
      "La proposition est maintenant refusée. Si elle est liée à un compte, l’utilisateur a été prévenu par email.",
    );
  } catch (error) {
    console.error(
      "[/api/v1/submissions/review] GET error",
      error,
    );

    return page(
      "Erreur",
      "Impossible de traiter cette proposition pour l’instant.",
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

    const token =
      String(
        form.get("token") || "",
      ).trim();

    const action =
      String(
        form.get("action") || "",
      ).trim();

    const placeId =
      String(
        form.get("placeId") || "",
      ).trim();

    if (
      !token ||
      action !== "approve" ||
      !placeId
    ) {
      return page(
        "Validation invalide",
        "Le lieu Indie Map correspondant doit être sélectionné.",
        400,
      );
    }

    const submission =
      await loadSubmission(token);

    if (!submission) {
      return page(
        "Lien introuvable",
        "Cette proposition est introuvable ou le lien n’est plus valide.",
        404,
      );
    }

    if (
      submission.status !==
      "pending"
    ) {
      return page(
        "Déjà traité",
        "Cette proposition a déjà été traitée.",
      );
    }

    const places =
      await readCataloguePlaces();

    const place =
      places.find(
        (candidate) =>
          candidate.id ===
          placeId,
      );

    if (!place) {
      return page(
        "Lieu introuvable",
        "Le lieu sélectionné n’existe pas dans le catalogue Indie Map.",
        400,
      );
    }

    /*
     * Le placeId est enregistré AVANT
     * l'envoi du mail d'approbation.
     *
     * Une contribution approuvée devient
     * donc une véritable attribution
     * userId → Submission → placeId.
     */
    const result =
      await prisma.submission.updateMany({
        where: {
          id: submission.id,
          status: "pending",
        },
        data: {
          status: "approved",
          reviewedAt: new Date(),
          placeId,
        },
      });

    if (result.count !== 1) {
      return page(
        "Déjà traité",
        "Cette proposition a déjà été traitée.",
      );
    }

    const updated =
      await loadSubmission(token);

    if (!updated) {
      throw new Error(
        "Submission introuvable après approbation.",
      );
    }

    await notifyUser(
      updated,
      true,
    );

    return page(
      "Contribution validée",
      `La contribution est maintenant attribuée à « ${place.name} » et compte dans l’espace personnel de l’utilisateur.`,
    );
  } catch (error) {
    console.error(
      "[/api/v1/submissions/review] POST error",
      error,
    );

    return page(
      "Erreur",
      "Impossible de traiter cette proposition pour l’instant.",
      500,
    );
  }
}
