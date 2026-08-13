import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type VerifiedFactScope =
  | "target_place"
  | "brand_general";

export type SaveVerifiedFactInput = {
  placeId: string;
  placeName?: string;
  placeAddress?: string;
  scope: VerifiedFactScope;
  sourceUrl: string;
  evidenceText: string;
  verificationQuestion?: string;
  sourceContentHash?: string;
  verifierVersion?: string;
  verifiedAt?: Date;
  expiresAt: Date;
};

export type SaveOfficialPageCacheInput = {
  url: string;
  finalUrl?: string;
  contentType?: string;
  httpStatus?: number;
  body: string;
  etag?: string;
  lastModified?: string;
  fetchedAt?: Date;
  expiresAt: Date;
};

export type RecordSearchSignalInput = {
  queryText: string;
  placeId?: string;
  signal: string;
  source: string;
  payload?: Prisma.InputJsonValue;
  weight?: number;
  observedAt?: Date;
};

/*
 * Hash cryptographique stable utilisé uniquement
 * pour la déduplication et la détection de changements.
 */
export function sha256(value: string) {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

/*
 * Normalisation destinée à regrouper différentes
 * formulations textuellement équivalentes.
 *
 * La formulation originale reste toujours stockée
 * séparément dans queryText.
 */
export function normalizeSearchQuery(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchQueryHash(queryText: string) {
  return sha256(
    normalizeSearchQuery(queryText)
  );
}

/*
 * Le fragment #... n'est jamais envoyé au serveur HTTP.
 * On le retire donc du cache.
 *
 * On ne retire ni le path ni les paramètres :
 * ils peuvent réellement changer le contenu d'une page.
 */
export function normalizeOfficialUrl(value: string) {
  const input = String(value ?? "").trim();

  if (!input) {
    throw new Error(
      "URL officielle vide"
    );
  }

  const parsed = new URL(input);

  if (
    parsed.protocol !== "http:" &&
    parsed.protocol !== "https:"
  ) {
    throw new Error(
      `Protocole officiel non supporté : ${parsed.protocol}`
    );
  }

  parsed.hash = "";

  return parsed.toString();
}

export function officialSourceDomain(
  sourceUrl: string
) {
  return new URL(
    normalizeOfficialUrl(sourceUrl)
  ).hostname.toLowerCase();
}

/*
 * =========================================================
 * MÉMOIRE FACTUELLE VÉRIFIÉE
 * =========================================================
 *
 * Seules des preuves déjà vérifiées sur une source officielle
 * doivent entrer ici.
 *
 * Cette API ne reçoit volontairement aucun SearchSignal.
 */

export async function getFreshVerifiedFacts(
  placeId: string,
  now = new Date()
) {
  const id = String(placeId ?? "").trim();

  if (!id) return [];

  return prisma.aiVerifiedFact.findMany({
    where: {
      placeId: id,
      expiresAt: {
        gt: now,
      },
    },
    orderBy: [
      {
        verifiedAt: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
  });
}



export async function getFreshVerifiedFactsForPlaces(
  placeIds: string[],
  now = new Date()
) {
  const ids = [
    ...new Set(
      placeIds
        .map((id) =>
          String(id ?? "").trim()
        )
        .filter(Boolean)
    ),
  ];

  if (ids.length === 0) {
    return [];
  }

  return prisma.aiVerifiedFact.findMany({
    where: {
      placeId: {
        in: ids,
      },

      expiresAt: {
        gt: now,
      },

      scope: {
        in: [
          "target_place",
          "brand_general",
        ],
      },
    },

    orderBy: [
      {
        placeId: "asc",
      },
      {
        verifiedAt: "desc",
      },
    ],
  });
}

export async function getPlaceIdsWithFreshVerifiedFacts(
  placeIds: string[],
  now = new Date()
) {
  const ids =
    [
      ...new Set(
        placeIds
          .map(
            (id) =>
              String(id ?? "")
                .trim()
          )
          .filter(Boolean)
      ),
    ];

  if (ids.length === 0) {
    return new Set<string>();
  }

  const rows =
    await prisma.aiVerifiedFact.findMany({
      where: {
        placeId: {
          in: ids,
        },
        expiresAt: {
          gt: now,
        },
      },

      select: {
        placeId: true,
      },

      distinct: [
        "placeId",
      ],
    });

  return new Set(
    rows.map(
      (row) =>
        row.placeId
    )
  );
}

export async function saveVerifiedFact(
  input: SaveVerifiedFactInput
) {
  const placeId =
    String(input.placeId ?? "").trim();

  if (!placeId) {
    throw new Error(
      "saveVerifiedFact : placeId manquant"
    );
  }

  if (
    input.scope !== "target_place" &&
    input.scope !== "brand_general"
  ) {
    throw new Error(
      `saveVerifiedFact : scope invalide : ${input.scope}`
    );
  }

  const evidenceText =
    String(input.evidenceText ?? "");

  if (!evidenceText.trim()) {
    throw new Error(
      "saveVerifiedFact : evidenceText vide"
    );
  }

  const sourceUrl =
    normalizeOfficialUrl(
      input.sourceUrl
    );

  const evidenceHash =
    sha256(evidenceText);

  const verifiedAt =
    input.verifiedAt ??
    new Date();

  if (
    input.expiresAt.getTime() <=
    verifiedAt.getTime()
  ) {
    throw new Error(
      "saveVerifiedFact : expiresAt doit être postérieur à verifiedAt"
    );
  }

  return prisma.aiVerifiedFact.upsert({
    where: {
      placeId_sourceUrl_evidenceHash: {
        placeId,
        sourceUrl,
        evidenceHash,
      },
    },

    create: {
      placeId,
      placeName:
        input.placeName,
      placeAddress:
        input.placeAddress,
      scope:
        input.scope,
      sourceDomain:
        officialSourceDomain(
          sourceUrl
        ),
      sourceUrl,
      evidenceText,
      evidenceHash,
      verificationQuestion:
        input.verificationQuestion,
      sourceContentHash:
        input.sourceContentHash,
      verifierVersion:
        input.verifierVersion,
      verifiedAt,
      expiresAt:
        input.expiresAt,
    },

    /*
     * Une même preuve peut être revue plus tard.
     * On conserve donc le même enregistrement tout en
     * rafraîchissant sa date de vérification/fraîcheur.
     */
    update: {
      placeName:
        input.placeName,
      placeAddress:
        input.placeAddress,
      scope:
        input.scope,
      sourceDomain:
        officialSourceDomain(
          sourceUrl
        ),
      verificationQuestion:
        input.verificationQuestion,
      sourceContentHash:
        input.sourceContentHash,
      verifierVersion:
        input.verifierVersion,
      verifiedAt,
      expiresAt:
        input.expiresAt,
    },
  });
}

/*
 * =========================================================
 * CACHE DES PAGES OFFICIELLES
 * =========================================================
 *
 * Le cache évite le réseau.
 * Son contenu n'est PAS automatiquement une connaissance
 * vérifiée.
 */

export async function getFreshOfficialPageCache(
  url: string,
  now = new Date()
) {
  const normalizedUrl =
    normalizeOfficialUrl(url);

  return prisma.aiOfficialPageCache.findFirst({
    where: {
      url: normalizedUrl,
      expiresAt: {
        gt: now,
      },
    },
  });
}

export async function saveOfficialPageCache(
  input: SaveOfficialPageCacheInput
) {
  const url =
    normalizeOfficialUrl(
      input.url
    );

  const finalUrl =
    input.finalUrl
      ? normalizeOfficialUrl(
          input.finalUrl
        )
      : undefined;

  const body =
    String(input.body ?? "");

  const fetchedAt =
    input.fetchedAt ??
    new Date();

  if (
    input.expiresAt.getTime() <=
    fetchedAt.getTime()
  ) {
    throw new Error(
      "saveOfficialPageCache : expiresAt doit être postérieur à fetchedAt"
    );
  }

  const contentHash =
    sha256(body);

  return prisma.aiOfficialPageCache.upsert({
    where: {
      url,
    },

    create: {
      url,
      finalUrl,
      contentType:
        input.contentType,
      httpStatus:
        input.httpStatus,
      body,
      contentHash,
      etag:
        input.etag,
      lastModified:
        input.lastModified,
      fetchedAt,
      expiresAt:
        input.expiresAt,
    },

    update: {
      finalUrl,
      contentType:
        input.contentType,
      httpStatus:
        input.httpStatus,
      body,
      contentHash,
      etag:
        input.etag,
      lastModified:
        input.lastModified,
      fetchedAt,
      expiresAt:
        input.expiresAt,
    },
  });
}

/*
 * =========================================================
 * MÉMOIRE D'APPRENTISSAGE DES RECHERCHES
 * =========================================================
 *
 * IMPORTANT :
 * un AiSearchSignal peut influencer le retrieval/ranking,
 * mais ne constitue jamais une preuve sur un établissement.
 */

export async function recordSearchSignal(
  input: RecordSearchSignalInput
) {
  const queryText =
    String(input.queryText ?? "");

  const normalizedQuery =
    normalizeSearchQuery(
      queryText
    );

  if (!normalizedQuery) {
    throw new Error(
      "recordSearchSignal : queryText vide"
    );
  }

  const signal =
    String(input.signal ?? "").trim();

  const source =
    String(input.source ?? "").trim();

  if (!signal) {
    throw new Error(
      "recordSearchSignal : signal manquant"
    );
  }

  if (!source) {
    throw new Error(
      "recordSearchSignal : source manquante"
    );
  }

  return prisma.aiSearchSignal.create({
    data: {
      queryText,
      normalizedQuery,
      queryHash:
        sha256(
          normalizedQuery
        ),
      placeId:
        input.placeId,
      signal,
      source,
      payload:
        input.payload,
      weight:
        input.weight ?? 1,
      observedAt:
        input.observedAt ??
        new Date(),
    },
  });
}

export async function getSearchSignalsForQuery(
  queryText: string,
  limit = 100
) {
  const normalizedQuery =
    normalizeSearchQuery(
      queryText
    );

  if (!normalizedQuery) {
    return [];
  }

  const safeLimit =
    Math.max(
      1,
      Math.min(
        Math.trunc(limit),
        500
      )
    );

  return prisma.aiSearchSignal.findMany({
    where: {
      queryHash:
        sha256(
          normalizedQuery
        ),
    },
    orderBy: {
      observedAt:
        "desc",
    },
    take:
      safeLimit,
  });
}
