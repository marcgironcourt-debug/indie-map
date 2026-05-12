import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function page(title: string, message: string, status = 200) {
  return new NextResponse(
    "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" +
      esc(title) +
      "</title></head><body style=\"margin:0;background:#111;color:#fff;font-family:Arial,Helvetica,sans-serif\"><main style=\"max-width:620px;margin:0 auto;padding:48px 20px;line-height:1.6\"><h1 style=\"font-size:28px;margin:0 0 16px\">" +
      esc(title) +
      "</h1><p style=\"font-size:16px;color:rgba(255,255,255,.78)\">" +
      esc(message) +
      "</p></main></body></html>",
    {
      status,
      headers: {
        ...V1_HEADERS,
        "Content-Type": "text/html; charset=utf-8",
      },
    }
  );
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token")?.trim() || "";
    const action = url.searchParams.get("action")?.trim() || "";

    if (!token || (action !== "approve" && action !== "reject")) {
      return page("Lien invalide", "Ce lien de validation est invalide.", 400);
    }

    const submission = await prisma.submission.findUnique({
      where: { reviewToken: token },
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

    if (!submission) {
      return page("Lien introuvable", "Cette proposition est introuvable ou le lien n’est plus valide.", 404);
    }

    if (submission.status === "approved" || submission.status === "rejected") {
      return page("Déjà traité", "Cette proposition a déjà été traitée.");
    }

    const nextStatus = action === "approve" ? "approved" : "rejected";

    const updated = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: nextStatus,
        reviewedAt: new Date(),
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

    if (updated.user?.email) {
      const apiKey = process.env.RESEND_API_KEY || "";
      const from = process.env.RESEND_FROM || "";

      if (apiKey && from) {
        const resend = new Resend(apiKey);
        const isFr = updated.user.preferredLocale !== "en";
        const approved = nextStatus === "approved";
        const subject = isFr
          ? approved
            ? "Ta contribution Indie Map a été validée"
            : "Ta contribution Indie Map n’a pas été retenue"
          : approved
            ? "Your Indie Map contribution was approved"
            : "Your Indie Map contribution was not approved";

        const body = isFr
          ? approved
            ? "Merci pour ta participation à faire grandir Indie Map. Ta dernière contribution, “" + updated.name + "”, a été validée et compte maintenant dans ton espace personnel.\n\nMarc\nFondateur d’Indie Map"
            : "Merci pour ta participation à faire grandir Indie Map. Ta dernière contribution, “" + updated.name + "”, n’a malheureusement pas été retenue, car le lieu ne correspond pas suffisamment aux valeurs ou aux critères d’Indie Map.\n\nMarc\nFondateur d’Indie Map"
          : approved
            ? "Thank you for helping Indie Map grow. Your latest contribution, “" + updated.name + "”, has been approved and now counts in your personal space.\n\nMarc\nFounder of Indie Map"
            : "Thank you for helping Indie Map grow. Your latest contribution, “" + updated.name + "”, was unfortunately not accepted because the place does not fully match Indie Map’s values or criteria.\n\nMarc\nFounder of Indie Map";

        await resend.emails.send({
          from,
          to: [updated.user.email],
          subject,
          html: "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111\"><p>" + esc(body).replaceAll("\n", "<br>") + "</p></div>",
        });
      }
    }

    return page(
      nextStatus === "approved" ? "Contribution validée" : "Contribution refusée",
      nextStatus === "approved"
        ? "La proposition est maintenant validée. Si elle est liée à un compte, son compteur Contributions augmentera."
        : "La proposition est maintenant refusée. Si elle est liée à un compte, l’utilisateur a été prévenu par email."
    );
  } catch (err) {
    console.error("[/api/v1/submissions/review] error", err);
    return page("Erreur", "Impossible de traiter cette proposition pour l’instant.", 500);
  }
}
