import fs from "node:fs";

const profiles =
  JSON.parse(
    fs.readFileSync(
      "data/private/scout/catalogue-profiles.v1.json",
      "utf8"
    )
  ).profiles;

const rules =
  JSON.parse(
    fs.readFileSync(
      "data/private/scout/category-rules.draft.v1.json",
      "utf8"
    )
  );

const discovery =
  JSON.parse(
    fs.readFileSync(
      "data/private/scout/discovery-clusters.v1.json",
      "utf8"
    )
  );

const decisions =
  JSON.parse(
    fs.readFileSync(
      "data/private/scout/discovery-decisions.v1.json",
      "utf8"
    )
  );

const wasteDecision =
  decisions.decisions.find(
    (decision: any) =>
      decision.key ===
        "wastePackagingReduction" &&
      decision.status ===
        "accepted_candidate"
  );

const wasteClusterIds =
  new Set(
    wasteDecision?.sourceClusters || []
  );

const wastePhrases =
  new Set<string>();

for (
  const cluster of
    discovery.results || []
) {
  if (
    !wasteClusterIds.has(
      cluster.id
    )
  ) {
    continue;
  }

  for (
    const phrase of
      cluster.phrases || []
  ) {
    wastePhrases.add(
      phrase.normalized
    );
  }
}

function normalizeText(
  value: unknown
) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function hasWasteCandidate(
  profile: any
) {
  return (
    profile.selectionDrivers ||
    []
  ).some(
    (driver: string) =>
      wastePhrases.has(
        normalizeText(driver)
      )
  );
}

const priority = {
  contradicted: 0,
  suggested: 1,
  supported: 2,
};

function signalMap(profile: any) {
  const map =
    new Map<string, string>();

  for (
    const signal of
      profile.signals || []
  ) {
    const current =
      map.get(signal.key);

    if (
      !current ||
      priority[
        signal.status as keyof typeof priority
      ] >
        priority[
          current as keyof typeof priority
        ]
    ) {
      map.set(
        signal.key,
        signal.status
      );
    }
  }

  return map;
}

console.log(
  "=== COUVERTURE DU BROUILLON ==="
);

for (
  const [
    category,
    rule
  ] of Object.entries(
    rules.categories
  ) as any
) {
  const group =
    profiles.filter(
      (p: any) =>
        p.normalizedCategory ===
        category
    );

  if (!group.length) {
    continue;
  }

  if (rule.inheritFrom) {
    console.log("");
    console.log(
      `${category} (${group.length}) — héritage ${rule.inheritFrom.join(" + ")}`
    );
    continue;
  }

  const anchors =
    rule.anchors || [];

  const strong =
    rule.strong || [];

  const relevant =
    [
      ...anchors,
      ...strong,
    ].filter(
      key =>
        key !==
        "wastePackagingReduction"
    );

  let supportedAnchor = 0;
  let observedAnchor = 0;
  let supportedAnchorOrStrong = 0;
  let observedAnchorOrStrong = 0;
  let noDocumentedMatch = 0;

  for (const profile of group) {
    const map =
      signalMap(profile);

    const hasSupportedAnchor =
      anchors.some(
        (key: string) =>
          map.get(key) ===
          "supported"
      );

    const hasObservedAnchor =
      anchors.some(
        (key: string) =>
          map.get(key) ===
            "supported" ||
          map.get(key) ===
            "suggested"
      );

    const hasSupportedRelevant =
      relevant.some(
        (key: string) =>
          map.get(key) ===
          "supported"
      );

    const hasObservedRelevantBase =
      relevant.some(
        (key: string) =>
          map.get(key) ===
            "supported" ||
          map.get(key) ===
            "suggested"
      );

    const candidateRelevant =
      [
        ...anchors,
        ...strong,
      ].includes(
        "wastePackagingReduction"
      );

    const hasObservedRelevant =
      hasObservedRelevantBase ||
      (
        candidateRelevant &&
        hasWasteCandidate(
          profile
        )
      );

    if (hasSupportedAnchor) {
      supportedAnchor++;
    }

    if (hasObservedAnchor) {
      observedAnchor++;
    }

    if (hasSupportedRelevant) {
      supportedAnchorOrStrong++;
    }

    if (hasObservedRelevant) {
      observedAnchorOrStrong++;
    }

    if (!hasObservedRelevant) {
      noDocumentedMatch++;
    }
  }

  const pct = (
    value: number
  ) =>
    (
      value /
      group.length *
      100
    ).toFixed(1);

  console.log("");
  console.log(
    `${category.toUpperCase()} (${group.length}) — confiance=${rule.confidence}`
  );

  console.log(
    `  anchor supported       : ${supportedAnchor}/${group.length} (${pct(supportedAnchor)}%)`
  );

  console.log(
    `  anchor observed        : ${observedAnchor}/${group.length} (${pct(observedAnchor)}%)`
  );

  console.log(
    `  anchor/strong supported: ${supportedAnchorOrStrong}/${group.length} (${pct(supportedAnchorOrStrong)}%)`
  );

  console.log(
    `  anchor/strong observed : ${observedAnchorOrStrong}/${group.length} (${pct(observedAnchorOrStrong)}%)`
  );

  console.log(
    `  aucun signal documenté : ${noDocumentedMatch}/${group.length} (${pct(noDocumentedMatch)}%)`
  );
}
