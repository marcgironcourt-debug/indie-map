import HomeScreen from "../../components/home/HomeScreen";
import { readPlaceCatalogueWithProfessionalOverrides } from "@/lib/placeCatalogue";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    openPlace?: string | string[];
    source?: string | string[];
  }>;
};

type RawHomePlace = {
  id?: unknown;
  name?: unknown;
  lat?: unknown;
  lng?: unknown;
  panoramaImage?: unknown;
  city?: unknown;
  address?: unknown;
  category?: unknown;
  website?: unknown;
  phone?: unknown;
  openingHours?: unknown;
  timeZone?: unknown;
  miniText?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  homeTextNear?: unknown;
  homeTextFar?: unknown;
  translations?: {
    en?: {
      miniText?: unknown;
      homeTextNear?: unknown;
      homeTextFar?: unknown;
    };
  };
};

type Place = {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  panoramaImage?: string;
  city?: string;
  address?: string;
  category?: string;
  website?: string;
phone?: string;
openingHours?: string;
timeZone?: string;
  miniText?: string;
  createdAt?: string;
  updatedAt?: string;
  homeTextNear?: string;
  homeTextFar?: string;
  homeTextNearEn?: string;
  homeTextFarEn?: string;
};

function getLocalDayKey(now: Date) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function pickDailyPlace(list: Place[], dayKey: string) {
  const sorted = [...list].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  let hash = 0;
  const seed = dayKey + "|" + sorted.length;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return sorted[hash % sorted.length] ?? null;
}

async function readPlaces(
  locale: string,
): Promise<Place[]> {
  const arr =
    await readPlaceCatalogueWithProfessionalOverrides();

  return arr
    .map((rawItem) => {
      const item =
        rawItem as RawHomePlace;

      return ({
      id: String(item?.id ?? ""),
      name: String(item?.name ?? "").trim(),
      lat: typeof item?.lat === "number" ? item.lat : undefined,
      lng: typeof item?.lng === "number" ? item.lng : undefined,
      panoramaImage: String(item?.panoramaImage ?? "").trim() || undefined,
      city: String(item?.city ?? "").trim() || undefined,
      address: String(item?.address ?? "").trim() || undefined,
      category: String(item?.category ?? "").trim() || undefined,
      website: String(item?.website ?? "").trim() || undefined,
phone: String(item?.phone ?? "").trim() || undefined,
openingHours: String(item?.openingHours ?? "").trim() || undefined,
timeZone: String(item?.timeZone ?? "").trim() || undefined,
      miniText: String((locale === "en" ? item?.translations?.en?.miniText : item?.miniText) ?? item?.miniText ?? "").trim() || undefined,
      createdAt: String(item?.createdAt ?? "").trim() || undefined,
      updatedAt: String(item?.updatedAt ?? "").trim() || undefined,
      homeTextNear: String(item?.homeTextNear ?? "").trim() || undefined,
      homeTextFar: String(item?.homeTextFar ?? "").trim() || undefined,
      homeTextNearEn: String(item?.translations?.en?.homeTextNear ?? "").trim() || undefined,
      homeTextFarEn: String(item?.translations?.en?.homeTextFar ?? "").trim() || undefined
      });
    })
    .filter((item: Place) =>
      !!item.id &&
      !!item.name &&
      Number.isFinite(item.lat) &&
      Number.isFinite(item.lng)
    );
}

export default async function Page({ params, searchParams }: Props) {
  const { locale } = await params;
const query = await searchParams;

const requestedOpenPlace =
  typeof query?.openPlace === "string" ? query.openPlace : null;

const requestedSource =
  typeof query?.source === "string" ? query.source : null;

  const l = locale === "en" ? "en" : "fr";

  const allPlaces = await readPlaces(l);

const supportedOpenPlaceSource =
  requestedSource === "recent_additions_all" ||
  requestedSource === "professional_space"
    ? requestedSource
    : null;

const initialSelectedHomePlace =
  requestedOpenPlace && supportedOpenPlaceSource
    ? allPlaces.find(
        (item) =>
          String(item.id) ===
          String(requestedOpenPlace),
      ) ?? null
    : null;

  const now = new Date();
  const dayKey = getLocalDayKey(now);

  const initialDiscoverPlace = allPlaces.length > 0 ? pickDailyPlace(allPlaces, dayKey) : null;
  const initialNewPlaces = [...allPlaces]
.sort((a, b) => {
const aTime = Date.parse(a.createdAt || "") || 0;
const bTime = Date.parse(b.createdAt || "") || 0;
return bTime - aTime;
})
.slice(0, 5);

  return (
    <HomeScreen
      locale={l}
      initialDiscoverPlace={initialDiscoverPlace}
      initialNewPlaces={initialNewPlaces}
      initialAllPlaces={allPlaces}
      initialSelectedHomePlace={initialSelectedHomePlace}
      initialSelectedHomePlaceSource={
        initialSelectedHomePlace &&
        supportedOpenPlaceSource
          ? supportedOpenPlaceSource
          : "home_detail"
      }
    />
  );
}
