import { prisma } from "@/lib/prisma";
import { readPlaceCatalogueWithProfessionalOverrides } from "@/lib/placeCatalogue";

export type ProfessionalAccessCapability =
  | "space"
  | "analytics";

export type ProfessionalPlan =
  | "free"
  | "pro"
  | "premium";

export type ProfessionalAccessPlace = {
  id: string;
  placeId: string;
  role: string;
  plan: string | null;
  resolvedPlan: ProfessionalPlan;
  accessStatus: string;
  name: string;
  city: string | null;
  country: string | null;
  category: string | null;
  address: string | null;
  website: string | null;
  openingHours: string | null;
  phone: string | null;
  panoramaImage: string | null;
  miniText: string | null;
};

type CataloguePlace = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  category: string | null;
  address: string | null;
  website: string | null;
  openingHours: string | null;
  phone: string | null;
  panoramaImage: string | null;
  miniText: string | null;
  timeZone: string | null;
};

function cleanText(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const clean = value.trim();

  return clean || null;
}

async function readCataloguePlaces() {
  const parsed: unknown =
    await readPlaceCatalogueWithProfessionalOverrides();

  if (!Array.isArray(parsed)) {
    return [] as CataloguePlace[];
  }

  return parsed
    .filter(
      (
        item,
      ): item is Record<
        string,
        unknown
      > =>
        Boolean(
          item &&
            typeof item ===
              "object" &&
            !Array.isArray(item),
        ),
    )
    .map(
      (item): CataloguePlace => ({
        id:
          cleanText(item.id) || "",

        name:
          cleanText(item.name) ||
          "Lieu Indie Map",

        city:
          cleanText(item.city),

        country:
          cleanText(item.country),

        category:
          cleanText(item.category),

        address:
          cleanText(item.address),

        website:
          cleanText(item.website),

        openingHours:
          cleanText(item.openingHours),

        phone:
          cleanText(item.phone),

        panoramaImage:
          cleanText(item.panoramaImage),

        miniText:
          cleanText(item.miniText),

        timeZone:
          cleanText(item.timeZone),
      }),
    )
    .filter((place) =>
      Boolean(place.id),
    );
}

export function resolveProfessionalPlan(
  professionalPlace: {
    plan: string | null;
    accessStatus: string;
    accessStartsAt: Date | null;
    accessEndsAt: Date | null;
  },
  now = new Date(),
): ProfessionalPlan {
  const plan =
    cleanText(
      professionalPlace.plan,
    )?.toLowerCase();

  if (
    plan !== "pro" &&
    plan !== "premium"
  ) {
    return "free";
  }

  if (
    !["active", "trial"].includes(
      professionalPlace.accessStatus,
    )
  ) {
    return "free";
  }

  if (
    professionalPlace.accessStartsAt &&
    professionalPlace.accessStartsAt >
      now
  ) {
    return "free";
  }

  if (
    professionalPlace.accessEndsAt &&
    professionalPlace.accessEndsAt <
      now
  ) {
    return "free";
  }

  return plan;
}

function hasProfessionalCapability(
  membership: {
    role: string;

    professionalPlace: {
      status: string;
      accessStatus: string;
      accessStartsAt: Date | null;
      accessEndsAt: Date | null;
    };
  },
  capability: ProfessionalAccessCapability,
  now: Date,
) {
  /*
   * Pour le lancement, seul un owner
   * vérifié manuellement par Indie Map
   * peut administrer un lieu.
   *
   * D'autres rôles pourront être ajoutés
   * plus tard explicitement.
   */
  if (membership.role !== "owner") {
    return false;
  }

  if (
    membership.professionalPlace
      .status !== "verified"
  ) {
    return false;
  }

  /*
   * L'Espace Pro de base n'est pas
   * conditionné à un abonnement.
   */
  if (capability === "space") {
    return true;
  }

  /*
   * Les règles commerciales ne
   * concernent que les fonctionnalités
   * premium, notamment l'analytics.
   */
  if (
    !["active", "trial"].includes(
      membership.professionalPlace
        .accessStatus,
    )
  ) {
    return false;
  }

  if (
    membership.professionalPlace
      .accessStartsAt &&
    membership.professionalPlace
      .accessStartsAt > now
  ) {
    return false;
  }

  if (
    membership.professionalPlace
      .accessEndsAt &&
    membership.professionalPlace
      .accessEndsAt < now
  ) {
    return false;
  }

  return true;
}

export async function getProfessionalAccessForUser(
  options: {
    userId: string;
    requestedPlaceId?: string | null;
    capability?: ProfessionalAccessCapability;
    now?: Date;
  },
) {
  const now =
    options.now ?? new Date();

  const capability =
    options.capability ?? "space";

  const memberships =
    await prisma.professionalPlaceMember.findMany(
      {
        where: {
          userId: options.userId,
        },

        include: {
          professionalPlace: true,
        },

        orderBy: {
          createdAt: "asc",
        },
      },
    );

  const accessibleMemberships =
    memberships.filter(
      (membership) =>
        hasProfessionalCapability(
          membership,
          capability,
          now,
        ),
    );

  const requestedPlaceId =
    cleanText(
      options.requestedPlaceId,
    );

  if (
    accessibleMemberships.length === 0
  ) {
    return {
      places:
        [] as ProfessionalAccessPlace[],

      selectedMembership: null,
      professionalPlace: null,
      cataloguePlace: null,
      selected: null,
    };
  }

  const selectedMembership =
    requestedPlaceId
      ? accessibleMemberships.find(
          ({ professionalPlace }) =>
            professionalPlace.placeId ===
            requestedPlaceId,
        ) ?? null
      : accessibleMemberships[0] ??
        null;

  /*
   * Un placeId explicitement demandé
   * mais non autorisé ne doit jamais
   * retomber silencieusement sur un
   * autre établissement.
   */
  if (
    requestedPlaceId &&
    !selectedMembership
  ) {
    return null;
  }

  const catalogue =
    await readCataloguePlaces();

  const catalogueById =
    new Map(
      catalogue.map((place) => [
        place.id,
        place,
      ]),
    );

  const places:
    ProfessionalAccessPlace[] =
    accessibleMemberships.map(
      ({
        professionalPlace,
        role,
      }) => {
        const place =
          catalogueById.get(
            professionalPlace.placeId,
          );

        return {
          id:
            professionalPlace.id,

          placeId:
            professionalPlace.placeId,

          role,

          plan:
            professionalPlace.plan,

          resolvedPlan:
            resolveProfessionalPlan(
              professionalPlace,
              now,
            ),

          accessStatus:
            professionalPlace.accessStatus,

          name:
            place?.name ||
            "Lieu Indie Map",

          city:
            place?.city ?? null,

          country:
            place?.country ?? null,

          category:
            place?.category ?? null,

          address:
            place?.address ?? null,

          website:
            place?.website ?? null,

          openingHours:
            place?.openingHours ?? null,

          phone:
            place?.phone ?? null,

          panoramaImage:
            place?.panoramaImage ?? null,

          miniText:
            place?.miniText ?? null,
        };
      },
    );

  if (!selectedMembership) {
    return {
      places,
      selectedMembership: null,
      professionalPlace: null,
      cataloguePlace: null,
      selected: null,
    };
  }

  const professionalPlace =
    selectedMembership.professionalPlace;

  const cataloguePlace =
    catalogueById.get(
      professionalPlace.placeId,
    ) ?? null;

  const selectedPlace =
    places.find(
      (place) =>
        place.placeId ===
        professionalPlace.placeId,
    ) ?? null;

  return {
    places,

    selectedMembership,

    professionalPlace,

    cataloguePlace,

    selected:
      selectedPlace
        ? {
            ...selectedPlace,

            timeZone:
              cataloguePlace?.timeZone ??
              null,
          }
        : null,
  };
}

/*
 * Fonction prévue pour toutes les
 * futures écritures professionnelles :
 * horaires, téléphone, site, etc.
 *
 * Elle ne doit être appelée que côté
 * serveur.
 */
export async function getProfessionalPlaceAuthorization(
  options: {
    userId: string;
    placeId: string;
  },
) {
  const access =
    await getProfessionalAccessForUser(
      {
        userId: options.userId,

        requestedPlaceId:
          options.placeId,

        capability: "space",
      },
    );

  if (
    !access ||
    !access.selectedMembership ||
    !access.professionalPlace
  ) {
    return null;
  }

  return {
    membership:
      access.selectedMembership,

    professionalPlace:
      access.professionalPlace,

    cataloguePlace:
      access.cataloguePlace,
  };
}
