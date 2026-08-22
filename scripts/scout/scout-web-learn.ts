import fs from "node:fs";
import path from "node:path";
import {
  createHash,
} from "node:crypto";
import dotenv from "dotenv";
import OpenAI from "openai";
import {
  collectOfficialPagesForScout,
  type OfficialVerifierUsage,
  type ScoutOfficialPage,
} from "../../src/lib/ai/officialSiteVerifier";
import {
  saveOfficialPlaceContact,
} from "../../src/lib/privatePlaceContacts";

dotenv.config({
  path: ".env.local",
});

const VERSION =
  "scout-catalogue-web-fusion-by-site-v2";

const CACHE_VERSION =
  "scout-catalogue-web-fusion-by-site-cache-v1";

const MODEL =
  process.env.SCOUT_WEB_MODEL?.trim() ||
  process.env.SCOUT_MODEL?.trim() ||
  "gpt-5.4-nano";

const EMBEDDING_MODEL =
  process.env.SCOUT_WEB_EMBEDDING_MODEL
    ?.trim() ||
  "text-embedding-3-small";

const MAX_SELECTED_PAGES =
  Math.max(
    1,
    Math.min(
      12,
      Number(
        process.env
          .SCOUT_WEB_MAX_PAGES ||
        "8"
      )
    )
  );

const PLACES_PATH =
  "data/places.json";

const INTERNAL_PROFILES_PATH =
  "data/private/scout/catalogue-profiles.v1.json";

const CACHE_PATH =
  "data/private/scout/catalogue-web-fusion-by-site.cache.v1.json";

const OUTPUT_PATH =
  "data/private/scout/catalogue-web-fusion-by-site.v1.json";

type Place = {
  id: string;
  name: string;
  city?: string;
  country?: string;
  address?: string;
  category?: string;
  website?: string;
  [key: string]: unknown;
};

type InternalProfile = {
  placeId: string;
  name: string;
  originalCategory: string;
  normalizedCategory: string;
  city: string;
  signals: unknown[];
  selectionDrivers: string[];
  cautions: string[];
};

type InternalProfilesFile = {
  profiles: InternalProfile[];
};

type FindingScope =
  | "target_place"
  | "brand_general"
  | "other_branch"
  | "unclear";

type FindingRelation =
  | "corroborates"
  | "extends"
  | "contradicts"
  | "new";

type ModelFinding = {
  concept: string;
  statementFr: string;
  evidenceQuote: string;
  sourceUrl: string;
  scope: FindingScope;
  relation: FindingRelation;
  relatedInternalDriver: string;
};

type ModelOutput = {
  summaryFr: string;
  findings: ModelFinding[];
  cautions: string[];
};

type OfficialFinding =
  ModelFinding & {
    sourceContentHash: string;
  };

type CombinedSource = {
  sourceType:
    | "indiemap_internal"
    | "official_site";
  evidenceText: string;
  sourceUrl?: string;
  sourceContentHash?: string;
  scope?: FindingScope;
};

type CombinedDriver = {
  label: string;
  status:
    | "internal_only"
    | "corroborated"
    | "official_only"
    | "conflict";
  relatedInternalDriver?: string;
  sources: CombinedSource[];
};

type PageSummary = {
  url: string;
  title: string;
  contentHash: string;
  textLength: number;
  emails?: string[];
};

type WebFusionProfile = {
  placeId: string;
  name: string;
  city: string;
  country: string;
  category: string;
  website: string;
  model: string;
  embeddingModel: string;
  internalProfile: InternalProfile;
  discoveredUrlCount: number;
  selectedUrls: string[];
  officialPages: PageSummary[];
  officialFindings: OfficialFinding[];
  combinedDrivers: CombinedDriver[];
  summaryFr: string;
  cautions: string[];
  invalidEvidenceCount: number;
  verifiedAt: string;
  officialSiteGroupKey?: string;
  officialSiteGroupPlaceIds?: string[];
  auditWebsite?: string;
  auditUsageOwner?: boolean;
  usage: OfficialVerifierUsage;
};

type WebsiteGroup = {
  key: string;
  domain: string;
  auditWebsite: string;
  rootWebsite: string;
  multiTenantProfile: boolean;
  places: Place[];
};

type CacheEntry = {
  cacheKey: string;
  placeId: string;
  status:
    | "success"
    | "error";
  savedAt: string;
  profile?: WebFusionProfile;
  error?: string;
  lastAttemptError?: string;
};

type CacheFile = {
  version:
    "scout-catalogue-web-fusion-by-site-cache-v1";
  updatedAt: string;
  entries: Record<
    string,
    CacheEntry
  >;
};

function sha256(
  value: string
) {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function normalizeText(
  value: unknown
) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalUrl(
  value: unknown
) {
  try {
    const url =
      new URL(
        String(value ?? "")
      );

    url.hash = "";

    return url.toString();
  } catch {
    return "";
  }
}

function cleanJsonOutput(
  value: string
) {
  return String(value || "")
    .replace(
      /^```(?:json)?\s*/i,
      ""
    )
    .replace(
      /\s*```$/,
      ""
    )
    .trim();
}

function hasFlag(
  name: string
) {
  return process.argv
    .slice(2)
    .includes(name);
}

function flagValue(
  name: string
) {
  const prefix =
    `${name}=`;

  const argument =
    process.argv
      .slice(2)
      .find(value =>
        value.startsWith(prefix)
      );

  return argument
    ? argument.slice(
        prefix.length
      ).trim()
    : "";
}

function positiveIntegerFlag(
  name: string
) {
  const raw =
    flagValue(name);

  if (!raw) {
    return undefined;
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

function emptyUsage():
  OfficialVerifierUsage {
  return {
    httpRequests: 0,
    embeddingTokens: 0,
    llmInputTokens: 0,
    llmOutputTokens: 0,
    ramCacheHits: 0,
    persistentCacheHits: 0,
    persistentCacheMisses: 0,
    persistentCacheWrites: 0,
    verifiedFactMemoryHits: 0,
    verifiedFactMemoryMisses: 0,
    verifiedFactWrites: 0,
  };
}

function addUsage(
  target: OfficialVerifierUsage,
  source: OfficialVerifierUsage
) {
  const keys = [
    "httpRequests",
    "embeddingTokens",
    "llmInputTokens",
    "llmOutputTokens",
    "ramCacheHits",
    "persistentCacheHits",
    "persistentCacheMisses",
    "persistentCacheWrites",
    "verifiedFactMemoryHits",
    "verifiedFactMemoryMisses",
    "verifiedFactWrites",
  ] as const;

  for (const key of keys) {
    (target as any)[key] =
      Number(
        (target as any)[key] || 0
      ) +
      Number(
        (source as any)[key] || 0
      );
  }
}

function emptyCache():
  CacheFile {
  return {
    version:
      CACHE_VERSION,
    updatedAt:
      new Date().toISOString(),
    entries: {},
  };
}

function loadCache():
  CacheFile {
  if (
    !fs.existsSync(
      CACHE_PATH
    )
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
      ) as CacheFile;

    if (
      parsed.version !==
        CACHE_VERSION ||
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

function cacheKeyForGroup(
  group: WebsiteGroup,
  internalProfiles:
    InternalProfile[]
) {
  return sha256(
    JSON.stringify({
      version: VERSION,
      model: MODEL,
      embeddingModel:
        EMBEDDING_MODEL,
      maxSelectedPages:
        MAX_SELECTED_PAGES,
      officialSiteGroup: {
        key:
          group.key,
        domain:
          group.domain,
        auditWebsite:
          group.auditWebsite,
        multiTenantProfile:
          group.multiTenantProfile,
        places:
          group.places.map(
            place => ({
              id:
                place.id,
              name:
                place.name,
              city:
                place.city,
              address:
                place.address,
              website:
                place.website,
            })
          ),
      },
      internalProfiles,
    })
  );
}

function modelSchema() {
  return {
    type: "object",
    properties: {
      summaryFr: {
        type: "string",
      },
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            concept: {
              type: "string",
            },
            statementFr: {
              type: "string",
            },
            evidenceQuote: {
              type: "string",
            },
            sourceUrl: {
              type: "string",
            },
            scope: {
              type: "string",
              enum: [
                "target_place",
                "brand_general",
                "other_branch",
                "unclear",
              ],
            },
            relation: {
              type: "string",
              enum: [
                "corroborates",
                "extends",
                "contradicts",
                "new",
              ],
            },
            relatedInternalDriver: {
              type: "string",
            },
          },
          required: [
            "concept",
            "statementFr",
            "evidenceQuote",
            "sourceUrl",
            "scope",
            "relation",
            "relatedInternalDriver",
          ],
          additionalProperties:
            false,
        },
      },
      cautions: {
        type: "array",
        items: {
          type: "string",
        },
      },
    },
    required: [
      "summaryFr",
      "findings",
      "cautions",
    ],
    additionalProperties:
      false,
  };
}

function validateFindings(
  rawFindings: unknown,
  pages: ScoutOfficialPage[],
  internalDrivers: string[]
) {
  const pageByUrl =
    new Map(
      pages.map(page => [
        canonicalUrl(
          page.url
        ),
        page,
      ])
    );

  const allowedScopes =
    new Set<FindingScope>([
      "target_place",
      "brand_general",
      "other_branch",
      "unclear",
    ]);

  const allowedRelations =
    new Set<FindingRelation>([
      "corroborates",
      "extends",
      "contradicts",
      "new",
    ]);

  const findings:
    OfficialFinding[] = [];

  let invalidEvidenceCount =
    0;

  const seen =
    new Set<string>();

  for (
    const raw of
    Array.isArray(rawFindings)
      ? rawFindings
      : []
  ) {
    if (
      !raw ||
      typeof raw !== "object"
    ) {
      invalidEvidenceCount += 1;
      continue;
    }

    const item =
      raw as Record<
        string,
        unknown
      >;

    const concept =
      String(
        item.concept || ""
      ).trim();

    const statementFr =
      String(
        item.statementFr || ""
      ).trim();

    const evidenceQuote =
      String(
        item.evidenceQuote || ""
      ).trim();

    const requestedUrl =
      canonicalUrl(
        item.sourceUrl
      );

    const page =
      pageByUrl.get(
        requestedUrl
      );

    const scope =
      String(
        item.scope || ""
      ) as FindingScope;

    let relation =
      String(
        item.relation || ""
      ) as FindingRelation;

    let relatedInternalDriver =
      String(
        item.relatedInternalDriver ||
        ""
      ).trim();

    if (
      !concept ||
      !statementFr ||
      evidenceQuote.length < 5 ||
      evidenceQuote.endsWith(":") ||
      !page ||
      !allowedScopes.has(scope) ||
      !allowedRelations.has(
        relation
      ) ||
      !normalizeText(
        page.text
      ).includes(
        normalizeText(
          evidenceQuote
        )
      )
    ) {
      invalidEvidenceCount += 1;
      continue;
    }

    if (
      !internalDrivers.includes(
        relatedInternalDriver
      )
    ) {
      relatedInternalDriver = "";

      if (
        relation !== "new"
      ) {
        relation = "new";
      }
    }

    if (
      scope === "other_branch" ||
      scope === "unclear"
    ) {
      relatedInternalDriver = "";
      relation = "new";
    }

    const dedupeKey =
      [
        canonicalUrl(
          page.url
        ),
        normalizeText(
          evidenceQuote
        ),
        relation,
        relatedInternalDriver,
      ].join("|");

    if (
      seen.has(
        dedupeKey
      )
    ) {
      continue;
    }

    seen.add(
      dedupeKey
    );

    findings.push({
      concept,
      statementFr,
      evidenceQuote,
      sourceUrl:
        page.url,
      sourceContentHash:
        page.contentHash,
      scope,
      relation,
      relatedInternalDriver,
    });
  }

  return {
    findings,
    invalidEvidenceCount,
  };
}

function officialSource(
  finding: OfficialFinding
): CombinedSource {
  return {
    sourceType:
      "official_site",
    evidenceText:
      finding.evidenceQuote,
    sourceUrl:
      finding.sourceUrl,
    sourceContentHash:
      finding.sourceContentHash,
    scope:
      finding.scope,
  };
}

function buildCombinedDrivers(
  internalDrivers: string[],
  officialFindings:
    OfficialFinding[]
) {
  const applicableFindings =
    officialFindings.filter(
      finding =>
        finding.scope ===
          "target_place" ||
        finding.scope ===
          "brand_general"
    );

  const combined:
    CombinedDriver[] = [];

  for (
    const driver of
    internalDrivers
  ) {
    const related =
      applicableFindings.filter(
        finding =>
          finding
            .relatedInternalDriver ===
          driver
      );

    const hasConflict =
      related.some(
        finding =>
          finding.relation ===
            "contradicts"
      );

    const hasOfficialSupport =
      related.some(
        finding =>
          finding.relation ===
            "corroborates" ||
          finding.relation ===
            "extends"
      );

    combined.push({
      label: driver,
      status:
        hasConflict
          ? "conflict"
          : hasOfficialSupport
            ? "corroborated"
            : "internal_only",
      sources: [
        {
          sourceType:
            "indiemap_internal",
          evidenceText:
            driver,
        },
        ...related.map(
          officialSource
        ),
      ],
    });
  }

  const officialOnly =
    new Map<
      string,
      CombinedDriver
    >();

  for (
    const finding of
    applicableFindings
  ) {
    if (
      finding.relation !==
        "new" &&
      finding.relation !==
        "extends"
    ) {
      continue;
    }

    const key =
      normalizeText(
        finding.concept
      );

    const existing =
      officialOnly.get(key);

    if (existing) {
      existing.sources.push(
        officialSource(
          finding
        )
      );
      continue;
    }

    officialOnly.set(
      key,
      {
        label:
          finding.concept,
        status:
          "official_only",
        relatedInternalDriver:
          finding
            .relatedInternalDriver ||
          undefined,
        sources: [
          officialSource(
            finding
          ),
        ],
      }
    );
  }

  combined.push(
    ...officialOnly.values()
  );

  return combined;
}

async function analyzePlace(
  openai: OpenAI,
  place: Place,
  internalProfile:
    InternalProfile,
  options?: {
    restrictToStartPage?: boolean;
  }
): Promise<WebFusionProfile> {
  const usage =
    emptyUsage();

  const collection =
    await collectOfficialPagesForScout({
      openai,
      place: {
        id: place.id,
        name: place.name,
        city: place.city,
        address:
          place.address,
        website:
          place.website,
      },
      usage,
      embeddingModel:
        EMBEDDING_MODEL,
      maxSelectedPages:
        MAX_SELECTED_PAGES,
      restrictToStartPage:
        options
          ?.restrictToStartPage,
    });

  if (
    collection.pages.length === 0
  ) {
    throw new Error(
      "Aucune page officielle exploitable"
    );
  }

  const response =
    await openai.responses.create({
      model: MODEL,

      reasoning: {
        effort: "low",
      },

      store: false,

      max_output_tokens:
        8000,

      text: {
        format: {
          type: "json_schema",
          name:
            "indie_map_scout_web_learning",
          strict: true,
          schema:
            modelSchema(),
        },
      },

      input: [
        {
          role: "system",
          content: `
Tu construis le corpus d'apprentissage d'Indie Map à partir
de deux sources : les données internes Indie Map et les pages
officielles des établissements.

Le lieu est déjà présent dans Indie Map. Tu ne dois pas décider
s'il mérite d'y être. Tu dois découvrir et documenter les
caractéristiques qui expliquent son identité, son fonctionnement,
ses engagements, ses pratiques et son ancrage.

Les critères existants ne forment pas une liste fermée.
Un concept nouveau et réellement documenté doit être conservé.

RÈGLES ABSOLUES :

- Utilise uniquement les pages officielles fournies.
- N'utilise aucune connaissance extérieure.
- Chaque finding doit contenir une citation courte, exacte et
  continue présente mot pour mot dans la page indiquée.
- Un finding doit exprimer une seule affirmation atomique.
- evidenceQuote doit suffire à elle seule à prouver entièrement
  concept et statementFr.
- N'ajoute dans statementFr aucun détail situé ailleurs dans la page.
- Si plusieurs citations sont nécessaires, crée plusieurs findings.
- Un titre, une amorce ou une phrase terminée par deux-points ne
  constitue pas une preuve autonome.
- Ne traduis jamais evidenceQuote.
- sourceUrl doit être copié exactement depuis une page fournie.
- statementFr et concept peuvent traduire fidèlement le sens.
- Une formule publicitaire vague n'est pas une preuve suffisante.
- Le silence du site n'est jamais une contradiction.
- contradicts exige une contradiction officielle explicite.
- target_place signifie que la preuve concerne cette adresse.
- brand_general exige que le texte concerne réellement toute
  la marque ou toute l'organisation.
- Si targetPlace.id commence par "site:", plusieurs lieux Indie Map
  partagent ce site. Les engagements communs sont brand_general.
  target_place ne doit alors être utilisé que si une succursale ou
  une adresse précise est explicitement nommée.
- other_branch concerne explicitement une autre adresse.
- unclear est utilisé quand la portée ne peut pas être établie.
- corroborates confirme un driver interne existant.
- extends confirme un driver interne et ajoute une précision.
- new documente un concept absent des drivers internes.
- relatedInternalDriver doit recopier exactement un driver interne,
  ou rester vide.
- Extrais toutes les caractéristiques matérielles pertinentes,
  sans imposer une limite arbitraire.
- Ne conserve pas les informations ordinaires comme l'adresse,
  le téléphone, les horaires ou une simple liste de produits.
- Une ouverture, un café sur place, une location de salle, une
  capacité d'accueil ou un événement ponctuel ne constituent pas
  seuls une caractéristique éditoriale Indie Map.

Inspecte notamment, sans limiter la découverte à cette liste :
histoire, mission, valeurs, engagements, approvisionnement,
producteurs, fabrication, savoir-faire, artisanat, saisonnalité,
agriculture, réduction des déchets, réemploi, impact social,
gouvernance, communauté, transmission, ateliers, culture et
ancrage territorial.
          `.trim(),
        },
        {
          role: "user",
          content:
            JSON.stringify({
              targetPlace: {
                id: place.id,
                name: place.name,
                city:
                  place.city || "",
                country:
                  place.country || "",
                address:
                  place.address || "",
                category:
                  place.category || "",
                website:
                  place.website || "",
              },
              internalProfile,
              officialPages:
                collection.pages.map(
                  page => ({
                    sourceUrl:
                      page.url,
                    title:
                      page.title,
                    text:
                      page.text,
                  })
                ),
            }),
        },
      ],
    });

  usage.llmInputTokens +=
    Number(
      response.usage
        ?.input_tokens || 0
    );

  usage.llmOutputTokens +=
    Number(
      response.usage
        ?.output_tokens || 0
    );

  if (
    !response.output_text
  ) {
    throw new Error(
      "Réponse OpenAI vide"
    );
  }

  const parsed =
    JSON.parse(
      cleanJsonOutput(
        response.output_text
      )
    ) as ModelOutput;

  const internalDrivers =
    Array.isArray(
      internalProfile
        .selectionDrivers
    )
      ? internalProfile
          .selectionDrivers
          .map(value =>
            String(value).trim()
          )
          .filter(Boolean)
      : [];

  const validated =
    validateFindings(
      parsed.findings,
      collection.pages,
      internalDrivers
    );

  const cautions =
    Array.isArray(
      parsed.cautions
    )
      ? parsed.cautions
          .map(value =>
            String(value).trim()
          )
          .filter(Boolean)
      : [];

  if (
    validated
      .invalidEvidenceCount > 0
  ) {
    cautions.push(
      `${validated.invalidEvidenceCount} preuve(s) rejetée(s) car la citation ou l'URL n'a pas pu être vérifiée exactement.`
    );
  }

  const excludedScopeCount =
    validated.findings.filter(
      finding =>
        finding.scope ===
          "other_branch" ||
        finding.scope ===
          "unclear"
    ).length;

  if (
    excludedScopeCount > 0
  ) {
    cautions.push(
      `${excludedScopeCount} information(s) conservée(s) pour audit mais exclue(s) des combinedDrivers à cause de leur portée.`
    );
  }

  return {
    placeId:
      place.id,
    name:
      place.name,
    city:
      String(
        place.city || ""
      ),
    country:
      String(
        place.country || ""
      ),
    category:
      String(
        place.category || ""
      ),
    website:
      String(
        place.website || ""
      ),
    model:
      MODEL,
    embeddingModel:
      EMBEDDING_MODEL,
    internalProfile,
    discoveredUrlCount:
      collection
        .discoveredCount,
    selectedUrls:
      collection.selectedUrls,
    officialPages:
      collection.pages.map(
        page => ({
          url: page.url,
          title: page.title,
          contentHash:
            page.contentHash,
          textLength:
            page.text.length,

          emails:
            page.emails,
        })
      ),
    officialFindings:
      validated.findings,
    combinedDrivers:
      buildCombinedDrivers(
        internalDrivers,
        validated.findings
      ),
    summaryFr:
      String(
        parsed.summaryFr || ""
      ).trim(),
    cautions,
    invalidEvidenceCount:
      validated
        .invalidEvidenceCount,
    verifiedAt:
      new Date().toISOString(),
    usage,
  };
}

const MULTI_TENANT_DOMAINS =
  new Set([
    "facebook.com",
    "instagram.com",
  ]);

function normalizedWebsiteIdentity(
  place: Place
) {
  const value =
    String(
      place.website || ""
    ).trim();

  if (!value) {
    throw new Error(
      `Site officiel absent : ${place.name}`
    );
  }

  const raw =
    /^https?:\/\//i.test(
      value
    )
      ? value
      : `https://${value}`;

  let url: URL;

  try {
    url =
      new URL(raw);
  } catch {
    throw new Error(
      `URL officielle invalide : ${place.name} — ${value}`
    );
  }

  url.hash = "";

  const domain =
    url.hostname
      .toLowerCase()
      .replace(
        /^www\./,
        ""
      );

  const rootWebsite =
    `${url.protocol}//${url.host}/`;

  const rawPath =
    url.pathname
      .replace(
        /\/+$/,
        ""
      ) || "/";

  let normalizedPath =
    rawPath;

  try {
    normalizedPath =
      decodeURIComponent(
        rawPath
      );
  } catch {}

  normalizedPath =
    normalizedPath
      .normalize("NFKC")
      .toLowerCase();

  const multiTenantProfile =
    MULTI_TENANT_DOMAINS
      .has(domain);

  const key =
    multiTenantProfile
      ? `${domain}:${normalizedPath}`
      : domain;

  return {
    key,
    domain,
    rootWebsite,
    originalWebsite:
      url.toString(),
    multiTenantProfile,
  };
}

function buildWebsiteGroups(
  places: Place[]
) {
  const byKey =
    new Map<
      string,
      WebsiteGroup
    >();

  for (const place of places) {
    if (
      !String(
        place.website || ""
      ).trim()
    ) {
      continue;
    }

    const identity =
      normalizedWebsiteIdentity(
        place
      );

    const existing =
      byKey.get(
        identity.key
      );

    if (existing) {
      existing.places.push(
        place
      );

      if (
        !existing.auditWebsite
          .startsWith(
            "https://"
          ) &&
        identity.originalWebsite
          .startsWith(
            "https://"
          )
      ) {
        existing.auditWebsite =
          identity.originalWebsite;

        existing.rootWebsite =
          identity.rootWebsite;
      }

      continue;
    }

    byKey.set(
      identity.key,
      {
        key:
          identity.key,
        domain:
          identity.domain,
        auditWebsite:
          identity
            .originalWebsite,
        rootWebsite:
          identity
            .rootWebsite,
        multiTenantProfile:
          identity
            .multiTenantProfile,
        places: [
          place,
        ],
      }
    );
  }

  const groups =
    [...byKey.values()];

  for (const group of groups) {
    if (
      !group
        .multiTenantProfile &&
      group.places.length > 1
    ) {
      group.auditWebsite =
        group.rootWebsite;
    }
  }

  return groups;
}

function uniqueStrings(
  values: unknown[]
) {
  const seen =
    new Set<string>();

  const result:
    string[] = [];

  for (const value of values) {
    const text =
      String(
        value ?? ""
      ).trim();

    if (
      !text ||
      seen.has(text)
    ) {
      continue;
    }

    seen.add(text);
    result.push(text);
  }

  return result;
}

function selectionDriversOf(
  profile: InternalProfile
) {
  return Array.isArray(
    profile.selectionDrivers
  )
    ? uniqueStrings(
        profile
          .selectionDrivers
      )
    : [];
}

function mergeInternalProfiles(
  group: WebsiteGroup,
  internalProfiles:
    InternalProfile[]
): InternalProfile {
  const signals =
    new Map<
      string,
      unknown
    >();

  for (
    const profile of
    internalProfiles
  ) {
    for (
      const signal of
      Array.isArray(
        profile.signals
      )
        ? profile.signals
        : []
    ) {
      const key =
        sha256(
          JSON.stringify(
            signal
          )
        );

      if (
        !signals.has(key)
      ) {
        signals.set(
          key,
          signal
        );
      }
    }
  }

  return {
    placeId:
      `site:${group.key}`,
    name:
      group.places
        .map(place =>
          String(
            place.name || ""
          ).trim()
        )
        .filter(Boolean)
        .join(" | "),
    originalCategory:
      uniqueStrings(
        internalProfiles.map(
          profile =>
            profile
              .originalCategory
        )
      ).join(" | "),
    normalizedCategory:
      uniqueStrings(
        internalProfiles.map(
          profile =>
            profile
              .normalizedCategory
        )
      ).join(" | "),
    city:
      uniqueStrings(
        group.places.map(
          place =>
            place.city
        )
      ).join(" | "),
    signals:
      [...signals.values()],
    selectionDrivers:
      uniqueStrings(
        internalProfiles.flatMap(
          profile =>
            selectionDriversOf(
              profile
            )
        )
      ),
    cautions:
      uniqueStrings([
        ...internalProfiles
          .flatMap(
            profile =>
              Array.isArray(
                profile.cautions
              )
                ? profile
                    .cautions
                : []
          ),
        group.places.length > 1
          ? `Site partagé par ${group.places.length} lieux Indie Map. Seules les preuves brand_general peuvent être propagées entre les lieux.`
          : "",
      ]),
  };
}

function materializeProfiles(
  group: WebsiteGroup,
  internalProfiles:
    InternalProfile[],
  siteAudit:
    WebFusionProfile
) {
  const sharedWebsite =
    group.places.length > 1;

  const findingsForFusion =
    siteAudit
      .officialFindings
      .filter(finding =>
        sharedWebsite
          ? finding.scope ===
              "brand_general"
          : finding.scope ===
              "brand_general" ||
            finding.scope ===
              "target_place"
      );

  const excludedCount =
    siteAudit
      .officialFindings
      .length -
    findingsForFusion.length;

  return group.places.map(
    (place, index) => {
      const internalProfile =
        internalProfiles[index];

      const cautions =
        [...siteAudit.cautions];

      if (sharedWebsite) {
        cautions.push(
          `${group.places.length} lieux partagent ce site. ${findingsForFusion.length} finding(s) brand_general ont été utilisables pour la fusion ; ${excludedCount} finding(s) de portée locale ou incertaine n'ont pas été propagés.`
        );
      }

      return {
        ...siteAudit,
        placeId:
          place.id,
        name:
          place.name,
        city:
          String(
            place.city || ""
          ),
        country:
          String(
            place.country || ""
          ),
        category:
          String(
            place.category || ""
          ),
        website:
          String(
            place.website || ""
          ),
        internalProfile,
        officialFindings:
          siteAudit
            .officialFindings,
        combinedDrivers:
          buildCombinedDrivers(
            selectionDriversOf(
              internalProfile
            ),
            findingsForFusion
          ),
        cautions,
        officialSiteGroupKey:
          group.key,
        officialSiteGroupPlaceIds:
          group.places.map(
            member =>
              member.id
          ),
        auditWebsite:
          group.auditWebsite,
        auditUsageOwner:
          index === 0,
        usage:
          index === 0
            ? siteAudit.usage
            : emptyUsage(),
      } satisfies WebFusionProfile;
    }
  );
}

async function analyzeWebsiteGroup(
  openai: OpenAI,
  group: WebsiteGroup,
  internalProfiles:
    InternalProfile[]
) {
  const mergedProfile =
    mergeInternalProfiles(
      group,
      internalProfiles
    );

  const auditPlace:
    Place = {
      id:
        `site:${group.key}`,
      name:
        group.places.length > 1
          ? `Site ${group.domain} partagé par : ${group.places
              .map(place =>
                place.name
              )
              .join(" | ")}`
          : group.places[0]
              .name,
      city:
        group.places.length === 1
          ? group.places[0]
              .city
          : "",
      country:
        uniqueStrings(
          group.places.map(
            place =>
              place.country
          )
        ).join(" | "),
      address:
        group.places.length === 1
          ? group.places[0]
              .address
          : "",
      category:
        uniqueStrings(
          group.places.map(
            place =>
              place.category
          )
        ).join(" | "),
      website:
        group.auditWebsite,
    };

  const siteAudit =
    await analyzePlace(
      openai,
      auditPlace,
      mergedProfile,
      {
        restrictToStartPage:
          group
            .multiTenantProfile,
      }
    );

  /*
   * Attribution sûre des coordonnées :
   *
   * un site lié à un seul établissement peut
   * alimenter directement le contact privé.
   *
   * Un site partagé entre plusieurs lieux n'est
   * jamais propagé automatiquement.
   */
  if (
    group.places.length === 1 &&
    !group.multiTenantProfile
  ) {
    const place =
      group.places[0];

    /*
     * Un même email peut apparaître sur beaucoup de pages
     * du site (footer, collections, équipe, etc.).
     *
     * Pour Neon on ne conserve qu'une preuve Scout
     * principale par email et par établissement.
     */
    const bestPageByEmail =
      new Map<
        string,
        {
          url: string;
          contentHash: string;
          priority: number;
        }
      >();

    function evidencePriority(
      urlValue: string
    ) {
      let pathname = "";

      try {
        pathname =
          new URL(urlValue)
            .pathname
            .toLowerCase();
      } catch {}

      if (
        /contact|nous-joindre|nous-contacter|get-in-touch/.test(
          pathname
        )
      ) {
        return 100;
      }

      if (
        /mention|legal|privacy|confidential|imprint/.test(
          pathname
        )
      ) {
        return 90;
      }

      if (
        /about|a-propos|equipe|team/.test(
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

    for (
      const page of
      siteAudit.officialPages
    ) {
      for (
        const rawEmail of
        page.emails || []
      ) {
        const email =
          rawEmail
            .trim()
            .toLowerCase();

        if (!email) {
          continue;
        }

        const priority =
          evidencePriority(
            page.url
          );

        const existing =
          bestPageByEmail.get(
            email
          );

        if (
          !existing ||
          priority >
            existing.priority
        ) {
          bestPageByEmail.set(
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

    let contactsCreated =
      0;

    let evidenceCreated =
      0;

    for (
      const [
        email,
        page,
      ] of bestPageByEmail
    ) {
      const result =
        await saveOfficialPlaceContact({
          placeId:
            place.id,

          email,

          sourceUrl:
            page.url,

          sourceContentHash:
            page.contentHash,

          sourceKind:
            "scout",

          verifiedAt:
            new Date(),
        });

      if (!result.saved) {
        continue;
      }

      if (
        result.contactCreated
      ) {
        contactsCreated += 1;
      }

      if (
        result.evidenceCreated
      ) {
        evidenceCreated += 1;
      }
    }

    if (
      bestPageByEmail.size > 0
    ) {
      console.log(
        `  emails officiels uniques=${bestPageByEmail.size} nouveaux contacts=${contactsCreated} nouvelles preuves=${evidenceCreated}`
      );
    }
  }

  return materializeProfiles(
    group,
    internalProfiles,
    siteAudit
  );
}

function writeOutput(
  cache: CacheFile,
  places: Place[],
  runUsage:
    OfficialVerifierUsage,
  officialSiteGroups:
    number
) {
  const placesWithWebsite =
    places.filter(place =>
      Boolean(
        String(
          place.website || ""
        ).trim()
      )
    );

  const profiles =
    placesWithWebsite
      .map(place =>
        cache.entries[
          place.id
        ]?.profile
      )
      .filter(
        (
          profile
        ): profile is WebFusionProfile =>
          Boolean(profile)
      );

  const failures =
    placesWithWebsite
      .map(place => {
        const entry =
          cache.entries[
            place.id
          ];

        if (
          !entry ||
          entry.status !==
            "error"
        ) {
          return null;
        }

        return {
          placeId:
            place.id,
          name:
            place.name,
          website:
            place.website,
          error:
            entry.error ||
            "Erreur inconnue",
        };
      })
      .filter(Boolean);

  writeJsonAtomic(
    OUTPUT_PATH,
    {
      version:
        VERSION,
      generatedAt:
        new Date().toISOString(),
      model:
        MODEL,
      embeddingModel:
        EMBEDDING_MODEL,
      maxSelectedPages:
        MAX_SELECTED_PAGES,
      totalCataloguePlaces:
        places.length,
      placesWithWebsite:
        placesWithWebsite.length,
      officialSiteGroups,
      redundantWebsiteAuditsAvoided:
        placesWithWebsite.length -
        officialSiteGroups,
      analyzedPlaces:
        profiles.length,
      failedPlaces:
        failures.length,
      complete:
        profiles.length ===
        placesWithWebsite.length,
      sourcePolicy: {
        learningCorpus: [
          "indiemap_internal",
          "official_site",
        ],
        internalDataPreserved:
          true,
        exactOfficialEvidenceRequired:
          true,
        silenceIsContradiction:
          false,
        oneAuditPerOfficialSiteGroup:
          true,
        multiTenantProfilesSeparated:
          true,
        sharedValuesRequireBrandGeneral:
          true,
      },
      runUsage,
      failures,
      profiles,
    }
  );
}

async function main() {
  if (
    !process.env
      .OPENAI_API_KEY
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

  const internalFile =
    JSON.parse(
      fs.readFileSync(
        INTERNAL_PROFILES_PATH,
        "utf8"
      )
    ) as InternalProfilesFile;

  const internalById =
    new Map(
      internalFile.profiles.map(
        profile => [
          profile.placeId,
          profile,
        ]
      )
    );

  const allGroups =
    buildWebsiteGroups(
      places
    );

  let candidates =
    [...allGroups];

  const placeFilter =
    flagValue("--place");

  if (placeFilter) {
    const normalizedFilter =
      normalizeText(
        placeFilter
      );

    candidates =
      candidates.filter(
        group =>
          group.places.some(
            place =>
              place.id ===
                placeFilter ||
              normalizeText(
                place.name
              ) ===
                normalizedFilter
          )
      );
  }

  const siteFilter =
    flagValue("--site");

  if (siteFilter) {
    const normalizedFilter =
      normalizeText(
        siteFilter
      );

    candidates =
      candidates.filter(
        group =>
          normalizeText(
            group.key
          ) ===
            normalizedFilter ||
          normalizeText(
            group.domain
          ) ===
            normalizedFilter
      );
  }

  const offset =
    positiveIntegerFlag(
      "--offset"
    ) || 0;

  candidates =
    candidates.slice(offset);

  const all =
    hasFlag("--all");

  const requestedLimit =
    positiveIntegerFlag(
      "--limit"
    );

  const limit =
    all
      ? candidates.length
      : requestedLimit ?? 3;

  const selectedGroups =
    candidates.slice(
      0,
      limit
    );

  if (
    selectedGroups.length === 0
  ) {
    throw new Error(
      "Aucun site officiel sélectionné"
    );
  }

  const resume =
    hasFlag("--resume");

  const cache =
    loadCache();

  const openai =
    new OpenAI({
      apiKey:
        process.env
          .OPENAI_API_KEY,
    });

  const runUsage =
    emptyUsage();

  const selectedPlaceCount =
    selectedGroups.reduce(
      (
        total,
        group
      ) =>
        total +
        group.places.length,
      0
    );

  console.log(
    `MODE ${all ? "COMPLET" : "PILOTE"}`
  );
  console.log(
    `Sites officiels sélectionnés : ${selectedGroups.length}`
  );
  console.log(
    `Lieux rattachés : ${selectedPlaceCount}`
  );
  console.log(
    `Total des groupes de sites : ${allGroups.length}`
  );
  console.log(
    `Audits redondants évités : ${
      places.filter(place =>
        Boolean(
          String(
            place.website || ""
          ).trim()
        )
      ).length -
      allGroups.length
    }`
  );
  console.log(
    `Modèle : ${MODEL}`
  );
  console.log(
    `Pages profondes maximum : ${MAX_SELECTED_PAGES}`
  );
  console.log("");

  for (
    let index = 0;
    index <
      selectedGroups.length;
    index += 1
  ) {
    const group =
      selectedGroups[index];

    const internalProfiles =
      group.places.map(
        place => {
          const profile =
            internalById.get(
              place.id
            );

          if (!profile) {
            throw new Error(
              `Profil interne absent : ${place.name}`
            );
          }

          return profile;
        }
      );

    const cacheKey =
      cacheKeyForGroup(
        group,
        internalProfiles
      );

    const existingEntries =
      group.places.map(
        place =>
          cache.entries[
            place.id
          ]
      );

    const completeCacheHit =
      existingEntries.every(
        entry =>
          entry?.status ===
            "success" &&
          entry.cacheKey ===
            cacheKey &&
          entry.profile
      );

    const label =
      group.places.length > 1
        ? `${group.domain} — ${group.places.length} lieux`
        : `${group.places[0].name}`;

    if (
      resume &&
      completeCacheHit
    ) {
      console.log(
        `[${index + 1}/${selectedGroups.length}] CACHE — ${label}`
      );
      continue;
    }

    console.log(
      `[${index + 1}/${selectedGroups.length}] AUDIT SITE — ${label} (${group.auditWebsite})`
    );

    if (
      group
        .multiTenantProfile
    ) {
      console.log(
        "  plateforme mutualisée : page de profil uniquement"
      );
    }

    try {
      const profiles =
        await analyzeWebsiteGroup(
          openai,
          group,
          internalProfiles
        );

      const usageOwner =
        profiles.find(
          profile =>
            profile
              .auditUsageOwner
        );

      if (usageOwner) {
        addUsage(
          runUsage,
          usageOwner.usage
        );
      }

      const savedAt =
        new Date()
          .toISOString();

      for (
        let memberIndex = 0;
        memberIndex <
          group.places.length;
        memberIndex += 1
      ) {
        const place =
          group.places[
            memberIndex
          ];

        cache.entries[
          place.id
        ] = {
          cacheKey,
          placeId:
            place.id,
          status:
            "success",
          savedAt,
          profile:
            profiles[
              memberIndex
            ],
        };
      }

      const auditProfile =
        profiles[0];

      const brandFindings =
        auditProfile
          .officialFindings
          .filter(
            finding =>
              finding.scope ===
                "brand_general"
          ).length;

      console.log(
        `  pages=${auditProfile.officialPages.length} findings=${auditProfile.officialFindings.length} brand=${brandFindings} lieux=${profiles.length}`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      const savedAt =
        new Date()
          .toISOString();

      for (const place of group.places) {
        const existing =
          cache.entries[
            place.id
          ];

        if (
          existing?.status ===
            "success" &&
          existing.profile
        ) {
          cache.entries[
            place.id
          ] = {
            ...existing,
            lastAttemptError:
              message,
          };
        } else {
          cache.entries[
            place.id
          ] = {
            cacheKey,
            placeId:
              place.id,
            status:
              "error",
            savedAt,
            error:
              message,
          };
        }
      }

      console.error(
        `  ERREUR — ${message}`
      );
    }

    cache.updatedAt =
      new Date().toISOString();

    writeJsonAtomic(
      CACHE_PATH,
      cache
    );

    writeOutput(
      cache,
      places,
      runUsage,
      allGroups.length
    );
  }

  writeJsonAtomic(
    CACHE_PATH,
    cache
  );

  writeOutput(
    cache,
    places,
    runUsage,
    allGroups.length
  );

  const successfulPlaces =
    Object.values(
      cache.entries
    ).filter(
      entry =>
        entry.status ===
          "success"
    ).length;

  const failedPlaces =
    Object.values(
      cache.entries
    ).filter(
      entry =>
        entry.status ===
          "error"
    ).length;

  const successfulGroups =
    allGroups.filter(
      group =>
        group.places.every(
          place =>
            cache.entries[
              place.id
            ]?.status ===
              "success" &&
            cache.entries[
              place.id
            ]?.profile
              ?.officialSiteGroupKey ===
              group.key
        )
    ).length;

  console.log("");
  console.log(
    `SITES AUDITÉS EN CACHE : ${successfulGroups}`
  );
  console.log(
    `LIEUX MATÉRIALISÉS EN CACHE : ${successfulPlaces}`
  );
  console.log(
    `LIEUX EN ERREUR : ${failedPlaces}`
  );
  console.log(
    `HTTP : ${runUsage.httpRequests}`
  );
  console.log(
    `TOKENS EMBEDDINGS : ${runUsage.embeddingTokens}`
  );
  console.log(
    `TOKENS LLM ENTREE : ${runUsage.llmInputTokens}`
  );
  console.log(
    `TOKENS LLM SORTIE : ${runUsage.llmOutputTokens}`
  );
  console.log(
    `SORTIE : ${OUTPUT_PATH}`
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
