import "dotenv/config";
import fs from "node:fs";
import OpenAI from "openai";

import {
  verifyOfficialSiteFact,
  type OfficialVerifierUsage,
} from "@/lib/ai/officialSiteVerifier";

async function main() {
  const places =
    JSON.parse(
      fs.readFileSync(
        "data/places.json",
        "utf8"
      )
    );

  const place =
    places.find(
      (item: any) =>
        item.name ===
        "Brasserie Vinatier"
    );

  if (!place) {
    throw new Error(
      "Brasserie Vinatier introuvable"
    );
  }

  const usage:
    OfficialVerifierUsage = {
      httpRequests: 0,
      embeddingTokens: 0,
      llmInputTokens: 0,
      llmOutputTokens: 0,
    };

  const result =
    await verifyOfficialSiteFact({
      openai:
        new OpenAI({
          apiKey:
            process.env.OPENAI_API_KEY,
        }),

      place: {
        id: place.id,
        name: place.name,
        city: place.city,
        address: place.address,
        website: place.website,
      },

      question:
        "Cet établissement permet-il de boire ou commander du café ?",

      usage,
    });

  console.log(
    JSON.stringify(
      {
        result,
        usage,
      },
      null,
      2
    )
  );
}

main().catch(
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
