import { prisma } from "./prisma";

const OFFICIAL_CONTACT_TTL_MS =
  180 * 24 * 60 * 60 * 1000;

function normalizeEmail(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function emailDomainOf(value: string) {
  const email =
    normalizeEmail(value);

  const at =
    email.lastIndexOf("@");

  if (
    at <= 0 ||
    at >= email.length - 1
  ) {
    return null;
  }

  return email.slice(at + 1);
}

/*
 * Validation utilisée uniquement pour les contacts
 * découverts automatiquement.
 *
 * Les 53 contacts manual_verified existants restent
 * inchangés, y compris les valeurs validées manuellement.
 */
export function isUsablePublicEmail(
  value: string
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(
    normalizeEmail(value)
  );
}

export async function saveOfficialPlaceContact(
  input: {
    placeId: string;
    email: string;
    sourceUrl: string;
    sourceContentHash?: string;
    sourceKind:
      | "scout"
      | "bulle"
      | "official_site";
    verifiedAt?: Date;
  }
) {
  const normalizedEmail =
    normalizeEmail(input.email);

  if (
    !isUsablePublicEmail(
      normalizedEmail
    )
  ) {
    return {
      saved: false as const,
      reason:
        "invalid_email" as const,
    };
  }

  const verifiedAt =
    input.verifiedAt ??
    new Date();

  const expiresAt =
    new Date(
      verifiedAt.getTime() +
        OFFICIAL_CONTACT_TTL_MS
    );

  const existing =
    await prisma
      .placePrivateContact
      .findUnique({
        where: {
          placeId_normalizedEmail: {
            placeId:
              input.placeId,
            normalizedEmail,
          },
        },
        select: {
          id: true,
          verificationStatus: true,
        },
      });

  const contact =
    existing
      ? await prisma
          .placePrivateContact
          .update({
            where: {
              id:
                existing.id,
            },
            data: {
              email:
                input.email.trim(),
              emailDomain:
                emailDomainOf(
                  normalizedEmail
                ),
              active: true,

              /*
               * Une corroboration Scout ne doit jamais
               * effacer le statut manual_verified.
               */
              verificationStatus:
                existing
                  .verificationStatus,
            },
            select: {
              id: true,
              verificationStatus: true,
            },
          })
      : await prisma
          .placePrivateContact
          .create({
            data: {
              placeId:
                input.placeId,
              email:
                input.email.trim(),
              normalizedEmail,
              emailDomain:
                emailDomainOf(
                  normalizedEmail
                ),
              contactRole:
                "unknown",
              verificationStatus:
                "official_site",
              active: true,
            },
            select: {
              id: true,
              verificationStatus: true,
            },
          });

  const sourceUrl =
    String(
      input.sourceUrl || ""
    ).trim();

  const sourceContentHash =
    String(
      input.sourceContentHash || ""
    ).trim();

  /*
   * Une seule preuve courante par moteur de découverte
   * et par contact.
   *
   * Si Scout revoit l'adresse plus tard ou si le contenu
   * de la page change, on rafraîchit cette preuve au lieu
   * d'accumuler des versions redondantes.
   */
  const existingEvidence =
    await prisma
      .placePrivateContactEvidence
      .findFirst({
        where: {
          contactId:
            contact.id,
          sourceKind:
            input.sourceKind,
        },
        select: {
          id: true,
        },
      });

  if (existingEvidence) {
    await prisma
      .placePrivateContactEvidence
      .update({
        where: {
          id:
            existingEvidence.id,
        },
        data: {
          sourceUrl:
            sourceUrl || null,
          sourceContentHash:
            sourceContentHash ||
            null,
          verifiedAt,
          expiresAt,
        },
      });

    return {
      saved: true as const,
      contactCreated: false,
      evidenceCreated: false,
      verificationStatus:
        contact.verificationStatus,
    };
  }

  await prisma
    .placePrivateContactEvidence
    .create({
      data: {
        contactId:
          contact.id,
        sourceKind:
          input.sourceKind,
        sourceUrl:
          sourceUrl || null,
        sourceContentHash:
          sourceContentHash ||
          null,
        verifiedAt,
        expiresAt,
      },
    });

  return {
    saved: true as const,
    contactCreated:
      !existing,
    evidenceCreated: true,
    verificationStatus:
      contact.verificationStatus,
  };
}
