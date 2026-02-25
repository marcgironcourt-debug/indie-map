"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function MobileMenu({ locale }: { locale: string }) {
  const [open, setOpen] = useState(false);

  const hrefs = useMemo(() => {
    const base = `/${locale}`;
    return {
      explorer: base,
      pros: `${base}/professionnels`,
      contrib: `${base}/contribution`,
      about: `${base}/a-propos`,
      dons: `${base}/dons`,
    };
  }, [locale]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="fixed left-4 top-16 z-[60] inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 backdrop-blur border border-black/10 shadow-sm"
      >
        <span className="block h-[2px] w-5 bg-black/80" />
        <span className="sr-only">Menu</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div className="absolute left-4 right-4 top-4 rounded-3xl bg-white shadow-xl border border-black/10 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="text-lg font-semibold">Indie Map</div>
              <button
                type="button"
                aria-label="Fermer le menu"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10"
              >
                <span className="text-xl leading-none">×</span>
              </button>
            </div>

            <nav className="px-2 pb-2">
              <MenuLink href={hrefs.explorer} onPick={() => setOpen(false)}>
                Explorer
              </MenuLink>
              <MenuLink href={hrefs.pros} onPick={() => setOpen(false)}>
                Professionnels
              </MenuLink>
              <MenuLink href={hrefs.contrib} onPick={() => setOpen(false)}>
                Contribution
              </MenuLink>
              <MenuLink href={hrefs.about} onPick={() => setOpen(false)}>
                À propos
              </MenuLink>
              <MenuLink href={hrefs.dons} onPick={() => setOpen(false)}>
                Dons
              </MenuLink>
            </nav>

            <div className="px-5 py-4 text-xs text-black/60 border-t border-black/10">
              Indépendant. Sans publicité. Sans revente de données.
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function MenuLink({
  href,
  children,
  onPick,
}: {
  href: string;
  children: React.ReactNode;
  onPick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onPick}
      className="block rounded-2xl px-4 py-3 text-base hover:bg-black/5 active:bg-black/10"
    >
      {children}
    </Link>
  );
}
