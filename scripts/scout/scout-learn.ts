import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config({ path: ".env.local" });

const MODEL =
  process.env.SCOUT_MODEL?.trim() ||
  "gpt-5.4-nano";

const PLACES_PATH =
  "data/places.json";

const CRITERIA_PATH =
  "data/private/scout/criteria.v1.json";

const OUTPUT_PATH =
  "data/private/scout/catalogue-profiles.v1.json";

const SUMMARY_PATH =
  "data/private/scout/catalogue-patterns.v1.json";

const CACHE_PATH =
  "data/private/scout/catalogue-profiles.cache.v1.json";

const BATCH_SIZE = 20;

type Place = {
  id: string;
  name: string;
  city?: string;
  country?: string;
  category?: string;
  website?: string;
  miniText?: string;
  tags?: string[];
  translations?: {
    en?: {
      miniText?: string;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type SignalStatus =
  | "supported"
  | "suggested"
  | "contradicted";

type EvidenceBasis =
  | "generic_claim"
  | "geographic_origin"
  | "named_partner"
  | "distance_radius"
  | "direct_sale"
  | "supply_chain_statement"
  | "on_site_statement"
  | "ownership_statement"
  | "process_statement"
  | "mission_statement"
  | "other";

type EvidenceSubject =
  | "target_place"
  | "products"
  | "partners"
  | "vendors_creators"
  | "activity"
  | "unclear";

type ProfileSignal = {
  key: string;
  status: SignalStatus;
  evidence: string;
  field: string;
  evidenceQuote: string;
  concreteValue: string;
  basis: EvidenceBasis;
  subject: EvidenceSubject;
};

type PlaceProfile = {
  placeId: string;
  name: string;
  originalCategory: string;
  normalizedCategory: string;
  city: string;
  signals: ProfileSignal[];
  selectionDrivers: string[];
  cautions: string[];
};

type ScoutCacheEntry = {
  cacheKey: string;
  placeId: string;
  model: string;
  criteriaVersion: string;
  savedAt: string;
  profile: PlaceProfile;
};

type ScoutCacheFile = {
  version: "scout-cache-v1";
  updatedAt: string;
  entries: Record<
    string,
    ScoutCacheEntry
  >;
};

type Criteria = {
  version: string;
  principles: string[];
  signals: Record<
    string,
    {
      label: string;
      weight: number;
      definition: string;
    }
  >;
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * Normalisation virtuelle uniquement.
 * Elle ne modifie jamais places.json.
 */
function normalizeCategory(value: unknown) {
  const raw = normalizeText(value);

  if (
    raw === "restaurant"
  ) {
    return "Restaurant";
  }

  if (
    raw === "cafe" ||
    raw === "cafe / brunch"
  ) {
    return "Café";
  }

  if (
    raw === "epicerie" ||
    raw === "grocery"
  ) {
    return "Épicerie";
  }

  if (
    raw === "lieu alternatif" ||
    raw === "lieu de vie"
  ) {
    return "Lieu alternatif";
  }

  if (
    raw === "brasserie" ||
    raw === "bar" ||
    raw === "pub" ||
    raw.includes("brasserie / bar") ||
    raw.includes("brasserie bar") ||
    raw.includes("brasserie / bar / pub")
  ) {
    return "Brasserie / Bar";
  }

  if (
    raw === "artisanat" ||
    raw === "artisanat / createurs locaux"
  ) {
    return "Artisanat";
  }

  if (raw === "brunch") {
    return "Brunch";
  }

  if (raw === "boulangerie") {
    return "Boulangerie";
  }

  if (raw === "boutique") {
    return "Boutique";
  }

  if (raw === "atelier") {
    return "Atelier";
  }

  if (raw === "ferme") {
    return "Ferme";
  }

  if (raw === "librairie") {
    return "Librairie";
  }

  if (raw === "marche") {
    return "Marché";
  }

  if (raw === "mode") {
    return "Mode";
  }

  return String(value ?? "").trim() || "Inconnue";
}

function buildStructuredOutputSchema(
  criteria: Criteria
) {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "profiles",
    ],
    properties: {
      profiles: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "placeId",
            "name",
            "originalCategory",
            "normalizedCategory",
            "city",
            "signals",
            "selectionDrivers",
            "cautions",
          ],
          properties: {
            placeId: {
              type: "string",
            },
            name: {
              type: "string",
            },
            originalCategory: {
              type: "string",
            },
            normalizedCategory: {
              type: "string",
            },
            city: {
              type: "string",
            },
            signals: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: [
                  "key",
                  "status",
                  "evidence",
                  "field",
                  "evidenceQuote",
                  "concreteValue",
                  "basis",
                  "subject",
                ],
                properties: {
                  key: {
                    type: "string",
                    enum:
                      Object.keys(
                        criteria.signals
                      ),
                  },
                  status: {
                    type: "string",
                    enum: [
                      "supported",
                      "suggested",
                      "contradicted",
                    ],
                  },
                  evidence: {
                    type: "string",
                  },
                  field: {
                    type: "string",
                    enum: [
                      "miniText",
                      "tags",
                      "englishMiniText",
                    ],
                  },
                  evidenceQuote: {
                    type: "string",
                  },
                  concreteValue: {
                    type: "string",
                  },
                  basis: {
                    type: "string",
                    enum: [
                      "generic_claim",
                      "geographic_origin",
                      "named_partner",
                      "distance_radius",
                      "direct_sale",
                      "supply_chain_statement",
                      "on_site_statement",
                      "ownership_statement",
                      "process_statement",
                      "mission_statement",
                      "other",
                    ],
                  },
                  subject: {
                    type: "string",
                    enum: [
                      "target_place",
                      "products",
                      "partners",
                      "vendors_creators",
                      "activity",
                      "unclear",
                    ],
                  },
                },
              },
            },
            selectionDrivers: {
              type: "array",
              maxItems: 4,
              items: {
                type: "string",
              },
            },
            cautions: {
              type: "array",
              maxItems: 3,
              items: {
                type: "string",
              },
            },
          },
        },
      },
    },
  };
}

function cleanJsonOutput(value: string) {
  return value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseLimit() {
  const arg = process.argv.find(
    (value) =>
      value.startsWith("--limit=")
  );

  if (!arg) return null;

  const value = Number(
    arg.slice("--limit=".length)
  );

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(
      "--limit doit être un entier positif"
    );
  }

  return Math.floor(value);
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function stratifiedPlaces(
  places: Place[],
  perCategory = 2
) {
  const groups =
    new Map<string, Place[]>();

  for (const place of places) {
    const category =
      normalizeCategory(
        place.category
      );

    const group =
      groups.get(category) ?? [];

    if (
      group.length <
      perCategory
    ) {
      group.push(place);
      groups.set(
        category,
        group
      );
    }
  }

  return [
    ...groups.entries(),
  ]
    .sort(
      ([a], [b]) =>
        a.localeCompare(
          b,
          "fr"
        )
    )
    .flatMap(
      ([, group]) =>
        group
    );
}

function chunk<T>(
  values: T[],
  size: number
) {
  const result: T[][] = [];

  for (
    let i = 0;
    i < values.length;
    i += size
  ) {
    result.push(
      values.slice(i, i + size)
    );
  }

  return result;
}

function placeForAnalysis(place: Place) {
  return {
    id: place.id,
    name: place.name,
    city: place.city ?? "",
    country: place.country ?? "",
    originalCategory:
      place.category ?? "",
    normalizedCategory:
      normalizeCategory(place.category),
    miniText:
      place.miniText ?? "",
    tags: Array.isArray(place.tags)
      ? place.tags
      : [],
    englishMiniText:
      place.translations?.en?.miniText ??
      "",
  };
}

function validateProfile(
  input: unknown,
  knownPlaceIds: Set<string>,
  signalKeys: Set<string>
): PlaceProfile {
  if (
    !input ||
    typeof input !== "object"
  ) {
    throw new Error(
      "Profil IA invalide : objet attendu"
    );
  }

  const row =
    input as Record<string, unknown>;

  const placeId =
    String(row.placeId ?? "").trim();

  if (!knownPlaceIds.has(placeId)) {
    throw new Error(
      `placeId inattendu : ${placeId}`
    );
  }

  const rawSignals =
    Array.isArray(row.signals)
      ? row.signals
      : [];

  const signals: ProfileSignal[] = [];

  for (const rawSignal of rawSignals) {
    if (
      !rawSignal ||
      typeof rawSignal !== "object"
    ) {
      continue;
    }

    const signal =
      rawSignal as Record<
        string,
        unknown
      >;

    const key =
      String(signal.key ?? "").trim();

    const status =
      String(
        signal.status ?? ""
      ).trim() as SignalStatus;

    if (!signalKeys.has(key)) {
      continue;
    }

    if (
      status !== "supported" &&
      status !== "suggested" &&
      status !== "contradicted"
    ) {
      continue;
    }

    const evidence =
      String(
        signal.evidence ?? ""
      ).trim();

    const field =
      String(
        signal.field ?? ""
      ).trim();

    const allowedBases =
      new Set<EvidenceBasis>([
        "generic_claim",
        "geographic_origin",
        "named_partner",
        "distance_radius",
        "direct_sale",
        "supply_chain_statement",
        "on_site_statement",
        "ownership_statement",
        "process_statement",
        "mission_statement",
        "other",
      ]);

    const allowedSubjects =
      new Set<EvidenceSubject>([
        "target_place",
        "products",
        "partners",
        "vendors_creators",
        "activity",
        "unclear",
      ]);

    const evidenceQuote =
      String(
        signal.evidenceQuote ?? ""
      ).trim();

    const concreteValue =
      String(
        signal.concreteValue ?? ""
      ).trim();

    const rawBasis =
      String(
        signal.basis ?? ""
      ).trim() as EvidenceBasis;

    const rawSubject =
      String(
        signal.subject ?? ""
      ).trim() as EvidenceSubject;

    const basis =
      allowedBases.has(rawBasis)
        ? rawBasis
        : "other";

    const subject =
      allowedSubjects.has(
        rawSubject
      )
        ? rawSubject
        : "unclear";

    if (!evidence) {
      continue;
    }

    signals.push({
      key,
      status,
      evidence,
      field:
        field || "unknown",
      evidenceQuote,
      concreteValue,
      basis,
      subject,
    });
  }

  return {
    placeId,
    name:
      String(row.name ?? "").trim(),
    originalCategory:
      String(
        row.originalCategory ?? ""
      ).trim(),
    normalizedCategory:
      String(
        row.normalizedCategory ?? ""
      ).trim(),
    city:
      String(row.city ?? "").trim(),
    signals,
    selectionDrivers:
      Array.isArray(
        row.selectionDrivers
      )
        ? row.selectionDrivers
            .map((value) =>
              String(value).trim()
            )
            .filter(Boolean)
            .slice(0, 4)
        : [],
    cautions:
      Array.isArray(row.cautions)
        ? row.cautions
            .map((value) =>
              String(value).trim()
            )
            .filter(Boolean)
            .slice(0, 3)
        : [],
  };
}

function normalizedIncludes(
  haystack: string,
  needle: string
) {
  const h =
    normalizeText(haystack);

  const n =
    normalizeText(needle);

  if (!n) return false;

  return h.includes(n);
}

function sourceTextForSignal(
  place: ReturnType<
    typeof placeForAnalysis
  >,
  field: string
) {
  if (field === "miniText") {
    return place.miniText;
  }

  if (field === "englishMiniText") {
    return place.englishMiniText;
  }

  if (field === "tags") {
    return place.tags.join(" | ");
  }

  return "";
}

function quoteHasAny(
  quote: string,
  tokens: string[]
) {
  const value =
    normalizeText(quote);

  return tokens.some(
    (token) =>
      value.includes(
        normalizeText(token)
      )
  );
}

function hasExplicitOnSiteEvidence(
  quote: string
) {
  return quoteHasAny(
    quote,
    [
      "sur place",
      "sur le site",
      "dans cet atelier",
      "dans son atelier",
      "dans notre atelier",
      "dans l'atelier",
      "dans cette ferme",
      "sur l'exploitation",
      "dans cet établissement",
      "brassé ici",
      "brassee ici",
      "brewed on site",
      "brewed onsite",
      "made on site",
      "made onsite",
      "prepared on site",
      "prepared onsite",
      "in our workshop",
      "in its workshop",
    ]
  );
}

function hasExplicitRepairReuseEvidence(
  quote: string
) {
  return quoteHasAny(
    quote,
    [
      "seconde main",
      "d'occasion",
      "occasion",
      "réemploi",
      "reemploi",
      "réutilisé",
      "reutilise",
      "revalorisé",
      "revalorise",
      "recyclé",
      "recycle",
      "recyclage",
      "seconde vie",
      "réparation",
      "reparation",
      "réparer",
      "reparer",
      "retouche",
      "upcycl",
      "second hand",
      "second-hand",
      "reuse",
      "reused",
      "repair",
      "recycled",
      "upcycled",
    ]
  );
}

function hasExplicitFarmRelationship(
  quote: string
) {
  return quoteHasAny(
    quote,
    [
      "fermes partenaires",
      "ferme partenaire",
      "travaille avec des fermes",
      "travaille directement avec des fermes",
      "partner farms",
      "partner farm",
      "works with farms",
      "works directly with farms",
      "farm partners",
    ]
  );
}

function validateSignalSource(
  signal: ProfileSignal,
  place: ReturnType<
    typeof placeForAnalysis
  >
): ProfileSignal | null {
  const source =
    sourceTextForSignal(
      place,
      signal.field
    );

  /*
   * La citation doit réellement exister dans
   * le champ indiqué.
   */
  if (
    !signal.evidenceQuote ||
    !normalizedIncludes(
      source,
      signal.evidenceQuote
    )
  ) {
    return null;
  }

  let status =
    signal.status;

  /*
   * geographic_origin exige désormais une
   * valeur géographique concrète présente dans
   * la citation elle-même.
   *
   * "local", "locaux", "locally", etc. seuls
   * ne sont jamais une origine géographique.
   */
  if (
    signal.key ===
      "localSourcing" &&
    status === "supported" &&
    signal.basis ===
      "geographic_origin"
  ) {
    const value =
      normalizeText(
        signal.concreteValue
      );

    const generic =
      new Set([
        "",
        "local",
        "locale",
        "locales",
        "locaux",
        "locally",
        "localement",
        "regional",
        "regionale",
        "regionaux",
        "regionalement",
      ]);

    if (
      generic.has(value) ||
      !normalizedIncludes(
        signal.evidenceQuote,
        signal.concreteValue
      )
    ) {
      status = "suggested";
    }
  }

  let basis =
    signal.basis;

  /*
   * Le modèle n'a pas le droit de transformer
   * "fabriqué à la main", "fait maison", etc.
   * en preuve spatiale.
   *
   * Pour onSiteProduction=SUPPORTED, la citation
   * doit elle-même contenir une indication du lieu
   * de production.
   */
  if (
    signal.key ===
      "onSiteProduction" &&
    status === "supported" &&
    !hasExplicitOnSiteEvidence(
      signal.evidenceQuote
    )
  ) {
    status = "suggested";
    basis = "process_statement";
  }

  /*
   * Zéro déchet, durable, réduction du gaspillage,
   * etc. restent des caractéristiques émergentes,
   * mais ne constituent pas du réemploi /
   * réparation / seconde main.
   */
  if (
    signal.key ===
      "repairReuseSecondHand" &&
    !hasExplicitRepairReuseEvidence(
      signal.evidenceQuote
    )
  ) {
    return null;
  }

  /*
   * Notre définition actuelle de farm-to-table
   * accepte une relation explicitement documentée
   * avec des fermes partenaires.
   *
   * Si cette relation figure littéralement dans
   * la citation, le modèle n'a pas à rester
   * arbitrairement en SUGGESTED.
   */
  if (
    signal.key ===
      "farmToTable" &&
    (
      signal.basis ===
        "supply_chain_statement" ||
      signal.basis ===
        "named_partner"
    ) &&
    hasExplicitFarmRelationship(
      signal.evidenceQuote
    )
  ) {
    status = "supported";
  }

  return {
    ...signal,
    status,
    basis,
  };
}

/*
 * Le modèle extrait les signaux.
 * Le code décide ensuite si le niveau de preuve est
 * suffisant pour conserver "supported".
 *
 * Ces règles sont volontairement explicites afin que
 * l'agent ne puisse pas modifier silencieusement la
 * définition d'un lieu Indie Map.
 */
function enforceSignalGuardrails(
  profile: PlaceProfile,
  place: ReturnType<
    typeof placeForAnalysis
  >
): PlaceProfile {
  const signals =
    profile.signals.flatMap(
      (rawSignal) => {
        const checked =
          validateSignalSource(
            rawSignal,
            place
          );

        if (!checked) {
          return [];
        }

        const signal =
          checked;

        let status =
          signal.status;

        /*
         * "local" seul est une affirmation générique.
         * Pour être supported, on exige une provenance,
         * une distance, un partenaire ou un mécanisme
         * concret comparable.
         */
        if (
          signal.key ===
            "localSourcing" &&
          status === "supported" &&
          ![
            "geographic_origin",
            "named_partner",
            "distance_radius",
            "direct_sale",
          ].includes(
            signal.basis
          )
        ) {
          status = "suggested";
        }

        /*
         * "independent" concerne exclusivement
         * l'établissement lui-même.
         *
         * Des artisans, vendeurs ou créateurs
         * indépendants ne prouvent rien sur la
         * propriété du lieu.
         */
        if (
          signal.key ===
            "independent"
        ) {
          if (
            signal.subject !==
              "target_place" ||
            signal.basis !==
              "ownership_statement"
          ) {
            return [];
          }
        }

        /*
         * Fabriqué à la main / fait maison / artisanal
         * n'est pas automatiquement synonyme de
         * production physiquement réalisée sur place.
         */
        if (
          signal.key ===
            "onSiteProduction" &&
          status === "supported" &&
          signal.basis !==
            "on_site_statement"
        ) {
          status = "suggested";
        }

        /*
         * Zéro déchet, réduction du gaspillage ou
         * durabilité ne signifient pas automatiquement
         * réparation, réemploi ou seconde main.
         */
        if (
          signal.key ===
            "repairReuseSecondHand" &&
          (
            signal.basis ===
              "generic_claim" ||
            signal.basis ===
              "mission_statement"
          )
        ) {
          return [];
        }

        /*
         * Une relation directe avec un producteur doit
         * être réellement décrite.
         */
        if (
          signal.key ===
            "directProducerRelationship" &&
          status === "supported" &&
          ![
            "named_partner",
            "direct_sale",
            "supply_chain_statement",
          ].includes(
            signal.basis
          )
        ) {
          status = "suggested";
        }

        /*
         * Circuit court : pas de déduction depuis
         * "local". Il faut une vente directe ou une
         * description explicite du circuit.
         */
        if (
          signal.key ===
            "shortSupplyChain" &&
          status === "supported" &&
          ![
            "direct_sale",
            "supply_chain_statement",
          ].includes(
            signal.basis
          )
        ) {
          status = "suggested";
        }

        /*
         * Farm-to-table nécessite une relation
         * d'approvisionnement concrète.
         */
        if (
          signal.key ===
            "farmToTable" &&
          status === "supported" &&
          ![
            "named_partner",
            "supply_chain_statement",
          ].includes(
            signal.basis
          )
        ) {
          status = "suggested";
        }

        return [
          {
            ...signal,
            status,
          },
        ];
      }
    );

  return {
    ...profile,
    signals,
  };
}

function sha256Json(
  value: unknown
) {
  return createHash("sha256")
    .update(
      JSON.stringify(value),
      "utf8"
    )
    .digest("hex");
}

function criteriaFingerprint(
  criteria: Criteria
) {
  return sha256Json(criteria);
}

function placeCacheKey(
  place: Place,
  criteria: Criteria
) {
  return sha256Json({
    version:
      "scout-learn-cache-key-v1",
    model: MODEL,
    criteriaVersion:
      criteria.version,
    criteriaHash:
      criteriaFingerprint(
        criteria
      ),
    place:
      placeForAnalysis(place),
  });
}

function emptyCache(): ScoutCacheFile {
  return {
    version:
      "scout-cache-v1",
    updatedAt:
      new Date().toISOString(),
    entries: {},
  };
}

function loadCache(): ScoutCacheFile {
  if (
    !fs.existsSync(CACHE_PATH)
  ) {
    return emptyCache();
  }

  try {
    const parsed =
      JSON.parse(
        fs.readFileSync(
          CACHE_PATH,
          "utf8"
        )
      ) as ScoutCacheFile;

    if (
      parsed?.version !==
        "scout-cache-v1" ||
      !parsed.entries ||
      typeof parsed.entries !==
        "object"
    ) {
      return emptyCache();
    }

    return parsed;
  } catch {
    return emptyCache();
  }
}

function writeJsonAtomic(
  filePath: string,
  value: unknown
) {
  fs.mkdirSync(
    path.dirname(filePath),
    {
      recursive: true,
    }
  );

  const tmpPath =
    `${filePath}.tmp-${process.pid}`;

  fs.writeFileSync(
    tmpPath,
    JSON.stringify(
      value,
      null,
      2
    ) + "\n"
  );

  fs.renameSync(
    tmpPath,
    filePath
  );
}

function saveCache(
  cache: ScoutCacheFile
) {
  cache.updatedAt =
    new Date().toISOString();

  writeJsonAtomic(
    CACHE_PATH,
    cache
  );
}

function orderedProfilesForPlaces(
  places: Place[],
  profilesById:
    Map<string, PlaceProfile>
) {
  return places.flatMap(
    (place) => {
      const profile =
        profilesById.get(
          place.id
        );

      return profile
        ? [profile]
        : [];
    }
  );
}

function writeProfilesSnapshot(
  profiles: PlaceProfile[],
  totalCataloguePlaces: number,
  criteria: Criteria,
  complete: boolean
) {
  writeJsonAtomic(
    OUTPUT_PATH,
    {
      version:
        "scout-catalogue-profiles-v1",
      criteriaVersion:
        criteria.version,
      model: MODEL,
      generatedAt:
        new Date().toISOString(),
      totalCataloguePlaces,
      analyzedPlaces:
        profiles.length,
      complete,
      profiles,
    }
  );
}

function buildSummary(
  profiles: PlaceProfile[],
  criteria: Criteria
) {
  const signalSummary: Record<
    string,
    {
      supported: number;
      suggested: number;
      contradicted: number;
      unknown: number;
    }
  > = {};

  for (
    const key of Object.keys(
      criteria.signals
    )
  ) {
    signalSummary[key] = {
      supported: 0,
      suggested: 0,
      contradicted: 0,
      unknown: 0,
    };
  }

  const categoryCounts: Record<
    string,
    number
  > = {};

  for (const profile of profiles) {
    categoryCounts[
      profile.normalizedCategory
    ] =
      (
        categoryCounts[
          profile.normalizedCategory
        ] ?? 0
      ) + 1;

    /*
     * Un signal ne doit être compté qu'une seule fois
     * par lieu, même si le modèle a extrait plusieurs
     * preuves pour la même caractéristique.
     *
     * Priorité statistique :
     * supported > suggested > contradicted
     *
     * Cela signifie : dès qu'au moins une preuve
     * valide permet de supporter le signal pour ce
     * lieu, le lieu est compté une seule fois comme
     * supported.
     */
    const statusBySignal =
      new Map<
        string,
        SignalStatus
      >();

    const statusPriority:
      Record<SignalStatus, number> = {
        contradicted: 1,
        suggested: 2,
        supported: 3,
      };

    for (
      const signal of profile.signals
    ) {
      if (
        !signalSummary[signal.key]
      ) {
        continue;
      }

      const current =
        statusBySignal.get(
          signal.key
        );

      if (
        !current ||
        statusPriority[
          signal.status
        ] >
          statusPriority[
            current
          ]
      ) {
        statusBySignal.set(
          signal.key,
          signal.status
        );
      }
    }

    for (
      const key of Object.keys(
        criteria.signals
      )
    ) {
      const status =
        statusBySignal.get(key);

      if (!status) {
        signalSummary[
          key
        ].unknown += 1;
        continue;
      }

      signalSummary[key][
        status
      ] += 1;
    }
  }

  return {
    version:
      "scout-catalogue-patterns-v1",
    criteriaVersion:
      criteria.version,
    generatedAt:
      new Date().toISOString(),
    analyzedPlaces:
      profiles.length,
    categoryCounts,
    signals: signalSummary,
    warning:
      "Ces chiffres décrivent uniquement ce qui est explicitement présent ou suggéré dans les données internes Indie Map. Ils ne prouvent pas que les caractéristiques absentes ne s'appliquent pas aux lieux.",
  };
}

async function main() {
  if (
    !process.env.OPENAI_API_KEY
  ) {
    throw new Error(
      "OPENAI_API_KEY absente"
    );
  }

  const places =
    JSON.parse(
      fs.readFileSync(
        PLACES_PATH,
        "utf8"
      )
    ) as Place[];

  const criteria =
    JSON.parse(
      fs.readFileSync(
        CRITERIA_PATH,
        "utf8"
      )
    ) as Criteria;

  const limit =
    parseLimit();

  const stratified =
    hasFlag("--stratified");

  const resume =
    hasFlag("--resume");

  let selectedPlaces =
    stratified
      ? stratifiedPlaces(
          places,
          2
        )
      : places;

  if (limit) {
    selectedPlaces =
      selectedPlaces.slice(
        0,
        limit
      );
  }

  console.log(
    "=== INDIE MAP SCOUT / LEARN V1 ==="
  );
  console.log(
    "CATALOGUE TOTAL :",
    places.length
  );
  console.log(
    "LIEUX À ANALYSER :",
    selectedPlaces.length
  );
  console.log(
    "MODEL :",
    MODEL
  );

  console.log(
    "MODE :",
    resume
      ? "RESUME"
      : "NOUVELLE ANALYSE"
  );

  console.log("");

  const openai =
    new OpenAI({
      apiKey:
        process.env.OPENAI_API_KEY,
    });

  const cache =
    resume
      ? loadCache()
      : emptyCache();

  const profilesById =
    new Map<
      string,
      PlaceProfile
    >();

  let cacheHits = 0;

  const pendingPlaces:
    Place[] = [];

  for (
    const place of selectedPlaces
  ) {
    const expectedKey =
      placeCacheKey(
        place,
        criteria
      );

    const cached =
      cache.entries[
        place.id
      ];

    if (
      resume &&
      cached &&
      cached.cacheKey ===
        expectedKey
    ) {
      profilesById.set(
        place.id,
        cached.profile
      );

      cacheHits += 1;
      continue;
    }

    pendingPlaces.push(
      place
    );
  }

  const batches =
    chunk(
      pendingPlaces,
      BATCH_SIZE
    );

  console.log(
    "CACHE HITS :",
    cacheHits
  );

  console.log(
    "RESTE À ANALYSER :",
    pendingPlaces.length
  );

  console.log(
    "BATCHES API :",
    batches.length
  );

  console.log("");

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const signalDefinitions =
    Object.entries(
      criteria.signals
    ).map(
      ([key, value]) => ({
        key,
        label: value.label,
        definition:
          value.definition,
      })
    );

  for (
    let index = 0;
    index < batches.length;
    index += 1
  ) {
    const batch =
      batches[index];

    console.log(
      `BATCH ${index + 1}/${batches.length} — ${batch.length} lieux`
    );

    const payload =
      batch.map(
        placeForAnalysis
      );

    const response =
      await openai.responses.create({
        model: MODEL,

        reasoning: {
          effort: "low",
        },

        store: false,

        text: {
          format: {
            type: "json_schema",
            name:
              "indie_map_scout_profiles",
            strict: true,
            schema:
              buildStructuredOutputSchema(
                criteria
              ),
          },
        },

        input: `
Tu analyses le catalogue existant d'Indie Map afin de décrire les caractéristiques réellement visibles dans ses données internes.

IMPORTANT :
Tu n'es PAS en train de décider si ces lieux auraient dû être acceptés.
Ils sont déjà dans Indie Map.

Ton travail consiste uniquement à extraire les signaux explicitement présents ou raisonnablement suggérés PAR LES DONNÉES FOURNIES.

RÈGLES ABSOLUES :

- N'utilise aucune connaissance externe.
- N'utilise aucune connaissance préalable sur les établissements.
- Ne consulte pas le web.
- Ne déduis pas "indépendant" simplement parce qu'un lieu a un nom artisanal ou local.
- Ne déduis pas "local" simplement parce que le lieu est petit.
- Une simple affirmation "local", "produits locaux", "nous soutenons les producteurs locaux" ou équivalent, sans provenance concrète, producteur identifié ou détail d'approvisionnement, ne peut PAS donner localSourcing=supported. Elle peut au maximum donner localSourcing=suggested.
- localSourcing=supported nécessite un élément concret : provenance géographique, producteurs identifiés, ferme ou artisan nommé, relation d'approvisionnement décrite ou autre information précise comparable.
- Ne déduis pas "farm-to-table" d'une simple cuisine de saison.
- Ne déduis jamais shortSupplyChain simplement de localSourcing.
- Ne déduis jamais directProducerRelationship simplement parce que le texte dit soutenir des producteurs.
- "bio", "responsable", "engagé", "durable", "local" ou "artisanal" peuvent être des signaux, mais ne prouvent pas automatiquement les autres critères.
- L'absence d'information signifie UNKNOWN : dans ce cas, n'ajoute simplement aucun signal.
- "supported" = le texte fourni donne une indication explicite ET suffisamment concrète.
- "suggested" = le texte fourni oriente vers le signal mais reste générique ou insuffisant pour l'affirmer fermement.
- "contradicted" = les données disent explicitement l'inverse.
- Chaque signal doit avoir une courte evidence provenant des champs fournis.

Pour chaque signal :

evidenceQuote :
- copie une COURTE CITATION EXACTE provenant du champ indiqué ;
- elle doit être présente textuellement dans miniText, tags ou englishMiniText ;
- ne paraphrase jamais evidenceQuote ;
- n'utilise jamais le nom de la ville ou du pays fourni séparément comme preuve si cette information n'apparaît pas dans le texte cité.

concreteValue :
- indique la valeur concrète qui justifie le basis lorsqu'elle existe ;
- pour geographic_origin : nom du territoire, ville, région, pays ou adjectif géographique explicitement présent dans evidenceQuote ;
- pour named_partner : nom exact du partenaire/producteur explicitement présent ;
- pour distance_radius : distance/rayon exact explicitement présent ;
- sinon utilise une chaîne vide "" ;
- "local", "locaux", "locale", "locally", "régional" et équivalents génériques ne sont JAMAIS des concreteValue géographiques suffisantes.

basis :
- generic_claim = slogan ou affirmation générale sans élément concret
- geographic_origin = provenance géographique concrète
- named_partner = ferme, producteur, artisan ou partenaire identifié
- distance_radius = distance ou rayon géographique concret
- direct_sale = vente directe producteur/fabricant vers public
- supply_chain_statement = relation ou circuit d'approvisionnement explicitement décrit
- on_site_statement = texte indiquant explicitement que la production se fait dans ce lieu / cet atelier / sur place
- ownership_statement = information explicite sur la propriété ou l'indépendance de l'établissement lui-même
- process_statement = procédé de fabrication ou savoir-faire décrit
- mission_statement = mission sociale, associative, environnementale ou communautaire décrite
- other = autre élément

subject :
- target_place = l'affirmation concerne l'établissement lui-même
- products = elle concerne les produits
- partners = elle concerne fournisseurs/producteurs/partenaires
- vendors_creators = elle concerne des vendeurs, artisans ou créateurs accueillis par le lieu
- activity = elle concerne une activité ou un procédé
- unclear = sujet impossible à déterminer

ATTENTION :
- independent concerne UNIQUEMENT l'établissement lui-même. Des "créateurs indépendants", "artisans indépendants" ou "vendeurs indépendants" ne permettent jamais d'attribuer independent au lieu.
- Une production artisanale, "faite maison" ou "fabriquée à la main" ne permet pas à elle seule d'affirmer onSiteProduction. Il faut une indication que la production a lieu dans cet établissement, cet atelier, cette ferme ou "sur place".
- Ne crée aucun signal dont la clé n'existe pas dans SIGNALS AUTORISÉS.
- selectionDrivers contient au maximum 4 caractéristiques réellement visibles dans les données.
- selectionDrivers peut faire apparaître une caractéristique intéressante qui n'existe pas encore dans SIGNALS AUTORISÉS (par exemple zéro déchet). Cela sert uniquement à découvrir de futurs critères et ne constitue jamais une règle Indie Map ni un signal validé.
- cautions contient au maximum 3 éléments.
- Ne modifie jamais la catégorie normalisée fournie.

SIGNALS AUTORISÉS :
${JSON.stringify(
  signalDefinitions,
  null,
  2
)}

LIEUX À ANALYSER :
${JSON.stringify(
  payload,
  null,
  2
)}

Réponds UNIQUEMENT avec du JSON valide ayant exactement cette forme générale :

{
  "profiles": [
    {
      "placeId": "id exact",
      "name": "nom exact",
      "originalCategory": "catégorie originale",
      "normalizedCategory": "catégorie normalisée fournie",
      "city": "ville",
      "signals": [
        {
          "key": "localSourcing",
          "status": "supported",
          "evidence": "courte preuve tirée des données",
          "field": "miniText",
          "evidenceQuote": "produits du Québec",
          "concreteValue": "Québec",
          "basis": "geographic_origin",
          "subject": "products"
        }
      ],
      "selectionDrivers": [
        "élément réellement visible dans les données"
      ],
      "cautions": [
        "information ambiguë ou insuffisante"
      ]
    }
  ]
}

Tu dois produire exactement un profil pour chaque lieu fourni.
        `.trim(),
      });

    const usage =
      response.usage as any;

    totalInputTokens +=
      Number(
        usage?.input_tokens ?? 0
      );

    totalOutputTokens +=
      Number(
        usage?.output_tokens ?? 0
      );

    const parsed =
      JSON.parse(
        cleanJsonOutput(
          response.output_text
        )
      ) as {
        profiles?: unknown[];
      };

    const knownIds =
      new Set(
        batch.map(
          (place) => place.id
        )
      );

    const signalKeys =
      new Set(
        Object.keys(
          criteria.signals
        )
      );

    const sourceById =
      new Map(
        batch.map(
          (place) => [
            place.id,
            placeForAnalysis(place),
          ]
        )
      );

    const batchProfiles =
      (
        parsed.profiles ?? []
      ).map((profile) => {
        const validated =
          validateProfile(
            profile,
            knownIds,
            signalKeys
          );

        const source =
          sourceById.get(
            validated.placeId
          );

        if (!source) {
          throw new Error(
            `Source introuvable pour ${validated.placeId}`
          );
        }

        return enforceSignalGuardrails(
          validated,
          source
        );
      });

    if (
      batchProfiles.length !==
      batch.length
    ) {
      throw new Error(
        `Batch ${index + 1}: ${batchProfiles.length} profils reçus pour ${batch.length} lieux`
      );
    }

    const returnedIds =
      new Set(
        batchProfiles.map(
          (profile) =>
            profile.placeId
        )
      );

    for (const place of batch) {
      if (
        !returnedIds.has(place.id)
      ) {
        throw new Error(
          `Batch ${index + 1}: profil manquant pour ${place.name} (${place.id})`
        );
      }
    }

    for (
      const profile of batchProfiles
    ) {
      profilesById.set(
        profile.placeId,
        profile
      );

      const sourcePlace =
        batch.find(
          (place) =>
            place.id ===
            profile.placeId
        );

      if (!sourcePlace) {
        throw new Error(
          `Lieu source introuvable pour le cache : ${profile.placeId}`
        );
      }

      cache.entries[
        profile.placeId
      ] = {
        cacheKey:
          placeCacheKey(
            sourcePlace,
            criteria
          ),
        placeId:
          profile.placeId,
        model: MODEL,
        criteriaVersion:
          criteria.version,
        savedAt:
          new Date()
            .toISOString(),
        profile,
      };
    }

    /*
     * Sauvegarde immédiatement après chaque batch.
     *
     * Si le processus plante au batch suivant,
     * ce batch-ci ne sera jamais recalculé lors
     * d'un lancement avec --resume.
     */
    saveCache(cache);

    const currentProfiles =
      orderedProfilesForPlaces(
        selectedPlaces,
        profilesById
      );

    writeProfilesSnapshot(
      currentProfiles,
      places.length,
      criteria,
      currentProfiles.length ===
        selectedPlaces.length
    );

    console.log(
      "  OK :",
      batchProfiles.length,
      "profils"
    );

    console.log(
      "  SAUVEGARDÉS :",
      currentProfiles.length,
      "/",
      selectedPlaces.length
    );
  }

  const profiles =
    orderedProfilesForPlaces(
      selectedPlaces,
      profilesById
    );

  if (
    profiles.length !==
    selectedPlaces.length
  ) {
    throw new Error(
      `Analyse incomplète : ${profiles.length}/${selectedPlaces.length} profils disponibles`
    );
  }

  const summary =
    buildSummary(
      profiles,
      criteria
    );

  writeProfilesSnapshot(
    profiles,
    places.length,
    criteria,
    true
  );

  writeJsonAtomic(
    SUMMARY_PATH,
    summary
  );

  /*
   * On sauvegarde également une dernière fois
   * le cache afin que son timestamp reflète
   * la fin du run.
   */
  saveCache(cache);

  console.log("");
  console.log(
    "=== TERMINÉ ==="
  );

  console.log(
    "PROFILS :",
    OUTPUT_PATH
  );

  console.log(
    "PATTERNS :",
    SUMMARY_PATH
  );

  console.log(
    "INPUT TOKENS :",
    totalInputTokens
  );

  console.log(
    "OUTPUT TOKENS :",
    totalOutputTokens
  );

  console.log(
    "CACHE HITS :",
    cacheHits
  );

  console.log(
    "CACHE :",
    CACHE_PATH
  );
}

main().catch((error) => {
  console.error("");
  console.error(
    "SCOUT LEARN FAILED"
  );
  console.error(error);
  process.exit(1);
});
