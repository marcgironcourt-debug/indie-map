import fs from "node:fs";
import dotenv from "dotenv";
import OpenAI from "openai";
import * as cheerio from "cheerio";

dotenv.config({ path: ".env.local" });

const MODEL = "gpt-5-nano";
const EMBEDDING_MODEL = "text-embedding-3-small";

const MAX_DISCOVERED_URLS = 160;
const MAX_SELECTED_PAGES = 6;
const MAX_PAGE_TEXT = 8000;

type Place = {
  id: string;
  name: string;
  city?: string;
  website?: string;
};

type Page = {
  url: string;
  title: string;
  text: string;
};

type CandidateUrl = {
  url: string;
  label: string;
};

const places = JSON.parse(
  fs.readFileSync("data/places.json", "utf8")
) as Place[];

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const TESTS = [
  {
    placeName: "La Recyclerie",
    question:
      "Le lieu est-il explicitement accessible aux personnes en fauteuil roulant ou PMR ?",
  },
  {
    placeName: "Le Pavillon des Canaux",
    question:
      "Quels sont les horaires officiels du dimanche et le lieu est-il ouvert avant midi ?",
  },
  {
    placeName: "Le Hasard Ludique",
    question:
      "Y a-t-il explicitement un concert ou événement musical annoncé le 12 août 2026 ?",
  },
  {
    placeName: "La Main Verte Gobelins",
    question:
      "Le lieu est-il explicitement un bar à vin naturel ou vend-il/sert-il explicitement des vins naturels ?",
  },
];

let embeddingTokens = 0;
let llmInputTokens = 0;
let llmOutputTokens = 0;
let httpRequests = 0;

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeWebsite(value: string) {
  return /^https?:\/\//i.test(value)
    ? value
    : `https://${value}`;
}

function rootDomain(url: URL) {
  return url.hostname
    .toLowerCase()
    .replace(/^www\./, "");
}

function sameDomain(a: URL, b: URL) {
  const da = rootDomain(a);
  const db = rootDomain(b);

  return da === db;
}

function cosine(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }

  if (!na || !nb) return 0;

  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function fetchRaw(url: string) {
  httpRequests += 1;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "IndieMap/0.1 (+https://www.indie-map.com)",
      Accept:
        "text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,*/*;q=0.5",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText}`
    );
  }

  return {
    url: response.url,
    contentType:
      response.headers.get("content-type") || "",
    body: await response.text(),
  };
}

function pageFromHtml(
  url: string,
  html: string
): {
  page: Page;
  links: CandidateUrl[];
} {
  const $ = cheerio.load(html);

  $("script,style,noscript,svg,canvas,template").remove();

  const title =
    $("title").first().text().replace(/\s+/g, " ").trim();

  const text = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PAGE_TEXT);

  const base = new URL(url);
  const links = new Map<string, CandidateUrl>();

  $("a[href]").each((_, element) => {
    const href =
      $(element).attr("href")?.trim();

    if (!href) return;

    try {
      const target =
        new URL(href, base);

      if (
        !["http:", "https:"].includes(
          target.protocol
        )
      ) {
        return;
      }

      if (!sameDomain(base, target)) {
        return;
      }

      target.hash = "";

      const lower =
        target.pathname.toLowerCase();

      if (
        /\.(jpg|jpeg|png|gif|webp|svg|zip|mp3|mp4|mov|avi|css|js|woff2?)$/i.test(
          lower
        )
      ) {
        return;
      }

      const clean =
        target.toString();

      if (!links.has(clean)) {
        links.set(clean, {
          url: clean,
          label:
            $(element)
              .text()
              .replace(/\s+/g, " ")
              .trim() ||
            target.pathname,
        });
      }
    } catch {}
  });

  return {
    page: {
      url,
      title,
      text,
    },
    links: [...links.values()],
  };
}

function sitemapUrls(
  xml: string,
  root: URL
) {
  const found =
    [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
      .map((match) => match[1].trim());

  const result: CandidateUrl[] = [];

  for (const value of found) {
    try {
      const url =
        new URL(value);

      if (
        sameDomain(root, url) &&
        !url.pathname.endsWith(".xml")
      ) {
        result.push({
          url: url.toString(),
          label: url.pathname,
        });
      }
    } catch {}
  }

  return result;
}

async function discover(
  website: string
) {
  const start =
    new URL(
      normalizeWebsite(website)
    );

  const candidates =
    new Map<string, CandidateUrl>();

  let homePage: Page | null = null;

  try {
    const raw =
      await fetchRaw(start.toString());

    const parsed =
      pageFromHtml(
        raw.url,
        raw.body
      );

    homePage =
      parsed.page;

    for (const link of parsed.links) {
      candidates.set(
        link.url,
        link
      );
    }
  } catch (error: any) {
    console.log(
      "HOME FETCH ERROR:",
      error?.message || error
    );
  }

  const sitemapCandidates = [
    new URL("/sitemap.xml", start).toString(),
    new URL("/wp-sitemap.xml", start).toString(),
  ];

  for (const sitemap of sitemapCandidates) {
    try {
      const raw =
        await fetchRaw(sitemap);

      for (
        const item of sitemapUrls(
          raw.body,
          start
        )
      ) {
        candidates.set(
          item.url,
          item
        );
      }
    } catch {
      // Sitemap absent : normal.
    }
  }

  return {
    start,
    homePage,
    candidates:
      [...candidates.values()]
        .slice(
          0,
          MAX_DISCOVERED_URLS
        ),
  };
}

async function selectRelevantUrls(
  question: string,
  candidates: CandidateUrl[]
) {
  if (candidates.length === 0) {
    return [];
  }

  const descriptors =
    candidates.map(
      (item) =>
        `${item.label} | ${item.url}`
    );

  const response =
    await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: [
        question,
        ...descriptors,
      ],
    });

  embeddingTokens +=
    response.usage?.total_tokens || 0;

  const vectors =
    [...response.data]
      .sort(
        (a, b) =>
          a.index - b.index
      )
      .map(
        (item) =>
          item.embedding
      );

  const queryVector =
    vectors[0];

  return candidates
    .map((candidate, index) => ({
      candidate,
      score: cosine(
        queryVector,
        vectors[index + 1]
      ),
    }))
    .sort(
      (a, b) =>
        b.score - a.score
    )
    .slice(
      0,
      MAX_SELECTED_PAGES
    );
}

async function loadPages(
  selected: Array<{
    candidate: CandidateUrl;
    score: number;
  }>,
  homePage: Page | null
) {
  const pages =
    new Map<string, Page>();

  if (homePage) {
    pages.set(
      homePage.url,
      homePage
    );
  }

  for (const item of selected) {
    if (
      pages.has(
        item.candidate.url
      )
    ) {
      continue;
    }

    try {
      const raw =
        await fetchRaw(
          item.candidate.url
        );

      if (
        !raw.contentType.includes("html")
      ) {
        continue;
      }

      const parsed =
        pageFromHtml(
          raw.url,
          raw.body
        );

      if (parsed.page.text.length > 50) {
        pages.set(
          parsed.page.url,
          parsed.page
        );
      }
    } catch (error: any) {
      console.log(
        "PAGE FETCH ERROR:",
        item.candidate.url,
        error?.message || error
      );
    }
  }

  return [...pages.values()];
}

function evidenceExists(
  evidenceText: string,
  sourceUrl: string,
  pages: Page[]
) {
  const page =
    pages.find(
      (item) =>
        item.url === sourceUrl
    );

  if (!page) return false;

  const evidence =
    normalize(evidenceText);

  if (evidence.length < 5) {
    return false;
  }

  return normalize(
    page.text
  ).includes(evidence);
}

async function verify(
  place: Place,
  question: string
) {
  if (!place.website) {
    return {
      status: "NOT_FOUND",
      answer: "Aucun site officiel enregistré.",
      evidence: [],
      missingInfo: ["website"],
      pages: [],
      selected: [],
    };
  }

  const discovered =
    await discover(place.website);

  const selected =
    await selectRelevantUrls(
      question,
      discovered.candidates
    );

  const pages =
    await loadPages(
      selected,
      discovered.homePage
    );

  if (pages.length === 0) {
    return {
      status: "NOT_FOUND",
      answer:
        "Le site officiel n'a pas pu être lu directement.",
      evidence: [],
      missingInfo: [
        "contenu du site officiel",
      ],
      pages: [],
      selected,
    };
  }

  const allowedUrls =
    pages.map((page) => page.url);

  const documents =
    pages
      .map(
        (page, index) =>
          `
PAGE ${index + 1}
URL: ${page.url}
TITLE: ${page.title}

CONTENT:
${page.text}
          `.trim()
      )
      .join(
        "\n\n--------------------\n\n"
      );

  /*
   * ÉTAPE 1 :
   * Le modèle EXtrait uniquement les preuves.
   * Il n'a pas le droit de répondre à la question.
   */
  const extractionResponse =
    await openai.responses.create({
      model: MODEL,

      reasoning: {
        effort: "minimal",
      },

      store: false,

      input: [
        {
          role: "system",
          content: `
Tu es un extracteur de preuves pour Indie Map.

Tu reçois des pages directement téléchargées
depuis le site officiel d'un lieu.

Tu dois uniquement rechercher les passages
factuels utiles pour répondre à la question.

RÈGLES ABSOLUES :

- Ne réponds PAS à la question.
- Ne conclus rien.
- N'infère rien.
- Chaque evidenceText doit être un COURT EXTRAIT
  EXACT ET CONTIGU de la page source.
- Ne remplace jamais du texte par "...".
- Ne paraphrase jamais une preuve.
- Maximum environ 220 caractères par extrait.
- Si aucune information utile n'apparaît,
  retourne evidence=[].
          `.trim(),
        },
        {
          role: "user",
          content: JSON.stringify({
            place: {
              name: place.name,
              city: place.city || "",
              website: place.website,
            },
            question,
            pages: documents,
          }),
        },
      ],

      text: {
        format: {
          type: "json_schema",
          name: "official_site_evidence",
          strict: true,
          schema: {
            type: "object",
            properties: {
              evidence: {
                type: "array",
                maxItems: 8,
                items: {
                  type: "object",
                  properties: {
                    sourceUrl: {
                      type: "string",
                      enum: allowedUrls,
                    },
                    evidenceText: {
                      type: "string",
                      maxLength: 260,
                    },
                  },
                  required: [
                    "sourceUrl",
                    "evidenceText",
                  ],
                  additionalProperties: false,
                },
              },
              missingInfo: {
                type: "array",
                items: {
                  type: "string",
                },
              },
            },
            required: [
              "evidence",
              "missingInfo",
            ],
            additionalProperties: false,
          },
        },
      },
    });

  llmInputTokens +=
    extractionResponse.usage?.input_tokens || 0;

  llmOutputTokens +=
    extractionResponse.usage?.output_tokens || 0;

  if (!extractionResponse.output_text) {
    throw new Error(
      "Réponse d'extraction vide"
    );
  }

  const extracted =
    JSON.parse(
      extractionResponse.output_text
    );

  /*
   * Validation indépendante :
   * chaque citation doit réellement apparaître
   * dans la page téléchargée.
   */
  const checkedEvidence =
    extracted.evidence.map(
      (item: any) => ({
        ...item,
        actuallyFound:
          evidenceExists(
            item.evidenceText,
            item.sourceUrl,
            pages
          ),
      })
    );

  const verifiedEvidence =
    checkedEvidence.filter(
      (item: any) =>
        item.actuallyFound
    );

  if (verifiedEvidence.length === 0) {
    return {
      status: "NOT_FOUND",
      answer:
        "Aucune preuve factuelle suffisante n'a été trouvée sur les pages officielles consultées.",
      evidence: checkedEvidence,
      missingInfo:
        extracted.missingInfo.length
          ? extracted.missingInfo
          : [
              "preuve factuelle explicite",
            ],
      pages:
        pages.map(
          (page) => page.url
        ),
      selected,
    };
  }

  /*
   * ÉTAPE 2 :
   * Un second appel raisonne UNIQUEMENT
   * sur les preuves déjà validées.
   */
  const decisionResponse =
    await openai.responses.create({
      model: MODEL,

      reasoning: {
        effort: "minimal",
      },

      store: false,

      input: [
        {
          role: "system",
          content: `
Tu es le vérificateur factuel final d'Indie Map.

Tu reçois une question et uniquement des preuves
qui ont déjà été vérifiées mot pour mot dans
le site officiel.

Tu dois décider :

CONFIRMED =
les preuves permettent d'affirmer clairement
ce qui est demandé.

CONTRADICTED =
les preuves indiquent explicitement le contraire.

NOT_FOUND =
les preuves ne permettent pas de trancher.

RÈGLES :

- N'utilise aucune connaissance extérieure.
- N'invente aucune information absente.
- Le silence n'est jamais une contradiction.
- Raisonne correctement sur les nombres,
  dates et heures.
- Exemple général :
  11:00 est avant 12:00.
  18:00 est après 17:00.
- Un événement à une date différente
  ne confirme jamais l'événement demandé.
- Explique brièvement la conclusion.
          `.trim(),
        },
        {
          role: "user",
          content: JSON.stringify({
            question,
            evidence:
              verifiedEvidence.map(
                (item: any) => ({
                  sourceUrl:
                    item.sourceUrl,
                  evidenceText:
                    item.evidenceText,
                })
              ),
          }),
        },
      ],

      text: {
        format: {
          type: "json_schema",
          name: "official_site_decision",
          strict: true,
          schema: {
            type: "object",
            properties: {
              status: {
                type: "string",
                enum: [
                  "CONFIRMED",
                  "CONTRADICTED",
                  "NOT_FOUND",
                ],
              },
              answer: {
                type: "string",
              },
              missingInfo: {
                type: "array",
                items: {
                  type: "string",
                },
              },
            },
            required: [
              "status",
              "answer",
              "missingInfo",
            ],
            additionalProperties: false,
          },
        },
      },
    });

  llmInputTokens +=
    decisionResponse.usage?.input_tokens || 0;

  llmOutputTokens +=
    decisionResponse.usage?.output_tokens || 0;

  if (!decisionResponse.output_text) {
    throw new Error(
      "Réponse de décision vide"
    );
  }

  const decision =
    JSON.parse(
      decisionResponse.output_text
    );

  return {
    status: decision.status,
    answer: decision.answer,
    evidence: checkedEvidence,
    missingInfo:
      decision.missingInfo,
    pages:
      pages.map(
        (page) => page.url
      ),
    selected,
  };
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY absente"
    );
  }

  console.log(
    "=== DIRECT OFFICIAL SITE VERIFIER ==="
  );

  for (const test of TESTS) {
    console.log("");
    console.log(
      "=================================================="
    );

    const place =
      places.find(
        (item) =>
          item.name.toLowerCase() ===
          test.placeName.toLowerCase()
      );

    if (!place) {
      console.log(
        "LIEU INTROUVABLE :",
        test.placeName
      );
      continue;
    }

    console.log(
      "LIEU :",
      place.name
    );

    console.log(
      "QUESTION :",
      test.question
    );

    const result =
      await verify(
        place,
        test.question
      );

    console.log("");
    console.log(
      "STATUS :",
      result.status
    );

    console.log(
      "ANSWER :",
      result.answer
    );

    console.log("");
    console.log(
      "PAGES RETENUES :"
    );

    for (
      const item of result.selected
    ) {
      console.log(
        ` - ${item.score.toFixed(4)} ${item.candidate.url}`
      );
    }

    console.log("");
    console.log(
      "PREUVES :"
    );

    if (
      result.evidence.length === 0
    ) {
      console.log(" —");
    } else {
      for (
        const evidence of result.evidence
      ) {
        console.log(
          ` - VERIFIED=${evidence.actuallyFound}`
        );

        console.log(
          `   ${evidence.sourceUrl}`
        );

        console.log(
          `   ${evidence.evidenceText}`
        );
      }
    }

    if (
      result.missingInfo.length
    ) {
      console.log(
        "MANQUANT :",
        result.missingInfo.join(
          " | "
        )
      );
    }
  }

  console.log("");
  console.log(
    "=================================================="
  );
  console.log(
    "=== USAGE ==="
  );
  console.log(
    "HTTP REQUESTS :",
    httpRequests
  );
  console.log(
    "EMBEDDING TOKENS :",
    embeddingTokens
  );
  console.log(
    "LLM INPUT TOKENS :",
    llmInputTokens
  );
  console.log(
    "LLM OUTPUT TOKENS :",
    llmOutputTokens
  );
  console.log(
    "WEB SEARCH CALLS : 0"
  );
}

main().catch((error: any) => {
  console.error("");
  console.error(
    "ERREUR DIRECT VERIFIER :"
  );
  console.error(
    error?.status || ""
  );
  console.error(
    error?.message || error
  );
  process.exit(1);
});
