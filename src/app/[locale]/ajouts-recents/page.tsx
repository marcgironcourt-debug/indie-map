import fs from "node:fs";
import path from "node:path";

import Link from "next/link";

type Props = {
  params: Promise<{ locale: string }>;
};

type RecentPlace = {
  id: string;
  name: string;
  panoramaImage?: string;
  city?: string;
  category?: string;
  createdAt?: string;
};

function readRecentPlaces(): RecentPlace[] {
  const filePath = path.join(process.cwd(), "data", "places.json");
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  const places = Array.isArray(parsed) ? parsed : [];

  return places
    .map((item: any) => ({
      id: String(item?.id ?? "").trim(),
      name: String(item?.name ?? "").trim(),
      panoramaImage:
        String(item?.panoramaImage ?? "").trim() || undefined,
      city:
        String(item?.city ?? "").trim() || undefined,
      category:
        String(item?.category ?? "").trim() || undefined,
      createdAt:
        String(item?.createdAt ?? "").trim() || undefined,
    }))
    .filter((item: RecentPlace) => item.id && item.name)
    .sort((a: RecentPlace, b: RecentPlace) => {
      const aTime = Date.parse(a.createdAt || "") || 0;
      const bTime = Date.parse(b.createdAt || "") || 0;
      return bTime - aTime;
    })
    .slice(0, 30);
}

export default async function RecentAdditionsPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale === "en" ? "en" : "fr";
  const isFr = locale === "fr";
  const places = readRecentPlaces();

  return (
    <main className="h-dvh overflow-y-auto overscroll-y-contain bg-black text-white">
      <div className="mx-auto min-h-dvh w-full max-w-[520px]">

        <header className="sticky top-0 z-20 bg-black/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+14px)] backdrop-blur-xl">
          <div className="flex items-center">
            <Link
              href={`/${locale}`}
              aria-label={isFr ? "Retour" : "Back"}
              className="mr-2 flex h-8 w-8 shrink-0 items-center justify-start text-[22px] leading-none text-white/75 active:opacity-50"
            >
              ←
            </Link>

            <h1 className="font-serif text-[17px] font-medium tracking-[0.01em]">
              {isFr ? "Ajouts récents" : "Recent additions"}
            </h1>
          </div>

                  </header>

        <div className="touch-pan-y space-y-2.5 px-3 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-2">
          {places.map((place) => {
            const meta = [place.category, place.city]
              .filter(Boolean)
              .join(" · ");

            return (
              <Link
                key={place.id}
                prefetch={false}
                href={`/${locale}?openPlace=${encodeURIComponent(place.id)}&source=recent_additions_all`}
                className="flex min-h-[84px] w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-2.5 text-left active:bg-white/[0.08]"
              >
                <div className="h-[64px] w-[82px] shrink-0 overflow-hidden rounded-xl bg-white/[0.06]">
                  <img
                    src={place.panoramaImage || "/explorer-bg.png?v=3"}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-serif text-[15px] font-medium leading-[1.2] tracking-[0.01em] text-white/95">
                    {place.name}
                  </p>

                  {meta ? (
                    <p className="mt-1.5 truncate text-[10px] tracking-[0.015em] text-white/42">
                      {meta}
                    </p>
                  ) : null}
                </div>

                <span
                  aria-hidden="true"
                  className="shrink-0 pr-1 text-[20px] font-light leading-none text-white/28"
                >
                  ›
                </span>
              </Link>
            );
          })}
        </div>

      </div>
    </main>
  );
}
