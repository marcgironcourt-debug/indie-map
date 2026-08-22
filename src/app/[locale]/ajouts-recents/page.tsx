import Link from "next/link";
import PlaceResultCard from "@/components/place/PlaceResultCard";
import { getLocalizedCategory } from "@/lib/localizedCategory";
import { readPlaceCatalogueWithProfessionalOverrides } from "@/lib/placeCatalogue";

type Props = {
  params: Promise<{ locale: string }>;
};

type RawRecentPlace = {
  id?: unknown;
  name?: unknown;
  panoramaImage?: unknown;
  city?: unknown;
  category?: unknown;
  miniText?: unknown;
  createdAt?: unknown;
  translations?: {
    en?: {
      miniText?: unknown;
    };
  };
};

type RecentPlace = {
  id: string;
  name: string;
  panoramaImage?: string;
  city?: string;
  category?: string;
  miniText?: string;
  createdAt?: string;
};

async function readRecentPlaces(
  locale: "fr" | "en",
): Promise<RecentPlace[]> {
  const places =
    await readPlaceCatalogueWithProfessionalOverrides();

  return places
    .map((rawItem) => {
      const item = rawItem as RawRecentPlace;

      return {
        id: String(item?.id ?? "").trim(),
        name: String(item?.name ?? "").trim(),
        panoramaImage:
          String(item?.panoramaImage ?? "").trim() || undefined,
        city:
          String(item?.city ?? "").trim() || undefined,
        category:
          String(item?.category ?? "").trim() || undefined,
        miniText:
          String(
            (
              locale === "en"
                ? item?.translations?.en?.miniText
                : item?.miniText
            ) ?? item?.miniText ?? "",
          ).trim() || undefined,
        createdAt:
          String(item?.createdAt ?? "").trim() || undefined,
      };
    })
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

  const places = await readRecentPlaces(locale);

  return (
    <main className="h-dvh overflow-y-auto overscroll-y-contain bg-black text-white">
      <div className="mx-auto min-h-dvh w-full max-w-[520px]">
        <header className="sticky top-0 z-20 bg-black/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+14px)] backdrop-blur-xl">
          <div className="flex items-center">
            <Link
              href={`/${locale}`}
              prefetch={false}
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

        <div className="touch-pan-y space-y-3 px-3 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-2">
          {places.map((place) => (
            <PlaceResultCard
              key={place.id}
              name={place.name}
              panoramaImage={place.panoramaImage}
              categoryKey={place.category}
              categoryLabel={getLocalizedCategory(place.category, isFr)}
              city={place.city}
              miniText={place.miniText}
              buttonLabel={isFr ? "Voir la fiche" : "View details"}
              href={`/${locale}?openPlace=${encodeURIComponent(place.id)}&source=recent_additions_all`}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
