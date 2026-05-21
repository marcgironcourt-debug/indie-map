import fs from "node:fs";
import path from "node:path";

import HomeScreen from "../../components/home/HomeScreen";
import { pickContextPlace } from "@/lib/contextSuggestions";

type Props = { params: Promise<{ locale: string }> };

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

function readPlaces(locale: string): Place[] {
  const filePath = path.join(process.cwd(), "data", "places.json");
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  const arr = Array.isArray(parsed) ? parsed : [];
  return arr
    .map((item: any) => ({
      id: String(item?.id ?? ""),
      name: String(item?.name ?? "").trim(),
      lat: typeof item?.lat === "number" ? item.lat : undefined,
      lng: typeof item?.lng === "number" ? item.lng : undefined,
      panoramaImage: String(item?.panoramaImage ?? "").trim() || undefined,
      city: String(item?.city ?? "").trim() || undefined,
      address: String(item?.address ?? "").trim() || undefined,
      category: String(item?.category ?? "").trim() || undefined,
      website: String(item?.website ?? "").trim() || undefined,
      miniText: String((locale === "en" ? item?.translations?.en?.miniText : item?.miniText) ?? item?.miniText ?? "").trim() || undefined,
      createdAt: String(item?.createdAt ?? "").trim() || undefined,
      updatedAt: String(item?.updatedAt ?? "").trim() || undefined,
      homeTextNear: String(item?.homeTextNear ?? "").trim() || undefined,
      homeTextFar: String(item?.homeTextFar ?? "").trim() || undefined,
      homeTextNearEn: String(item?.translations?.en?.homeTextNear ?? "").trim() || undefined,
      homeTextFarEn: String(item?.translations?.en?.homeTextFar ?? "").trim() || undefined
    }))
    .filter((item: Place) =>
      !!item.id &&
      !!item.name &&
      Number.isFinite(item.lat) &&
      Number.isFinite(item.lng)
    );
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  const l = locale === "en" ? "en" : "fr";

  const allPlaces = readPlaces(l);
  const now = new Date();
  const dayKey = getLocalDayKey(now);

  const initialDiscoverPlace = allPlaces.length > 0 ? pickDailyPlace(allPlaces, dayKey) : null;
  const contextPool = allPlaces.filter((item) => item.id !== initialDiscoverPlace?.id);
  const initialContextPlace =
    pickContextPlace(contextPool, now) ??
    pickContextPlace(allPlaces, now);

  const initialNewPlaces = [...allPlaces]
    .filter((item) => item.id !== initialDiscoverPlace?.id && item.id !== initialContextPlace?.id)
    .sort((a, b) => {
      const aTime = Date.parse(a.updatedAt || a.createdAt || "") || 0;
      const bTime = Date.parse(b.updatedAt || b.createdAt || "") || 0;
      return bTime - aTime;
    })
    .slice(0, 5);

  return (
    <HomeScreen
      locale={l}
      initialDiscoverPlace={initialDiscoverPlace}
      initialContextPlace={initialContextPlace}
      initialNewPlaces={initialNewPlaces}
    />
  );
}
