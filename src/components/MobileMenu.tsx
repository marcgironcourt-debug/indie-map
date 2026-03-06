"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import ContributeForm from "@/components/ContributeForm";

type Panel = null | "pros" | "contrib" | "about";

export default function MobileMenu({ locale }: { locale: string }) {
  const pathname = usePathname();
  const isPrivacy = (pathname || "").endsWith("/privacy");
  const isPros = (pathname || "").endsWith("/professionnels");
  const isContrib = (pathname || "").endsWith("/contribution");
  const isAbout = (pathname || "").endsWith("/a-propos");

  const isFr = locale === "fr";

  const [heroOpen, setHeroOpen] = React.useState(false);
  const [panel, setPanel] = React.useState<Panel>(null);
  const [anim, setAnim] = React.useState(false);
  const [bounds, setBounds] = React.useState<{ top: number; bottom: number }>({ top: 0, bottom: 0 });
  const panelScrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!panel) return;
    window.requestAnimationFrame(() => {
      panelScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
  }, [panel]);

  const hrefs = React.useMemo(() => {
    const base = `/${locale}`;
    return {
      pros: `${base}/professionnels`,
      contrib: `${base}/contribution`,
      about: `${base}/a-propos`,
      privacy: `${base}/privacy`,
      support: `${base}/support`,
    };
  }, [locale]);

  const canShowBar = !heroOpen && !isPrivacy && !isPros && !isContrib && !isAbout;

  const title = "Indie Map";


  const closePanel = React.useCallback(() => {
    setAnim(false);
    window.setTimeout(() => setPanel(null), 180);
  }, []);
  React.useEffect(() => {
    const onHero = (e: Event) => {
      const ce = e as CustomEvent<{ open?: boolean }>;
      const v = Boolean(ce.detail?.open);
      setHeroOpen(v);
      if (v) closePanel();
    };
    window.addEventListener("im:hero", onHero);
    return () => window.removeEventListener("im:hero", onHero);
  }, [closePanel]);

  React.useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, closePanel]);

  const measure = React.useCallback(() => {
    if (typeof window === "undefined") return;

    const bar = document.getElementById("im-bottom-bar");
    const barInner = bar ? (bar.querySelector(":scope > div") as HTMLElement | null) : null;
    const filters = document.getElementById("im-filters");
    const wh = window.innerHeight || 0;

    const f = filters?.getBoundingClientRect();
    const b = (barInner || bar)?.getBoundingClientRect();

    const top = Math.max(0, Math.round((f?.bottom ?? 0) + 14));
    const bottom = Math.max(0, Math.round(wh - (b?.top ?? wh)));

    setBounds({ top, bottom });
  }, []);

  React.useEffect(() => {
    if (!panel) return;
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [panel, measure]);

  React.useEffect(() => {
    if (!panel) {
      setAnim(false);
      return;
    }
    const raf = requestAnimationFrame(() => {
      measure();
      requestAnimationFrame(() => setAnim(true));
    });
    return () => cancelAnimationFrame(raf);
  }, [panel, measure]);

  function openPanel(next: Exclude<Panel, null>) {
    setPanel(next);
  }
  return (
    <>
      {canShowBar ? (
        <div id="im-bottom-bar" className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-1">
          <div className={"w-[92%] max-w-md mx-auto bg-neutral-800 shadow-xl border border-neutral-700 " + (panel ? "border-t-0 " : "") + "px-4 py-1.5 " + (panel ? "rounded-b-3xl rounded-t-none" : "rounded-3xl")}>
            <div className="grid grid-cols-3">
              <button
                type="button"
                onClick={() => (panel === "pros" ? closePanel() : openPanel("pros"))}
                className={"flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl hover:bg-white/10 active:bg-white/15 text-white" + (panel === "pros" ? " bg-white/12" : "")}
                aria-label={isFr ? "Ouvrir l’espace professionnel" : "Open professional space"}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 6h4" />
                  <path d="M10 6a2 2 0 0 0-2 2v1h8V8a2 2 0 0 0-2-2" />
                  <path d="M4 10h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9z" />
                  <path d="M9 14h6" />
                </svg>
                <span className={"text-[11px] " + (panel === "pros" ? "text-white" : "text-white/85")}>{isFr ? "Espace pro" : "Pros"}</span>
              </button>

              <button
                type="button"
                onClick={() => (panel === "contrib" ? closePanel() : openPanel("contrib"))}
                className={"flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl hover:bg-white/10 active:bg-white/15 text-white" + (panel === "contrib" ? " bg-white/12" : "")}
                aria-label={isFr ? "Ouvrir contribution" : "Open contribution"}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
                <span className={"text-[11px] " + (panel === "contrib" ? "text-white" : "text-white/85")}>{isFr ? "Contribution" : "Contribute"}</span>
              </button>

              <button
                type="button"
                onClick={() => (panel === "about" ? closePanel() : openPanel("about"))}
                className={"flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl hover:bg-white/10 active:bg-white/15 text-white" + (panel === "about" ? " bg-white/12" : "")}
                aria-label={isFr ? "Ouvrir infos" : "Open info"}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16v-5" />
                  <path d="M12 8h.01" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
                <span className={"text-[11px] " + (panel === "about" ? "text-white" : "text-white/85")}>{isFr ? "Infos" : "Info"}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {panel ? (
        <div className="fixed z-[2001] px-3 overflow-hidden" style={{ left: 0, right: 0, top: bounds.top, bottom: bounds.bottom }}>
          <div
            className={
              "w-[92%] max-w-md mx-auto h-full rounded-t-3xl rounded-b-[0px] bg-neutral-800 border border-neutral-700 border-t-0 overflow-hidden flex flex-col min-h-0 " +
              "transition-transform duration-200 ease-out " +
              (anim ? "translate-y-0" : "translate-y-full")
            }
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex flex-col leading-none">
                <span className="text-lg font-semibold text-white">{title}</span>
                <span className="text-xs tracking-widest text-[#5C6E3B] italic -rotate-2 inline-block -mt-1">Back To Local</span>
              </div>
              <button type="button" aria-label={isFr ? "Fermer" : "Close"} onClick={closePanel} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl">
                <span className="text-2xl leading-none text-white">×</span>
              </button>
            </div>

            <div ref={panelScrollRef} className={"px-5 pb-6 flex-1 min-h-0 overflow-auto transition-opacity duration-150 " + (anim ? "opacity-100" : "opacity-0")}>
              {panel === "pros" ? (
                isFr ? (
                  <>
                    <p className="mb-4 text-white/80">
                      Indie Map met en avant des lieux indépendants qui privilégient le local, la réparation, le réemploi, l’agriculture respectueuse, et plus largement une économie plus sobre et plus humaine.
                    </p>

                    <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Ce que nous faisons</h2>
                    <ul className="list-disc pl-5 space-y-1 text-white/80">
                      <li>Rendre votre lieu visible dans une carte claire, centrée sur la découverte.</li>
                      <li>Présenter l’essentiel : histoire du lieu, démarche, informations pratiques.</li>
                      <li>Améliorer le produit à partir de statistiques d’usage globales et anonymes.</li>
                    </ul>

                    <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Pour qui ?</h2>
                    <p className="text-white/80">
                      Pour les commerces et lieux qui assument une démarche cohérente : sourcing local, fabrication responsable, économie circulaire, indépendance, utilité sociale, ou contribution concrète à la vie du territoire.
                    </p>

                    <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Devenir partenaire</h2>
                    <p className="text-white/80">
                      Le partenariat vise à construire quelque chose de durable : un produit utile, éthique, et crédible sur le long terme. Si vous souhaitez rejoindre Indie Map, contactez-nous .
                    </p>

                    <a href="mailto:pro@indie-map.com?subject=Partenariat%20%E2%80%94%20Indie%20Map" target="_blank" rel="noopener noreferrer" className="inline-block mt-2 px-5 py-3 rounded-2xl bg-[hsl(var(--brand))] text-white font-medium no-underline hover:bg-[hsl(var(--brand-600))]">
                      Contact
                    </a>
                  </>
                ) : (
                  <>
                    <p className="mb-4 text-white/80">
                      Indie Map highlights independent places that prioritize local sourcing, repair, reuse, regenerative or respectful farming, and more broadly a simpler and more human economy.
                    </p>

                    <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">What we do</h2>
                    <ul className="list-disc pl-5 space-y-1 text-white/80">
                      <li>Make your place visible on a clear map designed for discovery.</li>
                      <li>Show the essentials: the place, the approach, and practical info.</li>
                      <li>Improve the product using aggregated and anonymous usage statistics.</li>
                    </ul>

                    <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Who is it for?</h2>
                    <p className="text-white/80">
                      For businesses and places with a consistent approach: local sourcing, responsible making, circular economy, independence, social utility, or a tangible positive impact on their territory.
                    </p>

                    <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Become a partner</h2>
                    <p className="text-white/80">
                      Partnership is about building something durable: a useful, ethical, and long-term credible product. If you want to join Indie Map, please reach out .
                    </p>

                    <a href="mailto:pro@indie-map.com" target="_blank" rel="noopener noreferrer" className="inline-block mt-2 px-5 py-3 rounded-2xl bg-[hsl(var(--brand))] text-white font-medium no-underline hover:bg-[hsl(var(--brand-600))]">
                      Contact
                    </a>
                  </>
                )
              ) : panel === "contrib" ? (
                isFr ? (
                  <>
                    <p className="mb-4 text-white/80">
                      Indie Map grandit grâce aux contributions. L’objectif : rendre visibles des lieux indépendants qui privilégient le local, la réparation, le réemploi, l’agriculture respectueuse et des pratiques cohérentes.
                    </p><div className="mt-4">
                      <ContributeForm locale={isFr ? "fr" : "en"} />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mb-4 text-white/80">
                      Indie Map grows through contributions. The goal: highlight independent places that prioritize local sourcing, repair, reuse, respectful farming, and consistent real-world practices.
                    </p>

                    <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">How you can help</h2>
                    <ul className="list-disc pl-5 space-y-1 text-white/80">
                      <li>Suggest a place to add (shop, farm, market, workshop, cooperative, etc.).</li>
                      <li>Report an error (address, opening hours, website, phone, category).</li>
                      <li>Share a clean, useful photo/panorama (no identifiable people if possible).</li>
                      <li>Suggest a product improvement (UX, clarity, performance, accessibility).</li>
                    </ul>

                    <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Send a contribution</h2>
                    <div className="mt-4">
                      <ContributeForm locale={isFr ? "fr" : "en"} />
                    </div>
                  </>
                )
              ) : (
                isFr ? (
                  <>
                    <p className="mb-4 text-white/80">
                      Indie Map est né d’une difficulté simple : trouver des lieux qui produisent ou travaillent réellement localement.
                    </p>
                    <p className="mb-4 text-white/80">
                      En voyage comme dans sa propre ville, il devient compliqué d’identifier ce qui est fabriqué, cultivé ou pensé à l’échelle d’un territoire. Les informations existent, mais elles sont dispersées.
                    </p>
                    <p className="mb-4 text-white/80"></p>
                    <p className="mb-4 text-white/80">
                      L’application référence des cafés, restaurants, ateliers, fermes, marchés, librairies ou boutiques qui ont un lien concret avec leur environnement : production locale, circuits courts, fabrication sur place, agriculture respectueuse, transformation artisanale.
                    </p>
                    <p className="mb-4 text-white/80"></p>
                    <p className="mb-4 text-white/80">
                      Chaque lieu est présenté avec des informations essentielles : où il se trouve, ce qu’il fait, comment il fonctionne.
                    </p>
                    <p className="text-white/80">
                      Indie Map est conçu comme un outil simple : une carte pour repérer plus facilement ce qui se fait localement, où que l’on soit.</p>
                  </>
                ) : (
                  <>
                    <p className="mb-4 text-white/80">
                      Indie Map was created from a simple difficulty: finding places that genuinely produce or work locally.
                    </p>
                    <p className="mb-4 text-white/80">
                      Whether traveling or in your own city, it can be hard to identify what is actually made, grown, or rooted in a specific territory. The information exists, but it is scattered.
                    </p>
                    <p className="mb-4 text-white/80">Indie Map gathers these places on a clear map.</p>
                    <p className="mb-4 text-white/80">
                      The app references cafés, restaurants, workshops, farms, markets, bookstores, and shops that maintain a concrete link to their environment: local production, short supply chains, on-site making, respectful farming, artisanal transformation.
                    </p>
                    <p className="mb-4 text-white/80">
                      The goal is not to judge or rank. It is to make visible. While making it easier to consume differently.
                    </p>
                    <p className="mb-4 text-white/80">
                      Each place is presented with essential information: where it is, what it does, how it operates.
                    </p>
                    <p className="text-white/80">
                      Indie Map is designed as a simple tool: a map to more easily locate what is produced locally, wherever you are. The project grows progressively, city by city, prioritizing coherence and accuracy.
                    </p>
                  </>
                )
              )}

              {panel === "about" && (
                <div className="mt-4">
                  <p className="mb-2 text-sm text-white/80">
                    {isFr ? "Pour toutes questions ou suggestions :" : "For any questions or suggestions:"}
                  </p>
                  <a
                    href="mailto:contact@indie-map.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 px-5 py-3 rounded-2xl bg-[hsl(var(--brand))] text-white font-medium no-underline hover:bg-[hsl(var(--brand-600))]"
                  >
                    Contact
                  </a>
                </div>
              )}

              {panel === "about" && (
                <div className="mt-4 text-[11px] text-white/60">
                  <Link href={hrefs.privacy} onClick={closePanel} className="opacity-70 hover:opacity-100">
                    {isFr ? "Confidentialité" : "Privacy"}
                  </Link>
                  <br />
                  <Link href={hrefs.support} onClick={closePanel} className="opacity-70 hover:opacity-100">
                    {isFr ? "Support" : "Support"}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
