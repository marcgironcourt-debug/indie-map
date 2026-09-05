import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

type Obj = Record<string, unknown>;

const PROFESSIONAL_TEXT_KINDS = [
  "name",
  "address",
  "openingHours",
  "phone",
  "website",
  "miniText",
] as const;

type ProfessionalTextKind =
  (typeof PROFESSIONAL_TEXT_KINDS)[number];

type ProfessionalChangeValue = {
  proposedValue?: unknown;
};

function isObj(
  value: unknown,
): value is Obj {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value),
  );
}

/*
 * Catalogue public effectif :
 *
 * 1. data/places.json reste la source
 *    éditoriale de référence.
 *
 * 2. Les modifications Pro pending ou
 *    rejected ne changent jamais la fiche.
 *
 * 3. Les modifications Pro approved sont
 *    appliquées comme une couche par-dessus.
 *
 * 4. Si plusieurs modifications approuvées
 *    existent pour le même champ, la plus
 *    récente proposition gagne.
 *
 * 5. Le contenu binaire des images n'est
 *    jamais chargé ici. Une image approuvée
 *    est servie par sa route dédiée.
 */
export async function readPlaceCatalogueWithProfessionalOverrides(): Promise<
  Obj[]
> {
  const filePath =
    path.join(
      process.cwd(),
      "data",
      "places.json",
    );

  const raw =
    await fs.promises.readFile(
      filePath,
      "utf8",
    );

  const parsed: unknown =
    JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    return [];
  }

  const basePlaces =
    parsed
      .filter(isObj)
      .map((place) => ({
        ...place,
      }));

  const [
    textRequests,
    imageRequests,
  ] =
    await Promise.all([
      prisma.professionalPlaceChangeRequest.findMany(
        {
          where: {
            status:
              "approved",

            kind: {
              in: [
                ...PROFESSIONAL_TEXT_KINDS,
              ],
            },
          },

          select: {
            id: true,
            kind: true,
            value: true,
            createdAt: true,

            professionalPlace: {
              select: {
                placeId:
                  true,
              },
            },
          },

          orderBy: {
            createdAt:
              "asc",
          },
        },
      ),

      /*
       * Important :
       * on ne sélectionne PAS value ici.
       *
       * Une image peut contenir plusieurs
       * Mo de base64. Le catalogue n'a
       * besoin que de l'id de la demande
       * approuvée pour construire son URL.
       */
      prisma.professionalPlaceChangeRequest.findMany(
        {
          where: {
            status:
              "approved",
            kind:
              "panoramaImage",
          },

          select: {
            id: true,
            createdAt: true,

            professionalPlace: {
              select: {
                placeId:
                  true,
              },
            },
          },

          orderBy: {
            createdAt:
              "asc",
          },
        },
      ),
    ]).catch((error) => {
      // Le catalogue éditorial doit rester disponible même si les surcharges
      // professionnelles ne peuvent pas être lues temporairement.
      console.error(
        "[placeCatalogue] Impossible de charger les surcharges professionnelles",
        error,
      );
      return [[], []] as const;
    });

  const patches =
    new Map<
      string,
      Record<string, unknown>
    >();

  for (
    const request of
    textRequests
  ) {
    const placeId =
      String(
        request
          .professionalPlace
          .placeId || "",
      ).trim();

    if (!placeId) {
      continue;
    }

    const kind =
      request.kind as
        ProfessionalTextKind;

    if (
      !PROFESSIONAL_TEXT_KINDS.includes(
        kind,
      )
    ) {
      continue;
    }

    if (!isObj(request.value)) {
      continue;
    }

    const value =
      request.value as
        ProfessionalChangeValue;

    if (
      !Object.prototype.hasOwnProperty.call(
        value,
        "proposedValue",
      )
    ) {
      continue;
    }

    if (
      typeof value.proposedValue !==
      "string"
    ) {
      continue;
    }

    const patch =
      patches.get(placeId) ||
      {};

    patch[kind] =
      value.proposedValue;

    patches.set(
      placeId,
      patch,
    );
  }

  for (
    const request of
    imageRequests
  ) {
    const placeId =
      String(
        request
          .professionalPlace
          .placeId || "",
      ).trim();

    if (!placeId) {
      continue;
    }

    const patch =
      patches.get(placeId) ||
      {};

    patch.panoramaImage =
      `/api/v1/professional-place-images/${encodeURIComponent(
        request.id,
      )}`;

    patches.set(
      placeId,
      patch,
    );
  }

  return basePlaces.map(
    (place) => {
      const placeId =
        String(
          place.id || "",
        ).trim();

      const patch =
        patches.get(
          placeId,
        );

      if (!patch) {
        return place;
      }

      return {
        ...place,
        ...patch,
      };
    },
  );
}
