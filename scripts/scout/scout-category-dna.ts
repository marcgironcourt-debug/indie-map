import fs from "node:fs";

const PROFILES_PATH =
  "data/private/scout/catalogue-profiles.v1.json";

const CRITERIA_PATH =
  "data/private/scout/criteria.v1.json";

const CLUSTERS_PATH =
  "data/private/scout/discovery-clusters.v1.json";

const DECISIONS_PATH =
  "data/private/scout/discovery-decisions.v1.json";

const OUTPUT_PATH =
  "data/private/scout/category-dna.v1.json";

type SignalStatus =
  | "supported"
  | "suggested"
  | "contradicted";

type Profile = {
  placeId: string;
  name: string;
  normalizedCategory: string;
  signals: Array<{
    key: string;
    status: SignalStatus;
  }>;
  selectionDrivers?: string[];
};

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

const profilesFile =
  JSON.parse(
    fs.readFileSync(
      PROFILES_PATH,
      "utf8"
    )
  ) as {
    profiles: Profile[];
  };

const criteria =
  JSON.parse(
    fs.readFileSync(
      CRITERIA_PATH,
      "utf8"
    )
  ) as {
    signals: Record<
      string,
      unknown
    >;
  };

const discovery =
  JSON.parse(
    fs.readFileSync(
      CLUSTERS_PATH,
      "utf8"
    )
  ) as {
    results: Array<{
      id: string;
      phrases: Array<{
        normalized: string;
      }>;
    }>;
  };

const decisions =
  JSON.parse(
    fs.readFileSync(
      DECISIONS_PATH,
      "utf8"
    )
  ) as {
    decisions: Array<{
      key: string;
      status: string;
      sourceClusters?: string[];
    }>;
  };

const priority:
  Record<
    SignalStatus,
    number
  > = {
    contradicted: 1,
    suggested: 2,
    supported: 3,
  };

const wasteDecision =
  decisions.decisions.find(
    decision =>
      decision.key ===
        "wastePackagingReduction" &&
      decision.status ===
        "accepted_candidate"
  );

if (!wasteDecision) {
  throw new Error(
    "Décision wastePackagingReduction introuvable"
  );
}

const wasteClusterIds =
  new Set(
    wasteDecision
      .sourceClusters || []
  );

const wastePhrases =
  new Set<string>();

for (
  const cluster of
    discovery.results
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
      cluster.phrases
  ) {
    wastePhrases.add(
      phrase.normalized
    );
  }
}

const categories =
  [
    ...new Set(
      profilesFile.profiles.map(
        profile =>
          profile.normalizedCategory
      )
    ),
  ].sort(
    (a, b) =>
      a.localeCompare(
        b,
        "fr"
      )
  );

const signalKeys =
  Object.keys(
    criteria.signals
  );

const result:
  Record<
    string,
    unknown
  > = {};

for (
  const category of
    categories
) {
  const places =
    profilesFile.profiles.filter(
      profile =>
        profile.normalizedCategory ===
        category
    );

  const signals:
    Record<
      string,
      {
        supported: number;
        suggested: number;
        contradicted: number;
        unknown: number;
        supportedPct: number;
        observedPct: number;
      }
    > = {};

  for (
    const key of
      signalKeys
  ) {
    let supported = 0;
    let suggested = 0;
    let contradicted = 0;

    for (
      const profile of
        places
    ) {
      let best:
        SignalStatus | null =
          null;

      for (
        const signal of
          profile.signals
      ) {
        if (
          signal.key !== key
        ) {
          continue;
        }

        if (
          !best ||
          priority[
            signal.status
          ] >
            priority[best]
        ) {
          best =
            signal.status;
        }
      }

      if (
        best === "supported"
      ) {
        supported += 1;
      } else if (
        best === "suggested"
      ) {
        suggested += 1;
      } else if (
        best === "contradicted"
      ) {
        contradicted += 1;
      }
    }

    const observed =
      supported +
      suggested +
      contradicted;

    signals[key] = {
      supported,
      suggested,
      contradicted,
      unknown:
        places.length -
        observed,
      supportedPct:
        Number(
          (
            supported /
            places.length *
            100
          ).toFixed(1)
        ),
      observedPct:
        Number(
          (
            observed /
            places.length *
            100
          ).toFixed(1)
        ),
    };
  }

  let wastePlaces = 0;

  for (
    const profile of
      places
  ) {
    const match =
      (
        profile.selectionDrivers ||
        []
      ).some(
        driver =>
          wastePhrases.has(
            normalizeText(driver)
          )
      );

    if (match) {
      wastePlaces += 1;
    }
  }

  result[category] = {
    places:
      places.length,
    signals,
    candidates: {
      wastePackagingReduction: {
        places:
          wastePlaces,
        pct:
          Number(
            (
              wastePlaces /
              places.length *
              100
            ).toFixed(1)
          ),
      },
    },
  };
}

fs.writeFileSync(
  OUTPUT_PATH,
  JSON.stringify(
    {
      version:
        "scout-category-dna-v1",
      generatedAt:
        new Date()
          .toISOString(),
      totalPlaces:
        profilesFile
          .profiles.length,
      categories:
        result,
    },
    null,
    2
  ) + "\n"
);

console.log(
  "=== ADN PAR CATÉGORIE ==="
);

for (
  const [
    category,
    raw,
  ] of Object.entries(result)
) {
  const data =
    raw as any;

  console.log("");
  console.log(
    `${category.toUpperCase()} (${data.places})`
  );

  const ranked =
    Object.entries(
      data.signals
    )
      .map(
        ([key, stats]) => ({
          key,
          ...(stats as any),
        })
      )
      .filter(
        item =>
          item.observedPct > 0
      )
      .sort(
        (a, b) =>
          b.supportedPct -
            a.supportedPct ||
          b.observedPct -
            a.observedPct
      )
      .slice(0, 8);

  for (
    const item of ranked
  ) {
    console.log(
      `  ${item.key.padEnd(28)} supported=${String(item.supportedPct).padStart(5)}% observed=${String(item.observedPct).padStart(5)}%`
    );
  }

  console.log(
    `  ${"wastePackagingReduction".padEnd(28)} candidate=${String(data.candidates.wastePackagingReduction.pct).padStart(5)}% (${data.candidates.wastePackagingReduction.places})`
  );
}

console.log("");
console.log(
  "SORTIE :",
  OUTPUT_PATH
);
