import fs from "node:fs";
import dotenv from "dotenv";

import {
  collectOfficialContactPagesForScout,
  type OfficialVerifierUsage,
  type ScoutOfficialPage,
} from "../../src/lib/ai/officialSiteVerifier";

import {
  saveOfficialPlaceContact,
  isUsablePublicEmail,
} from "../../src/lib/privatePlaceContacts";

import {
  prisma,
} from "../../src/lib/prisma";

dotenv.config({
  path: ".env.local",
});

const PLACES_PATH =
  "data/places.json";

const MULTI_TENANT_DOMAINS =
  new Set([
    "facebook.com",
    "instagram.com",
  ]);

type Place = {
  id: string;
  name: string;
  city?: string;
  country?: string;
  website?: string;
};

type WebsiteGroup = {
  key: string;
  domain: string;
  auditWebsite: string;
  multiTenantProfile: boolean;
  places: Place[];
};

function argumentValue(
  name: string
) {
  const prefix =
    `${name}=`;

  return (
    process.argv
      .slice(2)
      .find(
        value =>
          value.startsWith(
            prefix
          )
      )
      ?.slice(
        prefix.length
      )
      .trim() || ""
  );
}

function hasFlag(
  name: string
) {
  return process.argv
    .slice(2)
    .includes(name);
}

function positiveInteger(
  name: string,
  fallback: number
) {
  const raw =
    argumentValue(name);

  if (!raw) {
    return fallback;
  }

  const value =
    Number(raw);

  if (
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new Error(
      `${name} invalide : ${raw}`
    );
  }

  return value;
}

function websiteIdentity(
  place: Place
) {
  const rawValue =
    String(
      place.website || ""
    ).trim();

  if (!rawValue) {
    return null;
  }

  const raw =
    /^https?:\/\//i.test(
      rawValue
    )
      ? rawValue
      : `https://${rawValue}`;

  let url: URL;

  try {
    url =
      new URL(raw);
  } catch {
    return null;
  }

  url.hash = "";

  const domain =
    url.hostname
      .toLowerCase()
      .replace(
        /^www\./,
        ""
      );

  const rawPath =
    url.pathname
      .replace(
        /\/+$/,
        ""
      ) || "/";

  let path =
    rawPath;

  try {
    path =
      decodeURIComponent(
        rawPath
      );
  } catch {}

  path =
    path
      .normalize("NFKC")
      .toLowerCase();

  const multiTenantProfile =
    MULTI_TENANT_DOMAINS
      .has(domain);

  return {
    key:
      multiTenantProfile
        ? `${domain}:${path}`
        : domain,

    domain,

    auditWebsite:
      url.toString(),

    multiTenantProfile,
  };
}

function buildGroups(
  places: Place[]
) {
  const groups =
    new Map<
      string,
      WebsiteGroup
    >();

  for (
    const place of places
  ) {
    const identity =
      websiteIdentity(
        place
      );

    if (!identity) {
      continue;
    }

    const existing =
      groups.get(
        identity.key
      );

    if (existing) {
      existing.places.push(
        place
      );

      continue;
    }

    groups.set(
      identity.key,
      {
        ...identity,
        places: [
          place,
        ],
      }
    );
  }

  return [
    ...groups.values(),
  ];
}

function pagePriority(
  urlValue: string
) {
  let pathname = "";

  try {
    pathname =
      new URL(
        urlValue
      ).pathname
        .toLowerCase();
  } catch {}

  if (
    /contact|nous-contacter|nous-joindre|get-in-touch|kontakt|contacto|contatti/.test(
      pathname
    )
  ) {
    return 100;
  }

  if (
    /mention|legal|privacy|confidential|imprint|impressum/.test(
      pathname
    )
  ) {
    return 90;
  }

  if (
    /about|a-propos|equipe|team|qui-sommes-nous/.test(
      pathname
    )
  ) {
    return 70;
  }

  if (
    pathname === "/" ||
    pathname === ""
  ) {
    return 60;
  }

  return 10;
}

function bestEvidenceByEmail(
  pages: ScoutOfficialPage[]
) {
  const result =
    new Map<
      string,
      {
        url: string;
        contentHash: string;
        priority: number;
      }
    >();

  for (
    const page of pages
  ) {
    for (
      const rawEmail of
      page.emails || []
    ) {
      const email =
        rawEmail
          .trim()
          .toLowerCase();

      if (
        !isUsablePublicEmail(
          email
        )
      ) {
        continue;
      }

      const priority =
        pagePriority(
          page.url
        );

      const existing =
        result.get(
          email
        );

      if (
        !existing ||
        priority >
          existing.priority
      ) {
        result.set(
          email,
          {
            url:
              page.url,

            contentHash:
              page.contentHash,

            priority,
          }
        );
      }
    }
  }

  return result;
}

function emptyUsage():
  OfficialVerifierUsage {
  return {
    httpRequests: 0,
    embeddingTokens: 0,
    llmInputTokens: 0,
    llmOutputTokens: 0,
  };
}

async function main() {
  const places =
    JSON.parse(
      fs.readFileSync(
        PLACES_PATH,
        "utf8"
      )
    ) as Place[];

  const groups =
    buildGroups(
      places
    );

  const contacts =
    await prisma
      .placePrivateContact
      .findMany({
        where: {
          active: true,
        },

        select: {
          placeId: true,
        },
      });

  const placeIdsWithContact =
    new Set(
      contacts.map(
        contact =>
          contact.placeId
      )
    );

  const placeFilter =
    argumentValue(
      "--place"
    );

  const onlyMissing =
    !hasFlag(
      "--include-existing"
    );

  /*
   * Pour l'instant :
   * - plateforme mutualisée => ignorée ;
   * - site partagé par plusieurs lieux => ignoré.
   *
   * On ne veut jamais attribuer automatiquement
   * un email global à la mauvaise succursale.
   */
  let candidates =
    groups.filter(group => {
      if (
        group.multiTenantProfile
      ) {
        return false;
      }

      if (
        group.places.length !== 1
      ) {
        return false;
      }

      const place =
        group.places[0];

      if (
        placeFilter &&
        place.id !==
          placeFilter &&
        place.name
          .toLowerCase() !==
          placeFilter
            .toLowerCase()
      ) {
        return false;
      }

      if (
        onlyMissing &&
        placeIdsWithContact.has(
          place.id
        )
      ) {
        return false;
      }

      return true;
    });

  const offset =
    positiveInteger(
      "--offset",
      0
    );

  candidates =
    candidates.slice(
      offset
    );

  const all =
    hasFlag("--all");

  const limit =
    all
      ? candidates.length
      : Math.max(
          1,
          positiveInteger(
            "--limit",
            10
          )
        );

  const selected =
    candidates.slice(
      0,
      limit
    );

  const sharedGroups =
    groups.filter(
      group =>
        !group.multiTenantProfile &&
        group.places.length > 1
    );

  const multiTenantGroups =
    groups.filter(
      group =>
        group.multiTenantProfile
    );

  console.log(
    "========================================"
  );

  console.log(
    "SCOUT CONTACTS"
  );

  console.log(
    "========================================"
  );

  console.log(
    "Catalogue:",
    places.length
  );

  console.log(
    "Groupes de sites:",
    groups.length
  );

  console.log(
    "Lieux ayant déjà un contact:",
    placeIdsWithContact.size
  );

  console.log(
    "Groupes partagés ignorés:",
    sharedGroups.length
  );

  console.log(
    "Profils mutualisés ignorés:",
    multiTenantGroups.length
  );

  console.log(
    "Candidats sans contact:",
    candidates.length
  );

  console.log(
    "Sélectionnés:",
    selected.length
  );

  console.log("");

  for (
    const group of selected
  ) {
    const place =
      group.places[0];

    console.log(
      `${place.name} — ${place.city || ""}`
    );

    console.log(
      `  ${place.website}`
    );
  }

  if (
    hasFlag("--dry-run")
  ) {
    console.log("");
    console.log(
      "DRY RUN : aucun accès web, aucune écriture Neon."
    );

    return;
  }

  let placesWithEmail =
    0;

  let placesWithoutEmail =
    0;

  let contactsCreated =
    0;

  let evidenceCreated =
    0;

  let errors =
    0;

  const totalUsage =
    emptyUsage();

  for (
    let index = 0;
    index < selected.length;
    index += 1
  ) {
    const group =
      selected[index];

    const place =
      group.places[0];

    console.log("");
    console.log(
      `[${index + 1}/${selected.length}] ${place.name}`
    );

    const usage =
      emptyUsage();

    try {
      const collection =
        await collectOfficialContactPagesForScout({
          place,
          usage,
          maxPages: 6,
        });

      totalUsage.httpRequests +=
        usage.httpRequests || 0;

      const emails =
        bestEvidenceByEmail(
          collection.pages
        );

      if (
        emails.size === 0
      ) {
        placesWithoutEmail +=
          1;

        console.log(
          `  aucun email trouvé — pages=${collection.pages.length}`
        );

        continue;
      }

      placesWithEmail +=
        1;

      console.log(
        `  emails=${emails.size} pages=${collection.pages.length}`
      );

      for (
        const [
          email,
          evidence,
        ] of emails
      ) {
        const saved =
          await saveOfficialPlaceContact({
            placeId:
              place.id,

            email,

            sourceUrl:
              evidence.url,

            sourceContentHash:
              evidence.contentHash,

            sourceKind:
              "scout",

            verifiedAt:
              new Date(),
          });

        if (
          !saved.saved
        ) {
          continue;
        }

        if (
          saved.contactCreated
        ) {
          contactsCreated +=
            1;
        }

        if (
          saved.evidenceCreated
        ) {
          evidenceCreated +=
            1;
        }

        console.log(
          `    ${email}`
        );

        console.log(
          `      ${evidence.url}`
        );
      }
    } catch (error) {
      errors += 1;

      console.error(
        "  ERREUR:",
        error instanceof Error
          ? error.message
          : String(error)
      );
    }
  }

  console.log("");
  console.log(
    "========================================"
  );

  console.log(
    "RESULTAT"
  );

  console.log(
    "========================================"
  );

  console.log(
    "Lieux avec email:",
    placesWithEmail
  );

  console.log(
    "Lieux sans email:",
    placesWithoutEmail
  );

  console.log(
    "Contacts créés:",
    contactsCreated
  );

  console.log(
    "Preuves créées:",
    evidenceCreated
  );

  console.log(
    "Erreurs:",
    errors
  );

  console.log(
    "HTTP:",
    totalUsage.httpRequests
  );

  console.log(
    "Embeddings: 0"
  );

  console.log(
    "LLM: 0"
  );
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
