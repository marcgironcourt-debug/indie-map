import { normalizeContextCategory } from "@/lib/contextSuggestions";

export type SearchPlace = {
  id: string;
  name: string;
  city?: string;
  country?: string;
  address?: string;
  category?: string;
  miniText?: string;
  homeTextNear?: string;
  homeTextFar?: string;
  lat?: number;
  lng?: number;
  panoramaImage?: string;
  website?: string;
  phone?: string;
  openingHours?: string;
  timeZone?: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
  translations?: unknown;
};

type SearchField = {
  text: string;
  weight: number;
};

type SearchConcept = {
  name: string;
  queryAliases: string[];
  contentAliases: string[];
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsPhrase(text: unknown, phrase: unknown) {
  const haystack = ` ${normalizeText(text)} `;
  const needle = ` ${normalizeText(phrase)} `;
  return needle.trim().length > 0 && haystack.includes(needle);
}

function textWords(value: unknown) {
  return normalizeText(value)
    .split(/\s+/)
    .filter(Boolean);
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }

    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length];
}

function fuzzyWordMatch(term: string, candidate: string) {
  const a = normalizeText(term);
  const b = normalizeText(candidate);

  if (a === b) return true;
  if (a.length < 5 || b.length < 5) return false;
  if (a.slice(0, 2) !== b.slice(0, 2)) return false;

  const maxDistance = Math.max(a.length, b.length) >= 8 ? 2 : 1;
  return levenshtein(a, b) <= maxDistance;
}

function termMatchesText(term: string, text: string) {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return { matched: false, fuzzy: false };

  if (containsPhrase(text, normalizedTerm)) {
    return { matched: true, fuzzy: false };
  }

  if (normalizedTerm.includes(" ")) {
    return { matched: false, fuzzy: false };
  }

  const fuzzy = textWords(text).some((word) => fuzzyWordMatch(normalizedTerm, word));
  return { matched: fuzzy, fuzzy };
}

const CATEGORY_ALIASES: Record<string, string[]> = {
  epicerie: [
    "epicerie", "epiceries", "grocery", "groceries",
    "grocer", "magasin bio", "vrac"
  ],
  restaurant: [
    "restaurant", "restaurants", "resto", "restos",
    "eatery"
  ],
  brunch: ["brunch", "brunchs"],
  cafe: [
    "cafe", "cafes", "coffee", "coffees",
    "coffee shop"
  ],
  bar: [
    "bar", "bars", "pub", "pubs",
    "brasserie", "brasseries",
    "wine bar", "taproom"
  ],
  boutique: [
    "boutique", "boutiques", "mode", "shopping",
    "shop", "shops", "store"
  ],
  librairie: [
    "librairie", "librairies", "bookstore", "bookstores",
    "bookshop", "bookshops", "livre", "livres",
    "bouquin", "bouquins"
  ],
  boulangerie: [
    "boulangerie", "boulangeries", "bakery", "bakeries",
    "patisserie", "patisseries", "pastry"
  ],
  ferme: [
    "ferme", "fermes", "producteur", "producteurs",
    "farm", "farms"
  ],
  marche: [
    "marche", "marches", "market", "markets"
  ],
  atelier: [
    "atelier", "ateliers", "artisan", "artisans",
    "workshop", "workshops"
  ],
  alternatif: [
    "alternatif", "alternative",
    "lieu alternatif", "lieu de vie",
    "tiers lieu", "tiers lieux"
  ],
};

const INTENTS: Array<{ categories: string[]; aliases: string[] }> = [
  {
    categories: ["bar"],
    aliases: [
      "boire un verre",
      "prendre un verre",
      "boire un coup",
      "prendre un coup",
      "boire quelque chose",
      "prendre un verre entre amis",
      "sortir boire",
      "aller boire",
      "prendre l apero",
      "faire l apero",
      "aperitif",
      "apero",
      "biere",
      "beer",
      "drink",
      "cocktail",
      "vin",
      "wine"
    ],
  },
  {
    categories: ["epicerie", "marche", "ferme"],
    aliases: [
      "faire les courses",
      "faire mes courses",
      "acheter a manger",
      "acheter des produits",
      "acheter local",
      "acheter des produits locaux",
      "ingredients",
      "ingredient",
      "repas maison",
      "cuisiner",
      "produits locaux",
      "local food",
      "organic food",
      "grocery",
      "faire le marche"
    ],
  },
  {
    categories: ["restaurant", "brunch", "cafe"],
    aliases: [
      "manger",
      "dejeuner",
      "diner",
      "souper",
      "bon repas",
      "prendre un repas",
      "aller manger",
      "ou manger",
      "manger quelque chose",
      "grignoter",
      "casser la croute",
      "prendre un truc a manger",
      "manger sur le pouce",
      "sur le pouce",
      "snack",
      "lunch",
      "dinner",
      "eat",
      "food",
      "quick bite",
      "grab a bite"
    ],
  },
  {
    categories: ["cafe"],
    aliases: [
      "boire un cafe",
      "prendre un cafe",
      "pause cafe",
      "prendre un the",
      "boire un the",
      "gouter",
      "coffee",
      "travailler",
      "travailler sur mon ordinateur",
      "travailler avec mon ordinateur",
      "bosser",
      "work",
      "lire",
      "read"
    ],
  },
  {
    categories: ["boutique", "librairie"],
    aliases: [
      "cadeau",
      "cadeaux",
      "acheter un cadeau",
      "trouver un cadeau",
      "gift",
      "gifts",
      "pour ma niece",
      "pour mon neveu",
      "pour un enfant",
      "objet",
      "objets",
      "souvenir",
      "decoration",
      "deco"
    ],
  },
  {
    categories: ["boulangerie"],
    aliases: [
      "acheter du pain",
      "pain",
      "viennoiserie",
      "croissant",
      "baguette",
      "bread"
    ],
  },
  {
    categories: ["alternatif", "atelier"],
    aliases: [
      "expo",
      "exposition",
      "voir une expo",
      "art",
      "culture",
      "galerie",
      "gallery",
      "activite culturelle"
    ],
  },
  {
    categories: ["atelier"],
    aliases: [
      "reparer",
      "faire reparer",
      "apprendre a reparer",
      "bricoler",
      "faire un atelier",
      "participer a un atelier",
      "prendre un cours",
      "workshop"
    ],
  },
];

const CONCEPTS: SearchConcept[] = [
  {
    name: "rooftop",
    queryAliases: ["rooftop", "roof top", "sur un toit", "toit terrasse"],
    contentAliases: ["rooftop", "roof top", "toit terrasse", "sur le toit"]
  },
  {
    name: "terrace",
    queryAliases: [
      "terrasse", "en terrasse", "avec terrasse",
      "terrace", "outdoor seating", "dehors"
    ],
    contentAliases: [
      "terrasse", "terrace", "outdoor",
      "cour", "jardin", "patio"
    ]
  },
  {
    name: "garden",
    queryAliases: [
      "jardin", "avec un jardin", "dans un jardin",
      "garden"
    ],
    contentAliases: [
      "jardin", "garden", "potager", "cour vegetale"
    ]
  },
  {
    name: "vegetarian",
    queryAliases: [
      "vegetarien", "vegetarienne",
      "vegetarian", "sans viande"
    ],
    contentAliases: [
      "vegetarien", "vegetarienne",
      "vegetarian", "sans viande",
      "option vegetarienne", "options vegetariennes"
    ]
  },
  {
    name: "vegan",
    queryAliases: [
      "vegan", "vegetalien", "vegetalienne",
      "100 vegan"
    ],
    contentAliases: [
      "vegan", "vegetalien", "vegetalienne",
      "100 vegan"
    ]
  },
  {
    name: "gluten_free",
    queryAliases: [
      "sans gluten", "gluten free"
    ],
    contentAliases: [
      "sans gluten", "gluten free"
    ]
  },
  {
    name: "organic",
    queryAliases: [
      "bio", "biologique", "organic",
      "produits bio"
    ],
    contentAliases: [
      "bio", "biologique", "organic",
      "agriculture biologique"
    ]
  },
  {
    name: "local_products",
    queryAliases: [
      "produits locaux",
      "produit local",
      "producteurs locaux",
      "producteur local",
      "local products",
      "local produce"
    ],
    contentAliases: [
      "produits locaux",
      "producteurs locaux",
      "producteur local",
      "local products",
      "production locale",
      "sourcing local",
      "du territoire"
    ]
  },
  {
    name: "seasonal",
    queryAliases: [
      "de saison",
      "produits de saison",
      "saisonnier",
      "seasonal"
    ],
    contentAliases: [
      "de saison",
      "produits de saison",
      "saisonnier",
      "seasonal"
    ]
  },
  {
    name: "short_supply",
    queryAliases: [
      "circuit court",
      "circuits courts",
      "short supply chain"
    ],
    contentAliases: [
      "circuit court",
      "circuits courts",
      "approvisionnement court"
    ]
  },
  {
    name: "direct_producer",
    queryAliases: [
      "direct producteur",
      "direct producteurs",
      "vente directe",
      "acheter au producteur",
      "chez le producteur"
    ],
    contentAliases: [
      "vente directe",
      "direct producteur",
      "directement auprès",
      "directement aupres",
      "aupres de producteurs",
      "auprès de producteurs"
    ]
  },
  {
    name: "zero_waste",
    queryAliases: [
      "zero dechet",
      "zéro déchet",
      "anti gaspi",
      "anti-gaspi",
      "antigaspi",
      "anti gaspillage"
    ],
    contentAliases: [
      "zero dechet",
      "zéro déchet",
      "anti gaspi",
      "anti-gaspi",
      "antigaspi",
      "gaspillage"
    ]
  },
  {
    name: "bulk",
    queryAliases: [
      "vrac",
      "en vrac",
      "bulk"
    ],
    contentAliases: [
      "vrac", "bulk"
    ]
  },
  {
    name: "inclusive",
    queryAliases: [
      "inclusif",
      "inclusive",
      "restaurant inclusif",
      "lieu inclusif",
      "insertion"
    ],
    contentAliases: [
      "inclusif",
      "inclusive",
      "insertion",
      "handicap",
      "situation de handicap"
    ]
  },
  {
    name: "homemade",
    queryAliases: [
      "fait maison",
      "fait-maison",
      "cuisine maison",
      "homemade"
    ],
    contentAliases: [
      "fait maison",
      "fait-maison",
      "maison",
      "homemade"
    ]
  },
  {
    name: "sustainable",
    queryAliases: [
      "responsable",
      "durable",
      "ecoresponsable",
      "eco responsable",
      "sustainable"
    ],
    contentAliases: [
      "responsable",
      "durable",
      "ecoresponsable",
      "eco responsable",
      "sustainable",
      "engage",
      "engagée",
      "engagee"
    ]
  },
  {
    name: "ethical_fashion",
    queryAliases: [
      "mode ethique",
      "mode responsable",
      "vetements responsables",
      "vetement responsable",
      "ethical fashion"
    ],
    contentAliases: [
      "mode ethique",
      "mode responsable",
      "responsable",
      "fabrication francaise",
      "made in france",
      "durable"
    ]
  },
  {
    name: "second_hand",
    queryAliases: [
      "seconde main",
      "seconde-main",
      "occasion",
      "friperie",
      "vintage",
      "second hand"
    ],
    contentAliases: [
      "seconde main",
      "seconde-main",
      "occasion",
      "friperie",
      "vintage",
      "reemploi",
      "réemploi"
    ]
  },
  {
    name: "craft",
    queryAliases: [
      "artisanal",
      "artisanale",
      "artisanat",
      "fait par des artisans",
      "handmade"
    ],
    contentAliases: [
      "artisanal",
      "artisanale",
      "artisanat",
      "artisan",
      "artisans",
      "fait main",
      "handmade"
    ]
  },
  {
    name: "independent",
    queryAliases: [
      "independant",
      "independante",
      "independent",
      "createurs independants",
      "créateurs indépendants"
    ],
    contentAliases: [
      "independant",
      "independante",
      "independent",
      "createurs independants",
      "créateurs indépendants"
    ]
  },
  {
    name: "breakfast",
    queryAliases: [
      "petit dejeuner",
      "petit-dejeuner",
      "petit dej",
      "breakfast"
    ],
    contentAliases: [
      "petit dejeuner",
      "petit-dejeuner",
      "petit dej",
      "breakfast"
    ]
  },
  {
    name: "quick_food",
    queryAliases: [
      "sur le pouce",
      "manger vite",
      "repas rapide",
      "snack",
      "quick bite",
      "grab a bite",
      "a emporter",
      "à emporter",
      "takeaway"
    ],
    contentAliases: [
      "sur le pouce",
      "snack",
      "sandwich",
      "a emporter",
      "à emporter",
      "takeaway",
      "street food",
      "cantine",
      "comptoir"
    ]
  },
  {
    name: "family",
    queryAliases: [
      "en famille",
      "avec des enfants",
      "avec mes enfants",
      "pour les enfants",
      "family friendly",
      "kids"
    ],
    contentAliases: [
      "famille",
      "familial",
      "enfant",
      "enfants",
      "kids",
      "family"
    ]
  },
  {
    name: "work_friendly",
    queryAliases: [
      "pour travailler",
      "ou travailler",
      "où travailler",
      "avec mon ordinateur",
      "avec mon laptop",
      "coworking",
      "wifi"
    ],
    contentAliases: [
      "coworking",
      "espace de travail",
      "travailler",
      "travail",
      "wifi",
      "ordinateur",
      "laptop"
    ]
  },
  {
    name: "quiet",
    queryAliases: [
      "calme",
      "tranquille",
      "paisible",
      "quiet"
    ],
    contentAliases: [
      "calme",
      "tranquille",
      "paisible",
      "quiet",
      "intimiste"
    ]
  },
  {
    name: "cozy",
    queryAliases: [
      "cosy",
      "cozy",
      "chaleureux",
      "intimiste",
      "convivial"
    ],
    contentAliases: [
      "cosy",
      "cozy",
      "chaleureux",
      "intimiste",
      "convivial",
      "accueillant"
    ]
  },
  {
    name: "festive",
    queryAliases: [
      "festif",
      "festive",
      "pour faire la fete",
      "pour faire la fête",
      "ambiance festive"
    ],
    contentAliases: [
      "festif",
      "festive",
      "fete",
      "fête",
      "dj",
      "concert",
      "musique"
    ]
  },
  {
    name: "romantic",
    queryAliases: [
      "romantique",
      "pour un date",
      "pour un rendez vous",
      "en amoureux",
      "romantic"
    ],
    contentAliases: [
      "romantique",
      "romantic",
      "intimiste",
      "chaleureux",
      "feutre",
      "feutrée",
      "feutree"
    ]
  },
  {
    name: "live_music",
    queryAliases: [
      "concert",
      "musique live",
      "musique en live",
      "live music"
    ],
    contentAliases: [
      "concert",
      "musique live",
      "live music",
      "programmation musicale"
    ]
  },
  {
    name: "wine",
    queryAliases: [
      "vin",
      "vins",
      "vin naturel",
      "vins naturels",
      "vin nature",
      "wine"
    ],
    contentAliases: [
      "vin",
      "vins",
      "vin naturel",
      "vins naturels",
      "wine",
      "cave"
    ]
  },
  {
    name: "beer",
    queryAliases: [
      "biere",
      "bieres",
      "biere artisanale",
      "bieres artisanales",
      "craft beer"
    ],
    contentAliases: [
      "biere",
      "bieres",
      "brasserie",
      "microbrasserie",
      "craft beer"
    ]
  },
  {
    name: "cocktail",
    queryAliases: [
      "cocktail",
      "cocktails",
      "bar a cocktails"
    ],
    contentAliases: [
      "cocktail",
      "cocktails"
    ]
  },
  {
    name: "creperie",
    queryAliases: [
      "creperie",
      "crêperie",
      "crepe",
      "crêpe",
      "galette",
      "galette bretonne"
    ],
    contentAliases: [
      "creperie",
      "crêperie",
      "crepe",
      "crêpe",
      "galette",
      "ble noir",
      "blé noir"
    ]
  },
  {
    name: "pastry",
    queryAliases: [
      "patisserie",
      "pâtisserie",
      "gateau",
      "gâteau",
      "dessert",
      "viennoiserie",
      "pastry"
    ],
    contentAliases: [
      "patisserie",
      "pâtisserie",
      "gateau",
      "gâteau",
      "dessert",
      "viennoiserie",
      "pastry"
    ]
  },
  {
    name: "repair",
    queryAliases: [
      "reparation",
      "réparation",
      "reparer",
      "réparer",
      "repair",
      "repair cafe"
    ],
    contentAliases: [
      "reparation",
      "réparation",
      "reparer",
      "réparer",
      "repair",
      "repair cafe"
    ]
  },
  {
    name: "workshop",
    queryAliases: [
      "atelier pratique",
      "faire un atelier",
      "cours",
      "stage",
      "initiation",
      "workshop"
    ],
    contentAliases: [
      "atelier",
      "cours",
      "stage",
      "initiation",
      "workshop"
    ]
  },
  {
    name: "art_culture",
    queryAliases: [
      "art contemporain",
      "expo",
      "exposition",
      "galerie",
      "culture",
      "art"
    ],
    contentAliases: [
      "art",
      "expo",
      "exposition",
      "galerie",
      "culture",
      "artistique"
    ]
  },
  {
    name: "brittany",
    queryAliases: [
      "bretagne",
      "breizh",
      "breton",
      "bretonne",
      "bretons",
      "bretonnes"
    ],
    contentAliases: [
      "bretagne",
      "breizh",
      "breton",
      "bretonne",
      "bretons",
      "bretonnes"
    ]
  },
];

const TOKEN_EQUIVALENTS: Record<string, string[]> = {
  breizh: ["breizh", "bretagne", "breton", "bretonne", "bretons", "bretonnes"],
  bretagne: ["bretagne", "breizh", "breton", "bretonne", "bretons", "bretonnes"],
  breton: ["breton", "bretonne", "bretagne", "breizh"],
  bretonne: ["bretonne", "breton", "bretagne", "breizh"],
};

const STOP_WORDS = new Set([
  "je", "j", "me", "mes", "moi", "tu", "te",
  "le", "la", "les", "un", "une", "des", "de", "du", "d",
  "a", "au", "aux", "en", "sur", "pour", "dans", "avec",
  "vers", "pres", "près", "autour",
  "trouve", "trouver", "montre", "montrez", "voir",
  "veux", "veut", "voudrais", "besoin", "cherche", "chercher",
  "peux", "peut", "aller", "faire", "bientot", "quelques", "jours",
  "place", "lieu", "lieux", "ville", "city",
  "near", "nearby", "around", "show", "find", "for", "where",
  "need", "want", "in", "at", "the", "this", "tonight",
  "ce", "soir",
]);

function getPlaceSearchCategories(place: SearchPlace) {
  const category = place.category;
  const text = [
    place.category,
    place.miniText,
    place.homeTextNear,
    place.homeTextFar,
    place.name,
    ...(Array.isArray(place.tags) ? place.tags : []),
  ]
    .filter(Boolean)
    .join(" ");

  const normalized = normalizeContextCategory(category);
  const categories = new Set<string>();

  if (normalized) categories.add(normalized);

  const aliases: Array<[string, string[]]> = [
    ["cafe", [
      "cafe", "coffee", "espresso", "cappuccino",
      "latte", "coffee shop"
    ]],
    ["brunch", ["brunch"]],
    ["bar", [
      "bar", "pub", "brasserie", "biere",
      "microbrasserie", "cocktail", "aperitif",
      "apero", "buvette", "vin", "wine bar",
      "taproom"
    ]],
    ["epicerie", [
      "epicerie", "grocery", "grocer",
      "magasin bio", "vrac"
    ]],
    ["restaurant", [
      "restaurant", "resto", "gastronomie",
      "eatery"
    ]],
    ["boutique", [
      "boutique", "mode", "shop",
      "friperie", "concept store"
    ]],
    ["librairie", [
      "librairie", "bookstore", "bookshop",
      "bouquinerie"
    ]],
    ["boulangerie", [
      "boulangerie", "bakery",
      "patisserie", "viennoiserie"
    ]],
    ["ferme", [
      "ferme", "farm", "producteur",
      "agriculture"
    ]],
    ["marche", ["marche", "market"]],
    ["atelier", [
      "atelier", "workshop",
      "repair cafe", "reparation"
    ]],
    ["alternatif", [
      "alternatif", "alternative",
      "lieu alternatif", "lieu de vie",
      "tiers lieu"
    ]],
  ];

  for (const [target, values] of aliases) {
    if (values.some((value) => containsPhrase(text, value))) {
      categories.add(target);
    }
  }

  return [...categories];
}

function getStrictPlaceCategories(category: string | undefined) {
  const raw = normalizeText(category);
  const normalized = normalizeContextCategory(category);
  const categories = new Set<string>();

  if (normalized) categories.add(normalized);

  if (containsPhrase(raw, "cafe")) categories.add("cafe");
  if (containsPhrase(raw, "brunch")) categories.add("brunch");
  if (
    containsPhrase(raw, "bar") ||
    containsPhrase(raw, "pub") ||
    containsPhrase(raw, "brasserie")
  ) {
    categories.add("bar");
  }
  if (containsPhrase(raw, "mode")) categories.add("boutique");

  return [...categories];
}


const SEARCH_DAY_ALIASES = [
  {
    key: "monday",
    aliases: ["lundi", "monday"],
  },
  {
    key: "tuesday",
    aliases: ["mardi", "tuesday"],
  },
  {
    key: "wednesday",
    aliases: ["mercredi", "wednesday"],
  },
  {
    key: "thursday",
    aliases: ["jeudi", "thursday"],
  },
  {
    key: "friday",
    aliases: ["vendredi", "friday"],
  },
  {
    key: "saturday",
    aliases: ["samedi", "saturday"],
  },
  {
    key: "sunday",
    aliases: ["dimanche", "sunday"],
  },
] as const;

type SearchDayKey =
  (typeof SEARCH_DAY_ALIASES)[number]["key"];

const OPENING_QUERY_WORDS =
  new Set([
    "ouvert",
    "ouverte",
    "ouverts",
    "ouvertes",
    "ouvrir",
    "open",
    "opened",
    "opening",

    ...SEARCH_DAY_ALIASES.flatMap(
      (day) =>
        day.aliases.map(
          normalizeText
        )
    ),
  ]);

function detectRequestedDay(
  query: string
): SearchDayKey | null {
  for (
    const day of
    SEARCH_DAY_ALIASES
  ) {
    if (
      day.aliases.some(
        (alias) =>
          containsPhrase(
            query,
            alias
          )
      )
    ) {
      return day.key;
    }
  }

  return null;
}

function detectRequestedMinutes(
  query: string
) {
  const value =
    String(query ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      );

  /*
   * 18h
   * 18h30
   * 18:30
   */
  let match =
    value.match(
      /\b(\d{1,2})\s*(?:h|:)\s*(\d{0,2})\b/
    );

  /*
   * "à 18" / "at 18"
   */
  if (!match) {
    match =
      value.match(
        /\b(?:a|at)\s+(\d{1,2})\b/
      );
  }

  if (!match) {
    return null;
  }

  const hour =
    Number(match[1]);

  const minute =
    Number(
      match[2] || 0
    );

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
}

function openingHourLineForDay(
  openingHours: string | undefined,
  dayKey: SearchDayKey
) {
  const value =
    String(
      openingHours ?? ""
    ).trim();

  if (!value) {
    return null;
  }

  const day =
    SEARCH_DAY_ALIASES.find(
      (item) =>
        item.key === dayKey
    );

  if (!day) {
    return null;
  }

  return (
    value
      .split(/\n+/)
      .map(
        (line) =>
          line.trim()
      )
      .find(
        (line) =>
          day.aliases.some(
            (alias) =>
              containsPhrase(
                line,
                alias
              )
          )
      ) || null
  );
}

function parseOpeningClock(
  hour: string,
  minute: string
) {
  const h =
    Number(hour);

  const m =
    Number(
      minute || 0
    );

  if (
    !Number.isFinite(h) ||
    !Number.isFinite(m) ||
    h < 0 ||
    h > 24 ||
    m < 0 ||
    m > 59
  ) {
    return null;
  }

  return h * 60 + m;
}

function placeMatchesRequestedOpening(
  place: SearchPlace,
  dayKey: SearchDayKey,
  requestedMinutes: number | null
) {
  const line =
    openingHourLineForDay(
      place.openingHours,
      dayKey
    );

  /*
   * Précision d'abord :
   * absence d'horaire = on ne peut
   * pas prouver que le lieu est ouvert.
   */
  if (!line) {
    return false;
  }

  const normalized =
    normalizeText(line);

  if (
    normalized.includes(
      "ferme"
    ) ||
    normalized.includes(
      "closed"
    )
  ) {
    return false;
  }

  if (
    normalized.includes(
      "24h 24"
    ) ||
    normalized.includes(
      "24 24"
    )
  ) {
    return true;
  }

  const ranges = [
    ...line.matchAll(
      /(\d{1,2})\s*[h:]\s*(\d{0,2})\s*[-–—]\s*(\d{1,2})\s*[h:]\s*(\d{0,2})/gi
    ),
  ];

  /*
   * "ouvert samedi" :
   * une plage horaire explicite suffit.
   */
  if (
    requestedMinutes === null
  ) {
    return ranges.length > 0;
  }

  return ranges.some(
    (range) => {
      const start =
        parseOpeningClock(
          range[1],
          range[2]
        );

      let end =
        parseOpeningClock(
          range[3],
          range[4]
        );

      if (
        start === null ||
        end === null
      ) {
        return false;
      }

      let requested =
        requestedMinutes;

      /*
       * Ex. 18h00-00h00
       * ou 18h00-02h00.
       */
      if (end <= start) {
        end += 24 * 60;

        if (
          requested < start
        ) {
          requested +=
            24 * 60;
        }
      }

      return (
        requested >= start &&
        requested <= end
      );
    }
  );
}

function flattenInternalStrings(
  value: unknown,
  out: string[] = []
) {
  if (
    typeof value ===
    "string"
  ) {
    const text =
      value.trim();

    if (text) {
      out.push(text);
    }

    return out;
  }

  if (
    Array.isArray(value)
  ) {
    for (
      const item of value
    ) {
      flattenInternalStrings(
        item,
        out
      );
    }

    return out;
  }

  if (
    value &&
    typeof value ===
      "object"
  ) {
    for (
      const item of
      Object.values(
        value as Record<
          string,
          unknown
        >
      )
    ) {
      flattenInternalStrings(
        item,
        out
      );
    }
  }

  return out;
}

function searchFields(place: SearchPlace): SearchField[] {
  const translations =
    flattenInternalStrings(
      place.translations
    ).join(" ");

  return [
    { text: normalizeText(place.name), weight: 60 },
    { text: normalizeText(place.address), weight: 46 },
    { text: normalizeText(place.city), weight: 38 },
    { text: normalizeText(place.country), weight: 30 },
    { text: normalizeText(place.category), weight: 32 },

    { text: normalizeText((place.tags || []).join(" ")), weight: 26 },

    { text: normalizeText(place.miniText), weight: 22 },
    { text: normalizeText(place.homeTextNear), weight: 16 },
    { text: normalizeText(place.homeTextFar), weight: 16 },

    /*
     * Ces champs sont également des données Indie Map.
     */
    { text: normalizeText(place.openingHours), weight: 20 },
    { text: normalizeText(place.website), weight: 14 },
    { text: normalizeText(place.phone), weight: 14 },
    { text: normalizeText(translations), weight: 15 },
  ].filter((field) => field.text);
}

function searchableText(place: SearchPlace) {
  return searchFields(place)
    .map((field) => field.text)
    .join(" ");
}

function matchTokenAgainstPlace(token: string, place: SearchPlace) {
  const variants = TOKEN_EQUIVALENTS[token] || [token];

  let bestScore = 0;
  let matched = false;

  for (const variant of variants) {
    for (const field of searchFields(place)) {
      const result = termMatchesText(variant, field.text);
      if (!result.matched) continue;

      matched = true;
      const score = field.weight + (result.fuzzy ? 0 : 10);
      if (score > bestScore) bestScore = score;
    }
  }

  return { matched, score: bestScore };
}

function conceptMatchesPlace(concept: SearchConcept, place: SearchPlace) {
  const text = searchableText(place);
  return concept.contentAliases.some((alias) => containsPhrase(text, alias));
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findLocationAnchors(tokens: string[], places: SearchPlace[]) {
  if (tokens.length === 0) return [];

  return places.filter((place) => {
    if (!Number.isFinite(Number(place.lat)) || !Number.isFinite(Number(place.lng))) {
      return false;
    }

    const locationText = normalizeText([
      place.name,
      place.address,
      place.city,
      place.country,
    ].filter(Boolean).join(" "));

    return tokens.every((token) => {
      const variants = TOKEN_EQUIVALENTS[token] || [token];

      return variants.some((variant) => {
        const result = termMatchesText(variant, locationText);
        return result.matched;
      });
    });
  });
}

export function localSearch(query: string, places: SearchPlace[]) {
  const normalizedQuery = normalizeText(query);

  /*
   * Critères structurés d'ouverture.
   *
   * Ils ne passent jamais par une inférence
   * sémantique : on vérifie directement
   * openingHours.
   */
  const requestedDay =
    detectRequestedDay(query);

  const requestedMinutes =
    detectRequestedMinutes(query);

  const knownCities = [
    ...new Set(
      places
        .map((place) => place.city)
        .filter((value): value is string => Boolean(value))
    ),
  ].sort((a, b) => b.length - a.length);

  const detectedCity =
    knownCities.find((city) => containsPhrase(normalizedQuery, city)) || null;

  const detectedCityTokens = new Set(
    detectedCity ? textWords(detectedCity) : []
  );

  const explicitCategoryEntries = Object.entries(CATEGORY_ALIASES).filter(
    ([, aliases]) => aliases.some((alias) => containsPhrase(normalizedQuery, alias))
  );

  const explicitCategory = explicitCategoryEntries[0]?.[0] || null;

  const recognizedQueryWords = new Set<string>();
  const intentCategories = new Set<string>();

  for (const [, aliases] of explicitCategoryEntries) {
    for (const alias of aliases) {
      if (!containsPhrase(normalizedQuery, alias)) continue;
      for (const word of textWords(alias)) recognizedQueryWords.add(word);
    }
  }

  /*
   * V2.3 INTERNAL PROOF
   *
   * On ne transforme plus une envie en catégorie.
   *
   * Exemples interdits :
   *   "bière"  -> bar
   *   "manger" -> restaurant
   *   "lire"   -> café
   *
   * Les mots de la demande restent donc des contraintes
   * à retrouver réellement dans les données Indie Map.
   */

  const detectedConcepts = CONCEPTS.filter((concept) =>
    concept.queryAliases.some((alias) => containsPhrase(normalizedQuery, alias))
  );

  for (const concept of detectedConcepts) {
    for (const alias of concept.queryAliases) {
      if (!containsPhrase(normalizedQuery, alias)) continue;
      for (const word of textWords(alias)) {
        recognizedQueryWords.add(word);
      }
    }
  }

  const targetCategories = [
    ...new Set([
      ...(explicitCategory ? [explicitCategory] : []),
      ...intentCategories,
    ]),
  ];

  const meaningfulTokens = textWords(normalizedQuery).filter((token) => {
    if (token.length <= 2) return false;
    if (STOP_WORDS.has(token)) return false;

    if (
      OPENING_QUERY_WORDS.has(
        token
      )
    ) {
      return false;
    }

    /*
     * Une heure explicitement reconnue n'est pas
     * ensuite recherchée comme mot dans les descriptions.
     */
    if (
      requestedMinutes !== null &&
      /^\d{1,2}(?:h\d{0,2})?$/.test(
        token
      )
    ) {
      return false;
    }

    if (detectedCityTokens.has(token)) return false;
    if (recognizedQueryWords.has(token)) return false;
    return true;
  });

  const cityPool = detectedCity
    ? places.filter(
        (place) => normalizeText(place.city) === normalizeText(detectedCity)
      )
    : places;

  const baseCategoryPool =
    targetCategories.length > 0
      ? cityPool.filter((place) => {
          if (explicitCategory && intentCategories.size === 0) {
            return getStrictPlaceCategories(place.category).includes(
              explicitCategory
            );
          }

          const placeCategories = getPlaceSearchCategories(place);
          return targetCategories.some((category) =>
            placeCategories.includes(category)
          );
        })
      : cityPool;

  /*
   * Si un jour est demandé, le lieu doit posséder
   * une preuve exploitable dans openingHours.
   *
   * Pas d'horaire = pas de résultat pour une
   * requête demandant explicitement d'être ouvert.
   */
  const categoryPool =
    requestedDay
      ? baseCategoryPool.filter(
          (place) =>
            placeMatchesRequestedOpening(
              place,
              requestedDay,
              requestedMinutes
            )
        )
      : baseCategoryPool;

  const hasFreeConstraints =
    meaningfulTokens.length > 0 || detectedConcepts.length > 0;

  const isUnknownMultiWordEntityQuery =
    !detectedCity &&
    targetCategories.length === 0 &&
    detectedConcepts.length === 0 &&
    meaningfulTokens.length >= 2;

  if (isUnknownMultiWordEntityQuery) {
    const entityResults = places
      .map((place) => {
        const name = normalizeText(place.name);
        const address = normalizeText(place.address);

        const nameMatchesAll = meaningfulTokens.every(
          (token) => termMatchesText(token, name).matched
        );

        const addressMatchesAll = meaningfulTokens.every(
          (token) => termMatchesText(token, address).matched
        );

        if (!nameMatchesAll && !addressMatchesAll) {
          return null;
        }

        let score = 0;

        if (normalizedQuery === name) score += 1000;
        else if (containsPhrase(name, normalizedQuery)) score += 700;
        else if (nameMatchesAll) score += 400;

        if (normalizedQuery === address) score += 900;
        else if (containsPhrase(address, normalizedQuery)) score += 600;
        else if (addressMatchesAll) score += 300;

        return { place, score };
      })
      .filter(
        (entry): entry is { place: SearchPlace; score: number } =>
          entry !== null
      )
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.place.name.localeCompare(b.place.name)
      );

    return {
      detectedCity,
      explicitCategory,
      targetCategories,
      intentCategories: [...intentCategories],
      meaningfulTokens,
      detectedConcepts: [],
      searchMode: "entity_v2",
      results: entityResults.map((entry) => entry.place),
    };
  }

  const shouldReturnFullPool =
    !hasFreeConstraints &&
    (Boolean(detectedCity) || targetCategories.length > 0);

  if (shouldReturnFullPool) {
    return {
      detectedCity,
      explicitCategory,
      targetCategories,
      intentCategories: [...intentCategories],
      meaningfulTokens,
      detectedConcepts: detectedConcepts.map((concept) => concept.name),
      searchMode: "full_pool",
      results: [...categoryPool].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    };
  }

  const scored = categoryPool
    .map((place) => {
      const name = normalizeText(place.name);
      const address = normalizeText(place.address);

      let score = 0;

      if (normalizedQuery === name) score += 600;
      else if (containsPhrase(name, normalizedQuery)) score += 320;

      if (normalizedQuery === address) score += 500;
      else if (containsPhrase(address, normalizedQuery)) score += 240;

      if (
        detectedCity &&
        normalizeText(place.city) === normalizeText(detectedCity)
      ) {
        score += 90;
      }

      if (explicitCategory) {
        const categories = getPlaceSearchCategories(place);
        if (categories.includes(explicitCategory)) score += 80;
      }

      for (const category of intentCategories) {
        const categories = getPlaceSearchCategories(place);
        if (categories.includes(category)) score += 60;
      }

      for (const token of meaningfulTokens) {
        const tokenMatch = matchTokenAgainstPlace(token, place);

        // Une contrainte libre importante ne peut plus être ignorée.
        if (!tokenMatch.matched) {
          return null;
        }

        score += tokenMatch.score;
      }

      for (const concept of detectedConcepts) {
        // Même principe pour une contrainte sémantique reconnue.
        if (!conceptMatchesPlace(concept, place)) {
          return null;
        }

        score += 55;
      }

      return { place, score };
    })
    .filter(
      (entry): entry is { place: SearchPlace; score: number } =>
        entry !== null
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.place.name.localeCompare(b.place.name)
    );

  if (scored.length > 0) {
    return {
      detectedCity,
      explicitCategory,
      targetCategories,
      intentCategories: [...intentCategories],
      meaningfulTokens,
      detectedConcepts: detectedConcepts.map((concept) => concept.name),
      searchMode: "scored_v2",
      results: scored.map((entry) => entry.place),
    };
  }

  /*
   * Fallback géographique :
   * si un terme comme "Coogee" existe dans le nom/adresse d'un lieu mais
   * que ce lieu n'est pas de la catégorie demandée, on utilise ses
   * coordonnées comme ancre et on cherche les lieux demandés à proximité.
   */
  if (targetCategories.length > 0 && meaningfulTokens.length > 0) {
    const anchors = findLocationAnchors(meaningfulTokens, places);

    if (anchors.length > 0) {
      const nearby = categoryPool
        .map((place) => {
          const lat = Number(place.lat);
          const lng = Number(place.lng);

          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

          const minDistance = Math.min(
            ...anchors.map((anchor) =>
              haversineKm(
                Number(anchor.lat),
                Number(anchor.lng),
                lat,
                lng
              )
            )
          );

          if (minDistance > 5) return null;

          return { place, distance: minDistance };
        })
        .filter(
          (
            entry
          ): entry is { place: SearchPlace; distance: number } =>
            entry !== null
        )
        .sort(
          (a, b) =>
            a.distance - b.distance ||
            a.place.name.localeCompare(b.place.name)
        );

      if (nearby.length > 0) {
        return {
          detectedCity,
          explicitCategory,
          targetCategories,
          intentCategories: [...intentCategories],
          meaningfulTokens,
          detectedConcepts: detectedConcepts.map((concept) => concept.name),
          searchMode: "geo_nearby_v2",
          results: nearby.map((entry) => entry.place),
        };
      }
    }
  }

  return {
    detectedCity,
    explicitCategory,
    targetCategories,
    intentCategories: [...intentCategories],
    meaningfulTokens,
    detectedConcepts: detectedConcepts.map((concept) => concept.name),
    searchMode: "scored_v2",
    results: [],
  };
}
