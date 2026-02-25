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
        className="fixed left-4 top-16 z-[60] inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/18 backdrop-blur-xl border border-white/35 shadow-xl"
      >
        <span className="flex flex-col gap-1">
          <span className="block h-[2px] w-5 bg-[hsl(var(--brand))]" />
          <span className="block h-[2px] w-5 bg-[hsl(var(--brand))]" />
          <span className="block h-[2px] w-5 bg-[hsl(var(--brand))]" />
        </span>
        <span className="sr-only">Menu</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[2000]">
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div className="absolute inset-2 rounded-3xl bg-[#1f1f1f] shadow-xl border border-[hsl(var(--brand))]/25 overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex flex-col leading-none">
  <span className="text-lg font-semibold text-white">Indie Map</span>
  <span className="text-xs tracking-widest text-[#5C6E3B] italic -rotate-2 inline-block -mt-1">Back To Local</span>
</div>
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

            <div className="px-5 py-4 text-xs text-white  bg-[#1f1f1f]">
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
      className="block rounded-2xl px-4 py-3 text-base text-[hsl(var(--brand))] hover:bg-[hsl(var(--brand))]/10 active:bg-[hsl(var(--brand))]/20"
    >
      {children}
    </Link>
  );
}
