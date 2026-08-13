import fs from "node:fs";
import path from "node:path";
import {
  createHash
} from "node:crypto";

const VERSION =
  "scout-site-learning-corpus-v2";

const INPUT_PATH =
  "data/private/scout/catalogue-web-fusion-by-site.v1.json";

const OUTPUT_PATH =
  "data/private/scout/catalogue-site-learning-corpus.v2.json";

function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function aliasKey(value) {
  return normalize(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function canonicalCategory(value) {
  const key = aliasKey(value);

  const aliases = new Map([
    ["restaurant", "Restaurant"],
    ["epicerie", "Épicerie"],
    ["grocery", "Épicerie"],
    ["ferme", "Ferme"],
    ["lieu alternatif", "Lieu alternatif"],
    ["boutique", "Boutique"],
    ["cafe", "Café"],
    ["marche", "Marché"],
    ["mode", "Mode"],
    ["boulangerie", "Boulangerie"],
    ["atelier", "Atelier"],
    ["librairie", "Librairie"],
    ["lieu de vie", "Lieu de vie"],
    [
      "artisanat",
      "Artisanat / créateurs locaux"
    ],
    [
      "artisanat / createurs locaux",
      "Artisanat / créateurs locaux"
    ],
    [
      "brasserie",
      "Brasserie / bar / pub"
    ],
    [
      "bar",
      "Brasserie / bar / pub"
    ],
    [
      "pub",
      "Brasserie / bar / pub"
    ],
    [
      "brasserie / bar",
      "Brasserie / bar / pub"
    ],
    [
      "brasserie bar",
      "Brasserie / bar / pub"
    ],
    [
      "brasserie / bar / pub",
      "Brasserie / bar / pub"
    ],
    [
      "brunch",
      "Café / brunch"
    ],
    [
      "cafe / brunch",
      "Café / brunch"
    ]
  ]);

  return aliases.get(key) ||
    String(value || "Sans catégorie").trim();
}

function stableId(value) {
  return createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 20);
}

function uniqueValues(values) {
  const byNormalized = new Map();

  for (const value of values) {
    const cleaned =
      String(value || "").trim();

    if (!cleaned) {
      continue;
    }

    const key = normalize(cleaned);

    if (!byNormalized.has(key)) {
      byNormalized.set(key, cleaned);
    }
  }

  return [...byNormalized.values()];
}

function writeJsonAtomic(
  filePath,
  value
) {
  fs.mkdirSync(
    path.dirname(filePath),
    {
      recursive: true
    }
  );

  const temporaryPath =
    `${filePath}.${process.pid}.tmp`;

  fs.writeFileSync(
    temporaryPath,
    JSON.stringify(
      value,
      null,
      2
    ) + "\n",
    "utf8"
  );

  fs.renameSync(
    temporaryPath,
    filePath
  );
}

const source = JSON.parse(
  fs.readFileSync(
    INPUT_PATH,
    "utf8"
  )
);

const groups = new Map();

for (const profile of source.profiles) {
  const groupKey =
    profile.officialSiteGroupKey ||
    profile.placeId;

  let group = groups.get(groupKey);

  if (!group) {
    group = {
      groupKey,
      auditWebsite:
        profile.auditWebsite ||
        profile.website ||
        "",
      members: new Map(),
      originalCategories: [],
      internalDrivers: [],
      findings: new Map(),
      pages: new Map(),
      selectedUrls: [],
      summaries: [],
      cautions: [],
      invalidEvidenceCount: 0,
      verifiedAt: [],
      ownerFound: false
    };

    groups.set(groupKey, group);
  }

  group.members.set(
    profile.placeId,
    {
      placeId:
        profile.placeId,
      name:
        profile.name,
      city:
        profile.city || "",
      country:
        profile.country || "",
      category:
        profile.category || "",
      website:
        profile.website || ""
    }
  );

  group.originalCategories.push(
    profile.category || ""
  );

  group.internalDrivers.push(
    ...(
      profile.internalProfile
        ?.selectionDrivers || []
    )
  );

  group.selectedUrls.push(
    ...(profile.selectedUrls || [])
  );

  group.summaries.push(
    profile.summaryFr || ""
  );

  group.cautions.push(
    ...(profile.cautions || [])
  );

  group.verifiedAt.push(
    profile.verifiedAt || ""
  );

  if (profile.auditUsageOwner) {
    group.ownerFound = true;
    group.invalidEvidenceCount =
      Number(
        profile.invalidEvidenceCount || 0
      );
  }

  for (
    const page of
    profile.officialPages || []
  ) {
    const pageKey = [
      page.contentHash || "",
      page.url || ""
    ].join("|");

    if (!group.pages.has(pageKey)) {
      group.pages.set(
        pageKey,
        page
      );
    }
  }

  for (
    const finding of
    profile.officialFindings || []
  ) {
    const findingKey = [
      finding.sourceContentHash || "",
      normalize(finding.evidenceQuote),
      normalize(finding.concept),
      finding.scope || ""
    ].join("|");

    if (!group.findings.has(findingKey)) {
      group.findings.set(
        findingKey,
        {
          evidenceId:
            `evidence_${stableId(
              `${groupKey}|${findingKey}`
            )}`,
          concept:
            finding.concept,
          statementFr:
            finding.statementFr,
          evidenceQuote:
            finding.evidenceQuote,
          sourceUrl:
            finding.sourceUrl,
          sourceContentHash:
            finding.sourceContentHash,
          scope:
            finding.scope,
          relation:
            finding.relation,
          relatedInternalDriver:
            finding.relatedInternalDriver
        }
      );
    }
  }
}

const siteProfiles = [];

for (const group of groups.values()) {
  const members =
    [...group.members.values()]
      .sort(
        (a, b) =>
          a.name.localeCompare(
            b.name,
            "fr"
          )
      );

  const categories =
    uniqueValues(
      group.originalCategories.map(
        canonicalCategory
      )
    ).sort(
      (a, b) =>
        a.localeCompare(b, "fr")
    );

  const internalDrivers =
    uniqueValues(
      group.internalDrivers
    );

  const officialFindings =
    [...group.findings.values()];

  const applicableFindings =
    officialFindings.filter(
      finding =>
        finding.scope ===
          "target_place" ||
        finding.scope ===
          "brand_general"
    );

  const learningParts = [
    `Catégories : ${categories.join(", ")}`,
    internalDrivers.length
      ? `Signaux internes : ${internalDrivers.join("; ")}`
      : "",
    ...applicableFindings.map(
      finding =>
        [
          finding.concept,
          finding.statementFr
        ]
          .filter(Boolean)
          .join(" — ")
    )
  ].filter(Boolean);

  siteProfiles.push({
    siteProfileId:
      `site_${stableId(
        group.groupKey
      )}`,
    officialSiteGroupKey:
      group.groupKey,
    auditWebsite:
      group.auditWebsite,
    placeIds:
      members.map(
        member =>
          member.placeId
      ),
    places:
      members,
    categories,
    originalCategories:
      uniqueValues(
        group.originalCategories
      ),
    internalDrivers,
    officialPages:
      [...group.pages.values()],
    selectedUrls:
      uniqueValues(
        group.selectedUrls
      ),
    officialFindings,
    applicableOfficialFindingCount:
      applicableFindings.length,
    summariesFr:
      uniqueValues(
        group.summaries
      ),
    cautions:
      uniqueValues(
        group.cautions
      ),
    invalidEvidenceCount:
      group.invalidEvidenceCount,
    learningStatus:
      applicableFindings.length > 0
        ? "official_evidence"
        : "internal_context_only",
    learningTextFr:
      learningParts.join("\n"),
    verifiedAt:
      group.verifiedAt
        .filter(Boolean)
        .sort()
        .at(-1) || ""
  });
}

const cataloguePlaces = JSON.parse(
  fs.readFileSync(
    "data/places.json",
    "utf8"
  )
);

const internalProfilesFile =
  JSON.parse(
    fs.readFileSync(
      "data/private/scout/catalogue-profiles.v1.json",
      "utf8"
    )
  );

const placeById = new Map(
  cataloguePlaces.map(
    place => [
      place.id,
      place
    ]
  )
);

const internalProfileById =
  new Map(
    internalProfilesFile.profiles.map(
      profile => [
        profile.placeId,
        profile
      ]
    )
  );

function officialDomain(value) {
  try {
    const cleaned =
      String(value || "").trim();

    const raw =
      /^https?:\/\//i.test(cleaned)
        ? cleaned
        : `https://${cleaned}`;

    return new URL(raw)
      .hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return "";
  }
}

const failedGroups = new Map();

for (const failure of source.failures || []) {
  const place =
    placeById.get(
      failure.placeId
    );

  if (!place) {
    throw new Error(
      `Lieu en échec absent du catalogue : ${failure.placeId}`
    );
  }

  const groupKey =
    officialDomain(
      place.website ||
      failure.website
    );

  if (!groupKey) {
    throw new Error(
      `Domaine invalide pour ${place.name}`
    );
  }

  if (groups.has(groupKey)) {
    throw new Error(
      `Le groupe ${groupKey} existe à la fois en succès et en échec`
    );
  }

  let failedGroup =
    failedGroups.get(groupKey);

  if (!failedGroup) {
    failedGroup = {
      groupKey,
      auditWebsite:
        failure.website ||
        place.website ||
        "",
      members: new Map(),
      originalCategories: [],
      internalDrivers: [],
      errors: []
    };

    failedGroups.set(
      groupKey,
      failedGroup
    );
  }

  failedGroup.members.set(
    place.id,
    {
      placeId:
        place.id,
      name:
        place.name,
      city:
        place.city || "",
      country:
        place.country || "",
      category:
        place.category || "",
      website:
        place.website || ""
    }
  );

  failedGroup.originalCategories.push(
    place.category || ""
  );

  const internalProfile =
    internalProfileById.get(
      place.id
    );

  failedGroup.internalDrivers.push(
    ...(
      internalProfile
        ?.selectionDrivers || []
    )
  );

  failedGroup.errors.push(
    failure.error ||
    "Aucune page officielle exploitable"
  );
}

for (
  const failedGroup of
  failedGroups.values()
) {
  const members =
    [...failedGroup.members.values()]
      .sort(
        (a, b) =>
          a.name.localeCompare(
            b.name,
            "fr"
          )
      );

  const categories =
    uniqueValues(
      failedGroup
        .originalCategories
        .map(canonicalCategory)
    ).sort(
      (a, b) =>
        a.localeCompare(b, "fr")
    );

  const internalDrivers =
    uniqueValues(
      failedGroup.internalDrivers
    );

  const learningParts = [
    `Catégories : ${categories.join(", ")}`,
    internalDrivers.length
      ? `Signaux internes : ${internalDrivers.join("; ")}`
      : ""
  ].filter(Boolean);

  siteProfiles.push({
    siteProfileId:
      `site_${stableId(
        failedGroup.groupKey
      )}`,
    officialSiteGroupKey:
      failedGroup.groupKey,
    auditWebsite:
      failedGroup.auditWebsite,
    placeIds:
      members.map(
        member =>
          member.placeId
      ),
    places:
      members,
    categories,
    originalCategories:
      uniqueValues(
        failedGroup
          .originalCategories
      ),
    internalDrivers,
    officialPages: [],
    selectedUrls: [],
    officialFindings: [],
    applicableOfficialFindingCount: 0,
    summariesFr: [],
    cautions:
      uniqueValues(
        failedGroup.errors.map(
          error =>
            `Audit du site officiel en échec : ${error}`
        )
      ),
    invalidEvidenceCount: 0,
    learningStatus:
      "internal_context_only_web_audit_failed",
    webAuditFailure: {
      error:
        uniqueValues(
          failedGroup.errors
        ).join("; ")
    },
    learningTextFr:
      learningParts.join("\n"),
    verifiedAt:
      source.generatedAt || ""
  });
}

siteProfiles.sort(
  (a, b) =>
    a.officialSiteGroupKey.localeCompare(
      b.officialSiteGroupKey
    )
);

const representedPlaceIds =
  new Set(
    siteProfiles.flatMap(
      profile =>
        profile.placeIds
    )
  );

const expectedRepresentedPlaces =
  Number(
    source.analyzedPlaces || 0
  ) +
  Number(
    source.failedPlaces || 0
  );

if (
  representedPlaceIds.size !==
  expectedRepresentedPlaces
) {
  throw new Error(
    `Couverture incorrecte : ${representedPlaceIds.size} lieux représentés sur ${expectedRepresentedPlaces} attendus`
  );
}

if (
  siteProfiles.length !==
  Number(source.officialSiteGroups)
) {
  throw new Error(
    `Groupes incorrects : ${siteProfiles.length} obtenus sur ${source.officialSiteGroups} attendus`
  );
}

const categoryIndex = {};

for (const profile of siteProfiles) {
  for (const category of profile.categories) {
    categoryIndex[category] ||= [];
    categoryIndex[category].push(
      profile.siteProfileId
    );
  }
}

for (const category of Object.keys(
  categoryIndex
)) {
  categoryIndex[category].sort();
}

const groupsWithOfficialEvidence =
  siteProfiles.filter(
    profile =>
      profile.learningStatus ===
        "official_evidence"
  ).length;

const groupsWithInternalContextOnly =
  siteProfiles.filter(
    profile =>
      profile.learningStatus ===
        "internal_context_only"
  ).length;

const groupsWithFailedWebAudit =
  siteProfiles.filter(
    profile =>
      profile.learningStatus ===
        "internal_context_only_web_audit_failed"
  ).length;

const applicableOfficialFindings =
  siteProfiles.reduce(
    (total, profile) =>
      total +
      profile
        .applicableOfficialFindingCount,
    0
  );

const output = {
  version:
    VERSION,
  generatedAt:
    new Date().toISOString(),
  source: {
    path:
      INPUT_PATH,
    version:
      source.version,
    analyzedPlaces:
      source.analyzedPlaces,
    failedPlaces:
      source.failedPlaces
  },
  policy: {
    corpusType:
      "positive_examples",
    oneProfilePerOfficialSite:
      true,
    branchesDeduplicated:
      true,
    criteriaAreNotFixed:
      true,
    signalsAreNonExclusive:
      true,
    rareSignalsArePreserved:
      true,
    frequencyIsNotEligibility:
      true,
    absenceOfEvidenceIsNotNegative:
      true,
    officialEvidenceRemainsTraceable:
      true,
    failedWebAuditsRetainedAsInternalContext:
      true
  },
  coverage: {
    officialSiteGroups:
      siteProfiles.length,
    groupsWithOfficialEvidence,
    groupsWithInternalContextOnly,
    groupsWithFailedWebAudit,
    cataloguePlacesRepresented:
      representedPlaceIds.size,
    cataloguePlaceProfilesFromSuccessfulAudits:
      source.profiles.length,
    applicableOfficialFindings,
    rejectedOfficialEvidence:
      siteProfiles.reduce(
        (total, profile) =>
          total +
          profile.invalidEvidenceCount,
        0
      ),
    failedCataloguePlaces:
      source.failedPlaces
  },
  categoryIndex,
  failures:
    source.failures || [],
  siteProfiles
};

writeJsonAtomic(
  OUTPUT_PATH,
  output
);

console.log({
  version:
    output.version,
  officialSiteGroups:
    output.coverage
      .officialSiteGroups,
  groupsWithOfficialEvidence:
    output.coverage
      .groupsWithOfficialEvidence,
  groupsWithInternalContextOnly:
    output.coverage
      .groupsWithInternalContextOnly,
  groupsWithFailedWebAudit:
    output.coverage
      .groupsWithFailedWebAudit,
  cataloguePlacesRepresented:
    output.coverage
      .cataloguePlacesRepresented,
  applicableOfficialFindings:
    output.coverage
      .applicableOfficialFindings,
  rejectedOfficialEvidence:
    output.coverage
      .rejectedOfficialEvidence,
  normalizedCategories:
    Object.fromEntries(
      Object.entries(
        categoryIndex
      )
        .map(
          ([category, ids]) => [
            category,
            ids.length
          ]
        )
        .sort(
          (a, b) =>
            b[1] - a[1]
        )
    ),
  output:
    OUTPUT_PATH
});
