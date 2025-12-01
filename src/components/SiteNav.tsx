"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Carte" },
  { href: "/a-propos", label: "À propos" },
  { href: "/commerces", label: "Pour les commerces" },
  { href: "/contact", label: "Contact" },
];

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Indie Map
        </Link>
        <div className="flex gap-2 text-xs sm:text-sm">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  "rounded-full px-3 py-1 transition " +
                  (active
                    ? "bg-slate-900 text-slate-50"
                    : "text-slate-700 hover:bg-slate-100")
                }
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
