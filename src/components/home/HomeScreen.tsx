"use client";

import { useRouter } from "next/navigation";

export default function HomeScreen({ locale }: { locale: "fr" | "en" }) {
  const router = useRouter();

  const t = {
    fr: {
      openMap: "Ouvrir la carte",
      idea: "Une idée pour aujourd’hui",
      recent: "Ajouts récents",
      ideaText: "Un lieu à découvrir",
      recentText: "Nouveaux lieux ajoutés",
    },
    en: {
      openMap: "Open map",
      idea: "An idea for today",
      recent: "Recent additions",
      ideaText: "A place to discover",
      recentText: "New places added",
    },
  }[locale];

  return (
    <div className="h-[100dvh] w-full bg-[#6F6528] text-white px-6">
      <div className="mx-auto flex h-full w-full max-w-md flex-col items-center pt-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src="/brand-splash-logo.png"
            alt="Indie Map"
            className="mb-2 h-[54px] w-[54px] object-contain"
          />

          <h1 className="text-[30px] font-semibold leading-none text-white">
            Indie Map
          </h1>

          <span
            className="mt-1 inline-block -rotate-2 text-[14px] italic tracking-[0.13em] text-[#5C6E3B]"
            style={{
              textShadow:
                "-0.7px -0.7px 0 rgba(255,255,255,0.95), 0.7px -0.7px 0 rgba(255,255,255,0.95), -0.7px 0.7px 0 rgba(255,255,255,0.95), 0.7px 0.7px 0 rgba(255,255,255,0.95)",
            }}
          >
            Back To Local
          </span>
        </div>

        <div className="w-full space-y-4">
          <button
            onClick={() => router.push(`/${locale}/carte`)}
            className="w-full rounded-2xl bg-white py-4 text-lg font-medium text-black"
          >
            {t.openMap}
          </button>

          <div className="w-full rounded-2xl bg-white/10 p-4">
            <p className="mb-1 text-sm opacity-70">{t.idea}</p>
            <p className="text-base">{t.ideaText}</p>
          </div>

          <div className="w-full rounded-2xl bg-white/10 p-4">
            <p className="mb-1 text-sm opacity-70">{t.recent}</p>
            <p className="text-base">{t.recentText}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
