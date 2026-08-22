import OpenAI from "openai";
import * as cheerio from "cheerio";
import {
  getFreshOfficialPageCache,
  getFreshVerifiedFacts,
  normalizeOfficialUrl,
  saveOfficialPageCache,
  saveVerifiedFact,
  sha256,
} from "@/lib/ai/memoryStore";

const MAX_DISCOVERED_URLS = 160;
const MAX_SELECTED_PAGES = 6;

/*
 * Pour une vérification stable simple, on commence uniquement
 * par la homepage + quelques liens réellement présents dessus.
 *
 * Aucun sitemap n'est parcouru dans ce mode.
 */
const FAST_STABLE_SELECTED_PAGES = 2;

const MAX_PAGE_TEXT = 8000;

/*
 * Les PDF officiels sont autorisés uniquement lorsqu'ils
 * ont déjà été sélectionnés comme source pertinente.
 *
 * On garde des limites strictes pour éviter qu'un catalogue
 * énorme ralentisse ou surcharge une recherche.
 */
const MAX_PDF_BYTES =
  15 * 1024 * 1024;

const MAX_PDF_PAGES = 40;

const MAX_PDF_TEXT = 16000;

function shouldUseFastStableOfficialPass(
  question: string
) {
  const value =
    String(question ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      );

  /*
   * Ces demandes reposent plus souvent sur une programmation,
   * une activité ponctuelle ou une page profonde du site.
   * Elles conservent donc l'exploration complète.
   */
  const needsDeepDiscovery =
    [
      "concert",
      "live",
      "musique",
      "programmation",
      "spectacle",
      "projection",
      "cinema",
      "dj",
      "jam",
      "atelier",
      "workshop",
      "cours",
      "initiation",
      "stage",
      "rencontre",
      "conference",
      "evenement",
    ].some(
      (token) =>
        value.includes(token)
    );

  return !needsDeepDiscovery;
}

/*
 * Cache technique des pages officielles.
 *
 * Ce TTL concerne uniquement le contenu HTTP brut.
 * Il est indépendant de la fraîcheur des faits vérifiés.
 */
const OFFICIAL_PAGE_CACHE_TTL_MS =
  24 * 60 * 60 * 1000;

const SCOUT_DISABLE_PERSISTENT_OFFICIAL_PAGE_CACHE =
  process.env
    .SCOUT_DISABLE_PERSISTENT_OFFICIAL_PAGE_CACHE ===
  "1";

/*
 * Une preuve vérifiée est conservée durablement en base.
 *
 * expiresAt représente uniquement sa période de fraîcheur :
 * après 180 jours, elle doit être revérifiée avant réutilisation.
 *
 * Les données validées directement via l’Espace Pro restent
 * prioritaires et peuvent être mises à jour immédiatement.
 */
const VERIFIED_FACT_TTL_MS =
  180 * 24 * 60 * 60 * 1000;

export type OfficialVerifierUsage = {
  httpRequests: number;
  embeddingTokens: number;
  llmInputTokens: number;
  llmOutputTokens: number;

  /*
   * Optionnels pour rester compatibles avec
   * V4.1 / V4.2 qui construisent déjà cet objet.
   */
  ramCacheHits?: number;
  persistentCacheHits?: number;
  persistentCacheMisses?: number;
  persistentCacheWrites?: number;

  verifiedFactMemoryHits?: number;
  verifiedFactMemoryMisses?: number;
  verifiedFactWrites?: number;
};

export type OfficialSitePlace = {
  /*
   * Identifiant stable Indie Map.
   * Il sera utilisé comme clé de la mémoire factuelle V5.
   */
  id: string;
  name: string;
  city?: string;
  address?: string;
  website?: string;
};

export type OfficialEvidence = {
  sourceUrl: string;
  evidenceText: string;
  scope:
    | "target_place"
    | "brand_general"
    | "other_branch"
    | "unclear";
  actuallyFound: boolean;
};

export type OfficialVerificationResult = {
  status:
    | "CONFIRMED"
    | "CONTRADICTED"
    | "NOT_FOUND";
  answer: string;
  evidence: OfficialEvidence[];
  missingInfo: string[];
  selectedPages: string[];
};

type Page = {
  url: string;
  title: string;
  text: string;

  /*
   * Emails explicitement publiés sur cette
   * ressource officielle.
   */
  emails?: string[];

  /*
   * Hash du corps HTTP brut dont cette page a été extraite.
   * Il permet de rattacher une preuve au contenu officiel
   * exact observé lors de sa vérification.
   */
  contentHash: string;
};

type CandidateUrl = {
  url: string;
  label: string;
};

const pdfPageCache =
  new Map<
    string,
    Promise<Page>
  >();


const rawCache =
  new Map<
    string,
    Promise<{
      url: string;
      contentType: string;
      body: string;
    }>
  >();

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKC")
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
  return rootDomain(a) === rootDomain(b);
}

function cosine(
  a: number[],
  b: number[]
) {
  let dot = 0;
  let na = 0;
  let nb = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }

  if (!na || !nb) return 0;

  return dot /
    (Math.sqrt(na) * Math.sqrt(nb));
}


function isPdfUrl(
  value: string
) {
  try {
    return /\.pdf$/i.test(
      new URL(value)
        .pathname
    );
  } catch {
    return false;
  }
}


function isUnsupportedBinaryUrl(
  value: string
) {
  try {
    const pathname =
      new URL(value)
        .pathname
        .toLowerCase();

    return /\.(zip|gz|tar|rar|7z|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|gif|webp|avif|svg|mp3|mp4|mov|avi|webm|woff|woff2|ttf|otf)$/i.test(
      pathname
    );
  } catch {
    return false;
  }
}

function isSupportedOfficialContentType(
  contentType: string
) {
  const type =
    String(contentType || "")
      .toLowerCase()
      .split(";")[0]
      .trim();

  /*
   * Certains serveurs n'envoient aucun Content-Type.
   * Dans ce cas on conserve le comportement actuel et
   * laisse le parseur décider ensuite.
   */
  if (!type) {
    return true;
  }

  if (
    type.startsWith("text/")
  ) {
    return true;
  }

  return [
    "application/xhtml+xml",
    "application/xml",
    "application/rss+xml",
    "application/atom+xml",
  ].includes(type);
}

async function fetchRaw(
  url: string,
  usage: OfficialVerifierUsage
) {
  const normalizedUrl =
    normalizeOfficialUrl(url);

  /*
   * Niveau 1 :
   * cache RAM du processus courant.
   */
  const cached =
    rawCache.get(normalizedUrl);

  if (cached) {
    usage.ramCacheHits =
      (usage.ramCacheHits || 0) + 1;

    return cached;
  }

  const promise = (async () => {
    /*
     * Niveau 2 :
     * cache PostgreSQL persistant.
     *
     * Une panne du cache ne doit pas empêcher
     * la vérification officielle de fonctionner.
     */
    if (
      !SCOUT_DISABLE_PERSISTENT_OFFICIAL_PAGE_CACHE
    ) {
      try {
        const persistent =
          await getFreshOfficialPageCache(
            normalizedUrl
          );

        if (persistent) {
          usage.persistentCacheHits =
            (
              usage.persistentCacheHits ||
              0
            ) + 1;

          return {
            url:
              persistent.finalUrl ||
              persistent.url,
            contentType:
              persistent.contentType ||
              "",
            body:
              persistent.body,
          };
        }

        usage.persistentCacheMisses =
          (
            usage.persistentCacheMisses ||
            0
          ) + 1;
      } catch (error) {
        console.warn(
          "[officialSiteVerifier] cache read failed:",
          normalizedUrl,
          error
        );
      }
    }

    /*
     * Le vérificateur V5 ne sait actuellement extraire
     * des preuves que depuis HTML/XML/texte.
     *
     * Un PDF ou autre binaire ne doit donc jamais être
     * lu comme UTF-8 ni enregistré dans PostgreSQL TEXT.
     */
    if (
      isUnsupportedBinaryUrl(
        normalizedUrl
      )
    ) {
      throw new Error(
        `Ressource binaire non supportée : ${normalizedUrl}`
      );
    }

    /*
     * Niveau 3 :
     * réseau réel uniquement si RAM + PostgreSQL
     * n'ont rien de frais.
     */
    usage.httpRequests += 1;

    const response =
      await fetch(
        normalizedUrl,
        {
          headers: {
            "User-Agent":
              "IndieMap/0.1 (+https://www.indie-map.com)",
            Accept:
              "text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,*/*;q=0.5",
          },
          redirect: "follow",
          signal:
            AbortSignal.timeout(
              12000
            ),
        }
      );

    if (!response.ok) {
      throw new Error(
        `${response.status} ${response.statusText}`
      );
    }

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    if (
      !isSupportedOfficialContentType(
        contentType
      )
    ) {
      throw new Error(
        `Content-Type officiel non supporté : ${contentType || "inconnu"}`
      );
    }

    const body =
      await response.text();

    const result = {
      url:
        response.url,
      contentType,
      body,
    };

    /*
     * Une réponse HTTP réussie est conservée
     * pour les processus/requêtes futurs.
     */
    if (
      !SCOUT_DISABLE_PERSISTENT_OFFICIAL_PAGE_CACHE
    ) {
      try {
        const fetchedAt =
          new Date();

        await saveOfficialPageCache({
          url:
            normalizedUrl,
          finalUrl:
            response.url,
          contentType,
          httpStatus:
            response.status,
          body,
          etag:
            response.headers.get(
              "etag"
            ) || undefined,
          lastModified:
            response.headers.get(
              "last-modified"
            ) || undefined,
          fetchedAt,
          expiresAt:
            new Date(
              fetchedAt.getTime() +
              OFFICIAL_PAGE_CACHE_TTL_MS
            ),
        });

        usage.persistentCacheWrites =
          (
            usage.persistentCacheWrites ||
            0
          ) + 1;
      } catch (error) {
        console.warn(
          "[officialSiteVerifier] cache write failed:",
          normalizedUrl,
          error
        );
      }
    }

    return result;
  })();

  rawCache.set(
    normalizedUrl,
    promise
  );

  try {
    return await promise;
  } catch (error) {
    rawCache.delete(
      normalizedUrl
    );

    throw error;
  }
}

function normalizeExtractedOfficialEmail(
  value: unknown
) {
  return String(value ?? "")
    .trim()
    .replace(
      /^[<("'`]+|[>)"'`,.;:]+$/g,
      ""
    )
    .toLowerCase();
}

function emailsFromOfficialText(
  value: string
) {
  const matches =
    String(value || "").match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
    ) || [];

  return [
    ...new Set(
      matches
        .map(
          normalizeExtractedOfficialEmail
        )
        .filter(Boolean)
    ),
  ];
}

function pageFromHtml(
  url: string,
  html: string
): {
  page: Page;
  links: CandidateUrl[];
} {
  const $ = cheerio.load(html);

  $(
    "script,style,noscript,svg,canvas,template"
  ).remove();

  const title = $("title")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();

  /*
   * Ne pas utiliser $("body").text() pour extraire
   * les emails :
   *
   * Cheerio peut concaténer deux nœuds HTML voisins
   * sans espace et transformer par exemple :
   *
   *   contact@site.fr + Formulaire
   *
   * en :
   *
   *   contact@site.frFormulaire
   *
   * On parcourt donc chaque nœud texte séparément.
   */
  const textParts: string[] = [];

  function collectText(
    node: any
  ) {
    if (!node) {
      return;
    }

    if (
      node.type === "text"
    ) {
      const value =
        String(
          node.data || ""
        )
          .replace(/\s+/g, " ")
          .trim();

      if (value) {
        textParts.push(
          value
        );
      }

      return;
    }

    const children =
      Array.isArray(
        node.children
      )
        ? node.children
        : [];

    for (
      const child of children
    ) {
      collectText(child);
    }
  }

  collectText(
    $("body").get(0)
  );

  const bodyText =
    textParts
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

  const text =
    bodyText.slice(
      0,
      MAX_PAGE_TEXT
    );

  /*
   * Extraction nœud par nœud :
   * un email ne peut ainsi jamais absorber
   * le début du texte HTML suivant.
   */
  const emails =
    new Set(
      textParts.flatMap(
        part =>
          emailsFromOfficialText(
            part
          )
      )
    );

  $("a[href]").each(
    (_index, element) => {
      const href =
        String(
          $(element).attr(
            "href"
          ) || ""
        ).trim();

      if (
        !/^mailto:/i.test(
          href
        )
      ) {
        return;
      }

      const raw =
        href
          .replace(
            /^mailto:/i,
            ""
          )
          .split("?")[0];

      for (
        const candidate of
        raw.split(/[;,]/)
      ) {
        const email =
          normalizeExtractedOfficialEmail(
            candidate
          );

        if (email) {
          emails.add(email);
        }
      }
    }
  );

  const base = new URL(url);

  const links =
    new Map<string, CandidateUrl>();

  $("a[href]").each(
    (_index: number, element: any) => {
      const href =
        $(element)
          .attr("href")
          ?.trim();

      if (!href) return;

      try {
        const target =
          new URL(href, base);

        if (
          ![
            "http:",
            "https:",
          ].includes(target.protocol)
        ) {
          return;
        }

        if (
          !sameDomain(base, target)
        ) {
          return;
        }

        target.hash = "";

        if (
          /\.(jpg|jpeg|png|gif|webp|svg|zip|mp3|mp4|mov|avi|css|js|woff2?)$/i.test(
            target.pathname
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
    }
  );

  return {
    page: {
      url,
      title,
      text,
      emails: [...emails],
      contentHash:
        sha256(html),
    },
    links:
      [...links.values()],
  };
}

function extractSitemapLocs(
  xml: string
) {
  return [
    ...xml.matchAll(
      /<loc>\s*([^<]+?)\s*<\/loc>/gi
    ),
  ].map(
    (match) =>
      match[1].trim()
  );
}

async function discover(
  website: string,
  usage: OfficialVerifierUsage,
  options?: {
    includeSitemaps?: boolean;
  }
) {
  const includeSitemaps =
    options?.includeSitemaps ??
    true;
  const start =
    new URL(
      normalizeWebsite(website)
    );

  const candidates =
    new Map<
      string,
      CandidateUrl
    >();

  let homePage:
    | Page
    | null = null;

  try {
    const raw =
      await fetchRaw(
        start.toString(),
        usage
      );

    const parsed =
      pageFromHtml(
        raw.url,
        raw.body
      );

    homePage =
      parsed.page;

    for (
      const link of parsed.links
    ) {
      if (
        isUnsupportedBinaryUrl(
          link.url
        )
      ) {
        continue;
      }

      candidates.set(
        link.url,
        link
      );
    }
  } catch {}

  const sitemapQueue =
    includeSitemaps
      ? [
          new URL(
            "/sitemap.xml",
            start
          ).toString(),
          new URL(
            "/wp-sitemap.xml",
            start
          ).toString(),
        ]
      : [];

  const seenSitemaps =
    new Set<string>();

  while (
    sitemapQueue.length > 0 &&
    seenSitemaps.size < 8
  ) {
    const sitemap =
      sitemapQueue.shift()!;

    if (
      seenSitemaps.has(sitemap)
    ) {
      continue;
    }

    seenSitemaps.add(sitemap);

    try {
      const raw =
        await fetchRaw(
          sitemap,
          usage
        );

      for (
        const value of
        extractSitemapLocs(
          raw.body
        )
      ) {
        try {
          const url =
            new URL(value);

          if (
            isUnsupportedBinaryUrl(
              url.toString()
            )
          ) {
            continue;
          }

          if (
            !sameDomain(
              start,
              url
            )
          ) {
            continue;
          }

          if (
            /\.xml($|\?)/i.test(
              url.toString()
            )
          ) {
            sitemapQueue.push(
              url.toString()
            );

            continue;
          }

          candidates.set(
            url.toString(),
            {
              url:
                url.toString(),
              label:
                url.pathname,
            }
          );
        } catch {}
      }
    } catch {}
  }

  return {
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
  openai: OpenAI,
  question: string,
  candidates: CandidateUrl[],
  embeddingModel: string,
  usage: OfficialVerifierUsage,
  maxSelectedPages =
    MAX_SELECTED_PAGES
) {
  if (
    candidates.length === 0
  ) {
    return [];
  }

  const descriptors =
    candidates.map(
      (item) =>
        `${item.label} | ${item.url}`
    );

  const response =
    await openai.embeddings.create({
      model: embeddingModel,
      input: [
        question,
        ...descriptors,
      ],
    });

  usage.embeddingTokens +=
    response.usage?.total_tokens ||
    0;

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
    .map(
      (candidate, index) => ({
        candidate,
        score: cosine(
          queryVector,
          vectors[index + 1]
        ),
      })
    )
    .sort(
      (a, b) =>
        b.score - a.score
    )
    .slice(
      0,
      maxSelectedPages
    );
}

async function loadPdfPage(
  url: string,
  usage: OfficialVerifierUsage
): Promise<Page> {
  const normalizedUrl =
    normalizeOfficialUrl(url);

  const existing =
    pdfPageCache.get(
      normalizedUrl
    );

  if (existing) {
    return existing;
  }

  const promise =
    (async () => {
      usage.httpRequests += 1;

      const response =
        await fetch(
          normalizedUrl,
          {
            headers: {
              "User-Agent":
                "IndieMap/0.1 (+https://www.indie-map.com)",

              Accept:
                "application/pdf;q=1.0,*/*;q=0.1",
            },

            redirect:
              "follow",

            signal:
              AbortSignal.timeout(
                12000
              ),
          }
        );

      if (!response.ok) {
        throw new Error(
          `PDF HTTP ${response.status}: ${normalizedUrl}`
        );
      }

      const contentLength =
        Number(
          response.headers.get(
            "content-length"
          ) || "0"
        );

      if (
        contentLength >
        MAX_PDF_BYTES
      ) {
        throw new Error(
          `PDF trop volumineux: ${contentLength} octets`
        );
      }

      const bytes =
        new Uint8Array(
          await response
            .arrayBuffer()
        );

      if (
        bytes.byteLength >
        MAX_PDF_BYTES
      ) {
        throw new Error(
          `PDF trop volumineux: ${bytes.byteLength} octets`
        );
      }

      /*
       * Ne pas faire confiance uniquement à l'extension
       * ou au Content-Type : le fichier doit réellement
       * commencer par la signature PDF.
       */
      const signature =
        Buffer.from(
          bytes.slice(
            0,
            5
          )
        ).toString(
          "ascii"
        );

      if (
        signature !== "%PDF-"
      ) {
        throw new Error(
          `Ressource .pdf invalide: ${normalizedUrl}`
        );
      }

      const {
        getDocument,
      } =
        await import(
          "pdfjs-dist/legacy/build/pdf.mjs"
        );

      const loadingTask =
        getDocument({
          data: bytes,
        });

      const pdf =
        await loadingTask
          .promise;

      try {
        const pageCount =
          Math.min(
            pdf.numPages,
            MAX_PDF_PAGES
          );

        const chunks:
          string[] =
            [];

        let totalLength =
          0;

        for (
          let pageNumber = 1;
          pageNumber <=
            pageCount;
          pageNumber += 1
        ) {
          const page =
            await pdf.getPage(
              pageNumber
            );

          try {
            const content =
              await page
                .getTextContent();

            const pageText =
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

            if (
              pageText
            ) {
              chunks.push(
                pageText
              );

              totalLength +=
                pageText.length +
                1;
            }

            if (
              totalLength >=
              MAX_PDF_TEXT
            ) {
              break;
            }
          } finally {
            page.cleanup();
          }
        }

        const extractedText =
          chunks
            .join(" ")
            .replace(
              /\s+/g,
              " "
            )
            .trim()
            .slice(
              0,
              MAX_PDF_TEXT
            );

        if (
          extractedText.length <
          20
        ) {
          throw new Error(
            `PDF sans texte exploitable: ${normalizedUrl}`
          );
        }

        const finalUrl =
          response.url ||
          normalizedUrl;

        const pathname =
          new URL(finalUrl)
            .pathname;

        const filename =
          pathname
            .split("/")
            .filter(Boolean)
            .pop() ||
          "document.pdf";

        return {
          url:
            finalUrl,

          title:
            filename,

          text:
            extractedText,

          emails:
            emailsFromOfficialText(
              extractedText
            ),

          /*
           * On mémorise le hash du vrai binaire PDF,
           * pas seulement celui du texte extrait.
           */
          contentHash:
            sha256(
              Buffer.from(
                bytes
              ).toString(
                "base64"
              )
            ),
        };
      } finally {
        await loadingTask
          .destroy();
      }
    })();

  pdfPageCache.set(
    normalizedUrl,
    promise
  );

  try {
    return await promise;
  } catch (error) {
    pdfPageCache.delete(
      normalizedUrl
    );

    throw error;
  }
}


async function loadPages(
  selected: Array<{
    candidate: CandidateUrl;
    score: number;
  }>,
  homePage: Page | null,
  usage: OfficialVerifierUsage
) {
  const pages =
    new Map<string, Page>();

  if (homePage) {
    pages.set(
      homePage.url,
      homePage
    );
  }

  for (
    const item of selected
  ) {
    if (
      pages.has(
        item.candidate.url
      )
    ) {
      continue;
    }

    try {
      /*
       * PDF officiel sélectionné :
       * extraction textuelle dédiée.
       */
      if (
        isPdfUrl(
          item.candidate.url
        )
      ) {
        const pdfPage =
          await loadPdfPage(
            item.candidate.url,
            usage
          );

        if (
          pdfPage.text.length >
          50
        ) {
          pages.set(
            pdfPage.url,
            pdfPage
          );
        }

        continue;
      }

      /*
       * HTML / texte :
       * comportement historique.
       */
      const raw =
        await fetchRaw(
          item.candidate.url,
          usage
        );

      if (
        !raw.contentType.includes(
          "html"
        )
      ) {
        continue;
      }

      const parsed =
        pageFromHtml(
          raw.url,
          raw.body
        );

      if (
        parsed.page.text.length >
        50
      ) {
        pages.set(
          parsed.page.url,
          parsed.page
        );
      }
    } catch {}
  }

  return [
    ...pages.values(),
  ];
}


function sourceContentHashForEvidence(
  sourceUrl: string,
  pages: Page[]
) {
  let normalizedSourceUrl:
    string;

  try {
    normalizedSourceUrl =
      normalizeOfficialUrl(
        sourceUrl
      );
  } catch {
    return undefined;
  }

  const sourcePage =
    pages.find(
      (page) => {
        try {
          return (
            normalizeOfficialUrl(
              page.url
            ) ===
            normalizedSourceUrl
          );
        } catch {
          return false;
        }
      }
    );

  return sourcePage
    ?.contentHash;
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
    normalizeText(
      evidenceText
    );

  if (
    evidence.length < 5
  ) {
    return false;
  }

  return normalizeText(
    page.text
  ).includes(evidence);
}


function dedupeOfficialEvidence(
  evidence: OfficialEvidence[]
) {
  const seen =
    new Set<string>();

  return evidence.filter(
    (item) => {
      const key =
        [
          normalizeOfficialUrl(
            item.sourceUrl
          ),
          item.scope,
          normalizeText(
            item.evidenceText
          ),
        ].join("|");

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    }
  );
}

async function decideOfficialEvidence(
  options: {
    openai: OpenAI;
    model: string;
    place: OfficialSitePlace;
    question: string;
    evidence: OfficialEvidence[];
    usage: OfficialVerifierUsage;
  }
) {
  const {
    openai,
    model,
    place,
    question,
    evidence,
    usage,
  } = options;

  const decision =
    await openai.responses.create({
      model,

      reasoning: {
        effort: "low",
      },

      store: false,

      input: [
        {
          role: "system",
          content: `
Tu es le vérificateur factuel final d'Indie Map.

Tu reçois uniquement des preuves officielles qui ont déjà été
vérifiées mot pour mot dans le site de l'établissement.

Décide :

CONFIRMED =
les preuves permettent d'affirmer clairement la demande.

CONTRADICTED =
les preuves indiquent explicitement le contraire.

NOT_FOUND =
les preuves ne suffisent pas.

RÈGLES :
- N'utilise aucune connaissance extérieure.
- N'invente rien.
- Le silence n'est jamais une contradiction.
- Une preuve d'une autre branche a déjà été exclue.
- Raisonne correctement sur nombres, dates et heures.
- 11:00 est avant 12:00.
- Un événement à une autre date ne confirme pas celui demandé.
- Une caractéristique générale n'est applicable que lorsque
  la preuve dit réellement qu'elle concerne toute la marque.
          `.trim(),
        },
        {
          role: "user",
          content:
            JSON.stringify({
              targetPlace:
                place,
              question,
              evidence:
                evidence.map(
                  (item) => ({
                    sourceUrl:
                      item.sourceUrl,
                    evidenceText:
                      item.evidenceText,
                    scope:
                      item.scope,
                  })
                ),
            }),
        },
      ],

      text: {
        format: {
          type: "json_schema",
          name:
            "indie_map_official_decision",
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
            additionalProperties:
              false,
          },
        },
      },
    });

  usage.llmInputTokens +=
    decision.usage
      ?.input_tokens || 0;

  usage.llmOutputTokens +=
    decision.usage
      ?.output_tokens || 0;

  if (
    !decision.output_text
  ) {
    throw new Error(
      "Décision officielle vide"
    );
  }

  return JSON.parse(
    decision.output_text
  ) as {
    status:
      | "CONFIRMED"
      | "CONTRADICTED"
      | "NOT_FOUND";
    answer: string;
    missingInfo: string[];
  };
}

export async function verifyOfficialSiteFact(
  options: {
    openai: OpenAI;
    place: OfficialSitePlace;
    question: string;
    usage: OfficialVerifierUsage;
    model?: string;
    embeddingModel?: string;
  }
): Promise<OfficialVerificationResult> {
  const {
    openai,
    place,
    question,
    usage,
    model = "gpt-5.4-nano",
    embeddingModel =
      "text-embedding-3-small",
  } = options;

  /*
   * =======================================================
   * V5 MEMORY FIRST — VERIFIED FACTS
   * =======================================================
   *
   * L'ancienne verificationQuestion est uniquement
   * conservée pour audit.
   *
   * Pour une nouvelle recherche, on rejugera toujours
   * les evidenceText officiels contre la NOUVELLE question.
   */
  let rememberedEvidence:
    OfficialEvidence[] = [];

  try {
    const facts =
      await getFreshVerifiedFacts(
        place.id
      );

    rememberedEvidence =
      facts
        .filter(
          (fact) =>
            fact.scope ===
              "target_place" ||
            fact.scope ===
              "brand_general"
        )
        .map(
          (fact) => ({
            sourceUrl:
              fact.sourceUrl,
            evidenceText:
              fact.evidenceText,
            scope:
              fact.scope as
                | "target_place"
                | "brand_general",
            actuallyFound:
              true,
          })
        );

    if (
      rememberedEvidence.length >
      0
    ) {
      usage.verifiedFactMemoryHits =
        (
          usage.verifiedFactMemoryHits ||
          0
        ) + 1;

      const rememberedDecision =
        await decideOfficialEvidence({
          openai,
          model,
          place,
          question,
          evidence:
            rememberedEvidence,
          usage,
        });

      if (
        rememberedDecision.status !==
        "NOT_FOUND"
      ) {
        return {
          status:
            rememberedDecision.status,
          answer:
            rememberedDecision.answer,
          evidence:
            rememberedEvidence,
          missingInfo:
            rememberedDecision
              .missingInfo,
          selectedPages:
            [
              ...new Set(
                rememberedEvidence.map(
                  (item) =>
                    item.sourceUrl
                )
              ),
            ],
        };
      }
    } else {
      usage.verifiedFactMemoryMisses =
        (
          usage.verifiedFactMemoryMisses ||
          0
        ) + 1;
    }
  } catch (error) {
    console.warn(
      "[officialSiteVerifier] verified fact memory reuse failed:",
      place.id,
      error
    );
  }

  if (!place.website) {
    return {
      status: "NOT_FOUND",
      answer:
        "Aucun site officiel enregistré.",
      evidence: [],
      missingInfo: [
        "site officiel",
      ],
      selectedPages: [],
    };
  }

  const fastStablePass =
    shouldUseFastStableOfficialPass(
      question
    );

  let discovered;

  try {
    discovered =
      await discover(
        place.website,
        usage,
        {
          includeSitemaps:
            !fastStablePass,
        }
      );
  } catch {
    return {
      status: "NOT_FOUND",
      answer:
        "Le site officiel n'a pas pu être lu.",
      evidence: [],
      missingInfo: [
        "contenu du site officiel",
      ],
      selectedPages: [],
    };
  }

  const selected =
    await selectRelevantUrls(
      openai,
      question,
      discovered.candidates,
      embeddingModel,
      usage,
      fastStablePass
        ? FAST_STABLE_SELECTED_PAGES
        : MAX_SELECTED_PAGES
    );

  const pages =
    await loadPages(
      selected,
      discovered.homePage,
      usage
    );

  if (
    pages.length === 0
  ) {
    return {
      status: "NOT_FOUND",
      answer:
        "Le site officiel n'a pas pu être lu.",
      evidence: [],
      missingInfo: [
        "contenu du site officiel",
      ],
      selectedPages: [],
    };
  }

  const allowedUrls =
    pages.map(
      (page) =>
        page.url
    );

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

  const extraction =
    await openai.responses.create({
      model,

      reasoning: {
        effort: "low",
      },

      store: false,

      input: [
        {
          role: "system",
          content: `
Tu es l'extracteur de preuves officielles d'Indie Map.

Tu reçois uniquement des pages directement téléchargées
sur le domaine officiel d'un établissement.

Tu dois extraire les passages factuels utiles à la question.
Tu ne dois PAS répondre à la question et ne dois PAS conclure.

IDENTITÉ :
Il peut exister plusieurs établissements ou branches sur
le même domaine.

Pour chaque preuve, indique son scope :

target_place =
la preuve concerne explicitement l'établissement demandé.

brand_general =
la preuve est explicitement générale et s'applique clairement
à tous les établissements de la marque.

other_branch =
la preuve concerne explicitement une autre adresse/branche.

unclear =
impossible de savoir à quel établissement elle s'applique.

RÈGLES :
- N'utilise aucune connaissance extérieure.
- Aucun raisonnement implicite.
- Chaque evidenceText doit être un extrait EXACT,
  CONTIGU et court de la page.
- Ne paraphrase jamais.
- N'utilise jamais "...".
- Maximum environ 220 caractères par preuve.
- Une information concernant une autre adresse n'est jamais
  une preuve concernant la cible.
- Si rien d'utile n'est présent, evidence=[].
          `.trim(),
        },
        {
          role: "user",
          content:
            JSON.stringify({
              targetPlace: {
                name:
                  place.name,
                city:
                  place.city ||
                  "",
                address:
                  place.address ||
                  "",
                website:
                  place.website,
              },
              question,
              pages:
                documents,
            }),
        },
      ],

      text: {
        format: {
          type: "json_schema",
          name:
            "indie_map_official_evidence",
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
                      enum:
                        allowedUrls,
                    },
                    evidenceText: {
                      type: "string",
                      maxLength: 260,
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
                  },
                  required: [
                    "sourceUrl",
                    "evidenceText",
                    "scope",
                  ],
                  additionalProperties:
                    false,
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
            additionalProperties:
              false,
          },
        },
      },
    });

  usage.llmInputTokens +=
    extraction.usage
      ?.input_tokens || 0;

  usage.llmOutputTokens +=
    extraction.usage
      ?.output_tokens || 0;

  if (
    !extraction.output_text
  ) {
    throw new Error(
      "Extraction officielle vide"
    );
  }

  const parsed =
    JSON.parse(
      extraction.output_text
    ) as {
      evidence: Array<{
        sourceUrl: string;
        evidenceText: string;
        scope:
          | "target_place"
          | "brand_general"
          | "other_branch"
          | "unclear";
      }>;
      missingInfo: string[];
    };

  const checkedEvidence:
    OfficialEvidence[] =
      parsed.evidence.map(
        (item) => ({
          ...item,
          actuallyFound:
            evidenceExists(
              item.evidenceText,
              item.sourceUrl,
              pages
            ),
        })
      );

  const usableEvidence =
    checkedEvidence.filter(
      (item) =>
        item.actuallyFound &&
        (
          item.scope ===
            "target_place" ||
          item.scope ===
            "brand_general"
        )
    );


  /*
   * On mémorise uniquement :
   * - un extrait retrouvé réellement dans la page ;
   * - target_place ou brand_general.
   *
   * On ne mémorise jamais other_branch / unclear.
   */
  if (
    usableEvidence.length > 0
  ) {
    const verifiedAt =
      new Date();

    await Promise.all(
      usableEvidence.map(
        async (item) => {
          try {
            await saveVerifiedFact({
              placeId:
                place.id,
              placeName:
                place.name,
              placeAddress:
                place.address,
              scope:
                item.scope as
                  | "target_place"
                  | "brand_general",
              sourceUrl:
                item.sourceUrl,
              evidenceText:
                item.evidenceText,
              verificationQuestion:
                question,
              sourceContentHash:
                sourceContentHashForEvidence(
                  item.sourceUrl,
                  pages
                ),
              verifierVersion:
                "official-site-v5-memory-1",
              verifiedAt,
              expiresAt:
                new Date(
                  verifiedAt.getTime() +
                  VERIFIED_FACT_TTL_MS
                ),
            });

            usage.verifiedFactWrites =
              (
                usage.verifiedFactWrites ||
                0
              ) + 1;
          } catch (error) {
            console.warn(
              "[officialSiteVerifier] verified fact write failed:",
              place.id,
              item.sourceUrl,
              error
            );
          }
        }
      )
    );
  }

  const combinedUsableEvidence =
    dedupeOfficialEvidence([
      ...rememberedEvidence,
      ...usableEvidence,
    ]);

  const combinedEvidence =
    dedupeOfficialEvidence([
      ...rememberedEvidence,
      ...checkedEvidence,
    ]);

  if (
    usableEvidence.length === 0
  ) {
    return {
      status: "NOT_FOUND",
      answer:
        "Aucune preuve officielle applicable à cet établissement n'a été trouvée.",
      evidence:
        combinedEvidence,
      missingInfo:
        parsed.missingInfo.length
          ? parsed.missingInfo
          : [
              "preuve explicite applicable au lieu",
            ],
      selectedPages:
        [
        ...new Set([
          ...rememberedEvidence.map(
            (item) =>
              item.sourceUrl
          ),
          ...allowedUrls,
        ]),
      ],
    };
  }

  const result =
    await decideOfficialEvidence({
      openai,
      model,
      place,
      question,
      evidence:
        combinedUsableEvidence,
      usage,
    });


  return {
    status:
      result.status,
    answer:
      result.answer,
    evidence:
      combinedEvidence,
    missingInfo:
      result.missingInfo,
    selectedPages:
      [
        ...new Set([
          ...rememberedEvidence.map(
            (item) =>
              item.sourceUrl
          ),
          ...allowedUrls,
        ]),
      ],
  };
}

export type ScoutOfficialPage = {
  url: string;
  title: string;
  text: string;
  emails: string[];
  contentHash: string;
};

export async function collectOfficialPagesForScout(
  options: {
    openai: OpenAI;
    place: OfficialSitePlace;
    usage: OfficialVerifierUsage;
    embeddingModel?: string;
    maxSelectedPages?: number;
    restrictToStartPage?: boolean;
  }
): Promise<{
  discoveredCount: number;
  selectedUrls: string[];
  pages: ScoutOfficialPage[];
}> {
  const {
    openai,
    place,
    usage,
    embeddingModel =
      "text-embedding-3-small",
  } = options;

  const restrictToStartPage =
    options
      .restrictToStartPage ??
    false;

  const website =
    String(place.website || "").trim();

  if (!website) {
    throw new Error(
      `Site officiel absent pour ${place.name}`
    );
  }

  const maxSelectedPages =
    Math.max(
      1,
      Math.min(
        12,
        Math.trunc(
          options.maxSelectedPages ?? 8
        )
      )
    );

  const discovery =
    await discover(
      website,
      usage,
      {
        includeSitemaps:
          !restrictToStartPage,
      }
    );

  const selectionQuestion = [
    `Établissement : ${place.name}.`,
    place.city
      ? `Ville : ${place.city}.`
      : "",
    "Trouver les pages officielles qui documentent",
    "l'histoire, la mission, les valeurs, les engagements,",
    "la philosophie, les producteurs, les fournisseurs,",
    "l'approvisionnement, les circuits courts, la fabrication,",
    "les savoir-faire, l'artisanat, la saisonnalité,",
    "les pratiques environnementales, le réemploi,",
    "l'impact social, la gouvernance, la communauté,",
    "les ateliers et les actions culturelles ou pédagogiques.",
    "Inclure aussi les pages Contact, équipe,",
    "mentions légales, informations légales,",
    "et leurs équivalents dans toutes les langues,",
    "afin de retrouver les coordonnées professionnelles",
    "publiées officiellement par la structure.",
    "Inclure les équivalents dans toutes les langues.",
  ]
    .filter(Boolean)
    .join(" ");

  const selected =
    restrictToStartPage
      ? []
      : await selectRelevantUrls(
          openai,
          selectionQuestion,
          discovery.candidates,
          embeddingModel,
          usage,
          maxSelectedPages
        );

  const pages =
    await loadPages(
      selected,
      discovery.homePage,
      usage
    );

  return {
    discoveredCount:
      discovery.candidates.length,

    selectedUrls:
      selected.map(
        item => item.candidate.url
      ),

    pages:
      pages.map(page => ({
        url: page.url,
        title: page.title,
        text: page.text,
        emails:
          page.emails || [],
        contentHash:
          page.contentHash,
      })),
  };
}

/*
 * ===========================================================
 * SCOUT CONTACTS — COLLECTE OFFICIELLE SANS IA
 * ===========================================================
 *
 * Contrairement à collectOfficialPagesForScout(), cette
 * fonction n'utilise ni embeddings ni LLM.
 *
 * Elle charge :
 * - la page d'accueil ;
 * - les pages Contact ;
 * - les mentions / informations légales ;
 * - les pages À propos / équipe susceptibles de publier
 *   des coordonnées professionnelles.
 *
 * Le cache officiel PostgreSQL existant reste utilisé par
 * fetchRaw(), donc les pages fraîches ne sont pas retéléchargées.
 */
export async function collectOfficialContactPagesForScout(
  options: {
    place: OfficialSitePlace;
    usage: OfficialVerifierUsage;
    maxPages?: number;
  }
): Promise<{
  discoveredCount: number;
  selectedUrls: string[];
  pages: ScoutOfficialPage[];
}> {
  const website =
    String(
      options.place.website || ""
    ).trim();

  if (!website) {
    throw new Error(
      `Site officiel absent pour ${options.place.name}`
    );
  }

  const maxPages =
    Math.max(
      1,
      Math.min(
        10,
        Math.trunc(
          options.maxPages ?? 6
        )
      )
    );

  const discovery =
    await discover(
      website,
      options.usage,
      {
        includeSitemaps: true,
      }
    );

  function contactPriority(
    candidate: CandidateUrl
  ) {
    const value =
      `${candidate.label} ${candidate.url}`
        .normalize("NFKC")
        .toLowerCase();

    if (
      /contact|nous-contacter|nous-joindre|contact-us|get-in-touch|kontakt|contacto|contatti/.test(
        value
      )
    ) {
      return 100;
    }

    if (
      /mentions?-legales?|legal|legal-notice|imprint|impressum|privacy|confidential|politique-de-confidentialite/.test(
        value
      )
    ) {
      return 90;
    }

    if (
      /a-propos|about|qui-sommes-nous|equipe|team|notre-histoire|our-story/.test(
        value
      )
    ) {
      return 70;
    }

    return 0;
  }

  const selected =
    discovery.candidates
      .map(candidate => ({
        candidate,
        score:
          contactPriority(
            candidate
          ),
      }))
      .filter(
        item =>
          item.score > 0
      )
      .sort(
        (a, b) =>
          b.score - a.score
      )
      .slice(
        0,
        maxPages
      );

  const pages =
    await loadPages(
      selected,
      discovery.homePage,
      options.usage
    );

  return {
    discoveredCount:
      discovery.candidates.length,

    selectedUrls:
      selected.map(
        item =>
          item.candidate.url
      ),

    pages:
      pages.map(page => ({
        url:
          page.url,

        title:
          page.title,

        text:
          page.text,

        emails:
          page.emails || [],

        contentHash:
          page.contentHash,
      })),
  };
}

