import {
  getDocument,
} from "pdfjs-dist/legacy/build/pdf.mjs";

async function main() {
  const url =
    "https://lanouvellegarde.com/wp-content/uploads/bv_boissons.pdf";

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}`
    );
  }

  const bytes =
    new Uint8Array(
      await response.arrayBuffer()
    );

  const loadingTask =
    getDocument({
      data: bytes,
    });

  const pdf =
    await loadingTask.promise;

  const pages: string[] =
    [];

  for (
    let pageNumber = 1;
    pageNumber <= pdf.numPages;
    pageNumber += 1
  ) {
    const page =
      await pdf.getPage(
        pageNumber
      );

    const content =
      await page.getTextContent();

    const text =
      content.items
        .map(
          (item: any) =>
            typeof item?.str ===
            "string"
              ? item.str
              : ""
        )
        .filter(Boolean)
        .join(" ")
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    pages.push(text);

    page.cleanup();
  }

  await loadingTask.destroy();

  const fullText =
    pages.join("\n");

  console.log(
    "PAGES :",
    pages.length
  );

  console.log(
    "CARACTERES :",
    fullText.length
  );

  console.log(
    "\n=== SIGNAUX ==="
  );

  for (
    const token of [
      "café",
      "cafe",
      "expresso",
      "espresso",
      "allongé",
      "allonge",
      "cappuccino",
      "thé",
      "the",
      "boisson chaude",
    ]
  ) {
    console.log(
      token,
      "=>",
      fullText
        .toLowerCase()
        .includes(token)
    );
  }

  console.log(
    "\n=== EXTRAIT ==="
  );

  console.log(
    fullText.slice(
      0,
      6000
    )
  );
}

main().catch(
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
