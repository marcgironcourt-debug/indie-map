import React from "react";
import { setRequestLocale } from "next-intl/server";
import { locales, defaultLocale } from "../../../i18n";
import MobileMenu from "../../components/MobileMenu";

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const candidate = locale ?? defaultLocale;
  const finalLocale = (locales as readonly string[]).includes(candidate)
    ? candidate
    : defaultLocale;

  setRequestLocale(finalLocale);

  return (
    <div className="relative min-h-screen w-screen overflow-hidden">
      <MobileMenu locale={finalLocale} />
      {children}
    </div>
  );
}
