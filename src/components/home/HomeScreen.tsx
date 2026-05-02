"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";

import ContributeForm from "@/components/ContributeForm";
import MapPanel from "@/components/MapPanel";
import { isOpenNowFR } from "@/lib/openingHours";

type Panel = null | "pros" | "contrib" | "about" | "myPlaces" | "myPlacesList";

type DiscoverPlace = {
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
    miniText?: string;
  openingHours?: string;
  timeZone?: string;
  createdAt?: string;
  updatedAt?: string;
  homeTextNear?: string;
  homeTextFar?: string;
  homeTextNearEn?: string;
  homeTextFarEn?: string;
};

type NewPlace = DiscoverPlace;
type SavedPlace = DiscoverPlace;


function renderOpeningHours(openingHours: string | undefined, timeZone: string | undefined) {
  if (!openingHours) return null;

  const zone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date();

  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: zone,
  }).format(now).toLowerCase();

  const timeParts = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: zone,
  }).formatToParts(now);

  const currentMinutes =
    Number(timeParts.find((part) => part.type === "hour")?.value ?? 0) * 60 +
    Number(timeParts.find((part) => part.type === "minute")?.value ?? 0);

  const days: Record<string, string[]> = {
    monday: ["lundi", "monday"],
    tuesday: ["mardi", "tuesday"],
    wednesday: ["mercredi", "wednesday"],
    thursday: ["jeudi", "thursday"],
    friday: ["vendredi", "friday"],
    saturday: ["samedi", "saturday"],
    sunday: ["dimanche", "sunday"],
  };

  const todayLabels = days[today] ?? [];

  function parseHour(value: string) {
    const match = value.match(/(\d{1,2})\s*[h:]\s*(\d{2})?/i);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2] ?? 0);
  }

  function isLineOpenNow(line: string) {
    const normalized = line.trim().toLowerCase();
    if (normalized.includes("fermé") || normalized.includes("ferme") || normalized.includes("closed")) return false;

    const ranges = [...normalized.matchAll(/(\d{1,2}\s*[h:]\s*\d{0,2})\s*[-–—]\s*(\d{1,2}\s*[h:]\s*\d{0,2})/g)];

    return ranges.some((range) => {
      const startMinutes = parseHour(range[1]);
      const endMinutes = parseHour(range[2]);
      if (startMinutes === null || endMinutes === null) return false;
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    });
  }

  return openingHours.split(/\r?\n/).map((line, index) => {
    const normalized = line.trim().toLowerCase();
    const isToday = todayLabels.some((day) => normalized.startsWith(day));

    const color = isToday
      ? isLineOpenNow(line)
        ? "text-green-400"
        : "text-red-400"
      : "text-white/80";

    return (
      <div key={`${line}-${index}`} className={`text-[16px] font-serif leading-relaxed ${color}`}>
        {line}
      </div>
    );
  });
}

function getLocalizedCategory(category: string | undefined, isFr: boolean) {
  const key = String(category ?? "").trim().toLowerCase();

  const categories: Record<string, { fr: string; en: string }> = {
    "grocery": { fr: "Épicerie", en: "Grocery" },
    "épicerie": { fr: "Épicerie", en: "Grocery" },
    "epicerie": { fr: "Épicerie", en: "Grocery" },
    "café": { fr: "Café", en: "Cafe" },
    "cafe": { fr: "Café", en: "Cafe" },
    "restaurant": { fr: "Restaurant", en: "Restaurant" },
    "marché": { fr: "Marché", en: "Market" },
    "market": { fr: "Marché", en: "Market" },
    "boutique": { fr: "Boutique", en: "Shop" },
    "shop": { fr: "Boutique", en: "Shop" },
    "librairie": { fr: "Librairie", en: "Bookstore" },
    "bookstore": { fr: "Librairie", en: "Bookstore" },
    "boulangerie": { fr: "Boulangerie", en: "Bakery" },
    "bakery": { fr: "Boulangerie", en: "Bakery" },
    "ferme": { fr: "Ferme", en: "Farm" },
    "farm": { fr: "Ferme", en: "Farm" },
    "atelier": { fr: "Atelier", en: "Workshop" },
    "workshop": { fr: "Atelier", en: "Workshop" },
    "lieu alternatif": { fr: "Lieu alternatif", en: "Alternative place" },
    "alternative place": { fr: "Lieu alternatif", en: "Alternative place" },
  };

  return categories[key]?.[isFr ? "fr" : "en"] ?? String(category ?? "").trim();
}


declare global {
  interface Window {
    __IM_NATIVE_LOCATION__?: { lat?: number; lng?: number; ts?: number };
  }
  interface WindowEventMap {
    "im:native-location": CustomEvent<{ lat: number; lng: number }>;
  }
}

const homeMemoryCache: Record<string, { discoverPlace: DiscoverPlace | null; contextPlace: DiscoverPlace | null; newPlaces: NewPlace[] } | undefined> = {};
const SAVED_PLACES_KEY = "im-saved-places";
const PLACE_NOTES_KEY = "im:place-notes";

type PlaceNote = {
  visited?: boolean;
  comment?: string;
  updatedAt?: string;
};

function readPlaceNotes(): Record<string, PlaceNote> {
  try {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem(PLACE_NOTES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, PlaceNote>;
  } catch {
    return {};
  }
}

function writePlaceNotes(notes: Record<string, PlaceNote>) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PLACE_NOTES_KEY, JSON.stringify(notes));
    window.dispatchEvent(new Event("im:place-notes-updated"));
  } catch {}
}

function readSavedPlaces(): SavedPlace[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(SAVED_PLACES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item: any) => ({
        id: String(item?.id ?? "").trim(),
        name: String(item?.name ?? "").trim(),
        panoramaImage: String(item?.panoramaImage ?? "").trim() || undefined,
        city: String(item?.city ?? "").trim() || undefined,
        address: String(item?.address ?? "").trim() || undefined,
        lat: typeof item?.lat === "number" ? item.lat : undefined,
        lng: typeof item?.lng === "number" ? item.lng : undefined,
        createdAt: String(item?.createdAt ?? "").trim() || undefined,
        updatedAt: String(item?.updatedAt ?? "").trim() || undefined
      }))
      .filter((item: SavedPlace) => !!item.id && !!item.name);
  } catch {
    return [];
  }
}

const explorerPulseCss = `
@keyframes explorerPulse {
  0% { transform: scale(1.00); }
  50% { transform: scale(1.03); }
  100% { transform: scale(1.00); }
}
`;

function readHomeCache(locale: "fr" | "en") {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem("im-home-cache:" + locale);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const discover = parsed?.discover && typeof parsed.discover === "object" ? parsed.discover : null;
    const newest = Array.isArray(parsed?.newPlaces) ? parsed.newPlaces : [];
    const context = parsed?.context && typeof parsed.context === "object" ? parsed.context : null;
    return {
      discoverPlace: discover as DiscoverPlace | null,
      contextPlace: context as DiscoverPlace | null,
      newPlaces: newest as NewPlace[]
    };
  } catch {
    return null;
  }
}

function writeHomeCache(locale: "fr" | "en", discoverPlace: DiscoverPlace | null, contextPlace: DiscoverPlace | null, newPlaces: NewPlace[]) {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      "im-home-cache:" + locale,
      JSON.stringify({
        discover: discoverPlace ?? null,
        context: contextPlace ?? null,
        newPlaces: Array.isArray(newPlaces) ? newPlaces : []
      })
    );
  } catch {}
}

function mergePlace(base: DiscoverPlace | null | undefined, fresh: DiscoverPlace | null | undefined): DiscoverPlace | null {
  if (fresh && (!base || base.id === fresh.id)) {
    return { ...(base ?? {}), ...fresh };
  }
  return base ?? null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

function getLocalDayKey(now: Date) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function pickDailyPlace(list: DiscoverPlace[], dayKey: string) {
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

  if (hour >= 6 && hour < 11) {
    targets.push("cafe", "boulangerie");
  }

  if (hour >= 11 && hour < 14) {
    targets.push("restaurant", "brunch");
  }

  if (hour >= 14 && hour < 17) {
    targets.push("boutique", "librairie", "atelier");
  }

  if (hour >= 16 && hour < 20) {
    targets.push("epicerie", "ferme", "restaurant");
  }

  if (hour >= 17 || hour < 1) {
    targets.push("bar", "restaurant", "alternatif");
  }

  if (isWeekend) {
    targets.push("marche", "ferme", "brunch", "librairie", "alternatif", "cafe");
  }

  if (targets.length === 0) {
    targets.push("cafe", "restaurant", "boutique");
  }

  return [...new Set(targets)];
}

function pickContextPlaces(list: DiscoverPlace[], now: Date) {
  const targets = getContextCategoryTargets(now);
  return list
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
    })
    .map((entry) => entry.item);
}

function getSuggestionCopy(place: DiscoverPlace | null, locale: "fr" | "en", isNearby: boolean) {
  if (!place) return "";
  if (locale === "fr") {
    return (isNearby ? place.homeTextNear : place.homeTextFar) || "";
  }
  return (isNearby ? place.homeTextNearEn : place.homeTextFarEn) || "";
}

function getInitialSuggestionPlaces(
  all: DiscoverPlace[],
  now: Date,
  discoverPlace: DiscoverPlace | null | undefined,
  contextPlace: DiscoverPlace | null | undefined
) {
  const pool = all.filter((item) => item.id !== discoverPlace?.id);
  const picks = pickContextPlaces(pool.filter(isSuggestionCandidateOpen), now);
  const fallback = pickContextPlaces(pool, now);
  const list = (picks.length > 0 ? picks : fallback).slice(0, 3);
  if (list.length > 0) return list;
  return contextPlace ? [contextPlace] : [];
}

function isSuggestionCandidateOpen(place: DiscoverPlace) {
  const opening = String(place.openingHours ?? "").trim();
  const timeZone = String(place.timeZone ?? "").trim();
  if (!opening || !timeZone) return true;
  return isOpenNowFR(opening, timeZone) !== false;
}

export default function HomeScreen({
  locale,
  initialDiscoverPlace = null,
  initialContextPlace = null,
  initialNewPlaces = [],
  initialAllPlaces = []
}: {
  locale: "fr" | "en";
  initialDiscoverPlace?: DiscoverPlace | null;
  initialContextPlace?: DiscoverPlace | null;
  initialNewPlaces?: NewPlace[];
  initialAllPlaces?: DiscoverPlace[];
}) {
  const router = useRouter();
  const isFr = locale === "fr";
  const [panel, setPanel] = React.useState<Panel>(null);
  const panelScrollRef = React.useRef<HTMLDivElement | null>(null);
  const [discoverPlace, setDiscoverPlace] = React.useState<DiscoverPlace | null>(() => mergePlace(homeMemoryCache[locale]?.discoverPlace ?? null, initialDiscoverPlace ?? null));
  const [contextPlace, setContextPlace] = React.useState<DiscoverPlace | null>(() => mergePlace(homeMemoryCache[locale]?.contextPlace ?? null, initialContextPlace ?? null));
  const [contextPlaceNearby, setContextPlaceNearby] = React.useState(false);
  const [suggestionPlaces, setSuggestionPlaces] = React.useState<DiscoverPlace[]>(() => {
    const cachedContext = mergePlace(homeMemoryCache[locale]?.contextPlace ?? null, initialContextPlace ?? null);
    const cachedDiscover = mergePlace(homeMemoryCache[locale]?.discoverPlace ?? null, initialDiscoverPlace ?? null);
    const baseAll = (initialAllPlaces ?? []).filter((item) => !!item?.id && !!item?.name);
    return getInitialSuggestionPlaces(baseAll, new Date(), cachedDiscover, cachedContext);
  });
  const [suggestionIndex, setSuggestionIndex] = React.useState(0);
  const suggestionScrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    try { router.prefetch(`/${locale}/carte`); } catch {}
  }, [router, locale]);
  const [discoverReady, setDiscoverReady] = React.useState(() => {
    const cached = homeMemoryCache[locale];
    return Boolean(cached?.discoverPlace || cached?.contextPlace || (cached?.newPlaces?.length ?? 0) > 0 || initialDiscoverPlace || initialContextPlace || initialNewPlaces.length > 0);
  });
  const [newPlaces, setNewPlaces] = React.useState<NewPlace[]>(() => homeMemoryCache[locale]?.newPlaces ?? initialNewPlaces ?? []);
  const [selectedHomePlace, setSelectedHomePlace] = React.useState<DiscoverPlace | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchFocused, setSearchFocused] = React.useState(false);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<DiscoverPlace[] | null>(null);
  const [addressCopied, setAddressCopied] = React.useState(false);
  const [savedPlaces, setSavedPlaces] = React.useState<SavedPlace[]>(() => readSavedPlaces());
  const [placeNotes, setPlaceNotes] = React.useState<Record<string, PlaceNote>>(() => readPlaceNotes());
  const [editingPlaceNote, setEditingPlaceNote] = React.useState<SavedPlace | null>(null);
  const [editingPlaceComment, setEditingPlaceComment] = React.useState("");
  const [allPlaces, setAllPlaces] = React.useState<DiscoverPlace[]>(initialAllPlaces ?? []);
  const [nativeLocationTick, setNativeLocationTick] = React.useState(0);
  const [savedPlaceIndexes, setSavedPlaceIndexes] = React.useState<Record<string, number>>({});
  const savedPlacesScrollRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const savedPlacesTouchStartXRef = React.useRef<number | null>(null);
  const savedPlacesTouchDeltaXRef = React.useRef(0);

  React.useEffect(() => {
    homeMemoryCache[locale] = {
      discoverPlace: mergePlace(homeMemoryCache[locale]?.discoverPlace ?? null, initialDiscoverPlace ?? null),
      contextPlace: mergePlace(homeMemoryCache[locale]?.contextPlace ?? null, initialContextPlace ?? null),
      newPlaces: (homeMemoryCache[locale]?.newPlaces?.length ?? 0) > 0 ? homeMemoryCache[locale]!.newPlaces : (initialNewPlaces ?? [])
    };
  }, [locale, initialDiscoverPlace, initialContextPlace, initialNewPlaces]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onNativeLocation = () => setNativeLocationTick((v) => v + 1);
    window.addEventListener("im:native-location", onNativeLocation);
    return () => {
      window.removeEventListener("im:native-location", onNativeLocation);
    };
  }, []);

  React.useEffect(() => {
    if (!panel) return;
    window.requestAnimationFrame(() => {
      panelScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
  }, [panel]);

  React.useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("im-home-cache:" + locale);
      }
    } catch {}
  }, [locale]);

  React.useEffect(() => {
    const cached = readHomeCache(locale);
    if (!cached) return;
    if (cached.discoverPlace) setDiscoverPlace(mergePlace(cached.discoverPlace, initialDiscoverPlace ?? null));
    if (cached.contextPlace) {
      const mergedContext = mergePlace(cached.contextPlace, initialContextPlace ?? null);
      const mergedDiscover = mergePlace(cached.discoverPlace ?? null, initialDiscoverPlace ?? null);
      setContextPlace(mergedContext);
      setSuggestionPlaces(
        getInitialSuggestionPlaces(
          (initialAllPlaces ?? []).filter((item) => !!item?.id && !!item?.name),
          new Date(),
          mergedDiscover,
          mergedContext
        )
      );
      setSuggestionIndex(0);
    }
    if (Array.isArray(cached.newPlaces) && cached.newPlaces.length > 0) {
      setNewPlaces(cached.newPlaces);
    }
    if (cached.discoverPlace || cached.contextPlace || (cached.newPlaces?.length ?? 0) > 0) {
      setDiscoverReady(true);
    }
  }, [locale, nativeLocationTick]);

  React.useEffect(() => {
    const syncSavedPlaces = () => {
      setSavedPlaces(readSavedPlaces());
    };

    syncSavedPlaces();
    window.addEventListener("storage", syncSavedPlaces);
    window.addEventListener("im:saved-places-updated", syncSavedPlaces as EventListener);
    return () => {
      window.removeEventListener("storage", syncSavedPlaces);
      window.removeEventListener("im:saved-places-updated", syncSavedPlaces as EventListener);
    };
  }, []);

  React.useEffect(() => {
    const syncPlaceNotes = () => {
      setPlaceNotes(readPlaceNotes());
    };

    syncPlaceNotes();
    window.addEventListener("storage", syncPlaceNotes);
    window.addEventListener("im:place-notes-updated", syncPlaceNotes as EventListener);

    return () => {
      window.removeEventListener("storage", syncPlaceNotes);
      window.removeEventListener("im:place-notes-updated", syncPlaceNotes as EventListener);
    };
  }, []);

  React.useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  function goToSavedPlace(city: string, delta: number, length: number) {
    setSavedPlaceIndexes((prev) => {
      const current = prev[city] ?? 0;
      if (length <= 0) return prev;
      return {
        ...prev,
        [city]: (current + delta + length) % length
      };
    });
  }

  function openPlaceNoteEditor(place: SavedPlace) {
    const note = placeNotes[place.id];
    setEditingPlaceNote(place);
    setEditingPlaceComment(note?.comment ?? "");
  }

  function savePlaceNote() {
    if (!editingPlaceNote) return;

    const nextNotes: Record<string, PlaceNote> = {
      ...placeNotes,
      [editingPlaceNote.id]: {
        visited: true,
        comment: editingPlaceComment.trim(),
        updatedAt: new Date().toISOString()
      }
    };

    setPlaceNotes(nextNotes);
    writePlaceNotes(nextNotes);
    setEditingPlaceNote(null);
    setEditingPlaceComment("");
  }

  function onSavedPlacesTouchStart(e: React.TouchEvent<HTMLButtonElement>) {
    savedPlacesTouchStartXRef.current = e.touches[0]?.clientX ?? null;
    savedPlacesTouchDeltaXRef.current = 0;
  }

  function onSavedPlacesTouchMove(e: React.TouchEvent<HTMLButtonElement>) {
    const startX = savedPlacesTouchStartXRef.current;
    if (startX == null) return;
    const currentX = e.touches[0]?.clientX ?? startX;
    savedPlacesTouchDeltaXRef.current = currentX - startX;
  }

  function onSavedPlacesTouchEnd(city: string, length: number) {
    const dx = savedPlacesTouchDeltaXRef.current;
    savedPlacesTouchStartXRef.current = null;
    savedPlacesTouchDeltaXRef.current = 0;
    if (Math.abs(dx) < 35) return;
    if (dx < 0) {
      goToSavedPlace(city, 1, length);
      return;
    }
    goToSavedPlace(city, -1, length);
  }

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const r = await fetch("/api/v1/places?locale=" + encodeURIComponent(locale), { cache: "no-store" });
        if (!r.ok) throw new Error("load failed");
        const j = await r.json();
        const arr = Array.isArray(j) ? j : j?.data || [];
        const all: DiscoverPlace[] = arr
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
            phone: String(item?.phone ?? "").trim() || undefined,
                        miniText: String(item?.miniText ?? "").trim() || undefined,
            openingHours: String(item?.openingHours ?? "").trim() || undefined,
            timeZone: String(item?.timeZone ?? "").trim() || undefined,
            createdAt: String(item?.createdAt ?? "").trim() || undefined,
            updatedAt: String(item?.updatedAt ?? "").trim() || undefined,
            homeTextNear: String(item?.homeTextNear ?? "").trim() || undefined,
            homeTextFar: String(item?.homeTextFar ?? "").trim() || undefined,
            homeTextNearEn: String(item?.translations?.en?.homeTextNear ?? item?.homeTextNear ?? "").trim() || undefined,
            homeTextFarEn: String(item?.translations?.en?.homeTextFar ?? item?.homeTextFar ?? "").trim() || undefined
          }))
          .filter((item: DiscoverPlace) =>
            !!item.id &&
            !!item.name &&
            Number.isFinite(item.lat) &&
            Number.isFinite(item.lng)
          );

        setAllPlaces(all);

        const finish = (pool: DiscoverPlace[], hasLocation: boolean) => {
          if (cancelled) return;

          const now = new Date();
          const dayKey = getLocalDayKey(now);
          const nextDiscover = all.length > 0 ? pickDailyPlace(all, dayKey) : null;

          const contextBasePool = (pool.length > 0 ? pool : all).filter((item) => item.id !== nextDiscover?.id);
          const contextFallbackPool = all.filter((item) => item.id !== nextDiscover?.id);
          const openContextBasePool = contextBasePool.filter(isSuggestionCandidateOpen);
          const openContextFallbackPool = contextFallbackPool.filter(isSuggestionCandidateOpen);

          const nearbySuggestionsOpen = hasLocation && pool.length > 0 ? pickContextPlaces(openContextBasePool, now) : [];
          const nearbySuggestionsAll = hasLocation && pool.length > 0 ? pickContextPlaces(contextBasePool, now) : [];
          const farSuggestionsOpen = pickContextPlaces(openContextFallbackPool, now).slice(0, 3);
          const farSuggestionsAll = pickContextPlaces(contextFallbackPool, now).slice(0, 3);

          const nextSuggestionPlaces =
            nearbySuggestionsOpen.length > 0 ? nearbySuggestionsOpen :
            nearbySuggestionsAll.length > 0 ? nearbySuggestionsAll :
            farSuggestionsOpen.length > 0 ? farSuggestionsOpen :
            farSuggestionsAll;

          const nextContextPlace = nextSuggestionPlaces[0] ?? null;
          const nextIsNearby = hasLocation && (nearbySuggestionsOpen.length > 0 || nearbySuggestionsAll.length > 0);

          const latest = [...all]
            .filter((item) => item.id !== nextDiscover?.id && item.id !== nextContextPlace?.id)
            .sort((a, b) => {
              const aTime = Date.parse(a.updatedAt || a.createdAt || "") || 0;
              const bTime = Date.parse(b.updatedAt || b.createdAt || "") || 0;
              return bTime - aTime;
            })
            .slice(0, 5);

          homeMemoryCache[locale] = { discoverPlace: nextDiscover, contextPlace: nextContextPlace, newPlaces: latest };
          setNewPlaces(latest);
          setDiscoverPlace(nextDiscover);
          setContextPlace(nextContextPlace);
          setSuggestionPlaces(nextSuggestionPlaces);
          setSuggestionIndex(0);
          setContextPlaceNearby(nextIsNearby);
          setDiscoverReady(true);
          writeHomeCache(locale, nextDiscover, nextContextPlace, latest);
        };

        if (all.length === 0) {
          finish([], false);
          return;
        }

        const pos = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
          try {
            const nativeNow =
              typeof window !== "undefined" &&
              window.__IM_NATIVE_LOCATION__ &&
              Number.isFinite(Number(window.__IM_NATIVE_LOCATION__.lat)) &&
              Number.isFinite(Number(window.__IM_NATIVE_LOCATION__.lng))
                ? {
                    lat: Number(window.__IM_NATIVE_LOCATION__.lat),
                    lng: Number(window.__IM_NATIVE_LOCATION__.lng)
                  }
                : null;

            if (nativeNow) {
              resolve(nativeNow);
              return;
            }

            let settled = false;

            const done = (value: { lat: number; lng: number } | null) => {
              if (settled) return;
              settled = true;
              if (typeof window !== "undefined") {
                window.removeEventListener("im:native-location", onNativeLocation);
              }
              clearTimeout(waitNativeTimer);
              clearTimeout(geoFallbackTimer);
              resolve(value);
            };

            const onNativeLocation = (event: CustomEvent<{ lat: number; lng: number }>) => {
              const lat = Number(event.detail?.lat);
              const lng = Number(event.detail?.lng);
              if (Number.isFinite(lat) && Number.isFinite(lng)) {
                done({ lat, lng });
              }
            };

            if (typeof window !== "undefined") {
              window.addEventListener("im:native-location", onNativeLocation as EventListener, { once: true });
            }

            const readNativeAgain = () => {
              const nativeLater =
                typeof window !== "undefined" &&
                window.__IM_NATIVE_LOCATION__ &&
                Number.isFinite(Number(window.__IM_NATIVE_LOCATION__.lat)) &&
                Number.isFinite(Number(window.__IM_NATIVE_LOCATION__.lng))
                  ? {
                      lat: Number(window.__IM_NATIVE_LOCATION__.lat),
                      lng: Number(window.__IM_NATIVE_LOCATION__.lng)
                    }
                  : null;

              if (nativeLater) {
                done(nativeLater);
                return true;
              }
              return false;
            };

            const geoFallbackTimer = setTimeout(() => {
              if (readNativeAgain()) return;

              try {
                if (!navigator.geolocation) {
                  done(null);
                  return;
                }

                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    done({
                      lat: Number(position.coords.latitude),
                      lng: Number(position.coords.longitude)
                    });
                  },
                  () => done(null),
                  {
                    enableHighAccuracy: false,
                    timeout: 4500,
                    maximumAge: 21600000
                  }
                );
              } catch {
                done(null);
              }
            }, 1200);

            const waitNativeTimer = setTimeout(() => {
              readNativeAgain();
            }, 150);
          } catch {
            resolve(null);
          }
        });

        if (pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lng)) {
          const nearby = all.filter((item) => {
            const lat = Number(item.lat);
            const lng = Number(item.lng);
            return Number.isFinite(lat) && Number.isFinite(lng) && haversineKm(pos.lat, pos.lng, lat, lng) <= 50;
          });
          finish(nearby, true);
          return;
        }

        finish([], false);
      } catch {
        if (cancelled) return;
        setDiscoverReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locale, nativeLocationTick]);

  const savedPlacesByCity = React.useMemo(() => {
    const byId = new Map(allPlaces.map((place) => [place.id, place] as const));
    const groups = new Map<string, SavedPlace[]>();

    for (const place of savedPlaces) {
      const full = byId.get(place.id);
      const merged: SavedPlace = {
        ...place,
        city: place.city || full?.city || undefined,
        address: place.address || full?.address || undefined,
        panoramaImage: place.panoramaImage || full?.panoramaImage || undefined,
        lat: place.lat ?? full?.lat,
        lng: place.lng ?? full?.lng
      };

      const key = merged.city || (isFr ? "Autres lieux" : "Other places");
      const current = groups.get(key) ?? [];
      current.push(merged);
      groups.set(key, current);
    }

    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([city, places]) => ({
        city,
        places: [...places].sort((a, b) => a.name.localeCompare(b.name))
      }));
  }, [savedPlaces, allPlaces, isFr]);

  const suggestionTimerRef = React.useRef<number | null>(null);

  const savedPlacesTimerRefs = React.useRef<Record<string, number>>({});

  function restartSavedPlacesTimer(city: string, length: number) {
    const existing = savedPlacesTimerRefs.current[city];

    if (existing) {
      window.clearTimeout(existing);
    }

    if (length <= 1) return;

    savedPlacesTimerRefs.current[city] = window.setTimeout(() => {
      const currentIndex = savedPlaceIndexes[city] ?? 0;
      const nextIndex = (currentIndex + 1) % length;

      setSavedPlaceIndexes((prev) => ({
        ...prev,
        [city]: nextIndex
      }));

      const el = savedPlacesScrollRefs.current[city];

      if (el) {
        const width = el.clientWidth;

        el.scrollTo({
          left: width * nextIndex,
          behavior: "smooth"
        });
      }

      restartSavedPlacesTimer(city, length);
    }, 7000);
  }


  function restartSuggestionTimer() {
    if (suggestionTimerRef.current) {
      window.clearTimeout(suggestionTimerRef.current);
    }
    if (suggestionPlaces.length <= 1 || contextPlaceNearby) return;

    suggestionTimerRef.current = window.setTimeout(() => {
      const nextIndex = (suggestionIndex + 1) % suggestionPlaces.length;

      setSuggestionIndex(nextIndex);

      const el = suggestionScrollRef.current;
      if (el) {
        const width = el.clientWidth;
        el.scrollTo({
          left: width * nextIndex,
          behavior: "smooth"
        });
      }
    }, 7000);
  }

  React.useEffect(() => {
    restartSuggestionTimer();
    return () => {
      if (suggestionTimerRef.current) {
        window.clearTimeout(suggestionTimerRef.current);
      }
    };
  }, [suggestionIndex, suggestionPlaces, contextPlaceNearby]);

  function switchLocale(nextLocale: "fr" | "en") {
    if (nextLocale === locale) return;
    document.cookie = `NEXT_LOCALE=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.location.href = `/${nextLocale}`;
  }

  return (
    <>
      <style jsx global>{explorerPulseCss}</style>
      <style jsx global>{`
        .im-home-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .im-home-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div className="flex h-[100dvh] w-full flex-col bg-black text-white">
        <div className="mx-auto flex w-full max-w-md flex-col items-center px-6 pt-5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}>
          <div className="mb-2 flex w-full justify-center pt-2 pb-1">
            <div className="inline-flex flex-col items-start justify-center gap-1">
              <h1 className="text-[22px] font-semibold tracking-tight text-white">
                Indie Map
              </h1>

              <span className="-mt-3 inline-block -rotate-2 text-[13px] italic tracking-[0.13em] text-[#5C6E3B]">
                Back To Local
              </span>
            </div>
          </div>

        </div>

        <div className="im-home-scroll flex flex-1 w-full min-h-0 flex-col overflow-y-auto overscroll-y-contain" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 90px)" }}>
          




          <button
            onClick={() => router.push(`/${locale}/carte?entry=explore`)}
            className="relative mb-2 h-[290px] w-full shrink-0 overflow-hidden rounded-b-xl"
              style={{
                background: "#181914"
              }}
            >
              <img
                src="/explorer-bg.png?v=3"
                alt=""
                className="absolute inset-0 h-full w-full object-cover" style={{ animation: "explorerPulse 5s ease-in-out infinite", transformOrigin: "center center" }}
              />
              <div className="relative z-10 flex h-full flex-col justify-end items-start px-6 pb-6 text-white">
                <div className="flex items-center gap-3">
                  <p className="font-serif text-[24px] font-medium tracking-[0.01em]">
                    {isFr ? "Explorer le monde" : "Explore the world"}
                  </p>
                  <span aria-hidden="true" className="text-[24px] leading-none">→</span>
                </div>
              </div>
            </button>

          <div className="mt-4 mb-5 w-full shrink-0 px-3">
            <div className="mb-2 px-1">
              <p className="font-serif text-[15px] font-medium tracking-[0.01em] text-white">
                {isFr ? "Que cherches-tu ?" : "What are you looking for?"}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-white/45">
                {isFr ? "Un lieu, une envie, une ville." : "A place, a mood, a city."}
              </p>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                const query = searchQuery.trim();
                if (!query) return;

                setSearchResults(null);
                setSearchLoading(true);

                window.setTimeout(() => {
                  const normalize = (value: string) =>
                    value
                      .toLowerCase()
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .replace(/[^a-z0-9\s]/g, " ")
                      .replace(/\s+/g, " ")
                      .trim();

                  const normalizedQuery = normalize(query);

                  const knownCities = [...new Set(allPlaces.map((place) => place.city).filter(Boolean) as string[])]
                    .sort((a, b) => b.length - a.length);

                  const detectedCity = knownCities.find((city) => normalizedQuery.includes(normalize(city))) || null;
                  const normalizedDetectedCity = detectedCity ? normalize(detectedCity) : "";

                  const includesAny = (values: string[]) => values.some((value) => normalizedQuery.includes(normalize(value)));

                  const explicitCategoryAliases: Record<string, string[]> = {
                    epicerie: ["epicerie", "epiceries", "grocery", "groceries", "magasin bio"],
                    restaurant: ["restaurant", "restaurants", "resto", "restos"],
                    brunch: ["brunch", "brunchs"],
                    cafe: ["cafe", "cafes", "coffee", "coffees"],
                    bar: ["bar", "bars", "pub", "pubs", "brasserie", "brasseries"],
                    boutique: ["boutique", "boutiques", "mode", "shopping"],
                    librairie: ["librairie", "librairies", "bookstore"],
                    boulangerie: ["boulangerie", "boulangeries", "bakery"],
                    ferme: ["ferme", "fermes", "producteur", "producteurs", "farm", "farms"],
                    marche: ["marche", "marches", "market", "markets"],
                    atelier: ["atelier", "ateliers", "artisan", "artisans"],
                    alternatif: ["alternatif", "alternative", "lieu alternatif"]
                  };

                  const explicitCategory = Object.entries(explicitCategoryAliases).find(([, aliases]) =>
                    aliases.some((alias) => normalizedQuery.includes(normalize(alias)))
                  )?.[0] || null;

                  let targetCategories = explicitCategory ? [explicitCategory] : [];

                  if (targetCategories.length === 0) {
                    if (includesAny(["boire un verre", "prendre un verre", "sortir boire", "aller boire", "un verre", "biere", "beer", "drink", "cocktail", "aperitif", "apero"])) {
                      targetCategories = ["bar"];
                    } else if (includesAny(["faire les courses", "faire mes courses", "acheter a manger", "ingredients", "ingredient", "repas maison", "cuisiner", "produits locaux", "local food", "organic food", "grocery"])) {
                      targetCategories = ["epicerie", "marche", "ferme"];
                    } else if (includesAny(["manger", "dejeuner", "diner", "souper", "bon repas", "lunch", "dinner", "eat", "food"])) {
                      targetCategories = ["restaurant"];
                    } else if (includesAny(["boire un cafe", "prendre un cafe", "travailler", "lire", "pause cafe", "gouter", "coffee", "work", "read"])) {
                      targetCategories = ["cafe"];
                    } else if (includesAny(["cadeau", "cadeaux", "gift", "gifts", "pour ma niece", "pour mon neveu", "pour un enfant", "objet", "objets", "souvenir", "decoration", "deco"])) {
                      targetCategories = ["boutique", "atelier", "librairie", "alternatif"];
                    } else if (includesAny(["pain", "viennoiserie", "croissant", "baguette", "bread"])) {
                      targetCategories = ["boulangerie"];
                    } else if (includesAny(["expo", "exposition", "art", "culture", "galerie", "gallery"])) {
                      targetCategories = ["alternatif", "atelier"];
                    }
                  }

                  const stopWords = new Set([
                    "je", "j", "me", "moi", "tu", "te", "le", "la", "les", "un", "une", "des", "de", "du", "d", "a", "au", "aux",
                    "en", "sur", "pour", "dans", "avec", "trouve", "trouver", "montre", "montrez", "voir", "veux", "voudrais",
                    "besoin", "cherche", "chercher", "peux", "peut", "aller", "faire", "bientot", "quelques", "jours", "place",
                    "lieu", "lieux", "ville", "city", "near", "nearby", "show", "find", "for", "where", "need", "want", "ce", "soir"
                  ]);

                  const tokens = normalizedQuery
                    .split(/\s+/)
                    .map((token) => token.trim())
                    .filter((token) => token.length > 2 && !stopWords.has(token) && token !== normalizedDetectedCity);

                  const ignoredSearchTokens = new Set([
                    ...Object.values(explicitCategoryAliases)
                      .flatMap((aliases) => aliases)
                      .flatMap((alias) => normalize(alias).split(/\s+/)),
                    "boire", "prendre", "verre", "sortir", "biere", "beer", "drink", "cocktail", "aperitif", "apero",
                    "manger", "dejeuner", "diner", "souper", "repas", "lunch", "dinner", "eat", "food",
                    "cafe", "coffee", "travailler", "lire", "pause", "gouter", "work", "read",
                    "courses", "acheter", "ingredients", "ingredient", "cuisiner", "produits", "locaux", "local", "organic",
                    "cadeau", "cadeaux", "gift", "gifts", "niece", "neveu", "enfant", "objet", "objets", "souvenir",
                    "pain", "viennoiserie", "croissant", "baguette", "bread",
                    "expo", "exposition", "art", "culture", "galerie", "gallery"
                  ].filter((token) => token.length > 2));

                  const meaningfulTokens = tokens.filter((token) => !ignoredSearchTokens.has(token));

                  const cityPool = detectedCity
                    ? allPlaces.filter((place) => normalize(place.city || "") === normalizedDetectedCity)
                    : allPlaces;

                  const categoryPool = targetCategories.length > 0
                    ? cityPool.filter((place) => {
                        const rawCategory = normalize(place.category || "");
                        const miniText = normalize(place.miniText || "");
                        const miniTextEn = normalize((place as any).translations?.en?.miniText || "");
                        const searchCategory = rawCategory.includes("brunch") ? "brunch" : normalizeCategory(place.category);

                        if (targetCategories.includes(searchCategory)) return true;
                        if (targetCategories.includes("brunch") && (miniText.includes("brunch") || miniTextEn.includes("brunch"))) return true;

                        return false;
                      })
                    : cityPool;

                  const shouldReturnFullPool = Boolean(detectedCity) && (targetCategories.length > 0 || tokens.length === 0) && meaningfulTokens.length === 0;

                  const results = shouldReturnFullPool
                    ? categoryPool.sort((a, b) => a.name.localeCompare(b.name))
                    : categoryPool
                        .map((place) => {
                          const placeCity = normalize(place.city || "");
                          const rawCategory = normalize(place.category || "");
                          const placeCategory = rawCategory.includes("brunch") ? "brunch" : normalizeCategory(place.category);
                          const name = normalize(place.name || "");
                          const address = normalize(place.address || "");
                          const category = normalize(place.category || "");
                          const miniText = normalize(place.miniText || "");
                          const haystack = [name, placeCity, address, category, miniText].filter(Boolean).join(" ");

                          let score = 0;

                          if (detectedCity && placeCity === normalizedDetectedCity) score += 80;
                          if (targetCategories.includes(placeCategory)) score += 70;

                          for (const token of meaningfulTokens) {
                            if (name.includes(token)) score += 18;
                            if (category.includes(token)) score += 14;
                            if (placeCity.includes(token)) score += 12;
                            if (address.includes(token)) score += 8;
                            if (miniText.includes(token)) score += 10;
                            if (haystack.includes(token)) score += 3;
                          }

                          return { place, score };
                        })
                        .filter((entry) => entry.score > 0)
                        .sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name))
                        .map((entry) => entry.place);

                  setSearchResults(results);
                  setSearchLoading(false);
                }, 800);
              }}
              className={`flex w-full border border-white/10 bg-black/75 px-4 text-left text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_26px_rgba(0,0,0,0.28)] backdrop-blur-sm transition-all duration-300 ${
                searchFocused
                  ? "h-28 items-start rounded-3xl py-4"
                  : "h-13 items-center rounded-[22px] py-0"
              }`}
            >
              <div className={`mr-3 flex h-8 w-8 shrink-0 items-center justify-center text-white/45 ${searchFocused ? "mt-0.5" : ""}`}>
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder={
                    searchFocused
                      ? (isFr ? "Je veux boire un verre à Paris..." : "I want to have a drink in Paris...")
                      : (isFr ? "Un café, une épicerie, un lieu à Paris..." : "A café, a grocery store, a place in Paris...")
                  }
                  className="w-full min-w-0 bg-transparent text-[15px] leading-none text-white placeholder:text-white/42 outline-none"
                  type="search"
                />

                {searchFocused ? (
                  <div className="mt-3 text-[12px] leading-snug text-white/45">
                    {isFr
                      ? "Exemple : trouve-moi des cafés à Montréal, ou des épiceries à Paris."
                      : "Example: find cafés in Montreal, or grocery stores in Paris."}
                  </div>
                ) : null}
              </div>
              <button
                type="submit"
                aria-label={isFr ? "Rechercher" : "Search"}
                className={`ml-3 shrink-0 rounded-full bg-white/8 px-3 text-[12px] font-semibold text-white/70 transition-colors active:bg-white/14 ${searchFocused ? "mt-0.5 h-8" : "h-8"}`}
              >
                {isFr ? "OK" : "Go"}
              </button>
            </form>
          </div>

<div className="-mt-2 mb-3 w-full px-3">
            {suggestionPlaces.length > 0 ? (
              <>
                <div
                  ref={suggestionScrollRef}
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    const width = el.clientWidth;
                    if (!width) return;

                    const index = Math.round(el.scrollLeft / width);

                    if (index !== suggestionIndex) {
                      setSuggestionIndex(index);
                    }
                  }}
                  className="im-home-scroll flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth"
                >
                  {suggestionPlaces.map((item) => (
                    <div
                      key={item.id}
                      className="min-w-full snap-center"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedHomePlace(item);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left"
                        style={{
                          boxShadow: "0 10px 24px rgba(0,0,0,0.18)"
                        }}
                      >
                        <img
                          src={item.panoramaImage || "/explorer-bg.png?v=3"}
                          alt=""
                          className="h-20 w-20 shrink-0 rounded-xl object-cover"
                        />
                        <p className="text-[14px] leading-[1.35] text-white/80">
                          {getSuggestionCopy(item, locale, contextPlaceNearby)}
                        </p>
                      </button>
                    </div>
                  ))}
                </div>

                {suggestionPlaces.length > 1 ? (
                  <div className="mt-2 flex items-center justify-center gap-1.5">
                    {suggestionPlaces.map((item, index) => (
                      <button
                        key={item.id + "-dot"}
                        type="button"
                        aria-label={`Suggestion ${index + 1}`}
                        onClick={() => {
                          setSuggestionIndex(index);

                          const el = suggestionScrollRef.current;
                          if (el) {
                            const width = el.clientWidth;
                            el.scrollTo({
                              left: width * index,
                              behavior: "smooth"
                            });
                          }

                          restartSuggestionTimer();
                        }}
                        className={index === suggestionIndex ? "h-1.5 w-4 rounded-full bg-white/90" : "h-1.5 w-1.5 rounded-full bg-white/35"}
                      />
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex w-full items-center gap-3 px-1 py-2">
                <div className="h-20 w-20 shrink-0 rounded-xl bg-white/10"></div>
                <div className="h-16 flex-1 rounded-xl bg-white/10"></div>
              </div>
            )}
          </div>


          <div className="mb-0 w-full shrink-0 pb-6">
              <div className="w-full relative z-10">
                <div className="flex items-center justify-between px-3 pt-2">
                  <p className="font-serif text-[15px] font-medium whitespace-nowrap tracking-[0.01em]">
                    {isFr ? "Ajouts récents" : "Recent additions"}
                  </p>
                </div>
                <div className="im-home-scroll mt-3 flex gap-5 overflow-x-auto px-3 pb-2">
                  {newPlaces.length > 0 ? newPlaces.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedHomePlace(item);
                      }}
                      className="relative h-[190px] w-[170px] shrink-0 overflow-hidden rounded-xl bg-white/10 text-left"
                    >
                      {item.panoramaImage ? (
                        <img
                          src={item.panoramaImage}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : null}
                      <div
                        className="absolute inset-0"
                        style={{
                          background: "linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.18) 40%, rgba(0,0,0,0.64) 100%)"
                        }}
                      ></div>
                      <div className="absolute inset-x-0 bottom-0 z-10 p-3">
                        <p className="font-serif text-[15px] font-medium leading-tight tracking-[0.01em]">
                          {item.name}
                        </p>
                        <p className="mt-1 text-[11px] opacity-90 truncate">
                          {item.city || item.address || "Indie Map"}
                        </p>
                      </div>
                    </button>
                  )) : (
                    <div className="flex h-[240px] w-[170px] shrink-0 items-end rounded-xl bg-white/10 p-3">
                      <p className="font-serif text-[15px] font-medium leading-tight tracking-[0.01em]">
                        {isFr ? "Ajoutés récemment" : "Recently added"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

          </div>

          <div className="mt-2 w-full shrink-0 relative z-0 px-3">
            <button
              type="button"
              onClick={() => {
                setSelectedHomePlace(discoverPlace || ({ id: "__discovery__", name: "Discovery" } as DiscoverPlace));
              }}
              className="relative min-h-[290px] w-full overflow-hidden rounded-xl bg-red-600/40 text-left hover:bg-white/14 active:bg-white/18"
              style={{
                boxShadow: "inset 0 0 0 2px rgba(255,0,0,0.9), inset 0 1.5px 0 rgba(255,255,255,0.22), inset 0 -6px 14px rgba(0,0,0,0.16), 0 14px 30px rgba(0,0,0,0.20), 0 40px 90px rgba(0,0,0,0.14)"
              }}
            >
    {discoverPlace?.panoramaImage ? (
      <img
        src={discoverPlace.panoramaImage}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
    ) : null}

    <div
      className="absolute inset-0"
      style={{
        background: "linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.18) 40%, rgba(0,0,0,0.64) 100%)"
      }}
    ></div>

    <div className="absolute inset-0 z-10 flex flex-col justify-between">
      <div>
        <div className="w-full px-3 py-1">
          <p className="font-serif text-[15px] font-medium whitespace-nowrap tracking-[0.01em]">
            {isFr ? "Découverte du jour" : "Discovery of the day"}
          </p>
        </div>
      </div>

      <div className="pr-7">
        <div className="w-full px-3 py-1">
          <p className="font-serif text-[15px] font-medium leading-tight tracking-[0.01em]">
            {discoverPlace?.name || (isFr ? "Lieu surprise" : "Surprise place")}
          </p>
          <p className="mt-1 text-[11px] opacity-90 truncate">
            {discoverPlace?.city || discoverPlace?.address || "Indie Map"}
          </p>
        </div>
      </div>
    </div>
  </button>
</div>



        </div>
      </div>

      {selectedHomePlace ? (
        <div className="fixed inset-0 z-[2200] overflow-hidden bg-[#2f2f2f] text-white">
          {selectedHomePlace.panoramaImage ? (
            <img
              src={selectedHomePlace.panoramaImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-white/10" />
          )}

          <div className="absolute inset-0 z-10 overflow-y-auto">
          {selectedHomePlace?.miniText ? (
            <div className="relative mt-[55vh] min-h-[45vh] rounded-t-3xl bg-black/80 px-6 pt-6 pb-8">
              <div>
                <div className="mb-6">
                  <div className="text-[28px] font-bold leading-tight text-white">
                    {selectedHomePlace.name}
                  </div>
                  {(selectedHomePlace.category || selectedHomePlace.website) ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {selectedHomePlace.category ? (
                        <div className="text-[14px] text-white/70">
                          {getLocalizedCategory(selectedHomePlace.category, isFr)}
                        </div>
                      ) : null}

                      {selectedHomePlace.website ? (
                        <button
                          type="button"
                          onClick={() => {
                            const website = selectedHomePlace.website ?? "";
                            const url =
                              website.startsWith("http://") ||
                              website.startsWith("https://")
                                ? website
                                : `https://${website}`;

                            window.open(url, "_blank");
                          }}
                          className="rounded-[9px] border border-white/10 bg-white/8 px-2 py-0.5 text-[11px] font-semibold text-white/75"
                        >
                          {isFr ? "Site web" : "Website"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {selectedHomePlace.address ? (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <div className="text-[16px] font-serif leading-relaxed text-[#F97316]">
                        {selectedHomePlace.address}
                      </div>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const address = encodeURIComponent(selectedHomePlace.address ?? "");
                            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                            const isAndroid = /Android/.test(navigator.userAgent);

                            if (isIOS) {
                              window.location.href = `http://maps.apple.com/?q=${address}`;
                            } else if (isAndroid) {
                              window.location.href = `geo:0,0?q=${address}`;
                            } else {
                              window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, "_blank");
                            }
                          }}
                          className="rounded-[9px] border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-semibold text-white/75"
                        >
                          {isFr ? "Itinéraire" : "Directions"}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const text = selectedHomePlace.address ?? "";
                            let ok = false;
                            try {
                              await navigator.clipboard.writeText(text);
                              ok = true;
                            } catch {
                              try {
                                const area = document.createElement("textarea");
                                area.value = text;
                                area.setAttribute("readonly", "");
                                area.style.position = "fixed";
                                area.style.top = "0";
                                area.style.left = "0";
                                area.style.opacity = "0";
                                document.body.appendChild(area);
                                area.focus();
                                area.select();
                                area.setSelectionRange(0, area.value.length);
                                ok = document.execCommand("copy");
                                document.body.removeChild(area);
                              } catch {
                                ok = false;
                              }
                            }
                            if (ok) {
                              setAddressCopied(true);
                              window.setTimeout(() => setAddressCopied(false), 1500);
                            }
                          }}
                          className="rounded-[9px] border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-semibold text-white/75"
                        >
                          {addressCopied ? (isFr ? "Copié" : "Copied") : (isFr ? "Copier l'adresse" : "Copy address")}
                        </button>
                        {selectedHomePlace?.phone ? (
                          <button
                            type="button"
                            onClick={() => {
                              window.location.href = `tel:${selectedHomePlace.phone}`;
                            }}
                            className="rounded-[9px] border border-white/10 bg-white/8 p-1.5 text-white/75"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.9.37 1.78.73 2.6a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.48-1.25a2 2 0 0 1 2.11-.45c.82.36 1.7.61 2.6.73A2 2 0 0 1 22 16.92z"/>
                            </svg>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {selectedHomePlace.openingHours ? (
                    <div className="mt-5">
                      {renderOpeningHours(selectedHomePlace.openingHours, selectedHomePlace.timeZone)}
                    </div>
                  ) : null}
                </div>
                <div className="mt-2">
                  <div className="mb-2 text-[12px] uppercase tracking-wide text-white/40">À propos</div>
                  <p className="text-[17px] leading-[1.7] text-white/90">
                    {selectedHomePlace.miniText}
                  </p>

                  {Number.isFinite(Number(selectedHomePlace.lat)) && Number.isFinite(Number(selectedHomePlace.lng)) ? (
                    <button
                      type="button"
                      onClick={() => {
                        router.push(`/${locale}/carte?discover=${selectedHomePlace.id}`);
                      }}
                      className="relative mt-6 block h-[190px] w-full overflow-hidden rounded-2xl bg-[#101510]"
                    >
                      <div className="absolute inset-0 pointer-events-none">
                        <MapPanel
                          items={[{
                            ...selectedHomePlace,
                            type: selectedHomePlace.category
                          }]}
                          selectedId={selectedHomePlace.id}
                          overlaysReady={true}
                          hideGeolocate={true}
                        />
                      </div>

                      <div className="absolute inset-0 bg-black/10" />

                      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-5 pb-4 pt-10 text-white">
                        <div className="text-left">
                          <div className="text-[20px] font-serif">
                            {isFr ? "Voir sur la carte" : "View on map"}
                          </div>


                        </div>

                        <div className="text-[24px] leading-none">→</div>
                      </div>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
          </div>

          <button
            type="button"
            onClick={() => setSelectedHomePlace(null)}
            className="absolute right-4 z-[80] grid place-items-center"
            style={{
              top: "calc(env(safe-area-inset-top) + 16px)",
              width: 40,
              height: 40,
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(8px)",
              borderRadius: "9999px",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#ffffff",
              fontSize: "22px",
              fontWeight: 500,
              lineHeight: 1,
              padding: 0
            }}
            aria-label={isFr ? "Fermer" : "Close"}
          >
            <span className="block -translate-y-px leading-none">×</span>
          </button>
        </div>
      ) : null}

      {(searchLoading || searchResults) ? (
        <div className="fixed inset-0 z-[1400] bg-black/92 px-5 text-white">
          <button
            type="button"
            onClick={() => {
              setSearchLoading(false);
              setSearchResults(null);
            }}
            className="absolute right-4 z-20 grid place-items-center"
            style={{
              top: "calc(env(safe-area-inset-top) + 16px)",
              width: 40,
              height: 40,
              background: "rgba(255,255,255,0.10)",
              backdropFilter: "blur(8px)",
              borderRadius: "9999px",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#ffffff",
              fontSize: "22px",
              fontWeight: 500,
              lineHeight: 1,
              padding: 0
            }}
            aria-label={isFr ? "Fermer" : "Close"}
          >
            <span className="block -translate-y-px leading-none">×</span>
          </button>

          <div className="mx-auto flex h-full w-full max-w-md flex-col pt-[calc(env(safe-area-inset-top)+78px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
            {searchLoading ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div className="mb-5 flex items-center justify-center gap-2">
                  <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-white" style={{ animationDelay: "0ms" }} />
                  <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-white" style={{ animationDelay: "120ms" }} />
                  <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-white" style={{ animationDelay: "240ms" }} />
                </div>

                <div className="max-w-[280px]">
                  <div className="font-serif text-[22px] leading-tight">
                    {isFr ? "Indie Map cherche pour toi" : "Indie Map is searching for you"}
                  </div>
                  <div className="mt-3 text-[14px] leading-relaxed text-white/65">
                    “{searchQuery.trim()}”
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto pb-24">
                  <div className="pr-12">
                    <div className="font-serif text-[24px] leading-tight">
                      {isFr ? "Résultats" : "Results"}
                    </div>
                    <div className="mt-2 text-[14px] leading-relaxed text-white/60">
                      “{searchQuery.trim()}”
                    </div>
                  </div>

                <div className="mt-7 space-y-3">
                  {(searchResults ?? []).length > 0 ? (
                    (searchResults ?? []).map((item) => (
                      <div
                        key={item.id}
                        className="overflow-hidden rounded-2xl border border-white/10 bg-white/8"
                      >
                        <div className="flex w-full gap-3 p-3 text-left">
                          <img
                            src={item.panoramaImage || "/explorer-bg.png?v=3"}
                            alt=""
                            className="h-20 w-20 shrink-0 rounded-xl object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-serif text-[17px] leading-tight text-white">
                              {item.name}
                            </div>
                            <div className="mt-1 text-[12px] text-white/55">
                              {[getLocalizedCategory(item.category, isFr), item.city].filter(Boolean).join(" · ")}
                            </div>
                            {item.miniText ? (
                              <div className="mt-2 line-clamp-2 text-[13px] leading-snug text-white/70">
                                {item.miniText}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedHomePlace(item);
                            }}
                            className="flex w-full items-center justify-center px-4 py-3 text-center text-[14px] font-semibold text-white/85"
                          >
                            {isFr ? "Voir la fiche" : "View details"}
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/8 p-5 text-[15px] leading-relaxed text-white/70">
                      {isFr ? "Aucun lieu trouvé pour cette recherche pour le moment." : "No places found for this search yet."}
                    </div>
                  )}
                </div>
                </div>

                {(searchResults ?? []).length > 0 ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center pb-[calc(env(safe-area-inset-bottom)+18px)]">
                    <button
                      type="button"
                      onClick={() => {
                        const ids = (searchResults ?? []).map((item) => item.id).filter(Boolean).join(",");
                        router.push(`/${locale}/carte?searchIds=${encodeURIComponent(ids)}`);
                      }}
                      className="pointer-events-auto rounded-full border border-white/15 bg-black/55 px-7 py-2.5 text-center text-[14px] font-semibold text-white shadow-[0_10px_35px_rgba(0,0,0,0.45)] backdrop-blur-md active:bg-black/70"
                    >
                      {isFr ? "Voir sur la carte" : "View on map"}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-[1200]">
        <div
          className="grid w-full grid-cols-4 border-t border-white/10 bg-[#262626]/95 text-white shadow-[0_-10px_30px_rgba(0,0,0,0.28)] backdrop-blur-sm"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <button
            type="button"
            onClick={() => setPanel("myPlaces")}
            className="flex min-h-[50px] flex-col items-center justify-center gap-0.5 px-2 text-center hover:bg-white/6 active:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-5.5 w-5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="3.2" />
              <path d="M5.5 19c1.2-3.4 3.6-5.2 6.5-5.2s5.3 1.8 6.5 5.2" />
            </svg>
            <span className="whitespace-nowrap text-[9px] font-medium leading-tight">{isFr ? "Espace perso" : "Personal"}</span>
          </button>

          <button
            type="button"
            onClick={() => setPanel("contrib")}
            className="flex min-h-[50px] flex-col items-center justify-center gap-0.5 px-2 text-center hover:bg-white/6 active:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="whitespace-nowrap h-5.5 w-5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            <span className="whitespace-nowrap text-[9px] font-medium leading-tight">{isFr ? "Proposer un lieu" : "Suggest"}</span>
          </button>

          <button
            type="button"
            onClick={() => setPanel("about")}
            className="flex min-h-[50px] flex-col items-center justify-center gap-0.5 px-2 text-center hover:bg-white/6 active:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-5.5 w-5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16v-5" />
              <path d="M12 8h.01" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            <span className="whitespace-nowrap text-[9px] font-medium leading-tight">{isFr ? "Infos" : "Info"}</span>
          </button>

          <button
            type="button"
            onClick={() => setPanel("pros")}
            className="flex min-h-[50px] flex-col items-center justify-center gap-0.5 px-2 text-center hover:bg-white/6 active:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-5.5 w-5.5 -translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 6h4" />
              <path d="M10 6a2 2 0 0 0-2 2v1h8V8a2 2 0 0 0-2-2" />
              <path d="M4 10h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9z" />
              <path d="M9 14h6" />
            </svg>
            <span className="whitespace-nowrap text-[9px] font-medium leading-tight">{isFr ? "Espace pro" : "Pros"}</span>
          </button>
        </div>
      </div>

      {panel ? (
        <div className="fixed inset-0 z-[2001] bg-black/45 px-0 pt-[30vh] pb-0">
          <div className="mx-auto flex h-[70vh] w-full max-w-none flex-col overflow-hidden rounded-t-3xl rounded-b-none border border-neutral-700 bg-[#262626] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex flex-col leading-none">
                <span className="text-lg font-semibold text-white">Indie Map</span>
                <span className="text-xs tracking-widest text-[#5C6E3B] italic -rotate-2 inline-block -mt-1">Back To Local</span>
              </div>
              <button
                type="button"
                aria-label={isFr ? "Fermer" : "Close"}
                onClick={() => setPanel(null)}
                className="inline-flex h-12 w-16 items-center justify-center rounded-2xl"
              >
                <span className="text-2xl leading-none text-white">×</span>
              </button>
            </div>

            <div ref={panelScrollRef} className="px-5 pb-6 flex-1 min-h-0 overflow-auto">
              {panel === "pros" ? (
                isFr ? (
                  <>
                    <p className="mb-4 text-white/80">
                      Indie Map met en avant des lieux indépendants qui privilégient le local, la réparation, le réemploi, l’agriculture respectueuse, et plus largement une économie plus sobre et plus humaine.
                    </p>

                    <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Ce que nous faisons</h2>
                    <ul className="list-disc pl-5 space-y-1 text-white/80">
                      <li>Rendre votre lieu visible dans une carte claire, centrée sur la découverte.</li>
                      <li>Présenter l’essentiel : histoire du lieu, démarche, informations pratiques.</li>
                      <li>Améliorer le produit à partir de statistiques d’usage globales et anonymes.</li>
                    </ul>

                    <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Pour qui ?</h2>
                    <p className="text-white/80">
                      Pour les commerces et lieux qui assument une démarche cohérente : sourcing local, fabrication responsable, économie circulaire, indépendance, utilité sociale, ou contribution concrète à la vie du territoire.
                    </p>

                    <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Devenir partenaire</h2>
                    <p className="text-white/80">
                      Le partenariat vise à construire quelque chose de durable : un produit utile, éthique, et crédible sur le long terme. Si vous souhaitez rejoindre Indie Map, contactez-nous .
                    </p>

                    <a
                      href="mailto:pro@indie-map.com?subject=Partenariat%20%E2%80%94%20Indie%20Map"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-1 px-5 py-3 rounded-2xl bg-[hsl(var(--brand))] text-white font-medium no-underline hover:bg-[hsl(var(--brand-600))]"
                    >
                      Contact
                    </a>
                  </>
                ) : (
                  <>
                    <p className="mb-4 text-white/80">
                      Indie Map highlights independent places that prioritize local sourcing, repair, reuse, regenerative or respectful farming, and more broadly a simpler and more human economy.
                    </p>

                    <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">What we do</h2>
                    <ul className="list-disc pl-5 space-y-1 text-white/80">
                      <li>Make your place visible on a clear map designed for discovery.</li>
                      <li>Show the essentials: the place, the approach, and practical info.</li>
                      <li>Improve the product using aggregated and anonymous usage statistics.</li>
                    </ul>

                    <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Who is it for?</h2>
                    <p className="text-white/80">
                      For businesses and places with a consistent approach: local sourcing, responsible making, circular economy, independence, social utility, or a tangible positive impact on their territory.
                    </p>

                    <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Become a partner</h2>
                    <p className="text-white/80">
                      Partnership is about building something durable: a useful, ethical, and long-term credible product. If you want to join Indie Map, please reach out .
                    </p>

                    <a
                      href="mailto:pro@indie-map.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-1 px-5 py-3 rounded-2xl bg-[hsl(var(--brand))] text-white font-medium no-underline hover:bg-[hsl(var(--brand-600))]"
                    >
                      Contact
                    </a>
                  </>
                )
              ) : panel === "contrib" ? (
                isFr ? (
                  <>
                    <p className="mb-4 text-white/80">
                      Indie Map grandit grâce aux contributions. L’objectif : rendre visibles des lieux indépendants qui privilégient le local, la réparation, le réemploi, l’agriculture respectueuse et des pratiques cohérentes.
                    </p>
                    <div className="mt-4">
                      <ContributeForm locale="fr" />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mb-4 text-white/80">
                      Indie Map grows through contributions. The goal: make visible independent places that prioritize local sourcing, repair, reuse, respectful agriculture, and coherent practices.
                    </p>
                    <div className="mt-4">
                      <ContributeForm locale="en" />
                    </div>
                  </>
                )
              ) : panel === "myPlaces" ? (
<>
                  <div className="mb-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40">
                      {isFr ? "Espace perso" : "Personal space"}
                    </p>
                    <h2 className="mt-1 font-serif text-[24px] font-semibold leading-tight text-white">
                      {isFr ? "Ton tableau de bord" : "Your dashboard"}
                    </h2>
                  </div>

                  <div className="mb-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_28px_rgba(0,0,0,0.18)]">
                      <p className="text-[26px] font-semibold leading-none text-white">
                        {Object.values(placeNotes).filter((note) => note?.visited).length}
                      </p>
                      <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">
                        {isFr ? "Lieux" : "Places"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_28px_rgba(0,0,0,0.18)]">
                      <p className="text-[26px] font-semibold leading-none text-white">0</p>
                      <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">
                        {isFr ? "Contributions" : "Contributions"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPanel("myPlacesList")}
                      className="flex min-h-[112px] flex-col justify-between rounded-2xl border border-white/10 bg-white/8 p-4 text-left hover:bg-white/12 active:bg-white/16"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white/75">
                        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20.2s-6.8-4.1-8.4-8.2C2.5 9.1 4.1 6.5 6.8 6.2c1.6-.2 3.1.6 4.2 2c1.1-1.4 2.6-2.2 4.2-2c2.7.3 4.3 2.9 3.2 5.8C18.8 16.1 12 20.2 12 20.2z" />
                        </svg>
                      </span>
                      <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/70">
                        {isFr ? "Mes lieux" : "My places"}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled
                      className="flex min-h-[112px] flex-col justify-between rounded-2xl border border-white/8 bg-white/5 p-4 text-left opacity-70"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white/60">
                        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8.5 11.2a3 3 0 1 0 0-6a3 3 0 0 0 0 6z" />
                          <path d="M15.8 10.6a2.6 2.6 0 1 0 0-5.2" />
                          <path d="M3.8 19c.8-3.1 2.6-4.8 4.7-4.8s3.9 1.7 4.7 4.8" />
                          <path d="M14.2 14.4c2 .3 3.5 1.8 4.1 4.6" />
                        </svg>
                      </span>
                      <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/55">
                        {isFr ? "Mes amis" : "Friends"}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled
                      className="flex min-h-[112px] flex-col justify-between rounded-2xl border border-white/8 bg-white/5 p-4 text-left opacity-70"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white/60">
                        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3.8l1.8 5.2h5.5l-4.4 3.2l1.7 5.3L12 14.2l-4.6 3.3l1.7-5.3L4.7 9h5.5L12 3.8z" />
                        </svg>
                      </span>
                      <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/55">
                        {isFr ? "Impact local" : "Local impact"}
                      </span>
                    </button>
                  </div>
                </>
              ) : panel === "myPlacesList" ? (
                <>
                  <button
                    type="button"
                    onClick={() => setPanel("myPlaces")}
                    className="mb-4 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-[13px] font-semibold text-white/75 hover:bg-white/12 active:bg-white/16"
                  >
                    ← {isFr ? "Retour" : "Back"}
                  </button>

                  {savedPlacesByCity.length > 0 ? (
                    <div className="grid grid-cols-2 gap-5">
                      {savedPlacesByCity.map((group) => {
                        return (
                          <div key={group.city} className="relative">
                            <h2 className="mb-2 text-sm font-semibold tracking-wide text-white/80">{group.city}</h2>

                            <div
                              ref={(el) => {
                                savedPlacesScrollRefs.current[group.city] = el;
                              }}
                              onScroll={(e) => {
                                const el = e.currentTarget;
                                const width = el.clientWidth;
                                if (!width) return;

                                const index = Math.round(el.scrollLeft / width);

                                setSavedPlaceIndexes((prev) => {
                                  if (prev[group.city] === index) return prev;
                                  return {
                                    ...prev,
                                    [group.city]: index
                                  };
                                });
                              }}
                              className="im-home-scroll flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth"
                            >
                              {group.places.map((place) => (
                                <button
                                  key={place.id}
                                  type="button"
                                  onClick={() => {
                                    const fullPlace = allPlaces.find((item) => item.id === place.id);
                                    setSelectedHomePlace(fullPlace ?? place);
                                  }}
                                  className="relative min-w-full overflow-hidden rounded-xl bg-white/10 text-left hover:bg-white/14 active:bg-white/18 snap-center"
                                  style={{
                                    minHeight: "130px",
                                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -6px 14px rgba(0,0,0,0.16), 0 14px 30px rgba(0,0,0,0.20), 0 40px 90px rgba(0,0,0,0.14)"
                                  }}
                                >
                                  {place.panoramaImage ? (
                                    <img
                                      src={place.panoramaImage}
                                      alt=""
                                      className="absolute inset-0 h-full w-full object-cover"
                                    />
                                  ) : null}

                                  <div
                                    className="absolute inset-0"
                                    style={{
                                      background: "linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.18) 40%, rgba(0,0,0,0.64) 100%)"
                                    }}
                                  ></div>

                                  <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();

                                      const isVisited = Boolean(placeNotes[place.id]?.visited);
                                      const nextNotes: Record<string, PlaceNote> = {
                                        ...placeNotes,
                                        [place.id]: {
                                          ...(placeNotes[place.id] ?? {}),
                                          visited: !isVisited,
                                          updatedAt: new Date().toISOString()
                                        }
                                      };

                                      setPlaceNotes(nextNotes);
                                      writePlaceNotes(nextNotes);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key !== "Enter" && e.key !== " ") return;
                                      e.preventDefault();
                                      e.stopPropagation();

                                      const isVisited = Boolean(placeNotes[place.id]?.visited);
                                      const nextNotes: Record<string, PlaceNote> = {
                                        ...placeNotes,
                                        [place.id]: {
                                          ...(placeNotes[place.id] ?? {}),
                                          visited: !isVisited,
                                          updatedAt: new Date().toISOString()
                                        }
                                      };

                                      setPlaceNotes(nextNotes);
                                      writePlaceNotes(nextNotes);
                                    }}
                                    className={placeNotes[place.id]?.visited ? "absolute left-3 top-3 z-20 rounded-full bg-yellow-400 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-black shadow-[0_8px_18px_rgba(0,0,0,0.25)]" : "absolute left-3 top-3 z-20 rounded-full border border-white/35 bg-black/35 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/85 backdrop-blur-sm"}
                                  >
                                    {placeNotes[place.id]?.visited ? (isFr ? "Visité" : "Visited") : (isFr ? "À visiter" : "To visit")}
                                  </div>

                                  <div className="absolute inset-0 z-10 flex flex-col justify-end p-3">
                                    <div>
                                      <p className="font-serif text-[15px] font-medium leading-tight tracking-[0.01em] text-white">
                                        {place.name}
                                      </p>

                                      <p className="mt-1 text-[11px] opacity-90 truncate text-white/90">
                                        {place.address || "Indie Map"}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>

                            {group.places.length > 1 ? (
                              <div className="pointer-events-none absolute inset-x-0 bottom-1 z-30 flex justify-center">
                                <div className="pointer-events-auto flex items-center gap-1.5">
                                  {group.places.map((item, index) => (
                                    <button
                                      key={item.id + "-dot"}
                                      type="button"
                                      aria-label={`${group.city} ${index + 1}`}
                                      onClick={() => {
                                        setSavedPlaceIndexes((prev) => ({
                                          ...prev,
                                          [group.city]: index
                                        }));

                                        const el = savedPlacesScrollRefs.current[group.city];

                                        if (el) {
                                          const width = el.clientWidth;

                                          el.scrollTo({
                                            left: width * index,
                                            behavior: "smooth"
                                          });
                                        }
                                      }}
                                      className={index === (savedPlaceIndexes[group.city] ?? 0) ? "h-1.5 w-4 rounded-full bg-white/95" : "h-1.5 w-1.5 rounded-full bg-white/55"}
                                    />
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-white/80">
                      {isFr ? "Aucun lieu enregistré pour le moment." : "No saved places yet."}
                    </p>
                  )}
                </>
              ) : isFr ? (
                <>
                  <p className="mb-4 text-white/80">
                    Indie Map est né d’une difficulté simple : trouver des lieux qui produisent ou travaillent réellement localement.
                  </p>
                  <p className="mb-4 text-white/80">
                    En voyage comme dans sa propre ville, il devient compliqué d’identifier ce qui est fabriqué, cultivé ou pensé à l’échelle d’un territoire. Les informations existent, mais elles sont dispersées.
                  </p>
                  <p className="mb-4 text-white/80">
                    L’application référence des cafés, restaurants, ateliers, fermes, marchés, librairies ou boutiques qui ont un lien concret avec leur environnement : production locale, circuits courts, fabrication sur place, agriculture respectueuse, transformation artisanale.
                  </p>
                  <p className="mb-4 text-white/80">
                    Chaque lieu est présenté avec des informations essentielles : où il se trouve, ce qu’il fait, comment il fonctionne.
                  </p>
                  <p className="text-white/80">
                    Indie Map est conçu comme un outil simple : une carte pour repérer plus facilement ce qui se fait localement, où que l’on soit.
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-4 text-white/80">
                    Indie Map was created from a simple difficulty: finding places that genuinely produce or work locally.
                  </p>
                  <p className="mb-4 text-white/80">
                    Whether traveling or in your own city, it can be hard to identify what is actually made, grown, or rooted in a specific territory. The information exists, but it is scattered.
                  </p>
                  <p className="mb-4 text-white/80">
                    Indie Map gathers these places on a clear map.
                  </p>
                  <p className="mb-4 text-white/80">
                    The app references cafés, restaurants, workshops, farms, markets, bookstores, and shops that maintain a concrete link to their environment: local production, short supply chains, on-site making, respectful farming, artisanal transformation.
                  </p>
                  <p className="mb-4 text-white/80">
                    The goal is not to judge or rank. It is to make visible. While making it easier to consume differently.
                  </p>
                  <p className="mb-4 text-white/80">
                    Each place is presented with essential information: where it is, what it does, how it operates.
                  </p>
                  <p className="text-white/80">
                    Indie Map is designed as a simple tool: a map to more easily locate what is produced locally, wherever you are. The project grows progressively, city by city, prioritizing coherence and accuracy.
                  </p>
                </>
              )}

              {panel === "about" && (
                <div className="mt-6">
                  <p className="mb-2 text-sm font-semibold tracking-wide text-white/80">
                    {isFr ? "Langue" : "Language"}
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => switchLocale("fr")}
                      className={"px-4 py-2 rounded-2xl border text-sm text-white " + (isFr ? "bg-white/12 border-white/20" : "bg-white/5 border-white/10 hover:bg-white/10")}
                    >
                      Français
                    </button>
                    <button
                      type="button"
                      onClick={() => switchLocale("en")}
                      className={"px-4 py-2 rounded-2xl border text-sm text-white " + (!isFr ? "bg-white/12 border-white/20" : "bg-white/5 border-white/10 hover:bg-white/10")}
                    >
                      English
                    </button>
                  </div>
                </div>
              )}

              {panel === "about" && (
                <div className="mt-4">
                  <p className="mb-2 text-sm text-white/80">
                    {isFr ? "Pour toutes questions ou suggestions :" : "For any questions or suggestions:"}
                  </p>
                  <a
                    href="mailto:contact@indie-map.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-1 px-5 py-3 rounded-2xl bg-[hsl(var(--brand))] text-white font-medium no-underline hover:bg-[hsl(var(--brand-600))]"
                  >
                    Contact
                  </a>
                </div>
              )}

              {panel === "about" && (
                <div className="mt-4 text-[11px] text-white/60">
                  <Link href={`/${locale}/privacy`} className="opacity-70 hover:opacity-100">
                    {isFr ? "Confidentialité" : "Privacy"}
                  </Link>
                  <br />
                  <Link href={`/${locale}/support`} className="opacity-70 hover:opacity-100">
                    Support
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}



