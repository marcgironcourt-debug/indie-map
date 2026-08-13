import fs from "node:fs";
import * as cheerio from "cheerio";

async function main() {
  const places = JSON.parse(
    fs.readFileSync("data/places.json", "utf8")
  );

  const place = places.find(
    (item: any) =>
      item.name === "Brasserie Vinatier"
  );

  if (!place?.website) {
    throw new Error("Brasserie Vinatier / website introuvable");
  }

  const response = await fetch(place.website, {
    redirect: "follow",
  });

  const html = await response.text();
  const finalUrl = response.url;

  const $ = cheerio.load(html);
  const base = new URL(finalUrl);

  const normalizeHost = (host: string) =>
    host.toLowerCase().replace(/^www\./, "");

  const seen = new Set<string>();
  const links: Array<{
    label: string;
    url: string;
  }> = [];

  $("a[href]").each((_index, element) => {
    const href =
      $(element).attr("href")?.trim();

    if (!href) return;

    try {
      const url =
        new URL(href, base);

      if (
        !["http:", "https:"].includes(
          url.protocol
        )
      ) {
        return;
      }

      if (
        normalizeHost(url.hostname) !==
        normalizeHost(base.hostname)
      ) {
        return;
      }

      url.hash = "";

      const clean =
        url.toString();

      if (seen.has(clean)) {
        return;
      }

      seen.add(clean);

      links.push({
        label:
          $(element)
            .text()
            .replace(/\s+/g, " ")
            .trim() || "(sans texte)",
        url: clean,
      });
    } catch {}
  });

  const pageText =
    $("body")
      .text()
      .replace(/\s+/g, " ")
      .trim();

  console.log("URL :", finalUrl);
  console.log("LIENS INTERNES :", links.length);

  console.log("\n=== LIENS ===");
  for (const link of links) {
    console.log(
      `- ${link.label} -> ${link.url}`
    );
  }

  console.log("\n=== SIGNAUX PAGE ===");

  for (
    const token of [
      "café",
      "cafe",
      "coffee",
      "menu",
      "carte",
      "boissons",
      "boisson",
      "bar",
      "brunch",
      "petit déjeuner",
    ]
  ) {
    console.log(
      token,
      "=>",
      pageText
        .toLowerCase()
        .includes(token)
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
