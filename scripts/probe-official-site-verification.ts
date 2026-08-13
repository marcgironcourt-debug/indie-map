import fs from "node:fs";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config({ path: ".env.local" });

const MODEL = "gpt-5.4-nano";

type Place = {
  id: string;
  name: string;
  city?: string;
  website?: string;
  [key: string]: unknown;
};

const places = JSON.parse(
  fs.readFileSync("data/places.json", "utf8")
) as Place[];

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const parisDate = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const TESTS = [
  {
    placeName: "La Recyclerie",
    question:
      "Le site officiel indique-t-il explicitement que le lieu est accessible aux personnes en fauteuil roulant ou PMR ?",
  },
  {
    placeName: "Le Pavillon des Canaux",
    question:
      "Quels sont les horaires officiels du dimanche ? Le lieu est-il ouvert le dimanche matin avant midi ?",
  },
  {
    placeName: "Le Hasard Ludique",
    question:
      `Le site officiel annonce-t-il un concert ou un événement musical le ${parisDate} ?`,
  },
  {
    placeName: "La Main Verte Gobelins",
    question:
      "Le site officiel indique-t-il explicitement que ce lieu est un bar à vin naturel ou qu'il sert/vend des vins naturels ?",
  },
];

function findPlace(name: string) {
  return places.find(
    (place) =>
      place.name.toLowerCase() ===
      name.toLowerCase()
  );
}

function normalizeUrl(value: string) {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `https://${value}`;
}

function domainFromWebsite(value: string) {
  const url = new URL(normalizeUrl(value));

  return url.hostname.replace(/^www\./i, "");
}

function collectSources(response: any) {
  const urls = new Set<string>();

  for (const item of response.output || []) {
    if (item.type === "web_search_call") {
      for (const source of item.action?.sources || []) {
        if (source?.url) {
          urls.add(source.url);
        }
      }
    }

    if (item.type === "message") {
      for (const content of item.content || []) {
        for (const annotation of content.annotations || []) {
          if (
            annotation.type === "url_citation" &&
            annotation.url
          ) {
            urls.add(annotation.url);
          }
        }
      }
    }
  }

  return [...urls];
}

async function verify(
  place: Place,
  question: string
) {
  if (!place.website) {
    return {
      text: "STATUS: NO_WEBSITE\nAucune URL officielle enregistrée dans Indie Map.",
      sources: [],
      webCalls: 0,
      usage: null,
    };
  }

  const domain = domainFromWebsite(place.website);

  const response = await openai.responses.create({
    model: MODEL,

    reasoning: {
      effort: "low",
    },

    store: false,

    tools: [
      {
        type: "web_search",
        filters: {
          allowed_domains: [domain],
        },
      },
    ],

    tool_choice: "required",

    include: [
      "web_search_call.action.sources",
    ],

    input: `
Tu vérifies une information factuelle concernant un lieu Indie Map.

LIEU :
${place.name}

VILLE :
${place.city || "inconnue"}

SITE OFFICIEL AUTORISÉ :
${place.website}

QUESTION À VÉRIFIER :
${question}

RÈGLES ABSOLUES :

- Utilise uniquement le domaine officiel autorisé.
- N'utilise aucune connaissance préalable.
- N'infère jamais une caractéristique parce que le lieu
  "semble probablement" l'avoir.
- Une information n'est CONFIRMED que si le site officiel
  apporte une preuve suffisamment explicite.
- Si le site dit explicitement le contraire : CONTRADICTED.
- Si tu ne trouves pas de preuve suffisante : NOT_FOUND.
- Pour un horaire ou un événement, privilégie l'information
  correspondant à la date actuelle ou demandée.
- Ne transforme jamais une programmation habituelle en
  événement confirmé pour une date précise.
- Cite précisément ce que le site permet d'établir.
- Ne prétends jamais avoir vérifié quelque chose qui n'est
  pas dans les pages consultées.

Réponds avec cette structure :

STATUS: CONFIRMED | CONTRADICTED | NOT_FOUND
FACT: une phrase courte
EVIDENCE: ce que le site officiel permet réellement d'établir
SOURCE: URL officielle utilisée ou "aucune"
    `.trim(),
  });

  const webCalls =
    (response.output as any[]).filter(
      (item) =>
        item.type === "web_search_call"
    ).length;

  return {
    text: response.output_text,
    sources: collectSources(response),
    webCalls,
    usage: response.usage,
  };
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY absente");
  }

  let totalWebCalls = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  console.log(
    "=== VÉRIFICATION SITES OFFICIELS ==="
  );
  console.log(
    "DATE PARIS :",
    parisDate
  );

  for (const test of TESTS) {
    console.log("");
    console.log(
      "=================================================="
    );

    const place =
      findPlace(test.placeName);

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
      "SITE :",
      place.website || "—"
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
    console.log(result.text);

    console.log("");
    console.log("SOURCES CONSULTÉES :");

    if (result.sources.length === 0) {
      console.log(" —");
    } else {
      for (const source of result.sources) {
        console.log(" -", source);
      }
    }

    totalWebCalls +=
      result.webCalls;

    inputTokens +=
      result.usage?.input_tokens || 0;

    outputTokens +=
      result.usage?.output_tokens || 0;
  }

  console.log("");
  console.log(
    "=================================================="
  );
  console.log("=== USAGE ===");
  console.log(
    "WEB SEARCH CALLS :",
    totalWebCalls
  );
  console.log(
    "INPUT TOKENS :",
    inputTokens
  );
  console.log(
    "OUTPUT TOKENS :",
    outputTokens
  );
}

main().catch((error: any) => {
  console.error("");
  console.error(
    "ERREUR VÉRIFICATION :"
  );
  console.error(
    error?.status || ""
  );
  console.error(
    error?.message || error
  );
  process.exit(1);
});
