import fs from "node:fs";
import path from "node:path";

import HomeScreen from "../../components/home/HomeScreen";

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

function normalizeCategory(value: string | undefined) {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return "";
  if (v === "café" || v === "cafe" || v === "café / brunch") return "cafe";
  if (v === "boulangerie") return "boulangerie";
  if (v === "restaurant") return "restaurant";
  if (v === "brunch") return "brunch";
  if (
    v === "bar" ||
    v === "pub" ||
    v === "brasserie" ||
    v === "brasserie / bar" ||
    v === "brasserie / bar / pub" ||
    v === "brasserie bar"
  ) return "bar";
  if (v === "épicerie" || v === "epicerie" || v === "grocery") return "epicerie";
  if (v === "ferme") return "ferme";
  if (v === "librairie") return "librairie";
  if (v === "boutique" || v === "mode" || v === "artisanat" || v === "artisanat / créateurs locaux") return "boutique";
  if (v === "atelier") return "atelier";
  if (v === "lieu alternatif" || v === "lieu de vie") return "alternatif";
  if (v === "marché" || v === "marche") return "marche";
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getContextCategoryTargets(now: Date) {
  const hour = now.getHours();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;
  const targets: string[] = [];

  if (hour >= 6 && hour < 11) targets.push("cafe", "boulangerie");
  if (hour >= 11 && hour < 14) targets.push("restaurant", "brunch");
  if (hour >= 14 && hour < 17) targets.push("boutique", "librairie", "atelier");
  if (hour >= 16 && hour < 20) targets.push("epicerie", "ferme", "restaurant");
  if (hour >= 17 || hour < 1) targets.push("bar", "restaurant", "alternatif");
  if (isWeekend) targets.push("marche", "ferme", "brunch", "librairie", "alternatif", "cafe");
  if (targets.length === 0) targets.push("cafe", "restaurant", "boutique");

  return [...new Set(targets)];
}

function pickContextPlace(list: Place[], now: Date) {
  const targets = getContextCategoryTargets(now);
  const scored = list
    .map((item) => {
      const normalized = normalizeCategory(item.category);
      const index = targets.indexOf(normalized);
      return {
        item,
        index,
        updatedAt: Date.parse(item.updatedAt || item.createdAt || "") || 0
      };
    })
    .filter((entry) => entry.index >= 0)
    .sort((a, b) => {
      if (a.index !== b.index) return a.index - b.index;
      return b.updatedAt - a.updatedAt;
    });

  return scored[0]?.item ?? null;
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
      initialAllPlaces={allPlaces}
    />
  );
}
