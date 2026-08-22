import { NextResponse } from "next/server";
import { applyPrivateHomeSuggestionPatches } from "@/lib/privateHomeSuggestions";
import { normalizePlace } from "../../places/_normalize";
import { locales, defaultLocale } from "../../../../../../i18n";
import { type SearchPlace } from "@/lib/placeSearch";
import { readPlaceCatalogueWithProfessionalOverrides } from "@/lib/placeCatalogue";

type Obj = Record<string, unknown>;

const HEADERS = {
  "X-API-Version": "1",
  "Cache-Control": "no-store",
} as const;

function isObj(value: unknown): value is Obj {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function readPlaces(locale: string): Promise<SearchPlace[]> {
  const parsed: unknown =
    await readPlaceCatalogueWithProfessionalOverrides();

  if (!Array.isArray(parsed)) return [];

  const normalized = parsed.map((item: unknown) => {
    if (!isObj(item)) return item;

    if (locale === defaultLocale) return item;

    const tr = item.translations;
    if (!isObj(tr)) return item;

    let next = item;
    const tObj = tr[locale];

    if (isObj(tObj)) {
      const patch: Obj = {};

      if (typeof tObj.miniText === "string" && tObj.miniText.trim()) patch.miniText = tObj.miniText;
      if (typeof tObj.homeTextNear === "string" && tObj.homeTextNear.trim()) patch.homeTextNear = tObj.homeTextNear;
      if (typeof tObj.homeTextFar === "string" && tObj.homeTextFar.trim()) patch.homeTextFar = tObj.homeTextFar;

      if (Object.keys(patch).length > 0) next = { ...next, ...patch };
    }

    const mt = tr.miniText;
    if (isObj(mt)) {
      const value = mt[locale];
      if (typeof value === "string" && value.trim()) next = { ...next, miniText: value };
    }

    return next;
  });

  return applyPrivateHomeSuggestionPatches(
    normalized.map(normalizePlace)
  ) as SearchPlace[];
}


function normalizeSearchText(
  value: unknown
) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-z0-9\s]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function containsSearchPhrase(
  text: unknown,
  phrase: unknown
) {
  const haystack =
    ` ${normalizeSearchText(text)} `;

  const needle =
    ` ${normalizeSearchText(phrase)} `;

  return (
    needle.trim().length > 0 &&
    haystack.includes(needle)
  );
}

function levenshteinSearch(
  a: string,
  b: string
) {
  if (a === b) return 0;

  if (!a.length) {
    return b.length;
  }

  if (!b.length) {
    return a.length;
  }

  const previous =
    Array.from(
      {
        length:
          b.length + 1,
      },
      (_, index) =>
        index
    );

  const current =
    new Array<number>(
      b.length + 1
    );

  for (
    let i = 1;
    i <= a.length;
    i += 1
  ) {
    current[0] = i;

    for (
      let j = 1;
      j <= b.length;
      j += 1
    ) {
      current[j] =
        Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] +
            (
              a[i - 1] ===
              b[j - 1]
                ? 0
                : 1
            )
        );
    }

    for (
      let j = 0;
      j <= b.length;
      j += 1
    ) {
      previous[j] =
        current[j];
    }
  }

  return previous[b.length];
}

const SIMPLE_SEARCH_CATEGORIES = {
  restaurant: {
    aliases: [
      "restaurant",
      "restaurants",
      "resto",
      "restos",
    ],

    markers: [
      "restaurant",
    ],
  },

  cafe: {
    aliases: [
      "cafe",
      "cafes",
      "coffee",
      "coffee shop",
    ],

    markers: [
      "cafe",
    ],
  },

  brunch: {
    aliases: [
      "brunch",
      "brunchs",
    ],

    markers: [
      "brunch",
    ],
  },

  brasserie: {
    aliases: [
      "brasserie",
      "brasseries",
      "microbrasserie",
      "microbrasseries",
    ],

    markers: [
      "brasserie",
      "microbrasserie",
    ],
  },

  bar: {
    aliases: [
      "bar",
      "bars",
      "pub",
      "pubs",
    ],

    markers: [
      "bar",
      "pub",
    ],
  },

  epicerie: {
    aliases: [
      "epicerie",
      "epiceries",
      "grocery",
      "groceries",
    ],

    markers: [
      "epicerie",
    ],
  },

  librairie: {
    aliases: [
      "librairie",
      "librairies",
      "bookstore",
      "bookstores",
      "bookshop",
      "bookshops",
    ],

    markers: [
      "librairie",
    ],
  },

  boulangerie: {
    aliases: [
      "boulangerie",
      "boulangeries",
      "bakery",
      "bakeries",
    ],

    markers: [
      "boulangerie",
    ],
  },

  ferme: {
    aliases: [
      "ferme",
      "fermes",
      "farm",
      "farms",
    ],

    markers: [
      "ferme",
    ],
  },

  marche: {
    aliases: [
      "marche",
      "marches",
      "market",
      "markets",
    ],

    markers: [
      "marche",
    ],
  },

  boutique: {
    aliases: [
      "boutique",
      "boutiques",
      "shop",
      "shops",
    ],

    markers: [
      "boutique",
    ],
  },

  mode: {
    aliases: [
      "mode",
      "fashion",
    ],

    markers: [
      "mode",
    ],
  },

  atelier: {
    aliases: [
      "atelier",
      "ateliers",
      "workshop",
      "workshops",
    ],

    markers: [
      "atelier",
    ],
  },

  alternatif: {
    aliases: [
      "lieu alternatif",
      "lieux alternatifs",
      "tiers lieu",
      "tiers lieux",
    ],

    markers: [
      "lieu alternatif",
      "alternatif",
    ],
  },
} as const;

type SimpleSearchCategory =
  keyof typeof SIMPLE_SEARCH_CATEGORIES;

const SIMPLE_QUERY_WORDS =
  new Set([
    "un",
    "une",
    "des",
    "le",
    "la",
    "les",
    "du",
    "de",
    "d",
    "a",
    "au",
    "aux",
    "dans",
    "sur",

    "je",
    "cherche",
    "chercher",
    "recherche",
    "trouve",
    "trouver",
    "moi",

    "lieu",
    "lieux",
    "place",
    "places",

    "the",
    "a",
    "an",
    "in",
    "at",
    "find",
    "search",
    "looking",
    "for",
  ]);

function queryWords(
  value: unknown
) {
  return normalizeSearchText(
    value
  )
    .split(/\s+/)
    .filter(Boolean);
}

function detectSimpleCity(
  query: string,
  places: SearchPlace[]
) {
  const cities = [
    ...new Set(
      places
        .map(
          (place) =>
            String(
              place.city ?? ""
            ).trim()
        )
        .filter(Boolean)
    ),
  ].sort(
    (a, b) =>
      normalizeSearchText(b)
        .length -
      normalizeSearchText(a)
        .length
  );

  return (
    cities.find(
      (city) =>
        containsSearchPhrase(
          query,
          city
        )
    ) || null
  );
}

function detectSimpleCategory(
  query: string
): {
  key: SimpleSearchCategory;
  alias: string;
} | null {
  const matches:
    Array<{
      key: SimpleSearchCategory;
      alias: string;
    }> =
      [];

  for (
    const [
      key,
      config,
    ] of Object.entries(
      SIMPLE_SEARCH_CATEGORIES
    ) as Array<
      [
        SimpleSearchCategory,
        {
          aliases:
            readonly string[];
          markers:
            readonly string[];
        }
      ]
    >
  ) {
    for (
      const alias of
        config.aliases
    ) {
      if (
        containsSearchPhrase(
          query,
          alias
        )
      ) {
        matches.push({
          key,
          alias,
        });
      }
    }
  }

  matches.sort(
    (a, b) =>
      normalizeSearchText(
        b.alias
      ).length -
      normalizeSearchText(
        a.alias
      ).length
  );

  return matches[0] || null;
}

function placeMatchesSimpleCategory(
  place: SearchPlace,
  category:
    SimpleSearchCategory
) {
  const value =
    normalizeSearchText(
      place.category
    );

  const config =
    SIMPLE_SEARCH_CATEGORIES[
      category
    ];

  return config.markers.some(
    (marker) =>
      containsSearchPhrase(
        value,
        marker
      )
  );
}

function simpleNameQuery(
  query: string
) {
  return queryWords(query)
    .filter(
      (word) =>
        !SIMPLE_QUERY_WORDS.has(
          word
        )
    )
    .join(" ");
}

function strongExactNameResults(
  query: string,
  places: SearchPlace[]
) {
  const nameQuery =
    simpleNameQuery(query);

  if (!nameQuery) {
    return [];
  }

  return places.filter(
    (place) => {
      const name =
        normalizeSearchText(
          place.name
        );

      return (
        name === nameQuery ||
        (
          nameQuery.length >= 5 &&
          containsSearchPhrase(
            name,
            nameQuery
          )
        )
      );
    }
  );
}

function simpleNameResults(
  query: string,
  places: SearchPlace[]
) {
  const value =
    simpleNameQuery(
      query
    );

  if (!value) {
    return [];
  }

  const valueWords =
    queryWords(value);

  return places
    .map(
      (place) => {
        const name =
          normalizeSearchText(
            place.name
          );

        if (name === value) {
          return {
            place,
            score: 1000,
          };
        }

        if (
          containsSearchPhrase(
            name,
            value
          )
        ) {
          return {
            place,
            score: 800,
          };
        }

        const nameWords =
          queryWords(name);

        const allMatched =
          valueWords.every(
            (word) =>
              nameWords.some(
                (candidate) => {
                  if (
                    candidate ===
                    word
                  ) {
                    return true;
                  }

                  if (
                    word.length < 5 ||
                    candidate.length <
                      5
                  ) {
                    return false;
                  }

                  const maxDistance =
                    Math.max(
                      word.length,
                      candidate.length
                    ) >= 8
                      ? 2
                      : 1;

                  return (
                    levenshteinSearch(
                      word,
                      candidate
                    ) <=
                    maxDistance
                  );
                }
              )
          );

        if (!allMatched) {
          return null;
        }

        return {
          place,
          score: 500,
        };
      }
    )
    .filter(
      (
        item
      ): item is {
        place: SearchPlace;
        score: number;
      } =>
        item !== null
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.place.name.localeCompare(
          b.place.name
        )
    )
    .map(
      (item) =>
        item.place
    );
}

function simpleStructuredSearch(
  query: string,
  places: SearchPlace[]
) {
  /*
   * Un vrai nom de lieu exact reste prioritaire.
   *
   * Exemple :
   * "Café Bloom" ne doit pas être interprété
   * comme la catégorie Café.
   */
  const exactNameResults =
    strongExactNameResults(
      query,
      places
    );

  if (
    exactNameResults.length === 1
  ) {
    return {
      detectedCity: null,
      explicitCategory: null,
      targetCategories: [],
      intentCategories: [],
      meaningfulTokens: [],
      detectedConcepts: [],
      searchMode:
        "simple_name",
      results:
        exactNameResults,
    };
  }

  const detectedCity =
    detectSimpleCity(
      query,
      places
    );

  const detectedCategory =
    detectSimpleCategory(
      query
    );

  /*
   * On vérifie qu'il ne reste pas de critère
   * que cette barre simple ne sait pas traiter.
   *
   * Exemple :
   * "café ouvert samedi Paris"
   * contient encore "ouvert", "samedi".
   *
   * On ne prétend donc PAS avoir compris
   * ces critères.
   */
  const recognizedWords =
    new Set<string>(
      SIMPLE_QUERY_WORDS
    );

  if (detectedCity) {
    for (
      const word of
        queryWords(
          detectedCity
        )
    ) {
      recognizedWords.add(
        word
      );
    }
  }

  if (detectedCategory) {
    for (
      const word of
        queryWords(
          detectedCategory.alias
        )
    ) {
      recognizedWords.add(
        word
      );
    }
  }

  const unsupportedWords =
    queryWords(query)
      .filter(
        (word) =>
          !recognizedWords.has(
            word
          )
      );

  if (
    detectedCity ||
    detectedCategory
  ) {
    /*
     * Un mot restant peut correspondre à un vrai
     * nom de lieu contenant une catégorie.
     * On donne alors encore une chance au nom exact.
     */
    if (
      unsupportedWords.length >
        0
    ) {
      if (
        exactNameResults.length >
        0
      ) {
        return {
          detectedCity: null,
          explicitCategory: null,
          targetCategories: [],
          intentCategories: [],
          meaningfulTokens: [],
          detectedConcepts: [],
          searchMode:
            "simple_name",
          results:
            exactNameResults,
        };
      }

      return {
        detectedCity,
        explicitCategory:
          detectedCategory?.key ??
          null,

        targetCategories:
          detectedCategory
            ? [
                detectedCategory.key,
              ]
            : [],

        intentCategories: [],
        meaningfulTokens:
          unsupportedWords,
        detectedConcepts: [],
        searchMode:
          "simple_unsupported",
        results: [],
      };
    }

    let results =
      [...places];

    if (detectedCity) {
      const city =
        normalizeSearchText(
          detectedCity
        );

      results =
        results.filter(
          (place) =>
            normalizeSearchText(
              place.city
            ) === city
        );
    }

    if (detectedCategory) {
      results =
        results.filter(
          (place) =>
            placeMatchesSimpleCategory(
              place,
              detectedCategory.key
            )
        );
    }

    results.sort(
      (a, b) =>
        a.name.localeCompare(
          b.name
        )
    );

    return {
      detectedCity,

      explicitCategory:
        detectedCategory?.key ??
        null,

      targetCategories:
        detectedCategory
          ? [
              detectedCategory.key,
            ]
          : [],

      intentCategories: [],
      meaningfulTokens: [],
      detectedConcepts: [],

      searchMode:
        detectedCity &&
        detectedCategory
          ? "simple_category_city"
          : detectedCity
            ? "simple_city"
            : "simple_category",

      results,
    };
  }

  return {
    detectedCity: null,
    explicitCategory: null,
    targetCategories: [],
    intentCategories: [],
    meaningfulTokens:
      queryWords(
        simpleNameQuery(
          query
        )
      ),
    detectedConcepts: [],
    searchMode:
      "simple_name",
    results:
      simpleNameResults(
        query,
        places
      ),
  };
}


export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const query = String(body?.query ?? "").trim();
    const requestedLocale = String(body?.locale ?? defaultLocale).trim().toLowerCase();

    if (!query) {
      return NextResponse.json({ ok: false, error: "missing_query" }, { status: 400, headers: HEADERS });
    }

    const locale = (locales as readonly string[]).includes(requestedLocale) ? requestedLocale : defaultLocale;
    const places = await readPlaces(locale);
    const local =
      simpleStructuredSearch(
        query,
        places
      );

    return NextResponse.json({
      ok: true,
      mode: "simple_name_city_category",
      engineVersion: "search-simple-v1",
      query,
      detectedCity: local.detectedCity,
      explicitCategory: local.explicitCategory,
      targetCategories: local.targetCategories,
      intentCategories: local.intentCategories,
      meaningfulTokens: local.meaningfulTokens,
      detectedConcepts: local.detectedConcepts,
      searchMode: local.searchMode,
      resultsCount: local.results.length,
      results: local.results,
    }, { headers: HEADERS });
  } catch (err) {
    console.error("[/api/v1/ai/search] POST error", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500, headers: HEADERS });
  }
}
