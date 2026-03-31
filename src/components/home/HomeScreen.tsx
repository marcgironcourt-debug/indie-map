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
    <div className="h-[100dvh] w-full bg-[#2a2a24] text-white px-6">
      <div className="mx-auto flex h-full w-full max-w-md flex-col items-center pt-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <h1 className="text-[26px] font-semibold tracking-tight text-white">
            Indie Map
          </h1>

          <span
            className="-mt-1 inline-block -rotate-2 text-[14px] italic tracking-[0.13em] text-[#5C6E3B]"
            
          >
            Back To Local
          </span>
        </div>

        <div className="mt-8 w-full space-y-4">

          <button
            onClick={() => router.push(`/${locale}/carte`)}
            className="relative w-full h-[118px] overflow-hidden rounded-[999px]"
            style={{
              background: "linear-gradient(180deg, rgba(125,116,49,0.96) 0%, rgba(86,78,30,0.96) 100%)",
              boxShadow: "inset 0 2px 0 rgba(255,255,255,0.16), inset 0 -10px 18px rgba(0,0,0,0.28), 0 14px 24px rgba(0,0,0,0.18)"
            }}
          >
            <div
              className="absolute inset-[1px] rounded-[999px]"
              style={{
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -1px 0 rgba(0,0,0,0.20)"
              }}
            ></div>
            <img
              src="/explorer-bg.png"
              alt=""
              className="absolute inset-0 h-full w-full object-cover scale-105 opacity-88"
              style={{ filter: "blur(2px)" }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(111,101,40,0.10) 28%, rgba(111,101,40,0.32) 100%)"
              }}
            ></div>
            <div
              className="absolute inset-0"
              style={{
                boxShadow: "inset 0 20px 26px rgba(255,255,255,0.06), inset 0 -24px 28px rgba(0,0,0,0.26)"
              }}
            ></div>
            <div className="relative z-10 flex h-full flex-col justify-center items-center px-8 text-white">
              <p className="text-xl font-semibold">Explorer</p>
              <p className="text-sm opacity-80">Trouver des lieux autour de vous</p>
            </div>
          </button>

          <div className="grid grid-cols-2 gap-4">

            <div className="relative rounded-2xl bg-white/10 p-4 h-[110px]">
              <p className="text-base font-medium">Découverte</p>
              <p className="text-sm opacity-70">Un lieu à découvrir</p>
              <span className="absolute bottom-3 right-3 text-2xl">🧭</span>
            </div>

            <div className="relative rounded-2xl bg-white/10 p-4 h-[110px]">
              <p className="text-base font-medium">Nouveaux lieux</p>
              <p className="text-sm opacity-70">Ajoutés récemment</p>
              <span className="absolute bottom-3 right-3 text-2xl">➕</span>
            </div>

            <div className="relative rounded-2xl bg-white/10 p-4 h-[110px] col-span-2">
              <p className="text-base font-medium">Mes lieux</p>
              <p className="text-sm opacity-70">Aimés, visités, à tester</p>
              <span className="absolute bottom-3 right-3 text-2xl">🔖</span>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
