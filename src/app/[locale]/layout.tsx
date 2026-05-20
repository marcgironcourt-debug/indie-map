import React from "react";
import { setRequestLocale } from "next-intl/server";
import { locales, defaultLocale } from "../../../i18n";
import IosAppVersionGate from "@/components/app-update/IosAppVersionGate";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

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

  const appStoreUrl =
    finalLocale === "en"
      ? process.env.APP_STORE_URL_EN ||
        process.env.APP_STORE_URL ||
        "https://apps.apple.com/us/app/indie-map-back-to-local/id6761104779?l=en"
      : process.env.APP_STORE_URL_FR ||
        process.env.APP_STORE_URL ||
        "https://apps.apple.com/fr/app/indie-map-back-to-local/id6761104779?l=fr";

  const minimumIosBuild = Number.parseInt(
    process.env.IOS_MINIMUM_REQUIRED_BUILD || "0",
    10
  );

  return (
    <div className="relative min-h-screen w-screen overflow-hidden">
      <IosAppVersionGate
        locale={finalLocale}
        minimumBuild={Number.isFinite(minimumIosBuild) ? minimumIosBuild : 0}
        appStoreUrl={appStoreUrl}
      />
      {children}
    </div>
  );
}
