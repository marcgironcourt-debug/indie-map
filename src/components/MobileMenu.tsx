"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

type Panel = null | "pros" | "contrib" | "about";

export default function MobileMenu({ locale }: { locale: string }) {
  const pathname = usePathname();
  const isPrivacy = (pathname || "").endsWith("/privacy");
  const isPros = (pathname || "").endsWith("/professionnels");
  const isContrib = (pathname || "").endsWith("/contribution");
  const isAbout = (pathname || "").endsWith("/a-propos");

  const [heroOpen, setHeroOpen] = React.useState(false);
  const [panel, setPanel] = React.useState<Panel>(null);
  const [anim, setAnim] = React.useState(false);
  const [bounds, setBounds] = React.useState<{ top: number; bottom: number }>({ top: 0, bottom: 0 });

  const hrefs = React.useMemo(() => {
    const base = `/${locale}`;
    return {
      pros: `${base}/professionnels`,
      contrib: `${base}/contribution`,
      about: `${base}/a-propos`,
      privacy: `${base}/privacy`,
    };
  }, [locale]);

  const canShowBar = !heroOpen && !isPrivacy && !isPros && !isContrib && !isAbout;

  const title =
    panel === "pros" ? "Espace professionnel" : panel === "contrib" ? "Contribution" : panel === "about" ? "À propos" : "";

  const href =
    panel === "pros" ? hrefs.pros : panel === "contrib" ? hrefs.contrib : panel === "about" ? hrefs.about : hrefs.about;

  React.useEffect(() => {
    const onHero = (e: Event) => {
      const ce = e as CustomEvent<{ open?: boolean }>;
      const v = Boolean(ce.detail?.open);
      setHeroOpen(v);
      if (v) closePanel();
    };
    window.addEventListener("im:hero", onHero);
    return () => window.removeEventListener("im:hero", onHero);
  }, []);

  React.useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  const measure = React.useCallback(() => {
    if (typeof window === "undefined") return;

    const bar = document.getElementById("im-bottom-bar");
    const filters = document.getElementById("im-filters");
    const wh = window.innerHeight || 0;

    const f = filters?.getBoundingClientRect();
    const b = bar?.getBoundingClientRect();

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

  function closePanel() {
    setAnim(false);
    window.setTimeout(() => setPanel(null), 180);
  }

  return (
    <>
      {canShowBar ? (
        <div id="im-bottom-bar" className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
          <div className="w-full rounded-3xl bg-white/16 backdrop-blur-xl border border-white/30 shadow-xl px-2 py-2">
            <div className="grid grid-cols-3">
              <button
                type="button"
                onClick={() => openPanel("pros")}
                className="flex flex-col items-center justify-center gap-1 py-2 rounded-2xl hover:bg-white/10 active:bg-white/15 text-white"
                aria-label="Ouvrir l’espace professionnel"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 6h4" />
                  <path d="M10 6a2 2 0 0 0-2 2v1h8V8a2 2 0 0 0-2-2" />
                  <path d="M4 10h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9z" />
                  <path d="M9 14h6" />
                </svg>
                <span className="text-[11px] text-white/85">Espace pro</span>
              </button>

              <button
                type="button"
                onClick={() => openPanel("contrib")}
                className="flex flex-col items-center justify-center gap-1 py-2 rounded-2xl hover:bg-white/10 active:bg-white/15 text-white"
                aria-label="Ouvrir contribution"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
                <span className="text-[11px] text-white/85">Contribution</span>
              </button>

              <button
                type="button"
                onClick={() => openPanel("about")}
                className="flex flex-col items-center justify-center gap-1 py-2 rounded-2xl hover:bg-white/10 active:bg-white/15 text-white"
                aria-label="Ouvrir infos"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16v-5" />
                  <path d="M12 8h.01" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
                <span className="text-[11px] text-white/85">Infos</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {panel && canShowBar ? (
        <div className="fixed z-[2001] px-3" style={{ left: 0, right: 0, top: bounds.top, bottom: bounds.bottom }}>
          <div
            className={
              "w-full h-full rounded-3xl bg-[#1f1f1f] shadow-xl border border-[hsl(var(--brand))]/25 overflow-hidden " +
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
              <button type="button" aria-label="Fermer" onClick={closePanel} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl">
                <span className="text-2xl leading-none text-white">×</span>
              </button>
            </div>

            <div className="px-5 pb-5">
              <Link href={href} onClick={closePanel} className="block w-full rounded-2xl bg-[hsl(var(--brand))] text-black font-semibold px-4 py-3 text-center">
                Ouvrir la page
              </Link>

              <div className="mt-4 text-[11px] text-white/60">
                <Link href={hrefs.privacy} onClick={closePanel} className="opacity-70 hover:opacity-100">
                  Privacy / Confidentialité
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
