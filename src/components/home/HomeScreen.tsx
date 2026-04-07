"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";

import ContributeForm from "@/components/ContributeForm";
import MapPanel from "@/components/MapPanel";

type Panel = null | "pros" | "contrib" | "about" | "myPlaces";

type DiscoverPlace = {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  panoramaImage?: string;
  city?: string;
  address?: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
};

type NewPlace = DiscoverPlace;
type SavedPlace = DiscoverPlace;

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

function pickContextPlace(list: DiscoverPlace[], now: Date) {
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

function buildContextCopy(place: DiscoverPlace | null, locale: "fr" | "en", now: Date, isNearby: boolean, hasLocation: boolean) {
  const name = place?.name || (locale === "fr" ? "ce lieu" : "this place");
  const category = normalizeCategory(place?.category);
  const hour = now.getHours();
  const isFr = locale === "fr";

  if (isFr) {
    if (!hasLocation || !isNearby) {
      if (category === "cafe" || category === "boulangerie") {
        return `Ce matin, garde ${name} en tête si tu as envie de commencer la journée dans un lieu local.`;
      }
      if (category === "restaurant" || category === "brunch") {
        return `À cette heure-ci, ${name} est une bonne idée à garder pour un prochain repas local.`;
      }
      if (category === "boutique" || category === "librairie" || category === "atelier") {
        return `Cet après-midi, ${name} est une belle idée à garder si tu as envie de découvrir un lieu indépendant.`;
      }
      if (category === "epicerie" || category === "ferme") {
        return `En fin de journée, garde ${name} en tête si tu veux trouver quelque chose de local.`;
      }
      if (category === "bar" || category === "alternatif") {
        return hour < 20
          ? `Pour plus tard, ${name} peut être une bonne idée si tu veux sortir dans un lieu indépendant.`
          : `Pour ce soir ou un autre jour, ${name} peut être un bon choix si tu veux sortir.`;
      }
      if (category === "marche") {
        return `Garde ${name} en tête si tu veux découvrir un lieu vivant et local.`;
      }
      return `Garde ${name} en tête si tu veux découvrir un lieu local.`;
    }

    if (category === "cafe" || category === "boulangerie") {
      return `Ce matin, passe chez ${name} pour commencer la journée dans un lieu local.`;
    }
    if (category === "restaurant" || category === "brunch") {
      return `À cette heure-ci, ${name} est une bonne option si tu veux manger local sans trop réfléchir.`;
    }
    if (category === "boutique" || category === "librairie" || category === "atelier") {
      return `Cet après-midi, ${name} vaut le détour si tu as envie de flâner et découvrir un lieu indépendant.`;
    }
    if (category === "epicerie" || category === "ferme") {
      return `En fin de journée, passe chez ${name} si tu veux prendre quelque chose de local avant de rentrer.`;
    }
    if (category === "bar" || category === "alternatif") {
      return hour < 20
        ? `En sortant du travail, ${name} peut être un bon point de chute pour ce soir.`
        : `Pour ce soir, ${name} est un bon choix si tu veux sortir dans un lieu indépendant.`;
    }
    if (category === "marche") {
      return `Aujourd’hui, ${name} est une belle option si tu veux prendre le temps de découvrir un lieu vivant et local.`;
    }
    return `Aujourd’hui, ${name} peut être une bonne idée si tu veux découvrir un lieu local autour de toi.`;
  }

  if (!hasLocation || !isNearby) {
    if (category === "cafe" || category === "boulangerie") {
      return `This morning, keep ${name} in mind if you want to start the day in a local place.`;
    }
    if (category === "restaurant" || category === "brunch") {
      return `Right now, ${name} is a good idea to keep in mind for a future local meal.`;
    }
    if (category === "boutique" || category === "librairie" || category === "atelier") {
      return `This afternoon, ${name} is worth keeping in mind if you feel like discovering an independent place.`;
    }
    if (category === "epicerie" || category === "ferme") {
      return `Later today, keep ${name} in mind if you want to find something local.`;
    }
    if (category === "bar" || category === "alternatif") {
      return hour < 20
        ? `For later, ${name} could be a good idea if you want to go out somewhere independent.`
        : `For tonight or another day, ${name} could be a good place to go out.`;
    }
    if (category === "marche") {
      return `Keep ${name} in mind if you want to discover a lively local place.`;
    }
    return `Keep ${name} in mind if you want to discover a local place.`;
  }

  if (category === "cafe" || category === "boulangerie") {
    return `This morning, stop by ${name} to start the day in a local place.`;
  }
  if (category === "restaurant" || category === "brunch") {
    return `Right now, ${name} is a good option if you want to eat local without overthinking it.`;
  }
  if (category === "boutique" || category === "librairie" || category === "atelier") {
    return `This afternoon, ${name} is worth a stop if you feel like browsing and discovering an independent place.`;
  }
  if (category === "epicerie" || category === "ferme") {
    return `At the end of the day, stop by ${name} if you want to pick up something local before heading home.`;
  }
  if (category === "bar" || category === "alternatif") {
    return hour < 20
      ? `After work, ${name} could be a good place to head for tonight.`
      : `For tonight, ${name} is a good choice if you want to go out somewhere independent.`;
  }
  if (category === "marche") {
    return `Today, ${name} is a great option if you want to take your time and discover a lively local place.`;
  }
  return `Today, ${name} could be a good pick if you want to discover a local place around you.`;
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
  const [discoverPlace, setDiscoverPlace] = React.useState<DiscoverPlace | null>(() => homeMemoryCache[locale]?.discoverPlace ?? initialDiscoverPlace ?? null);
  const [contextPlace, setContextPlace] = React.useState<DiscoverPlace | null>(() => homeMemoryCache[locale]?.contextPlace ?? initialContextPlace ?? null);
  const [contextPlaceNearby, setContextPlaceNearby] = React.useState(false);
  const [contextHasLocation, setContextHasLocation] = React.useState(false);

  React.useEffect(() => {
    try { router.prefetch(`/${locale}/carte`); } catch {}
  }, [router, locale]);
  const [discoverReady, setDiscoverReady] = React.useState(() => {
    const cached = homeMemoryCache[locale];
    return Boolean(cached?.discoverPlace || cached?.contextPlace || (cached?.newPlaces?.length ?? 0) > 0 || initialDiscoverPlace || initialContextPlace || initialNewPlaces.length > 0);
  });
  const [newPlaces, setNewPlaces] = React.useState<NewPlace[]>(() => homeMemoryCache[locale]?.newPlaces ?? initialNewPlaces ?? []);
  const [newPlaceIndex, setNewPlaceIndex] = React.useState(0);
  const [savedPlaces, setSavedPlaces] = React.useState<SavedPlace[]>(() => readSavedPlaces());
  const [allPlaces, setAllPlaces] = React.useState<DiscoverPlace[]>(initialAllPlaces ?? []);
  const [nativeLocationTick, setNativeLocationTick] = React.useState(0);
  const [savedPlaceIndexes, setSavedPlaceIndexes] = React.useState<Record<string, number>>({});
  const newPlacesTouchStartXRef = React.useRef<number | null>(null);
  const newPlacesTouchDeltaXRef = React.useRef(0);
  const savedPlacesTouchStartXRef = React.useRef<number | null>(null);
  const savedPlacesTouchDeltaXRef = React.useRef(0);

  React.useEffect(() => {
    homeMemoryCache[locale] = {
      discoverPlace: homeMemoryCache[locale]?.discoverPlace ?? initialDiscoverPlace ?? null,
      contextPlace: homeMemoryCache[locale]?.contextPlace ?? initialContextPlace ?? null,
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
    const cached = readHomeCache(locale);
    if (!cached) return;
    if (cached.discoverPlace) setDiscoverPlace(cached.discoverPlace);
    if (cached.contextPlace) setContextPlace(cached.contextPlace);
    if (Array.isArray(cached.newPlaces) && cached.newPlaces.length > 0) {
      setNewPlaces(cached.newPlaces);
      setNewPlaceIndex(0);
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
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  React.useEffect(() => {
    if (newPlaces.length <= 1) return;
    const id = window.setInterval(() => {
      setNewPlaceIndex((prev) => (prev + 1) % newPlaces.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, [newPlaces]);

  const currentNewPlace = newPlaces[newPlaceIndex] ?? null;

  function goToNewPlace(delta: number) {
    setNewPlaceIndex((prev) => {
      if (newPlaces.length === 0) return 0;
      return (prev + delta + newPlaces.length) % newPlaces.length;
    });
  }

  function onNewPlacesTouchStart(e: React.TouchEvent<HTMLButtonElement>) {
    newPlacesTouchStartXRef.current = e.touches[0]?.clientX ?? null;
    newPlacesTouchDeltaXRef.current = 0;
  }

  function onNewPlacesTouchMove(e: React.TouchEvent<HTMLButtonElement>) {
    const startX = newPlacesTouchStartXRef.current;
    if (startX == null) return;
    const currentX = e.touches[0]?.clientX ?? startX;
    newPlacesTouchDeltaXRef.current = currentX - startX;
  }

  function onNewPlacesTouchEnd() {
    const dx = newPlacesTouchDeltaXRef.current;
    newPlacesTouchStartXRef.current = null;
    newPlacesTouchDeltaXRef.current = 0;
    if (Math.abs(dx) < 35) return;
    if (dx < 0) {
      goToNewPlace(1);
      return;
    }
    goToNewPlace(-1);
  }

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
            createdAt: String(item?.createdAt ?? "").trim() || undefined,
            updatedAt: String(item?.updatedAt ?? "").trim() || undefined
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
          const nextContextPlace =
            pickContextPlace(contextBasePool, now) ??
            pickContextPlace(contextFallbackPool, now);

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
          setNewPlaceIndex(0);
          setDiscoverPlace(nextDiscover);
          setContextPlace(nextContextPlace);
          setContextPlaceNearby(
            hasLocation &&
            pool.length > 0 &&
            !!nextContextPlace &&
            pool.some((item) => item.id === nextContextPlace.id)
          );
          setContextHasLocation(hasLocation);
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

  React.useEffect(() => {
    if (savedPlacesByCity.length === 0) return;
    const id = window.setInterval(() => {
      setSavedPlaceIndexes((prev) => {
        const next = { ...prev };
        for (const group of savedPlacesByCity) {
          if (group.places.length <= 1) continue;
          const current = next[group.city] ?? 0;
          next[group.city] = (current + 1) % group.places.length;
        }
        return next;
      });
    }, 4500);
    return () => window.clearInterval(id);
  }, [savedPlacesByCity]);

  function switchLocale(nextLocale: "fr" | "en") {
    if (nextLocale === locale) return;
    document.cookie = `NEXT_LOCALE=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.location.href = `/${nextLocale}`;
  }

  return (
    <>
      <style jsx global>{explorerPulseCss}</style>
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

        <div className="flex flex-1 w-full min-h-0 flex-col" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 74px)" }}>
          

          <button
            onClick={() => router.push(`/${locale}/carte?entry=explore`)}
            className="relative mb-2 w-full min-h-0 flex-[1.18] overflow-hidden rounded-b-xl"
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
                <p className="font-serif text-[24px] font-medium tracking-[0.01em]">
                  {isFr ? "Explorer le monde" : "Explore the world"}
                </p>
              </div>
            </button>

          

          <div className="mb-2 w-full px-1">
            {contextPlace ? (
              <button
                type="button"
                onClick={() => {
                  router.push(`/${locale}/carte?discover=${encodeURIComponent(contextPlace.id)}`);
                }}
                className="flex w-full items-center gap-2.5 text-left"
              >
                <img
                  src={contextPlace.panoramaImage || "/explorer-bg.png?v=3"}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-md object-cover"
                />
                <p className="text-[12.5px] leading-[1.3] text-white/88">
                  {buildContextCopy(contextPlace, locale, new Date(), contextPlaceNearby, contextHasLocation)}
                </p>
              </button>
            ) : (
              <div className="flex w-full items-center gap-2.5">
                <div className="h-8 w-8 shrink-0 rounded-md bg-white/10"></div>
                <div className="h-8 flex-1 rounded-md bg-white/10"></div>
              </div>
            )}
          </div>

          <div className="mb-3 grid w-full min-h-0 flex-1 grid-cols-2 gap-2">
            <button
                type="button"
                onClick={() => {
                  if (discoverPlace?.id) {
                    router.push(`/${locale}/carte?discover=${encodeURIComponent(discoverPlace.id)}`);
                    return;
                  }
                  router.push(`/${locale}/carte`);
                }}
                className="relative h-full overflow-hidden rounded-xl bg-white/10 text-left hover:bg-white/14 active:bg-white/18"
                style={{
                  boxShadow: "inset 0 1.5px 0 rgba(255,255,255,0.22), inset 0 -6px 14px rgba(0,0,0,0.16), 0 14px 30px rgba(0,0,0,0.20), 0 40px 90px rgba(0,0,0,0.14)"
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

              <button
                type="button"
                onClick={() => {
                  if (currentNewPlace?.id) {
                    router.push(`/${locale}/carte?discover=${encodeURIComponent(currentNewPlace.id)}`);
                    return;
                  }
                  router.push(`/${locale}/carte`);
                }}
                onTouchStart={onNewPlacesTouchStart}
                onTouchMove={onNewPlacesTouchMove}
                onTouchEnd={onNewPlacesTouchEnd}
                className="relative h-full overflow-hidden rounded-xl bg-white/10 text-left hover:bg-white/14 active:bg-white/18 touch-pan-y"
                style={{
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -6px 14px rgba(0,0,0,0.16), 0 14px 30px rgba(0,0,0,0.20), 0 40px 90px rgba(0,0,0,0.14)"
                }}
              >
                {currentNewPlace?.panoramaImage ? (
                  <img
                    src={currentNewPlace.panoramaImage}
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
                        {isFr ? "Ajouts récents" : "Recent additions"}
                      </p>
                    </div>
                  </div>
                  <div className="pr-7">
                    <div className="w-full px-3 py-1">
                      <p className="font-serif text-[15px] font-medium leading-tight tracking-[0.01em]">
                        {currentNewPlace?.name || (isFr ? "Ajoutés récemment" : "Recently added")}
                      </p>
                      <p className="text-[11px] opacity-90 truncate">
                        {currentNewPlace?.city || currentNewPlace?.address || "Indie Map"}
                      </p>
                    </div>
                  </div>
                </div>
                {newPlaces.length > 1 ? (
                  <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1.5">
                    {newPlaces.map((item, index) => (
                      <span
                        key={item.id}
                        className={index === newPlaceIndex ? "h-1.5 w-3 rounded-full bg-white/95" : "h-1.5 w-1.5 rounded-full bg-white/55"}
                      />
                    ))}
                  </div>
                ) : null}
            </button>

          </div>
        </div>
      </div>

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
            <span className="text-[22px] leading-none">♡</span>
            <span className="whitespace-nowrap text-[9px] font-medium leading-tight">{isFr ? "Mes lieux" : "My places"}</span>
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
                savedPlacesByCity.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {savedPlacesByCity.map((group) => {
                      const currentIndex = savedPlaceIndexes[group.city] ?? 0;
                      const currentPlace = group.places[currentIndex] ?? group.places[0] ?? null;
                      if (!currentPlace) return null;

                      return (
                        <div key={group.city}>
                          <h2 className="mb-2 text-sm font-semibold tracking-wide text-white/80">{group.city}</h2>
                          <button
                            type="button"
                            onClick={() => {
                              router.push(`/${locale}/carte?discover=${encodeURIComponent(currentPlace.id)}`);
                            }}
                            onTouchStart={onSavedPlacesTouchStart}
                            onTouchMove={onSavedPlacesTouchMove}
                            onTouchEnd={() => onSavedPlacesTouchEnd(group.city, group.places.length)}
                            className="relative w-full overflow-hidden rounded-xl bg-white/10 text-left hover:bg-white/14 active:bg-white/18 touch-pan-y"
                            style={{
                              minHeight: "130px",
                              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -6px 14px rgba(0,0,0,0.16), 0 14px 30px rgba(0,0,0,0.20), 0 40px 90px rgba(0,0,0,0.14)"
                            }}
                          >
                            {currentPlace.panoramaImage ? (
                              <img
                                src={currentPlace.panoramaImage}
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
                            <div className="absolute inset-0 z-10 flex flex-col justify-end p-3">
                              <div>
                                <p className="font-serif text-[15px] font-medium leading-tight tracking-[0.01em] text-white">
                                  {currentPlace.name}
                                </p>
                                <p className="mt-1 text-[11px] opacity-90 truncate text-white/90">
                                  {currentPlace.address || "Indie Map"}
                                </p>
                              </div>
                            </div>
                            {group.places.length > 1 ? (
                              <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1.5">
                                {group.places.map((item, index) => (
                                  <span
                                    key={item.id}
                                    className={index === currentIndex ? "h-1.5 w-3 rounded-full bg-white/95" : "h-1.5 w-1.5 rounded-full bg-white/55"}
                                  />
                                ))}
                              </div>
                            ) : null}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-white/80">
                    {isFr ? "Aucun lieu enregistré pour le moment." : "No saved places yet."}
                  </p>
                )
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
                  <div className="flex gap-2">
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




