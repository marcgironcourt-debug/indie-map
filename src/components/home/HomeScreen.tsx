"use client";
import { formatPlacePriceRange, type PlacePriceRange } from "@/lib/placePrice";

import { useRouter } from "next/navigation";
import React from "react";

import PlaceResultCard from "@/components/place/PlaceResultCard";

import BottomNavBar from "@/components/BottomNavBar";
import ContributeForm from "@/components/ContributeForm";
import MapPanel from "@/components/MapPanel";
import PersonalSpacePanel from "@/components/PersonalSpacePanel";
import ProfessionalSpacePanel from "@/components/ProfessionalSpacePanel";
import { getLocalizedCategory } from "@/lib/localizedCategory";
import { getCategoryStyle } from "@/lib/categoryStyle";
import { isOpenNowFR } from "@/lib/openingHours";
import {
  readRecentViewedPlaceIds,
  rememberRecentViewedPlace,
} from "@/lib/recentViewedPlaces";
import { getAnalyticsHeaders, trackEvent } from "@/lib/analytics";
import { readPlaceNotes, writePlaceNotes, type PlaceNote } from "@/lib/placeNotes";
import { migrateLegacySavedPlacesToUser, readSavedPlacesStorage, setSavedPlacesUserId, syncSavedPlaceToServer, writeSavedPlacesStorage } from "@/lib/savedPlacesStorage";
import { getInstallationLocale, getOrCreateInstallationSessionId, readInstallationPushToken, readRecentAnalyticsLocation, rememberAnalyticsLocation, rememberInstallationPushToken } from "@/lib/installationSession";
import {
  clearReferralToken,
  readReferralToken,
  rememberReferralToken,
} from "@/lib/referralStorage";

type Panel = null | "pros" | "contrib" | "personalSpace" | "myPlacesList" | "profileInfo" | "friends" | "sharedLists";

type AuthProfile = {
  id: string;
  email: string | null;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  avatarColor: string | null;
  preferredLocale: string;
  homeCity: string | null;
  ageRange: string | null;
  profileCompleted: boolean;
  contributionsCount?: number;
  contributionRank?: number | null;
  hasProfessionalAccess?: boolean;
  professionalPlaceId?: string | null;
};

type DiscoverPlace = {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  panoramaImage?: string;
  city?: string;
  address?: string;
  category?: string;
  priceRange?: PlacePriceRange;
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

function makeSearchTrackingId() {
  try {
    if (
      typeof globalThis.crypto !== "undefined" &&
      typeof globalThis.crypto.randomUUID === "function"
    ) {
      return globalThis.crypto.randomUUID();
    }
  } catch {}

  return (
    "search_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 12)
  );
}

type SharedListChoice = {
  id: string;
  title: string;
  places: {
    placeId: string;
  }[];
};


function renderOpeningHours(openingHours: string | undefined, timeZone: string | undefined, isFr: boolean = true) {
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

  function displayOpeningHoursLine(line: string) {
    if (isFr) return line;

    return line
      .replace(/^Lundi\b/i, "Monday")
      .replace(/^Mardi\b/i, "Tuesday")
      .replace(/^Mercredi\b/i, "Wednesday")
      .replace(/^Jeudi\b/i, "Thursday")
      .replace(/^Vendredi\b/i, "Friday")
      .replace(/^Samedi\b/i, "Saturday")
      .replace(/^Dimanche\b/i, "Sunday")
      .replace(/Fermé/gi, "Closed");
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
        {displayOpeningHoursLine(line)}
      </div>
    );
  });
}

declare global {
  interface Window {
    __IM_NATIVE_LOCATION__?: { lat?: number; lng?: number; ts?: number };
  }
  interface WindowEventMap {
    "im:native-location": CustomEvent<{ lat: number; lng: number }>;
  }

  interface Window {
    __IM_PENDING_PUSH_TOKEN__?: string;
    __IM_REGISTER_PUSH_TOKEN__?: (token: string) => void;
  }
}

const homeMemoryCache: Record<string, { discoverPlace: DiscoverPlace | null; newPlaces: NewPlace[] } | undefined> = {};

function normalizePushToken(value: unknown) {
  if (typeof value !== "string") return null;
  const token = value.trim();
  if (!token || token.length < 16 || token.length > 2000) return null;
  return token;
}

async function registerPushToken(token: string) {
  const res = await fetch("/api/v1/me/push-devices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      platform: "ios",
      token,
      sessionId:
        getOrCreateInstallationSessionId(),
      locale: getInstallationLocale(),
    }),
  });

  return res.ok;
}

function readSavedPlaces(userId?: string | null): SavedPlace[] {
  return readSavedPlacesStorage<SavedPlace>(userId)
    .filter((item) => !!item && typeof item === "object")
    .map((item) => ({
      ...item,
      id: String(item.id ?? "").trim(),
      name: String(item.name ?? "").trim(),
    }))
    .filter((item) => item.id.length > 0 && item.name.length > 0);
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
    return {
      discoverPlace: discover as DiscoverPlace | null,
      newPlaces: newest as NewPlace[]
    };
  } catch {
    return null;
  }
}

function writeHomeCache(locale: "fr" | "en", discoverPlace: DiscoverPlace | null, newPlaces: NewPlace[]) {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      "im-home-cache:" + locale,
      JSON.stringify({
        discover: discoverPlace ?? null,
        newPlaces: Array.isArray(newPlaces) ? newPlaces : []
      })
    );
  } catch {}
}

const HOME_RECENT_PLACES_CACHE_KEY =
  "im:home-recent-places:v1";

const HOME_OPEN_NOW_CACHE_KEY =
  "im:home-open-now:v1";

const HOME_OPEN_NOW_CACHE_MAX_AGE_MS =
  24 * 60 * 60 * 1000;

const HOME_OPEN_NOW_CACHE_MAX_PLACES =
  80;

function normalizeHomeCachedPlaces(
  value: unknown,
): DiscoverPlace[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return (value as DiscoverPlace[])
    .filter(
      (item) =>
        !!item &&
        typeof item === "object" &&
        String(item.id ?? "").trim().length > 0 &&
        String(item.name ?? "").trim().length > 0,
    );
}

function readRecentHomePlacesCache(
  locale: "fr" | "en",
): DiscoverPlace[] {
  try {
    if (typeof window === "undefined") {
      return [];
    }

    const raw =
      window.localStorage.getItem(
        `${HOME_RECENT_PLACES_CACHE_KEY}:${locale}`,
      );

    if (!raw) return [];

    return normalizeHomeCachedPlaces(
      JSON.parse(raw),
    ).slice(0, 20);
  } catch {
    return [];
  }
}

function writeRecentHomePlacesCache(
  locale: "fr" | "en",
  places: DiscoverPlace[],
) {
  try {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      `${HOME_RECENT_PLACES_CACHE_KEY}:${locale}`,
      JSON.stringify(
        normalizeHomeCachedPlaces(
          places,
        ).slice(0, 20),
      ),
    );
  } catch {}
}

function readOpenNowHomeCache(
  locale: "fr" | "en",
): {
  hadLocation: boolean;
  nearbyPlaces: DiscoverPlace[];
} | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }

    const raw =
      window.localStorage.getItem(
        `${HOME_OPEN_NOW_CACHE_KEY}:${locale}`,
      );

    if (!raw) return null;

    const parsed = JSON.parse(raw);

    const updatedAt =
      Number(parsed?.updatedAt);

    const age =
      Date.now() - updatedAt;

    const cacheFresh =
      Number.isFinite(age) &&
      age >= 0 &&
      age <=
        HOME_OPEN_NOW_CACHE_MAX_AGE_MS;

    return {
      hadLocation:
        parsed?.hadLocation === true,

      nearbyPlaces:
        cacheFresh
          ? normalizeHomeCachedPlaces(
              parsed?.nearbyPlaces,
            ).slice(
              0,
              HOME_OPEN_NOW_CACHE_MAX_PLACES,
            )
          : [],
    };
  } catch {
    return null;
  }
}

function writeOpenNowHomeCache(
  locale: "fr" | "en",
  nearbyPlaces: DiscoverPlace[],
) {
  try {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      `${HOME_OPEN_NOW_CACHE_KEY}:${locale}`,
      JSON.stringify({
        hadLocation: true,
        updatedAt: Date.now(),
        nearbyPlaces:
          normalizeHomeCachedPlaces(
            nearbyPlaces,
          ).slice(
            0,
            HOME_OPEN_NOW_CACHE_MAX_PLACES,
          ),
      }),
    );
  } catch {}
}

function getOpenNowHomePlaces(
  places: DiscoverPlace[],
) {
  return places
    .filter((place) => {
      const openingHours =
        String(
          place.openingHours ?? "",
        ).trim();

      const timeZone =
        String(
          place.timeZone ?? "",
        ).trim();

      if (
        !openingHours ||
        !timeZone
      ) {
        return false;
      }

      return (
        isOpenNowFR(
          openingHours,
          timeZone,
        ) === true
      );
    })
    .slice(0, 10);
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

type HomeMoodId =
  | "eat"
  | "relax"
  | "groceries"
  | "browse"
  | "inspire"
  | "alternative";

function matchesHomeMood(
  place: DiscoverPlace,
  mood: HomeMoodId,
) {
  const key = String(
    place.category ?? "",
  )
    .trim()
    .toLowerCase();

  if (!key) return false;

  if (mood === "eat") {
    return (
      key.includes("restaurant") ||
      key.includes("boulangerie") ||
      key.includes("bakery") ||
      key.includes("brasserie") ||
      key.includes("brewery") ||
      key.includes("brunch")
    );
  }

  if (mood === "relax") {
    return (
      key.includes("café") ||
      key.includes("cafe") ||
      key.includes("bar") ||
      key.includes("pub")
    );
  }

  if (mood === "groceries") {
    return (
      key.includes("épicerie") ||
      key.includes("epicerie") ||
      key.includes("grocery") ||
      key.includes("marché") ||
      key.includes("marche") ||
      key.includes("market") ||
      key.includes("ferme") ||
      key.includes("farm") ||
      key.includes("fromagerie") ||
      key.includes("cheese shop") ||
      key.includes("cheesemonger")
    );
  }

  if (mood === "browse") {
    return (
      key.includes("boutique") ||
      key.includes("shop") ||
      key.includes("mode") ||
      key.includes("fashion") ||
      key.includes("friperie") ||
      key.includes("vêtement") ||
      key.includes("vetement")
    );
  }

  if (mood === "inspire") {
    return (
      key.includes("librairie") ||
      key.includes("bookstore") ||
      key.includes("bouquinerie") ||
      key.includes("atelier") ||
      key.includes("workshop")
    );
  }

  return (
    key.includes("lieu alternatif") ||
    key.includes("lieu de vie") ||
    key.includes("alternative place")
  );
}

function getHomeMoodLabel(
  mood: HomeMoodId,
  isFr: boolean,
) {
  const labels: Record<
    HomeMoodId,
    { fr: string; en: string }
  > = {
    eat: {
      fr: "Manger",
      en: "Eat",
    },
    relax: {
      fr: "Se détendre",
      en: "Relax",
    },
    groceries: {
      fr: "Faire ses courses",
      en: "Shop for food",
    },
    browse: {
      fr: "Flâner",
      en: "Browse",
    },
    inspire: {
      fr: "S’inspirer",
      en: "Get inspired",
    },
    alternative: {
      fr: "Sortir autrement",
      en: "Go somewhere different",
    },
  };

  return labels[mood][isFr ? "fr" : "en"];
}

function getHomeMoodCategoriesLabel(
  mood: HomeMoodId,
  isFr: boolean,
) {
  const labels: Record<
    HomeMoodId,
    { fr: string; en: string }
  > = {
    eat: {
      fr: "Restaurant · Boulangerie · Brasserie · Brunch",
      en: "Restaurant · Bakery · Brewery · Brunch",
    },
    relax: {
      fr: "Café · Bar · Pub",
      en: "Cafe · Bar · Pub",
    },
    groceries: {
      fr: "Épicerie · Marché · Ferme · Fromagerie",
      en: "Grocery · Market · Farm · Cheese shop",
    },
    browse: {
      fr: "Boutique · Mode",
      en: "Shop · Fashion",
    },
    inspire: {
      fr: "Librairie · Atelier",
      en: "Bookstore · Workshop",
    },
    alternative: {
      fr: "Lieu alternatif",
      en: "Alternative place",
    },
  };

  return labels[mood][isFr ? "fr" : "en"];
}

function getDailyHomeMoodScore(
  placeId: string,
  dayKey: string,
  mood: HomeMoodId,
  proximity: "near" | "far",
) {
  const seed =
    `${dayKey}|${mood}|${proximity}|${placeId}`;

  let hash = 2166136261;

  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function pickDailyHomeMoodPlaces(
  places: DiscoverPlace[],
  dayKey: string,
  mood: HomeMoodId,
  proximity: "near" | "far",
  limit = 10,
) {
  if (places.length <= limit) {
    return places;
  }

  return [...places]
    .sort((a, b) => {
      const scoreA =
        getDailyHomeMoodScore(
          String(a.id),
          dayKey,
          mood,
          proximity,
        );

      const scoreB =
        getDailyHomeMoodScore(
          String(b.id),
          dayKey,
          mood,
          proximity,
        );

      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }

      return String(a.id).localeCompare(
        String(b.id),
      );
    })
    .slice(0, limit);
}

function getHomeMoodBackground(
  mood: HomeMoodId,
) {
  const backgrounds: Record<HomeMoodId, string> = {
    eat:
      "linear-gradient(145deg, rgba(121,69,54,0.78), rgba(28,28,25,0.96))",
    relax:
      "linear-gradient(145deg, rgba(92,68,50,0.78), rgba(28,28,25,0.96))",
    groceries:
      "linear-gradient(145deg, rgba(111,101,40,0.82), rgba(28,28,25,0.96))",
    browse:
      "linear-gradient(145deg, rgba(48,74,78,0.82), rgba(28,28,25,0.96))",
    inspire:
      "linear-gradient(145deg, rgba(72,62,96,0.82), rgba(28,28,25,0.96))",
    alternative:
      "linear-gradient(145deg, rgba(65,91,61,0.82), rgba(28,28,25,0.96))",
  };

  return backgrounds[mood];
}

function getHomeMoodOpaqueBackground(
  mood: HomeMoodId,
) {
  const backgrounds: Record<HomeMoodId, string> = {
    eat:
      "linear-gradient(145deg, rgb(121,69,54), rgb(28,28,25))",
    relax:
      "linear-gradient(145deg, rgb(92,68,50), rgb(28,28,25))",
    groceries:
      "linear-gradient(145deg, rgb(111,101,40), rgb(28,28,25))",
    browse:
      "linear-gradient(145deg, rgb(48,74,78), rgb(28,28,25))",
    inspire:
      "linear-gradient(145deg, rgb(72,62,96), rgb(28,28,25))",
    alternative:
      "linear-gradient(145deg, rgb(65,91,61), rgb(28,28,25))",
  };

  return backgrounds[mood];
}

export default function HomeScreen({
  locale,
  initialDiscoverPlace = null,
  initialNewPlaces = [],
  initialAllPlaces = [],
  initialSelectedHomePlace = null,
  initialSelectedHomePlaceSource = "home_detail"
}: {
  locale: "fr" | "en";
  initialDiscoverPlace?: DiscoverPlace | null;
  initialNewPlaces?: NewPlace[];
  initialAllPlaces?: DiscoverPlace[];
  initialSelectedHomePlace?: DiscoverPlace | null;
  initialSelectedHomePlaceSource?: string;
}) {
  const router = useRouter();
  const isFr = locale === "fr";
  const [panel, setPanel] = React.useState<Panel>(() => {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem("im:pending-panel-after-locale") === "personalSpace" ? "personalSpace" : null;
  });
  const [initialSharedListId, setInitialSharedListId] = React.useState<string | null>(null);
  const panelScrollRef = React.useRef<HTMLDivElement | null>(null);
  const [authProfile, setAuthProfile] = React.useState<AuthProfile | null>(null);
  const [authLoading, setAuthLoading] = React.useState(false);
  const [authMode, setAuthMode] = React.useState<"signup" | "login" | "resetRequest" | "resetConfirm">("signup");
  const [authEmail, setAuthEmail] = React.useState("");
  const [authUsername, setAuthUsername] = React.useState("");
  const [authPassword, setAuthPassword] = React.useState("");
  const [authResetToken, setAuthResetToken] = React.useState("");
  const [authResetDone, setAuthResetDone] = React.useState(false);
  const [authForceForm, setAuthForceForm] = React.useState(false);
  const [authSending, setAuthSending] = React.useState(false);
  const [authError, setAuthError] = React.useState("");
  const [profileUsername, setProfileUsername] = React.useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = React.useState("");
  const [profileAvatarColor, setProfileAvatarColor] = React.useState("#F97316");
  const [profileHomeCity, setProfileHomeCity] = React.useState("");
  const [profileAgeRange, setProfileAgeRange] = React.useState("");
  const [profileLocale, setProfileLocale] = React.useState<"fr" | "en">(locale);
  const [commentsVisibleToFriends, setCommentsVisibleToFriends] = React.useState(false);
  const [visitedPlacesVisibleToFriends, setVisitedPlacesVisibleToFriends] = React.useState(false);
  const [profileSaving, setProfileSaving] = React.useState(false);
  const [profileSuccess, setProfileSuccess] = React.useState("");
  const [profileError, setProfileError] = React.useState("");
  const [incomingFriendRequestCount, setIncomingFriendRequestCount] = React.useState(0);
  const [unseenSharedListCount, setUnseenSharedListCount] = React.useState(0);
  const [discoverPlace, setDiscoverPlace] = React.useState<DiscoverPlace | null>(() => mergePlace(homeMemoryCache[locale]?.discoverPlace ?? null, initialDiscoverPlace ?? null));

  const refreshAuthProfile = React.useCallback(async () => {
    setAuthLoading(true);
    try {
      const res = await fetch("/api/v1/me/profile", { cache: "no-store" });
      if (res.status === 401) {
        setAuthProfile(null);
        setSavedPlacesUserId(null);
        setIncomingFriendRequestCount(0);
        return null;
      }
      const data = await res.json().catch(() => null);
      const user = data?.user ?? null;
      if (data?.ok && user) {
        setIncomingFriendRequestCount(
          Number(data?.notifications?.incomingFriendRequestCount) || 0,
        );
        setUnseenSharedListCount(
          Number(data?.notifications?.unseenSharedListCount) || 0,
        );

        const migratedSavedPlaces =
          await migrateLegacySavedPlacesToUser<SavedPlace>(
            user.id,
          );

        const profileSavedPlaceIds = Array.isArray(data?.savedPlaceIds)
          ? data.savedPlaceIds
              .map((value: unknown) => String(value ?? "").trim())
              .filter(Boolean)
          : [];

        const savedIds = new Set([
          ...profileSavedPlaceIds,
          ...migratedSavedPlaces
            .map((place) => String(place?.id ?? "").trim())
            .filter(Boolean),
        ]);

        const syncedSavedPlaces =
          initialAllPlaces.length > 0
            ? initialAllPlaces.filter((place) =>
                savedIds.has(String(place.id)),
              )
            : migratedSavedPlaces;

        setAuthProfile(user);
        setSavedPlacesUserId(user.id);
        setSavedPlaces(syncedSavedPlaces);
        writeSavedPlacesStorage(syncedSavedPlaces, user.id);
        setProfileUsername(user.username || "");
        setProfileAvatarUrl(user.avatarUrl || "");
        setProfileAvatarColor(user.avatarColor || "#F97316");
        setProfileHomeCity(user.homeCity || "");
        setProfileAgeRange(user.ageRange || "");
        const preferredLocale = user.preferredLocale === "en" ? "en" : "fr";
        setProfileLocale(preferredLocale);
        if (preferredLocale !== locale && typeof window !== "undefined") {
          document.cookie = `NEXT_LOCALE=${preferredLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
          const nextPath = window.location.pathname.match(/^\/(fr|en)(?=\/|$)/)
            ? window.location.pathname.replace(/^\/(fr|en)(?=\/|$)/, `/${preferredLocale}`)
            : `/${preferredLocale}`;
          router.replace(nextPath + window.location.search);
        }
        setCommentsVisibleToFriends(user.commentsVisibleToFriends === true);
        setVisitedPlacesVisibleToFriends(user.visitedPlacesVisibleToFriends === true);
        return user as AuthProfile;
      }
      return null;
    } catch {
      return null;
    } finally {
      setAuthLoading(false);
    }
  }, [locale, router, initialAllPlaces]);

React.useEffect(() => {
    const onAuthExpired = () => {
      setAuthProfile(null);
      setSavedPlacesUserId(null);
      setIncomingFriendRequestCount(0);
      setUnseenSharedListCount(0);
    };

    window.addEventListener(
      "im:auth-expired",
      onAuthExpired as EventListener,
    );

    return () => {
      window.removeEventListener(
        "im:auth-expired",
        onAuthExpired as EventListener,
      );
    };
  }, []);

  React.useEffect(() => {
    refreshAuthProfile();
  }, [refreshAuthProfile]);

React.useEffect(() => {
    window.__IM_REGISTER_PUSH_TOKEN__ = (rawToken: string) => {
      const token = normalizePushToken(rawToken);
      if (!token) return;
      window.__IM_PENDING_PUSH_TOKEN__ = token;
      rememberInstallationPushToken(token);

      registerPushToken(token)
        .then((ok) => {
          if (ok && window.__IM_PENDING_PUSH_TOKEN__ === token) {
            delete window.__IM_PENDING_PUSH_TOKEN__;
          }
        })
        .catch(() => null);
    };

    const pendingToken =
      normalizePushToken(
        window.__IM_PENDING_PUSH_TOKEN__,
      ) ??
      normalizePushToken(
        readInstallationPushToken(),
      );

    if (pendingToken) {
      registerPushToken(pendingToken)
        .then((ok) => {
          if (ok && window.__IM_PENDING_PUSH_TOKEN__ === pendingToken) {
            delete window.__IM_PENDING_PUSH_TOKEN__;
          }
        })
        .catch(() => null);
    }

    return () => {
      delete window.__IM_REGISTER_PUSH_TOKEN__;
    };
  }, [authProfile?.id, panel]);


  React.useEffect(() => {
    if (!authProfile) return;
    window.__IM_REGISTER_WEB_PUSH__?.().catch(() => false);
  }, [authProfile?.id]);

  React.useEffect(() => {
    if (panel === "personalSpace" && !authProfile) {
      refreshAuthProfile();
    }
  }, [panel, authProfile, refreshAuthProfile]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);

    const referralToken =
      params.get("invite");

    if (referralToken) {
      rememberReferralToken(
        referralToken,
      );

      setPanel("personalSpace");
      setAuthMode("signup");
      setAuthForceForm(true);
    }
    if (params.get("auth") === "ok") {
      setPanel("personalSpace");
      refreshAuthProfile();
    }

    if (params.get("signup") === "1") {
      setPanel("personalSpace");
      setAuthMode("signup");
      setAuthForceForm(true);
    }

    const requestedPanel = params.get("panel");
    if (requestedPanel === "friends") {
      window.sessionStorage.removeItem("im:pending-panel-after-locale");
      setPanel("friends");
      refreshAuthProfile();
      return;
    }

    if (requestedPanel === "sharedLists") {
      window.sessionStorage.removeItem("im:pending-panel-after-locale");
      const sharedListId = params.get("sharedListId") || params.get("listId");
      setInitialSharedListId(sharedListId);
      setPanel("sharedLists");
      refreshAuthProfile();
      return;
    }

    const pendingPanel = window.sessionStorage.getItem("im:pending-panel-after-locale");
    if (pendingPanel === "personalSpace") {
      window.sessionStorage.removeItem("im:pending-panel-after-locale");
      setPanel("personalSpace");
      refreshAuthProfile();
    }

    const resetPasswordToken = params.get("resetPasswordToken");
    if (resetPasswordToken) {
      setPanel("personalSpace");
      setAuthMode("resetConfirm");
      setAuthResetToken(resetPasswordToken);
      setAuthError("");
      setAuthResetDone(false);
      setAuthForceForm(true);
    }
  }, [refreshAuthProfile]);


  React.useEffect(() => {
    if (
      !authProfile ||
      typeof window === "undefined"
    ) {
      return;
    }

    clearReferralToken();

    const url =
      new URL(
        window.location.href,
      );

    if (
      url.searchParams.has(
        "invite",
      )
    ) {
      url.searchParams.delete(
        "invite",
      );

      window.history.replaceState(
        {},
        "",
        url.toString(),
      );
    }
  }, [authProfile?.id]);

  async function requestPasswordReset() {
    const email = authEmail.trim();
    setAuthError("");
    setAuthResetDone(false);

    if (!email || !email.includes("@")) {
      setAuthError(isFr ? "Entre l’email associé à ton compte." : "Enter the email linked to your account.");
      return;
    }

    setAuthSending(true);
    try {
      const res = await fetch("/api/v1/auth/password-reset/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setAuthError(isFr ? "Impossible d’envoyer le lien pour l’instant." : "Unable to send the link right now.");
        return;
      }

      setAuthResetDone(true);
    } catch {
      setAuthError(isFr ? "Impossible d’envoyer le lien pour l’instant." : "Unable to send the link right now.");
    } finally {
      setAuthSending(false);
    }
  }

  async function confirmPasswordReset() {
    const password = authPassword;
    setAuthError("");

    if (!authResetToken) {
      setAuthError(isFr ? "Lien invalide ou expiré." : "Invalid or expired link.");
      return;
    }

    if (password.length < 8) {
      setAuthError(isFr ? "Le mot de passe doit contenir au moins 8 caractères." : "Password must be at least 8 characters.");
      return;
    }

    setAuthSending(true);
    try {
      const res = await fetch("/api/v1/auth/password-reset/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: authResetToken, password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setAuthError(isFr ? "Lien invalide ou expiré." : "Invalid or expired link.");
        return;
      }

      setAuthUsername(data.username || "");
      setAuthPassword("");
      setAuthResetToken("");
      setAuthResetDone(true);
      setAuthMode("login");

      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("resetPasswordToken");
        window.history.replaceState({}, "", url.toString());
      }
    } catch {
      setAuthError(isFr ? "Impossible de modifier le mot de passe." : "Unable to update the password.");
    } finally {
      setAuthSending(false);
    }
  }

  async function submitAuth() {
    const email = authEmail.trim();
    const username = authUsername.trim();
    const password = authPassword;
    setAuthError("");

    if (authMode === "signup") {
      if (!email || !email.includes("@")) {
        setAuthError(isFr ? "Entre une adresse email valide." : "Enter a valid email address.");
        return;
      }
      if (username.length < 3) {
        setAuthError(isFr ? "Le pseudo doit contenir au moins 3 caractères." : "Username must be at least 3 characters.");
        return;
      }
    } else if (username.length < 3) {
      setAuthError(isFr ? "Entre ton email ou ton pseudo." : "Enter your email or username.");
      return;
    }

    if (password.length < 8) {
      setAuthError(isFr ? "Le mot de passe doit contenir au moins 8 caractères." : "Password must be at least 8 characters.");
      return;
    }

    setAuthSending(true);
    try {
      const res = await fetch(authMode === "signup" ? "/api/v1/auth/signup" : "/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          authMode === "signup"
            ? {
                email,
                username,
                password,
                referralToken:
                  readReferralToken() ||
                  undefined,
              }
            : { identifier: username, password }
        ),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok || !data?.user) {
        if (data?.error === "email_taken") {
          setAuthError(isFr ? "Un compte existe déjà avec cet email." : "An account already exists with this email.");
          return;
        }
        if (data?.error === "username_taken") {
          setAuthError(isFr ? "Ce pseudo est déjà pris." : "This username is already taken.");
          return;
        }
        if (data?.error === "invalid_credentials") {
          setAuthError(isFr ? "Identifiant ou mot de passe incorrect." : "Incorrect identifier or password.");
          return;
        }
        setAuthError(authMode === "signup" ? (isFr ? "Impossible de créer le compte." : "Unable to create the account.") : (isFr ? "Impossible de se connecter." : "Unable to sign in."));
        return;
      }

      setAuthProfile(data.user);
      setAuthForceForm(false);
      setProfileUsername(data.user.username || "");
      setProfileAvatarUrl(data.user.avatarUrl || "");
      setProfileAvatarColor(data.user.avatarColor || "#F97316");
      setProfileHomeCity(data.user.homeCity || "");
      setProfileAgeRange(data.user.ageRange || "");
      setProfileLocale(data.user.preferredLocale || locale);
      setCommentsVisibleToFriends(data.user.commentsVisibleToFriends === true);
      setVisitedPlacesVisibleToFriends(data.user.visitedPlacesVisibleToFriends === true);
      setAuthPassword("");
    } catch {
      setAuthError(authMode === "signup" ? (isFr ? "Impossible de créer le compte." : "Unable to create the account.") : (isFr ? "Impossible de se connecter." : "Unable to sign in."));
    } finally {
      setAuthSending(false);
    }
  }


  async function logoutAuth(): Promise<boolean> {
    setAuthError("");
    setAuthSending(true);

    try {
      const res = await fetch("/api/v1/auth/logout", {
        method: "POST",
      });

      if (!res.ok) {
        setAuthError(isFr ? "Impossible de se déconnecter pour l’instant." : "Unable to sign out right now.");
        return false;
      }

      setAuthProfile(null);
      setSavedPlacesUserId(null);
      setAuthMode("login");
      setAuthEmail("");
      setAuthUsername("");
      setAuthPassword("");
      setAuthResetToken("");
      setAuthResetDone(false);
      setAuthForceForm(false);
      setProfileUsername("");
      setProfileAvatarUrl("");
      setProfileAvatarColor("#F97316");
      setProfileHomeCity("");
      setProfileAgeRange("");
      setProfileLocale(locale);
      setCommentsVisibleToFriends(false);
      setVisitedPlacesVisibleToFriends(false);
      return true;
    } catch {
      setAuthError(isFr ? "Impossible de se déconnecter pour l’instant." : "Unable to sign out right now.");
      return false;
    } finally {
      setAuthSending(false);
    }
  }

  async function saveProfile() {
    setProfileError("");
    setProfileSuccess("");
    const username = profileUsername.trim();
    if (username.length < 3) {
      setProfileError(isFr ? "Le pseudo doit contenir au moins 3 caractères." : "Username must be at least 3 characters.");
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetch("/api/v1/me/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username,
          displayName: username,
          avatarUrl: authProfile?.avatarUrl || null,
          avatarColor: profileAvatarColor,
          preferredLocale: profileLocale || locale,
          homeCity: profileHomeCity.trim() || null,
          ageRange: profileAgeRange || null,
          commentsVisibleToFriends,
          visitedPlacesVisibleToFriends,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.user) {
        setProfileError(data?.error === "username_taken" ? (isFr ? "Ce pseudo est déjà pris." : "This username is already taken.") : (isFr ? "Impossible d’enregistrer le profil." : "Unable to save profile."));
        return;
      }
      setAuthProfile(data.user);
      setProfileAvatarColor(data.user.avatarColor || profileAvatarColor);
      setCommentsVisibleToFriends(data.user.commentsVisibleToFriends === true);
      setVisitedPlacesVisibleToFriends(data.user.visitedPlacesVisibleToFriends === true);
      if (profileLocale !== locale) {
        document.cookie = `NEXT_LOCALE=${profileLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
        window.location.href = window.location.pathname.replace(/^\/(fr|en)(?=\/|$)/, `/${profileLocale}`);
        return;
      }
      setProfileSuccess(isFr ? "Profil enregistré." : "Profile saved.");
    } catch {
      setProfileError(isFr ? "Impossible d’enregistrer le profil." : "Unable to save profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  React.useEffect(() => {
    try { router.prefetch(`/${locale}/carte`); } catch {}
  }, [router, locale]);
  const [discoverReady, setDiscoverReady] = React.useState(() => {
    const cached = homeMemoryCache[locale];
    return Boolean(cached?.discoverPlace || (cached?.newPlaces?.length ?? 0) > 0 || initialDiscoverPlace || initialNewPlaces.length > 0);
  });
  const [newPlaces, setNewPlaces] = React.useState<NewPlace[]>(() => homeMemoryCache[locale]?.newPlaces ?? initialNewPlaces ?? []);
  const [nearbyPlaces, setNearbyPlaces] = React.useState<DiscoverPlace[]>([]);

  const [
    cachedOpenNowNearbyPlaces,
    setCachedOpenNowNearbyPlaces,
  ] = React.useState<DiscoverPlace[]>([]);

  const [openNowHasLocation, setOpenNowHasLocation] =
    React.useState(false);

  const [openNowRefreshing, setOpenNowRefreshing] =
    React.useState(false);

  const [homeLocationError, setHomeLocationError] =
    React.useState("");

  const [openNowTick, setOpenNowTick] =
    React.useState(0);
  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setOpenNowTick((value) => value + 1);
    }, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  React.useEffect(() => {
    const cached =
      readOpenNowHomeCache(locale);

    if (!cached) return;

    if (cached.hadLocation) {
      setOpenNowHasLocation(true);
      setOpenNowRefreshing(true);
    }

    if (
      cached.nearbyPlaces.length > 0
    ) {
      setCachedOpenNowNearbyPlaces(
        cached.nearbyPlaces,
      );
    }
  }, [locale]);

  const openNowPlaces =
    React.useMemo(() => {
      void openNowTick;

      const source =
        nearbyPlaces.length > 0
          ? nearbyPlaces
          : cachedOpenNowNearbyPlaces;

      return getOpenNowHomePlaces(
        source,
      );
    }, [
      nearbyPlaces,
      cachedOpenNowNearbyPlaces,
      openNowTick,
    ]);

  const [selectedHomeMood, setSelectedHomeMood] =
    React.useState<HomeMoodId | null>(null);

  const [
    recentViewedPlaceIds,
    setRecentViewedPlaceIds,
  ] = React.useState<string[]>([]);

  const [
    cachedRecentViewedPlaces,
    setCachedRecentViewedPlaces,
  ] = React.useState<DiscoverPlace[]>([]);

  const [
    recentViewedOpen,
    setRecentViewedOpen,
  ] = React.useState(false);

  React.useEffect(() => {
    setCachedRecentViewedPlaces(
      readRecentHomePlacesCache(
        locale,
      ),
    );
  }, [locale]);

  const [selectedHomePlace, setSelectedHomePlace] = React.useState<DiscoverPlace | null>(
    initialSelectedHomePlace
  );
  const [selectedHomePlaceSource, setSelectedHomePlaceSource] = React.useState(
    initialSelectedHomePlaceSource
  );
  const [selectedPlaceSharedListPickerOpen, setSelectedPlaceSharedListPickerOpen] = React.useState(false);
  const [selectedPlaceSharedLists, setSelectedPlaceSharedLists] = React.useState<SharedListChoice[]>([]);
  const [selectedPlaceSharedListsLoading, setSelectedPlaceSharedListsLoading] = React.useState(false);
  const [selectedPlaceSharedListsSaving, setSelectedPlaceSharedListsSaving] = React.useState(false);
  const [selectedPlaceSharedListsError, setSelectedPlaceSharedListsError] = React.useState("");
  const [selectedPlaceSharedListsMessage, setSelectedPlaceSharedListsMessage] = React.useState("");
  const [selectedPlaceNewSharedListTitle, setSelectedPlaceNewSharedListTitle] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchFocused, setSearchFocused] = React.useState(false);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<DiscoverPlace[] | null>(null);
  const searchAbortRef = React.useRef<AbortController | null>(null);
  const [activeSearchId, setActiveSearchId] = React.useState<string | null>(null);
  const [activeSearchQuery, setActiveSearchQuery] = React.useState("");
  const searchResultsScrollRef = React.useRef<HTMLDivElement | null>(null);
  const searchImpressionKeysRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    const root = searchResultsScrollRef.current;

    if (
      !root ||
      !activeSearchId ||
      !searchResults ||
      searchResults.length === 0 ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (
            !entry.isIntersecting ||
            entry.intersectionRatio < 0.6
          ) {
            continue;
          }

          const element = entry.target as HTMLElement;

          const placeId = String(
            element.dataset.searchResultId || ""
          ).trim();

          const rank = Number(
            element.dataset.searchResultRank
          );

          if (
            !placeId ||
            !Number.isInteger(rank) ||
            rank < 1
          ) {
            continue;
          }

          const key =
            `${activeSearchId}:${placeId}`;

          if (
            searchImpressionKeysRef.current.has(key)
          ) {
            observer.unobserve(element);
            continue;
          }

          const item = searchResults.find(
            (candidate) =>
              String(candidate.id) === placeId
          );

          if (!item) continue;

          searchImpressionKeysRef.current.add(key);

          trackEvent({
            eventType: "search_result_impression",
            placeId: item.id,
            city: item.city,
            category: item.category,
            searchId: activeSearchId,
            searchRank: rank,
            locale,
            metadata: {
              name: item.name,
              query: activeSearchQuery,
              source: "search_results",
            },
          });

          observer.unobserve(element);
        }
      },
      {
        root,
        threshold: [0.6],
      },
    );

    root
      .querySelectorAll<HTMLElement>(
        "[data-search-result-id]"
      )
      .forEach((element) => {
        observer.observe(element);
      });

    return () => {
      observer.disconnect();
    };
  }, [
    activeSearchId,
    activeSearchQuery,
    locale,
    searchResults,
  ]);

  const [addressCopied, setAddressCopied] = React.useState(false);
  const [selectedPlaceCommentsOpen, setSelectedPlaceCommentsOpen] = React.useState(false);
  const [selectedPlaceCommentInput, setSelectedPlaceCommentInput] = React.useState("");
  const [selectedPlaceCommentSaving, setSelectedPlaceCommentSaving] = React.useState(false);
  const [selectedPlaceCommentError, setSelectedPlaceCommentError] = React.useState("");
  const [savedPlaces, setSavedPlaces] = React.useState<SavedPlace[]>(() => readSavedPlaces());
  const savedPlaceMutationIdsRef = React.useRef<Set<string>>(new Set());
  const [placeNotes, setPlaceNotes] = React.useState<Record<string, PlaceNote>>({});
  const [editingPlaceNote, setEditingPlaceNote] = React.useState<SavedPlace | null>(null);
  const [editingPlaceComment, setEditingPlaceComment] = React.useState("");
  const [allPlaces, setAllPlaces] = React.useState<DiscoverPlace[]>(initialAllPlaces ?? []);

  const applyHomeLocation =
    React.useCallback(
      (
        latRaw: number,
        lngRaw: number,
      ) => {
        const lat =
          Number(latRaw);

        const lng =
          Number(lngRaw);

        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng)
        ) {
          return;
        }

        rememberAnalyticsLocation(
          lat,
          lng,
        );

        setHomeLocationError("");
        setOpenNowHasLocation(
          true,
        );

        const source =
          allPlaces.length > 0
            ? allPlaces
            : initialAllPlaces;

        const nearby =
          source
            .filter((item) => {
              const itemLat =
                Number(item.lat);

              const itemLng =
                Number(item.lng);

              return (
                Number.isFinite(
                  itemLat,
                ) &&
                Number.isFinite(
                  itemLng,
                ) &&
                haversineKm(
                  lat,
                  lng,
                  itemLat,
                  itemLng,
                ) <= 30
              );
            })
            .sort((a, b) => {
              const distanceA =
                haversineKm(
                  lat,
                  lng,
                  Number(a.lat),
                  Number(a.lng),
                );

              const distanceB =
                haversineKm(
                  lat,
                  lng,
                  Number(b.lat),
                  Number(b.lng),
                );

              return (
                distanceA -
                distanceB
              );
            });

        if (source.length > 0) {
          setNearbyPlaces(
            nearby,
          );

          setCachedOpenNowNearbyPlaces(
            nearby.slice(
              0,
              HOME_OPEN_NOW_CACHE_MAX_PLACES,
            ),
          );

          writeOpenNowHomeCache(
            locale,
            nearby,
          );

          setOpenNowRefreshing(
            false,
          );
        } else {
          setOpenNowRefreshing(
            true,
          );
        }

        fetch(
          "/api/v1/me/location",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                lat,
                lng,
              }),
            keepalive: true,
          },
        ).catch(
          () => null,
        );
      },
      [
        allPlaces,
        initialAllPlaces,
        locale,
      ],
    );

  const requestHomeLocation =
    React.useCallback(
      () => {
        if (
          typeof window ===
          "undefined"
        ) {
          return;
        }

        const nativePlatform =
          window
            .__IM_NATIVE_APP__
            ?.platform;

        /*
         * iOS :
         * on laisse CLLocationManager
         * décider entre demande initiale
         * et ouverture des réglages.
         */
        if (
          nativePlatform ===
          "ios"
        ) {
          const handler =
            (
              window as any
            ).webkit
              ?.messageHandlers
              ?.imLocationPermission;

          if (handler) {
            handler.postMessage(
              "open",
            );

            return;
          }
        }

        if (
          !navigator.geolocation
        ) {
          return;
        }

        navigator.geolocation
          .getCurrentPosition(
            (position) => {
              applyHomeLocation(
                Number(
                  position
                    .coords
                    .latitude,
                ),
                Number(
                  position
                    .coords
                    .longitude,
                ),
              );
            },

            (error) => {
              console.error(
                "[home-location]",
                error.code,
                error.message,
              );

              if (
                /Android/i.test(
                  navigator.userAgent,
                )
              ) {
                window.location.href =
                  "indiemap://location-settings";
                return;
              }

              if (
                error.code === 1
              ) {
                setHomeLocationError(
                  isFr
                    ? "Safari refuse l’accès à ta position pour ce site. Vérifie l’autorisation de localisation d’Indie Map dans Safari puis réessaie."
                    : "Safari is denying location access for this site. Check Indie Map's location permission in Safari and try again.",
                );
              } else if (
                error.code === 2
              ) {
                /*
                 * Safari/macOS peut répondre POSITION_UNAVAILABLE
                 * temporairement même lorsque l'autorisation est accordée.
                 * On retente avec une précision plus élevée et davantage
                 * de temps avant d'afficher une erreur.
                 */
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    applyHomeLocation(
                      Number(
                        position.coords.latitude,
                      ),
                      Number(
                        position.coords.longitude,
                      ),
                    );
                  },
                  (retryError) => {
                    console.error(
                      "[home-location-retry]",
                      retryError.code,
                      retryError.message,
                    );

                    setHomeLocationError(
                      isFr
                        ? "Ta localisation est autorisée, mais ton appareil n’arrive pas à déterminer ta position actuellement. Vérifie que le service de localisation et le Wi-Fi sont actifs, puis réessaie."
                        : "Location is allowed, but your device cannot determine your position right now. Check that Location Services and Wi-Fi are enabled, then try again.",
                    );
                  },
                  {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0,
                  },
                );
              } else if (
                error.code === 3
              ) {
                setHomeLocationError(
                  isFr
                    ? "La récupération de ta position a pris trop de temps. Réessaie."
                    : "Getting your location took too long. Try again.",
                );
              } else {
                setHomeLocationError(
                  isFr
                    ? "Impossible de récupérer ta position."
                    : "Unable to get your location.",
                );
              }
            },

            {
              enableHighAccuracy:
                false,
              timeout: 7000,
              maximumAge:
                300000,
            },
          );
      },
      [
        applyHomeLocation,
      ],
    );

  React.useEffect(() => {
    const onNativeLocation =
      (
        event:
          Event,
      ) => {
        const detail =
          (
            event as
              CustomEvent<{
                lat: number;
                lng: number;
              }>
          ).detail;

        applyHomeLocation(
          Number(
            detail?.lat,
          ),
          Number(
            detail?.lng,
          ),
        );
      };

    window.addEventListener(
      "im:native-location",
      onNativeLocation,
    );

    return () => {
      window.removeEventListener(
        "im:native-location",
        onNativeLocation,
      );
    };
  }, [
    applyHomeLocation,
  ]);

  React.useEffect(() => {
    /*
     * Quand l'utilisateur revient
     * des réglages iOS / Android,
     * on vérifie à nouveau la position.
     */
    const refresh =
      () => {
        if (
          document
            .visibilityState ===
          "hidden"
        ) {
          return;
        }

        const nativePlatform =
          window
            .__IM_NATIVE_APP__
            ?.platform;

        if (
          nativePlatform ===
          "ios"
        ) {
          const handler =
            (
              window as any
            ).webkit
              ?.messageHandlers
              ?.imLocationPermission;

          handler
            ?.postMessage(
              "refresh",
            );

          return;
        }

        if (
          !navigator.geolocation
        ) {
          return;
        }

        navigator.geolocation
          .getCurrentPosition(
            (position) => {
              applyHomeLocation(
                Number(
                  position
                    .coords
                    .latitude,
                ),
                Number(
                  position
                    .coords
                    .longitude,
                ),
              );
            },
            () => undefined,
            {
              enableHighAccuracy:
                false,
              timeout: 3500,
              maximumAge:
                300000,
            },
          );
      };

    window.addEventListener(
      "focus",
      refresh,
    );

    document.addEventListener(
      "visibilitychange",
      refresh,
    );

    return () => {
      window.removeEventListener(
        "focus",
        refresh,
      );

      document.removeEventListener(
        "visibilitychange",
        refresh,
      );
    };
  }, [
    applyHomeLocation,
  ]);

  React.useEffect(() => {
    const recentPosition =
      readRecentAnalyticsLocation();

    if (!recentPosition) return;

    setOpenNowHasLocation(true);

    const source =
      allPlaces.length > 0
        ? allPlaces
        : initialAllPlaces;

    if (source.length === 0) {
      setOpenNowRefreshing(true);
      return;
    }

    const nearby = source
      .filter((item) => {
        const lat = Number(item.lat);
        const lng = Number(item.lng);

        return (
          Number.isFinite(lat) &&
          Number.isFinite(lng) &&
          haversineKm(
            recentPosition.lat,
            recentPosition.lng,
            lat,
            lng,
          ) <= 30
        );
      })
      .sort((a, b) => {
        const distanceA =
          haversineKm(
            recentPosition.lat,
            recentPosition.lng,
            Number(a.lat),
            Number(a.lng),
          );

        const distanceB =
          haversineKm(
            recentPosition.lat,
            recentPosition.lng,
            Number(b.lat),
            Number(b.lng),
          );

        return distanceA - distanceB;
      });

    setNearbyPlaces(nearby);

    setCachedOpenNowNearbyPlaces(
      nearby.slice(
        0,
        HOME_OPEN_NOW_CACHE_MAX_PLACES,
      ),
    );

    writeOpenNowHomeCache(
      locale,
      nearby,
    );

    setOpenNowRefreshing(false);
  }, [
    allPlaces,
    initialAllPlaces,
    locale,
  ]);

  const [nativeLocationTick, setNativeLocationTick] = React.useState(0);
  const homeMoodDayKey =
    getLocalDayKey(new Date());

  const selectedMoodNearbyCandidates =
    React.useMemo(() => {
      if (
        !selectedHomeMood ||
        !openNowHasLocation
      ) {
        return [];
      }

      return nearbyPlaces.filter(
        (place) =>
          matchesHomeMood(
            place,
            selectedHomeMood,
          ),
      );
    }, [
      selectedHomeMood,
      nearbyPlaces,
      openNowHasLocation,
    ]);

  const selectedMoodNearbyPlaces =
    React.useMemo(() => {
      if (!selectedHomeMood) {
        return [];
      }

      const dailySelection =
        pickDailyHomeMoodPlaces(
          selectedMoodNearbyCandidates,
          homeMoodDayKey,
          selectedHomeMood,
          "near",
          10,
        );

      // On sélectionne quotidiennement les lieux,
      // puis on conserve l'ordre de proximité existant.
      const selectedIds = new Set(
        dailySelection.map(
          (place) => String(place.id),
        ),
      );

      return selectedMoodNearbyCandidates.filter(
        (place) =>
          selectedIds.has(
            String(place.id),
          ),
      );
    }, [
      selectedHomeMood,
      selectedMoodNearbyCandidates,
      homeMoodDayKey,
    ]);

  const selectedMoodFarPlaces =
    React.useMemo(() => {
      if (
        !selectedHomeMood ||
        !openNowHasLocation
      ) {
        return [];
      }

      // Exclure TOUS les lieux réellement proches,
      // même ceux qui ne font pas partie des 6 du jour.
      const nearbyIds = new Set(
        selectedMoodNearbyCandidates.map(
          (place) => String(place.id),
        ),
      );

      const candidates = allPlaces
        .filter((place) =>
          matchesHomeMood(
            place,
            selectedHomeMood,
          ),
        )
        .filter(
          (place) =>
            !nearbyIds.has(
              String(place.id),
            ),
        );

      return pickDailyHomeMoodPlaces(
        candidates,
        homeMoodDayKey,
        selectedHomeMood,
        "far",
        10,
      );
    }, [
      selectedHomeMood,
      selectedMoodNearbyCandidates,
      allPlaces,
      openNowHasLocation,
      homeMoodDayKey,
    ]);

  const recentViewedPlaces =
    React.useMemo(() => {
      if (recentViewedPlaceIds.length === 0) {
        return [];
      }

      const placesById = new Map(
        [
          ...cachedRecentViewedPlaces,
          ...allPlaces,
        ].map((place) => [
          String(place.id),
          place,
        ]),
      );

      return recentViewedPlaceIds
        .map((id) => placesById.get(id))
        .filter(
          (
            place,
          ): place is DiscoverPlace =>
            Boolean(place),
        )
        .slice(0, 20);
    }, [
      recentViewedPlaceIds,
      allPlaces,
      cachedRecentViewedPlaces,
    ]);

  React.useEffect(() => {
    if (
      allPlaces.length === 0 ||
      recentViewedPlaces.length === 0
    ) {
      return;
    }

    writeRecentHomePlacesCache(
      locale,
      recentViewedPlaces,
    );
  }, [
    locale,
    allPlaces.length,
    recentViewedPlaces,
  ]);

  const [savedPlaceIndexes, setSavedPlaceIndexes] = React.useState<Record<string, number>>({});
  const savedPlacesScrollRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const savedPlacesTouchStartXRef = React.useRef<number | null>(null);
  const savedPlacesTouchDeltaXRef = React.useRef(0);

  React.useEffect(() => {
    homeMemoryCache[locale] = {
      discoverPlace: mergePlace(homeMemoryCache[locale]?.discoverPlace ?? null, initialDiscoverPlace ?? null),
      newPlaces: (homeMemoryCache[locale]?.newPlaces?.length ?? 0) > 0 ? homeMemoryCache[locale]!.newPlaces : (initialNewPlaces ?? [])
    };
  }, [locale, initialDiscoverPlace, initialNewPlaces]);

  React.useEffect(() => {
    const syncRecentViewedPlaces = () => {
      setRecentViewedPlaceIds(
        readRecentViewedPlaceIds(),
      );
    };

    syncRecentViewedPlaces();

    window.addEventListener(
      "im:recent-viewed-places-updated",
      syncRecentViewedPlaces,
    );

    return () => {
      window.removeEventListener(
        "im:recent-viewed-places-updated",
        syncRecentViewedPlaces,
      );
    };
  }, []);

  React.useEffect(() => {
    setSelectedPlaceCommentsOpen(false);
    setSelectedPlaceCommentInput("");
    setSelectedPlaceCommentError("");
    setSelectedPlaceCommentSaving(false);
    setSelectedPlaceSharedListPickerOpen(false);
    setSelectedPlaceSharedLists([]);
    setSelectedPlaceSharedListsError("");
    setSelectedPlaceSharedListsMessage("");
    setSelectedPlaceNewSharedListTitle("");
  }, [selectedHomePlace?.id]);


  React.useEffect(() => {
    if (!initialSelectedHomePlace) {
      return;
    }

    if (
      initialSelectedHomePlaceSource !==
        "recent_additions_all" &&
      initialSelectedHomePlaceSource !==
        "professional_space"
    ) {
      return;
    }

    if (
      initialSelectedHomePlaceSource ===
      "recent_additions_all"
    ) {
      trackEvent({
        eventType: "click_recent_additions",
        placeId: initialSelectedHomePlace.id,
        city: initialSelectedHomePlace.city,
        category: initialSelectedHomePlace.category,
        locale,
        metadata: {
          name: initialSelectedHomePlace.name,
          source: "recent_additions_all",
        },
      });
    }

    trackEvent({
      eventType: "view_place_detail",
      placeId: initialSelectedHomePlace.id,
      city: initialSelectedHomePlace.city,
      category: initialSelectedHomePlace.category,
      locale,
      metadata: {
        name: initialSelectedHomePlace.name,
        source:
          initialSelectedHomePlaceSource,
      },
    });
  }, [
    initialSelectedHomePlace,
    initialSelectedHomePlaceSource,
    locale,
  ]);

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
    if (Array.isArray(cached.newPlaces) && cached.newPlaces.length > 0) {
      setNewPlaces(cached.newPlaces);
    }
    if (cached.discoverPlace || (cached.newPlaces?.length ?? 0) > 0) {
      setDiscoverReady(true);
    }
  }, [locale, nativeLocationTick]);

  React.useEffect(() => {
    const syncSavedPlaces = () => {
      setSavedPlaces(readSavedPlaces(authProfile ? authProfile.id : undefined));
    };

    syncSavedPlaces();
    window.addEventListener("storage", syncSavedPlaces);
    window.addEventListener("im:saved-places-updated", syncSavedPlaces as EventListener);
    return () => {
      window.removeEventListener("storage", syncSavedPlaces);
      window.removeEventListener("im:saved-places-updated", syncSavedPlaces as EventListener);
    };
  }, [authProfile?.id]);

  React.useEffect(() => {
    if (!authProfile) return;
    if (initialAllPlaces.length > 0) return;
    if (allPlaces.length === 0) return;

    let cancelled = false;

    async function loadSavedPlacesFromServer() {
      try {
        const res = await fetch("/api/v1/me/saved-places", { cache: "no-store" });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok || !Array.isArray(data.places)) return;

        const ids = new Set(data.places.map((item: any) => String(item?.placeId ?? "").trim()).filter(Boolean));
        const next = allPlaces.filter((place) => ids.has(String(place.id)));

        if (cancelled || savedPlaceMutationIdsRef.current.size > 0) return;

        setSavedPlaces(next);
        writeSavedPlacesStorage(next, authProfile?.id ?? null);
        window.dispatchEvent(new CustomEvent("im:saved-places-updated"));
      } catch {}
    }

    void loadSavedPlacesFromServer();

    return () => {
      cancelled = true;
    };
  }, [authProfile?.id, allPlaces, initialAllPlaces]);

  React.useEffect(() => {
    const syncPlaceNotes = () => {
      setPlaceNotes(readPlaceNotes(authProfile?.id ?? null));
    };

    syncPlaceNotes();
    window.addEventListener("storage", syncPlaceNotes);
    window.addEventListener("im:place-notes-updated", syncPlaceNotes as EventListener);

    return () => {
      window.removeEventListener("storage", syncPlaceNotes);
      window.removeEventListener("im:place-notes-updated", syncPlaceNotes as EventListener);
    };
  }, [authProfile?.id]);

  React.useEffect(() => {
    if (!authProfile) return;
    if (panel !== "personalSpace" && panel !== "myPlacesList") return;

    const userId = authProfile.id;
    let cancelled = false;

    async function loadPlaceNotesFromServer() {
      try {
        const res = await fetch("/api/v1/me/place-notes", { cache: "no-store" });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok || !data.notes || typeof data.notes !== "object") return;

        if (cancelled) return;

        setPlaceNotes(data.notes);
        writePlaceNotes(data.notes, userId);
      } catch {}
    }

    void loadPlaceNotesFromServer();

    return () => {
      cancelled = true;
    };
  }, [authProfile]);


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

  async function syncPlaceNoteToServer(placeId: string, note: PlaceNote | undefined) {
    if (!authProfile) return;

    try {
      await fetch("/api/v1/me/place-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAnalyticsHeaders(),
        },
        body: JSON.stringify({
          placeId,
          visited: note?.visited === true,
          visitedAt: note?.visitedAt ?? null,
          comment: note?.comment ?? ""
        })
      });
    } catch {}
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
    writePlaceNotes(nextNotes, authProfile?.id ?? null);
    void syncPlaceNoteToServer(editingPlaceNote.id, nextNotes[editingPlaceNote.id]);
    setEditingPlaceNote(null);
    setEditingPlaceComment("");
  }

  function toggleSelectedHomePlaceSaved() {
    if (!selectedHomePlace?.id) return;

    const id = String(selectedHomePlace.id);
    const exists = savedPlaces.some((item) => String(item.id) === id);
    savedPlaceMutationIdsRef.current.add(id);

    trackEvent({
      eventType: exists ? "unsave_place" : "save_place",
      placeId: selectedHomePlace.id,
      city: selectedHomePlace.city,
      category: selectedHomePlace.category,
      locale,
      metadata: { name: selectedHomePlace.name, source: selectedHomePlaceSource }
    });
    const next = exists
      ? savedPlaces.filter((item) => String(item.id) !== id)
      : [
          {
            id,
            name: String(selectedHomePlace.name ?? "").trim(),
            panoramaImage: String(selectedHomePlace.panoramaImage ?? "").trim() || undefined,
            city: String(selectedHomePlace.city ?? "").trim() || undefined,
            address: String(selectedHomePlace.address ?? "").trim() || undefined,
            lat: Number.isFinite(Number(selectedHomePlace.lat)) ? Number(selectedHomePlace.lat) : undefined,
            lng: Number.isFinite(Number(selectedHomePlace.lng)) ? Number(selectedHomePlace.lng) : undefined,
            createdAt: String(selectedHomePlace.createdAt ?? "").trim() || undefined,
            updatedAt: String(selectedHomePlace.updatedAt ?? "").trim() || undefined
          },
          ...savedPlaces
        ];

    setSavedPlaces(next);
    writeSavedPlacesStorage(next, authProfile?.id ?? null);
    window.dispatchEvent(new CustomEvent("im:saved-places-updated"));

    if (!authProfile) {
      savedPlaceMutationIdsRef.current.delete(id);
      return;
    }

    const previousPlace = savedPlaces.find(
      (item) => String(item.id) === id,
    );

    void syncSavedPlaceToServer(
      authProfile.id,
      id,
      !exists,
    )
      .then((result) => {
        if (result.ok) return;

        const latest = readSavedPlaces(authProfile.id);
        const reverted = exists
          ? previousPlace &&
            !latest.some((item) => String(item.id) === id)
            ? [previousPlace, ...latest]
            : latest
          : latest.filter((item) => String(item.id) !== id);

        setSavedPlaces(reverted);
        writeSavedPlacesStorage(reverted, authProfile.id);

        if (result.unauthorized) {
          setAuthProfile(null);
          setSavedPlacesUserId(null);
        }

        window.dispatchEvent(
          new CustomEvent("im:saved-places-updated"),
        );
      })
      .finally(() => {
        savedPlaceMutationIdsRef.current.delete(id);
      });
  }

  async function reloadSelectedPlaceSharedLists() {
    if (!authProfile) return;

    setSelectedPlaceSharedListsLoading(true);
    setSelectedPlaceSharedListsError("");

    try {
      const res = await fetch("/api/v1/me/shared-lists", { cache: "no-store" });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error("shared_lists_load_failed");
      }

      setSelectedPlaceSharedLists(Array.isArray(data.lists) ? data.lists : []);
    } catch {
      setSelectedPlaceSharedListsError(isFr ? "Impossible de charger tes listes." : "Unable to load your lists.");
    } finally {
      setSelectedPlaceSharedListsLoading(false);
    }
  }

  async function openSelectedPlaceSharedListPicker() {
    if (!authProfile) {
      setPanel("personalSpace");
      return;
    }

    if (selectedHomePlace?.id) {
      trackEvent({
        eventType: "open_shared_list_picker",
        placeId: selectedHomePlace.id,
        city: selectedHomePlace.city,
        category: selectedHomePlace.category,
        locale,
        metadata: { name: selectedHomePlace.name, source: selectedHomePlaceSource }
      });
    }

    setSelectedPlaceSharedListPickerOpen(true);
    setSelectedPlaceSharedListsMessage("");
    await reloadSelectedPlaceSharedLists();
  }

  async function addSelectedPlaceToSharedList(listId: string) {
    if (!selectedHomePlace?.id || !listId) return;

    setSelectedPlaceSharedListsSaving(true);
    setSelectedPlaceSharedListsMessage("");
    setSelectedPlaceSharedListsError("");

    try {
      const res = await fetch(`/api/v1/me/shared-lists/${encodeURIComponent(listId)}/places`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ placeId: String(selectedHomePlace.id) })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error("shared_list_place_failed");
      }

      trackEvent({
        eventType: "add_place_to_shared_list",
        placeId: selectedHomePlace.id,
        city: selectedHomePlace.city,
        category: selectedHomePlace.category,
        locale,
        metadata: { listId, name: selectedHomePlace.name, source: selectedHomePlaceSource }
      });

      setSelectedPlaceSharedListsMessage(isFr ? "Lieu ajouté à la liste." : "Place added to the list.");
      await reloadSelectedPlaceSharedLists();
    } catch {
      setSelectedPlaceSharedListsError(isFr ? "Impossible d’ajouter ce lieu." : "Unable to add this place.");
    } finally {
      setSelectedPlaceSharedListsSaving(false);
    }
  }

  async function createSharedListAndAddSelectedPlace() {
    if (!selectedHomePlace?.id) return;

    const title = selectedPlaceNewSharedListTitle.trim();

    if (!title) {
      setSelectedPlaceSharedListsError(isFr ? "Donne un titre à ta liste." : "Give your list a title.");
      return;
    }

    setSelectedPlaceSharedListsSaving(true);
    setSelectedPlaceSharedListsMessage("");
    setSelectedPlaceSharedListsError("");

    try {
      const createRes = await fetch("/api/v1/me/shared-lists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title })
      });

      const createData = await createRes.json().catch(() => null);

      if (!createRes.ok || !createData?.ok || typeof createData.listId !== "string") {
        throw new Error("shared_list_create_failed");
      }

      const addRes = await fetch(`/api/v1/me/shared-lists/${encodeURIComponent(createData.listId)}/places`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ placeId: String(selectedHomePlace.id) })
      });

      const addData = await addRes.json().catch(() => null);

      if (!addRes.ok || !addData?.ok) {
        throw new Error("shared_list_place_failed");
      }

      trackEvent({
        eventType: "create_shared_list",
        placeId: selectedHomePlace.id,
        city: selectedHomePlace.city,
        category: selectedHomePlace.category,
        locale,
        metadata: { listId: createData.listId, title, source: selectedHomePlaceSource }
      });

      trackEvent({
        eventType: "add_place_to_shared_list",
        placeId: selectedHomePlace.id,
        city: selectedHomePlace.city,
        category: selectedHomePlace.category,
        locale,
        metadata: { listId: createData.listId, name: selectedHomePlace.name, source: selectedHomePlaceSource }
      });

      setSelectedPlaceNewSharedListTitle("");
      setSelectedPlaceSharedListsMessage(isFr ? "Liste créée et lieu ajouté." : "List created and place added.");
      await reloadSelectedPlaceSharedLists();
    } catch {
      setSelectedPlaceSharedListsError(isFr ? "Impossible de créer cette liste." : "Unable to create this list.");
    } finally {
      setSelectedPlaceSharedListsSaving(false);
    }
  }

  async function saveSelectedHomePlaceComment() {
    if (!selectedHomePlace?.id || !authProfile) return;

    const placeId = String(selectedHomePlace.id);
    const currentNote = placeNotes[placeId];
    const comment = selectedPlaceCommentInput.trim();

    if (!comment || currentNote?.comment) return;

    setSelectedPlaceCommentSaving(true);
    setSelectedPlaceCommentError("");

    const nextNote: PlaceNote = {
      ...(currentNote ?? {}),
      comment,
      updatedAt: new Date().toISOString()
    };

    try {
      const res = await fetch("/api/v1/me/place-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAnalyticsHeaders(),
        },
        body: JSON.stringify({
          placeId,
          visited: currentNote?.visited === true,
          visitedAt: currentNote?.visitedAt ?? null,
          comment
        })
      });

      if (!res.ok) {
        throw new Error("comment_save_failed");
      }

      const nextNotes = {
        ...placeNotes,
        [placeId]: nextNote
      };

      setPlaceNotes(nextNotes);
      writePlaceNotes(nextNotes, authProfile.id);
      setSelectedPlaceCommentInput("");
    } catch {
      setSelectedPlaceCommentError(isFr ? "Impossible d’enregistrer ce commentaire." : "Unable to save this comment.");
    } finally {
      setSelectedPlaceCommentSaving(false);
    }
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

    setOpenNowRefreshing(true);

    (async () => {
      try {
        let all: DiscoverPlace[];

        if (initialAllPlaces.length > 0) {
          all = initialAllPlaces;
        } else {
          const r = await fetch(
            "/api/v1/places?locale=" + encodeURIComponent(locale),
            { cache: "no-store" }
          );

          if (!r.ok) throw new Error("load failed");

          const j = await r.json();
          const arr = Array.isArray(j) ? j : j?.data || [];

          all = arr
            .map((item: any) => ({
              id: String(item?.id ?? ""),
              name: String(item?.name ?? "").trim(),
              lat: typeof item?.lat === "number" ? item.lat : undefined,
              lng: typeof item?.lng === "number" ? item.lng : undefined,
              panoramaImage:
                String(item?.panoramaImage ?? "").trim() || undefined,
              city: String(item?.city ?? "").trim() || undefined,
              address: String(item?.address ?? "").trim() || undefined,
              category: String(item?.category ?? "").trim() || undefined,
              website: String(item?.website ?? "").trim() || undefined,
              phone: String(item?.phone ?? "").trim() || undefined,
              miniText: String(item?.miniText ?? "").trim() || undefined,
              openingHours:
                String(item?.openingHours ?? "").trim() || undefined,
              timeZone: String(item?.timeZone ?? "").trim() || undefined,
              createdAt: String(item?.createdAt ?? "").trim() || undefined,
              updatedAt: String(item?.updatedAt ?? "").trim() || undefined,
              homeTextNear:
                String(item?.homeTextNear ?? "").trim() || undefined,
              homeTextFar:
                String(item?.homeTextFar ?? "").trim() || undefined,
              homeTextNearEn:
                String(
                  item?.translations?.en?.homeTextNear ??
                    item?.homeTextNear ??
                    ""
                ).trim() || undefined,
              homeTextFarEn:
                String(
                  item?.translations?.en?.homeTextFar ??
                    item?.homeTextFar ??
                    ""
                ).trim() || undefined,
            }))
            .filter(
              (item: DiscoverPlace) =>
                !!item.id &&
                !!item.name &&
                Number.isFinite(item.lat) &&
                Number.isFinite(item.lng)
            );
        }

        setAllPlaces(all);

        const finish = (pool: DiscoverPlace[], hasLocation: boolean) => {
          if (cancelled) return;

          if (hasLocation) {
            setNearbyPlaces(pool);
            setOpenNowHasLocation(true);

            setCachedOpenNowNearbyPlaces(
              pool.slice(
                0,
                HOME_OPEN_NOW_CACHE_MAX_PLACES,
              ),
            );

            writeOpenNowHomeCache(
              locale,
              pool,
            );
          } else {
            const previousCache =
              readOpenNowHomeCache(
                locale,
              );

            if (
              previousCache?.hadLocation
            ) {
              setOpenNowHasLocation(
                true,
              );

              if (
                previousCache
                  .nearbyPlaces
                  .length > 0
              ) {
                setCachedOpenNowNearbyPlaces(
                  previousCache
                    .nearbyPlaces,
                );
              }
            } else {
              setNearbyPlaces([]);
              setOpenNowHasLocation(false);
            }
          }

          setOpenNowRefreshing(false);

          const now = new Date();
          const dayKey = getLocalDayKey(now);
          const nextDiscover = all.length > 0 ? pickDailyPlace(all, dayKey) : null;

          const latest = [...all]
        .sort((a, b) => {
          const aTime = Date.parse(a.createdAt || "") || 0;
          const bTime = Date.parse(b.createdAt || "") || 0;
          return bTime - aTime;
        })
        .slice(0, 5);

          homeMemoryCache[locale] = {
            discoverPlace: nextDiscover,
            newPlaces: latest,
          };
          setNewPlaces(latest);
          setDiscoverPlace(nextDiscover);
          setDiscoverReady(true);
          writeHomeCache(locale, nextDiscover, latest);
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
                const isNativeIos =
                  typeof window !== "undefined" &&
                  window.__IM_NATIVE_APP__ &&
                  window.__IM_NATIVE_APP__.platform === "ios";

                if (isNativeIos || !navigator.geolocation) {
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
          rememberAnalyticsLocation(
            pos.lat,
            pos.lng,
          );

          fetch("/api/v1/me/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: pos.lat, lng: pos.lng }),
            keepalive: true,
          }).catch(() => null);

          const nearby = all
            .filter((item) => {
              const lat = Number(item.lat);
              const lng = Number(item.lng);

              return (
                Number.isFinite(lat) &&
                Number.isFinite(lng) &&
                haversineKm(pos.lat, pos.lng, lat, lng) <= 30
              );
            })
            .sort((a, b) => {
              const distanceA = haversineKm(
                pos.lat,
                pos.lng,
                Number(a.lat),
                Number(a.lng),
              );

              const distanceB = haversineKm(
                pos.lat,
                pos.lng,
                Number(b.lat),
                Number(b.lng),
              );

              return distanceA - distanceB;
            });

          finish(nearby, true);
          return;
        }

        finish([], false);
      } catch {
        if (cancelled) return;
        setDiscoverReady(true);
        setOpenNowRefreshing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locale, nativeLocationTick, initialAllPlaces]);

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


  function switchLocale(nextLocale: "fr" | "en") {
    if (nextLocale === locale) return;
    document.cookie = `NEXT_LOCALE=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.sessionStorage.setItem("im:pending-panel-after-locale", "personalSpace");
    const nextPath = window.location.pathname.match(/^\/(fr|en)(?=\/|$)/)
      ? window.location.pathname.replace(/^\/(fr|en)(?=\/|$)/, `/${nextLocale}`)
      : `/${nextLocale}`;
    setPanel("personalSpace");
    router.push(nextPath + window.location.search);
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
            onClick={() => {
              trackEvent({ eventType: "click_explore_world", locale });
              router.push(`/${locale}/carte?entry=explore`);
            }}
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

          <div className="mb-0 w-full shrink-0">
            <div className="mb-2 flex items-center gap-2 px-3">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full bg-green-400"
              />

              <p className="font-serif text-[15px] font-medium tracking-[0.01em] text-white">
                {isFr
                  ? "Ouvert maintenant"
                  : "Open now"}
              </p>

              {openNowRefreshing &&
              openNowHasLocation ? (
                <span
                  aria-label={
                    isFr
                      ? "Actualisation"
                      : "Refreshing"
                  }
                  className="h-3 w-3 shrink-0 animate-spin rounded-full border border-white/25 border-t-white/80"
                />
              ) : null}
            </div>

            {openNowPlaces.length > 0 ? (
              <div className="im-home-scroll flex w-full gap-2 overflow-x-auto px-3 pb-1">
                {openNowPlaces.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      trackEvent({
                        eventType: "view_place_detail",
                        placeId: item.id,
                        city: item.city,
                        category: item.category,
                        locale,
                        metadata: {
                          source: "open_now",
                          name: item.name,
                        },
                      });

                      setSelectedHomePlaceSource(
                        "open_now",
                      );

                      setSelectedHomePlace(
                        item,
                      );
                    }}
                    className="w-[calc(33.333333%-5.333px)] min-w-[calc(33.333333%-5.333px)] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] text-left active:bg-white/[0.10]"
                  >
                    <div className="relative h-[72px] w-full overflow-hidden bg-white/10">
                      <img
                        src={
                          item.panoramaImage ||
                          "/explorer-bg.png?v=3"
                        }
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />

                      <span
                        aria-hidden="true"
                        className="absolute right-2 top-2 h-2 w-2 rounded-full bg-green-400"
                      />
                    </div>

                    <div className="px-2.5 pb-2.5 pt-2">
                      <p className="line-clamp-2 font-serif text-[12px] font-medium leading-[1.15] text-white">
                        {item.name}
                      </p>

                      <p className="mt-1 truncate text-[9px] font-medium text-white/60">
                        {[
                          getLocalizedCategory(
                            item.category,
                            isFr,
                          ),
                          item.city,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : openNowHasLocation &&
              openNowRefreshing ? (
              <div className="flex min-h-[54px] items-center justify-center px-3">
                <span
                  aria-label={
                    isFr
                      ? "Chargement des lieux ouverts"
                      : "Loading open places"
                  }
                  className="h-5 w-5 animate-spin rounded-full border border-white/20 border-t-white/75"
                />
              </div>
            ) : openNowHasLocation ? (
              <div className="px-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3">
                  <p className="text-[11px] leading-snug text-white/50">
                    {isFr
                      ? "Aucun lieu ouvert près de toi pour le moment."
                      : "No places open near you right now."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="px-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-4">
                  <p className="text-[12px] leading-relaxed text-white/55">
                    {isFr
                      ? "Ta localisation doit être activée pour découvrir les lieux autour de toi."
                      : "Your location must be enabled to discover places around you."}
                  </p>

                  <button
                    type="button"
                    onClick={
                      requestHomeLocation
                    }
                    className="mt-3 rounded-xl bg-white px-4 py-2.5 text-[11px] font-semibold text-black active:opacity-80"
                  >
                    {isFr
                      ? "Activer ma localisation"
                      : "Enable my location"}
                  </button>

                  {homeLocationError ? (
                    <p className="mt-3 text-[11px] leading-relaxed text-red-200/85">
                      {homeLocationError}
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </div>


          <div className="mt-5 mb-0 w-full shrink-0 px-3">
            <div className="mb-2 px-1">
              <p className="font-serif text-[15px] font-medium tracking-[0.01em] text-white">
                {isFr ? "Que cherches-tu ?" : "What are you looking for?"}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-white/45">
                {isFr ? "Un lieu, une catégorie, une ville." : "A place, a category, a city."}
              </p>
            </div>

            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const query = searchQuery.trim();
                if (!query) return;

                const searchId =
                  makeSearchTrackingId();

                setActiveSearchId(searchId);
                setActiveSearchQuery(query);

                searchImpressionKeysRef.current =
                  new Set();

                searchAbortRef.current?.abort();

                const controller =
                  new AbortController();

                searchAbortRef.current =
                  controller;

                setSearchResults(null);
                setSearchLoading(true);

                /*
                 * V5 n'est utilisé QUE sur le serveur Next
                 * lancé en development.
                 *
                 * En production, HomeScreen continue
                 * d'appeler exactement la route V2.2 actuelle.
                 */
                /*
                 * V5 avancée est conservée dans le projet
                 * pour plus tard.
                 *
                 * La recherche active utilise désormais
                 * uniquement les données Indie Map.
                 */
                const useLocalV5 =
                  false;

                try {
                  if (useLocalV5) {
                    const res =
                      await fetch(
                        "/api/v1/ai/search-v5-local",
                        {
                          method:
                            "POST",

                          headers: {
                            "Content-Type":
                              "application/json",
                          },

                          body:
                            JSON.stringify({
                              query,
                              locale,
                            }),

                          signal:
                            controller.signal,
                        }
                      );

                    if (
                      !res.ok ||
                      !res.body
                    ) {
                      throw new Error(
                        `V5 local HTTP ${res.status}`
                      );
                    }

                    let latestResults:
                      DiscoverPlace[] =
                        [];

                    const mergeResults =
                      (
                        incoming:
                          unknown[]
                      ) => {
                        const byId =
                          new Map(
                            latestResults.map(
                              (item) => [
                                item.id,
                                item,
                              ]
                            )
                          );

                        for (
                          const raw of
                          incoming
                        ) {
                          const item =
                            raw as
                              DiscoverPlace;

                          if (
                            !item ||
                            !item.id
                          ) {
                            continue;
                          }

                          const previous =
                            byId.get(
                              item.id
                            );

                          byId.set(
                            item.id,
                            previous
                              ? {
                                  ...previous,
                                  ...item,
                                }
                              : item
                          );
                        }

                        latestResults =
                          Array.from(
                            byId.values()
                          );

                        setSearchResults(
                          latestResults
                        );
                      };

                    const reader =
                      res.body
                        .getReader();

                    const decoder =
                      new TextDecoder();

                    let buffer =
                      "";

                    let receivedDone =
                      false;

                    while (true) {
                      const {
                        value,
                        done,
                      } =
                        await reader.read();

                      if (done) {
                        break;
                      }

                      buffer +=
                        decoder.decode(
                          value,
                          {
                            stream:
                              true,
                          }
                        );

                      const lines =
                        buffer.split(
                          "\n"
                        );

                      buffer =
                        lines.pop() ??
                        "";

                      for (
                        const line of
                        lines
                      ) {
                        const trimmed =
                          line.trim();

                        if (!trimmed) {
                          continue;
                        }

                        const eventData =
                          JSON.parse(
                            trimmed
                          );

                        if (
                          eventData?.type ===
                            "results" &&
                          Array.isArray(
                            eventData.results
                          )
                        ) {
                          mergeResults(
                            eventData.results
                          );

                          continue;
                        }

                        if (
                          eventData?.type ===
                            "done"
                        ) {
                          if (
                            Array.isArray(
                              eventData.results
                            )
                          ) {
                            mergeResults(
                              eventData.results
                            );
                          }

                          receivedDone =
                            true;

                          continue;
                        }

                        if (
                          eventData?.type ===
                            "error"
                        ) {
                          throw new Error(
                            String(
                              eventData.error ||
                                "v5_local_error"
                            )
                          );
                        }
                      }
                    }

                    /*
                     * Si aucune phase n'a produit de lieu,
                     * on passe explicitement à [] afin
                     * d'afficher "Aucun lieu trouvé".
                     */
                    if (
                      latestResults.length ===
                        0
                    ) {
                      setSearchResults(
                        []
                      );
                    }

                    trackEvent({
                      eventType:
                        "search_ai_used",

                      searchId,

                      locale,

                      metadata: {
                        query,

                        mode:
                          "v5_simple_local_stream",

                        resultsCount:
                          latestResults.length,

                        hasResults:
                          latestResults.length >
                          0,

                        engineVersion:
                          "search-v5-simple-local",

                        searchMode:
                          receivedDone
                            ? "local_stream_complete"
                            : "local_stream_closed",
                      },
                    });
                  } else {
                    /*
                     * Production : comportement existant
                     * strictement conservé.
                     */
                    const res =
                      await fetch(
                        "/api/v1/ai/search",
                        {
                          method:
                            "POST",

                          headers: {
                            "Content-Type":
                              "application/json",
                          },

                          body:
                            JSON.stringify({
                              query,
                              locale,
                            }),

                          signal:
                            controller.signal,
                        }
                      );

                    const data =
                      await res
                        .json()
                        .catch(
                          () => null
                        );

                    const results =
                      Array.isArray(
                        data?.results
                      )
                        ? data.results
                        : [];

                    trackEvent({
                      eventType:
                        "search_ai_used",

                      searchId,

                      locale,

                      city:
                        data?.detectedCity ||
                        null,

                      category:
                        Array.isArray(
                          data?.targetCategories
                        )
                          ? data
                              .targetCategories[0] ||
                            null
                          : data?.explicitCategory ||
                            null,

                      metadata: {
                        query,

                        mode:
                          data?.mode ||
                          "unknown",

                        detectedCity:
                          data?.detectedCity ||
                          null,

                        explicitCategory:
                          data?.explicitCategory ||
                          null,

                        targetCategories:
                          Array.isArray(
                            data?.targetCategories
                          )
                            ? data.targetCategories
                            : [],

                        resultsCount:
                          results.length,

                        hasResults:
                          results.length >
                          0,

                        meaningfulTokens:
                          Array.isArray(
                            data?.meaningfulTokens
                          )
                            ? data.meaningfulTokens
                            : [],

                        detectedConcepts:
                          Array.isArray(
                            data?.detectedConcepts
                          )
                            ? data.detectedConcepts
                            : [],

                        engineVersion:
                          data?.engineVersion ||
                          "unknown",

                        searchMode:
                          data?.searchMode ||
                          "api",
                      },
                    });

                    setSearchResults(
                      results
                    );
                  }
                } catch (err) {
                  if (
                    controller.signal
                      .aborted
                  ) {
                    return;
                  }

                  console.error(
                    "[HomeScreen search] API error",
                    err
                  );

                  trackEvent({
                    eventType:
                      "search_ai_used",

                    searchId,

                    locale,

                    metadata: {
                      query,

                      mode:
                        useLocalV5
                          ? "v5_local_client_error"
                          : "client_error",

                      resultsCount:
                        0,

                      hasResults:
                        false,
                    },
                  });

                  setSearchResults(
                    []
                  );
                } finally {
                  if (
                    searchAbortRef.current ===
                    controller
                  ) {
                    searchAbortRef.current =
                      null;

                    setSearchLoading(
                      false
                    );
                  }
                }
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
                      ? (isFr ? "Un café à Tokyo..." : "A café in Tokyo...")
                      : (isFr ? "Un café, une épicerie, un lieu à Paris..." : "A café, a grocery store, a place in Paris...")
                  }
                  className="w-full min-w-0 bg-transparent text-[15px] leading-none text-white placeholder:text-white/42 outline-none"
                  type="search"
                />

                {searchFocused ? (
                  <div className="mt-3 text-[12px] leading-snug text-white/45">
                    {isFr
                      ? "Exemple : un café à Tokyo, une boulangerie à Paris, le nom d’un lieu."
                      : "Example: a café in Tokyo, a bakery in Paris, the name of a place."}
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

          <div className="mt-5 w-full shrink-0">
            <div className="relative z-10 w-full">
              <div className="flex items-baseline gap-1.5 px-3 pt-2">
                <p className="whitespace-nowrap font-serif text-[15px] font-medium tracking-[0.01em]">
                  {isFr
                    ? "Consultés récemment"
                    : "Recently viewed"}
                </p>

                {recentViewedPlaces.length > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setRecentViewedOpen(true)
                    }
                    className="inline-flex items-baseline gap-0.5 text-[10px] leading-none text-white/55 transition-opacity active:opacity-60"
                  >
                    <span>
                      {isFr
                        ? "Tout afficher"
                        : "View all"}
                    </span>
                    <span aria-hidden="true">
                      →
                    </span>
                  </button>
                ) : null}
              </div>

              {recentViewedPlaces.length > 0 ? (
                <div className="im-home-scroll mt-3 flex gap-5 overflow-x-auto px-3 pb-2">
                  {recentViewedPlaces
                    .slice(0, 5)
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          trackEvent({
                            eventType:
                              "view_place_detail",
                            placeId:
                              item.id,
                            city:
                              item.city,
                            category:
                              item.category,
                            locale,
                            metadata: {
                              source:
                                "recently_viewed",
                              name:
                                item.name,
                            },
                          });

                          setSelectedHomePlaceSource(
                            "recently_viewed",
                          );

                          setSelectedHomePlace(
                            item,
                          );
                        }}
                        className="relative h-[92px] w-[142px] shrink-0 overflow-hidden rounded-xl bg-white/10 text-left"
                      >
                        {item.panoramaImage ? (
                          <img
                            src={
                              item.panoramaImage
                            }
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : null}

                        <div
                          className="absolute inset-0"
                          style={{
                            background:
                              "linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.18) 40%, rgba(0,0,0,0.64) 100%)",
                          }}
                        />

                        <div className="absolute inset-x-0 bottom-0 z-10 p-2.5">
                          <p className="line-clamp-2 font-serif text-[12px] font-medium leading-tight tracking-[0.01em]">
                            {item.name}
                          </p>

                          <p className="mt-1 truncate text-[9px] opacity-80">
                            {item.city ||
                              item.address ||
                              "Indie Map"}
                          </p>
                        </div>
                      </button>
                    ))}
                </div>
              ) : (
                <div className="px-3 pt-3">
                  <p className="text-[12px] text-white/45">
                    {isFr
                      ? "Aucun historique connu"
                      : "No viewing history yet"}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 w-full shrink-0">
              <div className="w-full relative z-10">
                <div className="flex items-baseline gap-1.5 px-3 pt-2">
                  <p className="font-serif text-[15px] font-medium whitespace-nowrap tracking-[0.01em]">
                    {isFr ? "Ajouts récents" : "Recent additions"}
                  </p>


                  <button
                    type="button"
                    onClick={() => router.push(`/${locale}/ajouts-recents`)}
                    className="inline-flex items-baseline gap-0.5 text-[10px] leading-none text-white/55 transition-opacity active:opacity-60"
                  >
                    <span>{isFr ? "Tout afficher" : "View all"}</span>
                    <span aria-hidden="true">→</span>
                  </button>
</div>
                <div className="im-home-scroll mt-3 flex gap-5 overflow-x-auto px-3 pb-2">
                  {newPlaces.length > 0 ? newPlaces.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        trackEvent({
                          eventType: "click_recent_additions",
                          placeId: item.id,
                          city: item.city,
                          category: item.category,
                          locale,
                          metadata: { name: item.name, source: "recent_additions" }
                        });
                        trackEvent({
                          eventType: "view_place_detail",
                          placeId: item.id,
                          city: item.city,
                          category: item.category,
                          locale,
                          metadata: { source: "recent_additions", name: item.name }
                        });
                        setSelectedHomePlaceSource("recent_additions");
                        setSelectedHomePlace(item);
                      }}
                      className="relative h-[190px] w-[170px] shrink-0 overflow-hidden rounded-xl bg-white/10 text-left"
                    >
                      {item.panoramaImage ? (
                        <img
                          src={item.panoramaImage}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                      <div
                        className="absolute inset-0"
                        style={{
                          background: "linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.18) 40%, rgba(0,0,0,0.64) 100%)"
                        }}
                      ></div>

                      {item.category ? (
                        <div
                          className={`absolute right-2 top-2 z-20 rounded-full px-2 py-1 text-[9px] font-semibold leading-none shadow-[0_2px_8px_rgba(0,0,0,0.28)] ${getCategoryStyle(
                            String(item.category),
                            true,
                          )}`}
                        >
                          {getLocalizedCategory(item.category, isFr)}
                        </div>
                      ) : null}

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


          <section className="mt-5 w-full shrink-0 px-3 pb-6">
            <div className="mb-3 px-1">
              <p className="font-serif text-[15px] font-medium tracking-[0.01em] text-white">
                {isFr ? "Une envie ?" : "In the mood for something?"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setSelectedHomeMood("eat")}
                className="relative flex h-[96px] flex-col justify-between overflow-hidden rounded-2xl border border-white/10 p-4 text-left text-white shadow-[0_10px_24px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.08)] transition-[transform,box-shadow] active:scale-[0.985] active:shadow-[0_5px_14px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]"
                style={{
                  background:
                    getHomeMoodBackground("eat"),
                }}
              >
                <p className="font-serif text-[18px] font-medium leading-tight">
                  {isFr ? "Manger" : "Eat"}
                </p>

                <p className="text-[10px] leading-snug text-white/65">
                  {isFr
                    ? "Restaurant · Boulangerie · Brasserie · Brunch"
                    : "Restaurant · Bakery · Brewery · Brunch"}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedHomeMood("relax")}
                className="relative flex h-[96px] flex-col justify-between overflow-hidden rounded-2xl border border-white/10 p-4 text-left text-white shadow-[0_10px_24px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.08)] transition-[transform,box-shadow] active:scale-[0.985] active:shadow-[0_5px_14px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]"
                style={{
                  background:
                    getHomeMoodBackground("relax"),
                }}
              >
                <p className="font-serif text-[18px] font-medium leading-tight">
                  {isFr ? "Se détendre" : "Relax"}
                </p>

                <p className="text-[10px] leading-snug text-white/65">
                  {isFr
                    ? "Café · Bar · Pub"
                    : "Cafe · Bar · Pub"}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedHomeMood("groceries")}
                className="relative flex h-[96px] flex-col justify-between overflow-hidden rounded-2xl border border-white/10 p-4 text-left text-white shadow-[0_10px_24px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.08)] transition-[transform,box-shadow] active:scale-[0.985] active:shadow-[0_5px_14px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]"
                style={{
                  background:
                    getHomeMoodBackground("groceries"),
                }}
              >
                <p className="font-serif text-[18px] font-medium leading-tight">
                  {isFr ? "Faire ses courses" : "Shop for food"}
                </p>

                <p className="text-[10px] leading-snug text-white/65">
                  {isFr
                    ? "Épicerie · Marché · Ferme · Fromagerie"
                    : "Grocery · Market · Farm · Cheese shop"}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedHomeMood("browse")}
                className="relative flex h-[96px] flex-col justify-between overflow-hidden rounded-2xl border border-white/10 p-4 text-left text-white shadow-[0_10px_24px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.08)] transition-[transform,box-shadow] active:scale-[0.985] active:shadow-[0_5px_14px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]"
                style={{
                  background:
                    getHomeMoodBackground("browse"),
                }}
              >
                <p className="font-serif text-[18px] font-medium leading-tight">
                  {isFr ? "Flâner" : "Browse"}
                </p>

                <p className="text-[10px] leading-snug text-white/65">
                  {isFr
                    ? "Boutique · Mode"
                    : "Shop · Fashion"}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedHomeMood("inspire")}
                className="relative flex h-[96px] flex-col justify-between overflow-hidden rounded-2xl border border-white/10 p-4 text-left text-white shadow-[0_10px_24px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.08)] transition-[transform,box-shadow] active:scale-[0.985] active:shadow-[0_5px_14px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]"
                style={{
                  background:
                    getHomeMoodBackground("inspire"),
                }}
              >
                <p className="font-serif text-[18px] font-medium leading-tight">
                  {isFr ? "S’inspirer" : "Get inspired"}
                </p>

                <p className="text-[10px] leading-snug text-white/65">
                  {isFr
                    ? "Librairie · Atelier"
                    : "Bookstore · Workshop"}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedHomeMood("alternative")}
                className="relative flex h-[96px] flex-col justify-between overflow-hidden rounded-2xl border border-white/10 p-4 text-left text-white shadow-[0_10px_24px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.08)] transition-[transform,box-shadow] active:scale-[0.985] active:shadow-[0_5px_14px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]"
                style={{
                  background:
                    getHomeMoodBackground("alternative"),
                }}
              >
                <p className="font-serif text-[18px] font-medium leading-tight">
                  {isFr ? "Sortir autrement" : "Go somewhere different"}
                </p>

                <p className="text-[10px] leading-snug text-white/65">
                  {isFr
                    ? "Lieu alternatif"
                    : "Alternative place"}
                </p>
              </button>
            </div>

          <div className="mt-5 w-full shrink-0 relative z-0">
            <div className="mb-3 flex items-baseline gap-1.5 px-1 pt-2">
              <p className="font-serif text-[15px] font-medium whitespace-nowrap tracking-[0.01em]">
                {isFr ? "Découverte du jour" : "Discovery of the day"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                const place = discoverPlace || ({ id: "__discovery__", name: "Discovery" } as DiscoverPlace);
                trackEvent({
                  eventType: "click_discovery_of_day",
                  placeId: place.id,
                  city: place.city,
                  category: place.category,
                  locale,
                  metadata: { name: place.name, source: "discovery_of_day" }
                });
                trackEvent({
                  eventType: "view_place_detail",
                  placeId: place.id,
                  city: place.city,
                  category: place.category,
                  locale,
                  metadata: { source: "discovery_of_day", name: place.name }
                });
                setSelectedHomePlaceSource("discovery_of_day");
                setSelectedHomePlace(place);
              }}
              className="relative min-h-[240px] w-full overflow-hidden rounded-2xl border border-white/10 text-left shadow-[0_12px_30px_rgba(0,0,0,0.30),inset_0_1px_0_rgba(255,255,255,0.10)] transition-[transform,box-shadow] active:scale-[0.992] active:shadow-[0_6px_18px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.07)]"
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

    <div className="absolute inset-0 z-10 flex flex-col justify-end">
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


            <div className="mt-6">
              <div className="mx-auto grid w-full max-w-[390px] grid-cols-2 gap-5 px-2">

                <div className="relative aspect-square">
                  <div className="absolute inset-0 overflow-hidden rounded-[28px] border border-white/10 text-white shadow-[0_12px_30px_rgba(0,0,0,0.30),inset_0_1px_0_rgba(255,255,255,0.10)]">
                    <img
                      src="/home/events-concert.webp"
                      alt=""
                      className="absolute inset-0 h-full w-full scale-110 object-cover blur-[2px]"
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(145deg, rgba(0,0,0,0.18), rgba(20,20,18,0.72))",
                      }}
                    />
                    <div className="absolute inset-0 z-10 flex items-center justify-center px-5 text-center">
                      <p className="font-serif text-[19px] font-medium leading-tight">
                        {isFr ? "Événements" : "Events"}
                      </p>
                    </div>
                  </div>

                  <div className="absolute -right-1 -top-1 z-20 rounded-full border border-white/15 bg-[#F97316]/85 px-2 py-[2px] text-[9px] font-semibold tracking-[0.02em] text-[#f3efe3] shadow-[0_2px_6px_rgba(0,0,0,0.18)]">
                    {isFr ? "À venir" : "Coming soon"}
                  </div>
                </div>

                <div className="relative aspect-square">
                  <div
                    className="absolute inset-0 overflow-hidden rounded-[28px] border border-white/10 text-white shadow-[0_12px_30px_rgba(0,0,0,0.30),inset_0_1px_0_rgba(255,255,255,0.10)]"
                    style={{
                      background:
                        "linear-gradient(145deg, #817946 0%, #34352b 52%, #1b1c17 100%)",
                    }}
                  >
                    <img src="/home/itinerary-road.avif" alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-[2px] brightness-[0.65]" />
                    <div className="absolute inset-0 z-10 flex items-center justify-center px-5 text-center">
                      <p className="font-serif text-[17px] font-medium leading-[1.12]">
                        {isFr
                          ? "Parcours sur mesure"
                          : "Tailored route"}
                      </p>
                    </div>
                  </div>

                  <div className="absolute -right-1 -top-1 z-20 rounded-full border border-white/15 bg-[#F97316]/85 px-2 py-[2px] text-[9px] font-semibold tracking-[0.02em] text-[#f3efe3] shadow-[0_2px_6px_rgba(0,0,0,0.18)]">
                    {isFr ? "À venir" : "Coming soon"}
                  </div>
                </div>

              </div>
            </div>
          </section>


        </div>
      </div>

      {recentViewedOpen ? (
        <div className="fixed inset-0 z-[2100] overflow-y-auto bg-[#171813] text-white">
          <div className="sticky top-0 z-20 border-b border-white/10 bg-[#171813]/95 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+14px)] backdrop-blur-xl">
            <div className="relative flex min-h-[58px] items-center justify-center">
              <button
                type="button"
                onClick={() =>
                  setRecentViewedOpen(false)
                }
                aria-label={
                  isFr
                    ? "Retour"
                    : "Back"
                }
                className="absolute left-0 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-[21px] text-white active:bg-white/[0.12]"
              >
                ←
              </button>

              <h2 className="px-12 text-center font-serif text-[24px] font-medium">
                {isFr
                  ? "Consultés récemment"
                  : "Recently viewed"}
              </h2>
            </div>
          </div>

          <div className="px-3 pb-[calc(env(safe-area-inset-bottom)+36px)] pt-5">
            {recentViewedPlaces.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5">
                {recentViewedPlaces.map(
                  (item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        trackEvent({
                          eventType:
                            "view_place_detail",
                          placeId:
                            item.id,
                          city:
                            item.city,
                          category:
                            item.category,
                          locale,
                          metadata: {
                            source:
                              "recently_viewed",
                            name:
                              item.name,
                          },
                        });

                        setSelectedHomePlaceSource(
                          "recently_viewed",
                        );

                        setSelectedHomePlace(
                          item,
                        );
                      }}
                      className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] text-left active:bg-white/[0.10]"
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-white/10">
                        <img
                          src={
                            item.panoramaImage ||
                            "/explorer-bg.png?v=3"
                          }
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      </div>

                      <div className="h-[84px] p-3">
                        <p className="line-clamp-2 font-serif text-[14px] font-medium leading-tight">
                          {item.name}
                        </p>

                        <p className="mt-1.5 truncate text-[10px] text-white/50">
                          {[
                            getLocalizedCategory(
                              item.category,
                              isFr,
                            ),
                            item.city,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </button>
                  ),
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-5">
                <p className="text-center text-[12px] text-white/50">
                  {isFr
                    ? "Aucun historique connu."
                    : "No viewing history yet."}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {selectedHomeMood ? (
        <div
          className="fixed inset-0 z-[2100] overflow-y-auto text-white"
          style={{
            background:
              getHomeMoodOpaqueBackground(selectedHomeMood),
          }}
        >
          <div
            className="sticky top-0 z-20 border-b border-white/10 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+14px)] backdrop-blur-xl"
            style={{
              background:
                getHomeMoodOpaqueBackground(selectedHomeMood),
            }}
          >
            <div className="relative flex min-h-[58px] items-center justify-center">
              <button
                type="button"
                onClick={() =>
                  setSelectedHomeMood(null)
                }
                aria-label={
                  isFr
                    ? "Retour"
                    : "Back"
                }
                className="absolute left-0 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-[21px] text-white active:bg-white/[0.12]"
              >
                ←
              </button>

              <div className="min-w-0 px-12 text-center">
                <h2 className="font-serif text-[24px] font-medium leading-tight">
                  {getHomeMoodLabel(
                    selectedHomeMood,
                    isFr,
                  )}
                </h2>

                <p className="mt-1.5 text-[10px] leading-snug text-white/55">
                  {getHomeMoodCategoriesLabel(
                    selectedHomeMood,
                    isFr,
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="px-3 pb-[calc(env(safe-area-inset-bottom)+36px)] pt-5">
            {!openNowHasLocation ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-5">
                <p className="text-[12px] leading-relaxed text-white/55">
                  {isFr
                    ? "Ta localisation doit être activée pour découvrir les lieux autour de toi."
                    : "Your location must be enabled to discover places around you."}
                </p>

                <button
                  type="button"
                  onClick={
                    requestHomeLocation
                  }
                  className="mt-4 rounded-xl bg-white px-4 py-2.5 text-[11px] font-semibold text-black active:opacity-80"
                >
                  {isFr
                    ? "Activer ma localisation"
                    : "Enable my location"}
                </button>
              </div>
            ) : (
              <>
                <section>
                  <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
                    <h3 className="font-serif text-[17px] font-medium">
                      {isFr
                        ? "Lieux proches de toi"
                        : "Places near you"}
                    </h3>

                    <span className="text-[10px] text-white/35">
                      {selectedMoodNearbyPlaces.length}
                    </span>
                  </div>

                  {selectedMoodNearbyPlaces.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2.5">
                      {selectedMoodNearbyPlaces.map(
                        (item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              trackEvent({
                                eventType:
                                  "view_place_detail",
                                placeId:
                                  item.id,
                                city:
                                  item.city,
                                category:
                                  item.category,
                                locale,
                                metadata: {
                                  source:
                                    "home_mood",
                                  mood:
                                    selectedHomeMood,
                                  proximity:
                                    "near",
                                  name:
                                    item.name,
                                },
                              });

                              setSelectedHomePlaceSource(
                                "home_mood",
                              );
                              setSelectedHomePlace(
                                item,
                              );
                            }}
                            className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] text-left active:bg-white/[0.10]"
                          >
                            <div className="relative aspect-[4/3] w-full overflow-hidden bg-white/10">
                              <img
                                src={
                                  item.panoramaImage ||
                                  "/explorer-bg.png?v=3"
                                }
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                            </div>

                            <div className="h-[84px] p-3">
                              <p className="line-clamp-2 font-serif text-[14px] font-medium leading-tight">
                                {item.name}
                              </p>

                              <p className="mt-1.5 truncate text-[10px] text-white/50">
                                {[
                                  getLocalizedCategory(
                                    item.category,
                                    isFr,
                                  ),
                                  item.city,
                                ]
                                  .filter(
                                    Boolean,
                                  )
                                  .join(
                                    " · ",
                                  )}
                              </p>
                            </div>
                          </button>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                      <p className="text-[11px] leading-snug text-white/45">
                        {isFr
                          ? "Aucun lieu correspondant à cette envie près de toi."
                          : "No places matching this mood near you."}
                      </p>
                    </div>
                  )}
                </section>

                <section className="mt-8">
                  <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
                    <h3 className="font-serif text-[17px] font-medium">
                      {isFr
                        ? "Lieux loin de toi"
                        : "Places farther away"}
                    </h3>

                    <span className="text-[10px] text-white/35">
                      {selectedMoodFarPlaces.length}
                    </span>
                  </div>

                  {selectedMoodFarPlaces.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2.5">
                      {selectedMoodFarPlaces.map(
                        (item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              trackEvent({
                                eventType:
                                  "view_place_detail",
                                placeId:
                                  item.id,
                                city:
                                  item.city,
                                category:
                                  item.category,
                                locale,
                                metadata: {
                                  source:
                                    "home_mood",
                                  mood:
                                    selectedHomeMood,
                                  proximity:
                                    "far",
                                  name:
                                    item.name,
                                },
                              });

                              setSelectedHomePlaceSource(
                                "home_mood",
                              );
                              setSelectedHomePlace(
                                item,
                              );
                            }}
                            className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] text-left active:bg-white/[0.10]"
                          >
                            <div className="relative aspect-[4/3] w-full overflow-hidden bg-white/10">
                              <img
                                src={
                                  item.panoramaImage ||
                                  "/explorer-bg.png?v=3"
                                }
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                            </div>

                            <div className="h-[84px] p-3">
                              <p className="line-clamp-2 font-serif text-[14px] font-medium leading-tight">
                                {item.name}
                              </p>

                              <p className="mt-1.5 truncate text-[10px] text-white/50">
                                {[
                                  getLocalizedCategory(
                                    item.category,
                                    isFr,
                                  ),
                                  item.city,
                                ]
                                  .filter(
                                    Boolean,
                                  )
                                  .join(
                                    " · ",
                                  )}
                              </p>
                            </div>
                          </button>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                      <p className="text-[11px] leading-snug text-white/45">
                        {isFr
                          ? "Aucun autre lieu correspondant à cette envie."
                          : "No other places matching this mood."}
                      </p>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      ) : null}

      {selectedHomePlace ? (
        <div className="fixed inset-0 z-[2200] overflow-hidden bg-[#2f2f2f] text-white">
          {(() => {
            const selectedHomePlaceSaved = savedPlaces.some((item) => String(item.id) === String(selectedHomePlace.id));

            return (
              <div className="absolute left-4 z-[80] flex flex-col gap-3" style={{ top: "calc(env(safe-area-inset-top) + 16px)" }}>
                <button
                  type="button"
                  onClick={toggleSelectedHomePlaceSaved}
                  className="grid place-items-center"
                  style={{
                    width: 40,
                    height: 40,
                    backgroundColor: "rgba(0,0,0,0.48)",
                    WebkitBackdropFilter: "blur(8px)",
                    backdropFilter: "blur(8px)",
                    borderRadius: "9999px",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#ffffff",
                    padding: 0,
                    WebkitAppearance: "none",
                    appearance: "none",
                    WebkitTapHighlightColor: "transparent"
                  }}
                  aria-label={selectedHomePlaceSaved ? (isFr ? "Retirer des favoris" : "Remove from favorites") : (isFr ? "Ajouter aux favoris" : "Add to favorites")}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="22"
                    height="22"
                    fill={selectedHomePlaceSaved ? "#6F6528" : "none"}
                    stroke="rgba(255,255,255,0.95)"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 21.2c-.3 0-.6-.1-.8-.3C8.1 18.4 2.5 13.9 2.5 8.4C2.5 5.5 4.8 3.3 7.7 3.3c1.8 0 3.4.8 4.3 2.2c.9-1.4 2.5-2.2 4.3-2.2c2.9 0 5.2 2.2 5.2 5.1c0 5.5-5.6 10-8.7 12.5c-.2.2-.5.3-.8.3z" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={openSelectedPlaceSharedListPicker}
                  className="grid place-items-center text-white"
                  style={{
                    width: 40,
                    height: 40,
                    backgroundColor: "rgba(0,0,0,0.48)",
                    WebkitBackdropFilter: "blur(8px)",
                    backdropFilter: "blur(8px)",
                    borderRadius: "9999px",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#ffffff",
                    padding: 0,
                    WebkitAppearance: "none",
                    appearance: "none",
                    WebkitTapHighlightColor: "transparent"
                  }}
                  aria-label={isFr ? "Ajouter à une liste partagée" : "Add to a shared list"}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="22"
                    height="22"
                    fill="none"
                    stroke="rgba(255,255,255,0.95)"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                </button>
              </div>
            );
          })()}
          {selectedPlaceSharedListPickerOpen ? (
            <div className="absolute inset-0 z-[120] flex items-end bg-black/45 px-4 pb-5 pt-20 backdrop-blur-sm">
              <div className="max-h-[72vh] w-full overflow-y-auto rounded-[28px] border border-white/10 bg-[#1f1f1f] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                      {isFr ? "Listes partagées" : "Shared lists"}
                    </p>
                    <h3 className="mt-1 truncate font-serif text-[22px] font-semibold text-white">
                      {isFr ? "Ajouter ce lieu" : "Add this place"}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPlaceSharedListPickerOpen(false)}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-[18px] text-white/75"
                    aria-label={isFr ? "Fermer" : "Close"}
                  >
                    ×
                  </button>

                  {homeLocationError ? (
                    <p className="mt-3 text-[11px] leading-relaxed text-red-200/85">
                      {homeLocationError}
                    </p>
                  ) : null}
                </div>

                {selectedPlaceSharedListsLoading ? (
                  <p className="text-[13px] text-white/45">
                    {isFr ? "Chargement..." : "Loading..."}
                  </p>
                ) : selectedPlaceSharedLists.length > 0 ? (
                  <div className="space-y-2">
                    {selectedPlaceSharedLists.map((list) => {
                      const alreadyAdded = list.places.some((item) => String(item.placeId) === String(selectedHomePlace.id));

                      return (
                        <button
                          key={list.id}
                          type="button"
                          onClick={() => alreadyAdded ? undefined : addSelectedPlaceToSharedList(list.id)}
                          disabled={selectedPlaceSharedListsSaving || alreadyAdded}
                          className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/8 px-4 py-3 text-left disabled:opacity-50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[14px] font-semibold text-white/90">
                              {list.title}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-white/40">
                              {alreadyAdded ? (isFr ? "Déjà dans cette liste" : "Already in this list") : (isFr ? "Ajouter à cette liste" : "Add to this list")}
                            </span>
                          </span>
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[18px] font-semibold text-black">
                            {alreadyAdded ? "✓" : "+"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-2xl bg-white/8 px-4 py-3 text-[13px] leading-relaxed text-white/55">
                    {isFr ? "Tu n’as pas encore de liste partagée." : "You do not have any shared list yet."}
                  </p>
                )}

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/8 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
                    {isFr ? "Nouvelle liste" : "New list"}
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={selectedPlaceNewSharedListTitle}
                      onChange={(event) => setSelectedPlaceNewSharedListTitle(event.target.value)}
                      placeholder={isFr ? "Titre de la liste" : "List title"}
                      className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[14px] text-white outline-none placeholder:text-white/30"
                    />
                    <button
                      type="button"
                      onClick={createSharedListAndAddSelectedPlace}
                      disabled={selectedPlaceSharedListsSaving}
                      className="shrink-0 rounded-2xl bg-white px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-50"
                    >
                      {isFr ? "Créer" : "Create"}
                    </button>
                  </div>
                </div>

                {selectedPlaceSharedListsError ? (
                  <p className="mt-3 text-[13px] leading-relaxed text-red-200">{selectedPlaceSharedListsError}</p>
                ) : null}

                {selectedPlaceSharedListsMessage ? (
                  <p className="mt-3 text-[13px] leading-relaxed text-white/55">{selectedPlaceSharedListsMessage}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {selectedHomePlace.panoramaImage ? (
            <img
              src={selectedHomePlace.panoramaImage}
              alt=""
              className="absolute inset-x-0 top-0 h-[60vh] w-full bg-black object-contain"
            />
          ) : (
            <div className="absolute inset-x-0 top-0 h-[60vh] bg-white/10" />
          )}

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 top-[60vh] bg-black"
          />

          <div className="absolute inset-0 z-10 overflow-y-auto overscroll-y-none">
          {selectedHomePlace?.miniText ? (
            <div className="relative mt-[60vh] min-h-[40vh] bg-black px-6 pt-6 pb-8">
              <div>
                <div className="absolute inset-x-0 bottom-full z-40 -mb-px flex justify-center">
                  <button
                    type="button"
                    onClick={() => setSelectedPlaceCommentsOpen((value) => !value)}
                    className="inline-flex rounded-t-xl rounded-b-none bg-black px-4 py-2 text-center text-[12px] font-semibold uppercase tracking-[0.18em] text-white/75 hover:bg-black active:bg-black"
                  >
                    {isFr ? "Commentaires" : "Comments"}
                  </button>

                  {selectedPlaceCommentsOpen ? (
                    <div className="absolute inset-x-0 bottom-full z-30 max-h-[42vh] overflow-y-auto rounded-3xl border border-white/10 bg-black/35 px-6 py-5 shadow-[0_-18px_45px_rgba(0,0,0,0.35)] backdrop-blur-md">
                      {(() => {
                        const note = placeNotes[String(selectedHomePlace.id)];
                        const existingComment = String(note?.comment ?? "").trim();
                        const friendComments = Array.isArray(note?.friendComments) ? note.friendComments : [];
                        const hasAnyComment = Boolean(existingComment) || friendComments.length > 0;

                        return (
                          <div className="space-y-4">
                            <p className="text-[11px] leading-relaxed text-white/45">
                              {isFr
                                ? "Tes commentaires sont privés. Ils ne sont visibles que par toi, ou par tes amis si tu as activé cette option dans ton profil."
                                : "Your comments are private. They are only visible to you, or to your friends if you have enabled this option in your profile."}
                            </p>
                            {existingComment ? (
                              <div className="rounded-2xl border border-white/10 bg-black/55 p-4">
                                <p className="text-[15px] leading-relaxed text-white/88">
                                  <span className="font-semibold text-white">{isFr ? "Moi : " : "Me: "}</span>
                                  <span>{existingComment}</span>
                                </p>
                              </div>
                            ) : null}

                            {friendComments.map((item) => {
                              const friendName = String(item.displayName || item.username || "").trim() || (isFr ? "Ami" : "Friend");
                              const friendComment = String(item.comment ?? "").trim();

                              if (!friendComment) return null;

                              return (
                                <div key={`${item.userId}-${item.updatedAt}`} className="rounded-2xl border border-white/10 bg-black/55 p-4">
                                  <p className="text-[15px] leading-relaxed text-white/88">
                                    <span className="font-semibold text-white">{friendName} : </span>
                                    <span>{friendComment}</span>
                                  </p>
                                </div>
                              );
                            })}

                            {!existingComment ? (
                              <div className="rounded-2xl border border-white/10 bg-black/55 p-4">
                                {!hasAnyComment ? (
                                  <div className="mb-3 text-[14px] text-white/70">
                                    {isFr ? "Aucun commentaire pour le moment." : "No comments yet."}
                                  </div>
                                ) : null}

                                {authProfile ? (
                                  <div className="space-y-3">
                                    <textarea
                                      value={selectedPlaceCommentInput}
                                      onChange={(e) => setSelectedPlaceCommentInput(e.target.value)}
                                      maxLength={1200}
                                      rows={4}
                                      placeholder={isFr ? "Écris ton commentaire..." : "Write your comment..."}
                                      className="w-full resize-none rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-[14px] leading-relaxed text-white outline-none placeholder:text-white/35 focus:border-white/25"
                                    />

                                    {selectedPlaceCommentError ? (
                                      <p className="text-[12px] text-red-200/85">{selectedPlaceCommentError}</p>
                                    ) : null}

                                    <button
                                      type="button"
                                      onClick={saveSelectedHomePlaceComment}
                                      disabled={selectedPlaceCommentSaving || !selectedPlaceCommentInput.trim()}
                                      className="rounded-full bg-[#F97316] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-white disabled:opacity-45"
                                    >
                                      {selectedPlaceCommentSaving ? (isFr ? "Enregistrement..." : "Saving...") : (isFr ? "Publier" : "Post")}
                                    </button>
                                  </div>
                                ) : (
                                  <p className="text-[13px] leading-relaxed text-white/45">
                                    {isFr ? "Connecte-toi à ton espace perso pour écrire un commentaire." : "Sign in to your personal space to write a comment."}
                                  </p>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })()}
                    </div>
                  ) : null}
                </div>

                <div className="mb-6">
                  <div className="text-[28px] font-bold leading-tight text-white">
                    {selectedHomePlace.name}
                  </div>
                  {(selectedHomePlace.category || selectedHomePlace.website) ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {selectedHomePlace.category ? (
                        <div className="text-[14px] font-semibold text-white/70">
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

                            trackEvent({
                              eventType: "click_detail_website",
                              placeId: selectedHomePlace.id,
                              city: selectedHomePlace.city,
                              category: selectedHomePlace.category,
                              locale,
                              metadata: { name: selectedHomePlace.name, url, source: selectedHomePlaceSource }
                            });

                            const nativeWebsiteBridge =
                              (window as any)?.webkit?.messageHandlers?.imWebsite;

                            if (nativeWebsiteBridge?.postMessage) {
                              nativeWebsiteBridge.postMessage(url);
                            } else if (/Android/i.test(navigator.userAgent)) {
                              const encodedUrl = encodeURIComponent(url);

                              window.location.href =
                                `intent://website?url=${encodedUrl}` +
                                `#Intent;scheme=indiemap;package=com.indiemap.app;` +
                                `S.browser_fallback_url=${encodedUrl};end`;
                            } else {
                              window.open(url, "_blank");
                            }
                          }}
                          className="rounded-[9px] border border-[#6F6528] bg-[#6F6528] px-2.5 py-1 text-[12px] font-semibold text-white shadow-sm active:opacity-70"
                        >
                          {isFr ? "Voir le site ↗" : "Visit website ↗"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {selectedHomePlace.priceRange ? (
                    <div className="mt-2 text-[13px] font-normal text-white/80">
                      {formatPlacePriceRange(selectedHomePlace.priceRange, locale)}
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

                            trackEvent({
                              eventType: "click_detail_itinerary",
                              placeId: selectedHomePlace.id,
                              city: selectedHomePlace.city,
                              category: selectedHomePlace.category,
                              locale,
                              metadata: { name: selectedHomePlace.name, source: selectedHomePlaceSource }
                            });

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
                            const shareUrl = `https://www.indie-map.com/${locale}/carte?discover=${encodeURIComponent(selectedHomePlace.id)}`;
                            const shareData = {
                              title: selectedHomePlace.name,
                              text: isFr ? `Découvre ${selectedHomePlace.name} sur Indie Map.` : `Discover ${selectedHomePlace.name} on Indie Map.`,
                              url: shareUrl
                            };

                            trackEvent({
                              eventType: "click_detail_share",
                              placeId: selectedHomePlace.id,
                              city: selectedHomePlace.city,
                              category: selectedHomePlace.category,
                              locale,
                              metadata: { name: selectedHomePlace.name, url: shareUrl, source: selectedHomePlaceSource }
                            });

                            try {
                              if (navigator.share) {
                                await navigator.share(shareData);
                                return;
                              }

                              await navigator.clipboard.writeText(shareUrl);
                              setAddressCopied(true);
                              window.setTimeout(() => setAddressCopied(false), 1500);
                            } catch {
                              try {
                                await navigator.clipboard.writeText(shareUrl);
                                setAddressCopied(true);
                                window.setTimeout(() => setAddressCopied(false), 1500);
                              } catch {}
                            }
                          }}
                          className="rounded-[9px] border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-semibold text-white/75"
                        >
                          {isFr ? "Partager" : "Share"}
                        </button>
                        {selectedHomePlace?.phone ? (
                          <button
                            type="button"
                            onClick={() => {
                              trackEvent({
                                eventType: "click_detail_phone",
                                placeId: selectedHomePlace.id,
                                city: selectedHomePlace.city,
                                category: selectedHomePlace.category,
                                locale,
                                metadata: { name: selectedHomePlace.name, source: selectedHomePlaceSource }
                              });
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
                      {renderOpeningHours(selectedHomePlace.openingHours, selectedHomePlace.timeZone, isFr)}
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
                        trackEvent({
                          eventType: "click_detail_view_on_map",
                          placeId: selectedHomePlace.id,
                          city: selectedHomePlace.city,
                          category: selectedHomePlace.category,
                          locale,
                          metadata: { name: selectedHomePlace.name }
                        });
                        router.push(
                          `/${locale}/carte?discover=${selectedHomePlace.id}`
                        );
                      }}
                      className="relative mt-6 block h-[108px] w-full overflow-hidden rounded-2xl bg-[#101510] text-white"
                    >
                      <div
                        className="absolute -inset-1 pointer-events-none scale-[1.03]"
                        style={{ filter: "blur(1.4px)" }}
                      >
                        <MapPanel
                          items={[{
                            ...selectedHomePlace,
                            type: selectedHomePlace.category
                          }]}
                          overlaysReady={true}
                          hideGeolocate={true}
                          searchMode={true}
                        />
                      </div>

                      <div className="absolute inset-0 bg-black/25" />

                      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between bg-gradient-to-t from-black/85 via-black/40 to-transparent px-5 pb-4 pt-9">
                        <div className="text-left">
                          <div className="inline-flex items-center gap-2 font-serif text-[20px] font-medium tracking-[0.01em]">
                            <span>{isFr ? "Voir sur la carte" : "View on map"}</span>
                            <span className="text-[22px] leading-none">→</span>
                          </div>
                        </div>
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
            onClick={() => {
              const returnToPreviousScreen =
                selectedHomePlaceSource ===
                  "recent_additions_all" ||
                selectedHomePlaceSource ===
                  "professional_space";

              setSelectedHomePlace(null);

              if (returnToPreviousScreen) {
                router.back();
              }
            }}
            className="absolute right-4 z-[80] grid place-items-center"
            style={{
              top: "calc(env(safe-area-inset-top) + 16px)",
              width: 40,
              height: 40,
              backgroundColor: "rgba(0,0,0,0.48)",
              WebkitBackdropFilter: "blur(8px)",
              backdropFilter: "blur(8px)",
              borderRadius: "9999px",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#ffffff",
              fontSize: "22px",
              fontWeight: 500,
              lineHeight: 1,
              padding: 0,
              WebkitAppearance: "none",
              appearance: "none",
              WebkitTapHighlightColor: "transparent"
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
              searchAbortRef.current?.abort();
              searchAbortRef.current = null;
              setSearchLoading(false);
              setSearchResults(null);
            }}
            className="absolute right-[calc(env(safe-area-inset-right)+24px)] z-20 grid place-items-center"
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
            {searchLoading && searchResults === null ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div className="mb-5 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/90" />

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
                <div
                  ref={searchResultsScrollRef}
                  className="min-h-0 flex-1 overflow-y-auto pb-24"
                >
                  <div className="pr-12">
                    <div className="font-serif text-[24px] leading-tight">
                      {isFr ? "Résultats" : "Results"}
                    </div>
                    <div className="mt-2 text-[14px] leading-relaxed text-white/60">
                      “{searchQuery.trim()}”
                    </div>

                    {searchLoading ? (
                      <div className="mt-4 flex items-center gap-2 text-[12px] text-white/55">
                        <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border border-white/20 border-t-white/80" />
                        <span>
                          {isFr
                            ? "Recherche de lieux supplémentaires…"
                            : "Looking for more places…"}
                        </span>
                      </div>
                    ) : null}
                  </div>

                <div className="mt-7 space-y-3">
                  {(searchResults ?? []).length > 0 ? (
                    (searchResults ?? []).map((item, index) => (
                      <PlaceResultCard
                        key={item.id}
                        searchResultId={item.id}
                        searchResultRank={index + 1}
                        name={item.name}
                        panoramaImage={item.panoramaImage}
                        categoryKey={item.category}
                        categoryLabel={getLocalizedCategory(item.category, isFr)}
                        city={item.city}
                        miniText={item.miniText}
                        buttonLabel={isFr ? "Voir la fiche" : "View details"}
                        onViewDetails={() => {
                          trackEvent({
                            eventType: "click_search_result_detail",
                            placeId: item.id,
                            city: item.city,
                            category: item.category,
                            searchId: activeSearchId,
                            searchRank: index + 1,
                            locale,
                            metadata: {
                              name: item.name,
                              query: activeSearchQuery || searchQuery.trim()
                            }
                          });

                          trackEvent({
                            eventType: "view_place_detail",
                            placeId: item.id,
                            city: item.city,
                            category: item.category,
                            searchId: activeSearchId,
                            searchRank: index + 1,
                            locale,
                            metadata: {
                              source: "search_result",
                              name: item.name
                            }
                          });

                          setSelectedHomePlaceSource("search_result");
                          setSelectedHomePlace(item);
                        }}
                      />
                    ))
                  ) : searchLoading ? (
                    <div className="rounded-2xl border border-white/10 bg-white/8 p-5 text-[14px] leading-relaxed text-white/60">
                      <div className="flex items-center gap-3">
                        <span className="h-4 w-4 shrink-0 animate-spin rounded-full border border-white/20 border-t-white/80" />
                        <span>
                          {isFr
                            ? "Vérification des lieux pertinents…"
                            : "Checking relevant places…"}
                        </span>
                      </div>
                    </div>
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
                        trackEvent({
                          eventType: "click_search_results_map",
                          searchId: activeSearchId,
                          locale,
                          metadata: {
                            query: activeSearchQuery || searchQuery.trim(),
                            resultCount: (searchResults ?? []).length,
                            ids
                          }
                        });

                        const params =
                          new URLSearchParams();

                        params.set(
                          "searchIds",
                          ids,
                        );


                        router.push(
                          `/${locale}/carte?${params.toString()}`
                        );
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

      <BottomNavBar
        isFr={isFr}
        authProfile={authProfile}
        professionalPlace={
          allPlaces.find(
            (item) =>
              String(item.id) ===
              String(authProfile?.professionalPlaceId || "")
          ) ?? null
        }
        hasPersonalNotification={incomingFriendRequestCount > 0 || unseenSharedListCount > 0}
        onOpenPersonal={() => setPanel("personalSpace")}
        onOpenContrib={() => setPanel("contrib")}
        onCreateAccount={() => {
          setPanel("personalSpace");
          setAuthMode("signup");
          setAuthForceForm(true);
        }}
        onOpenPros={() => setPanel("pros")}
      />

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
                <ProfessionalSpacePanel
                  isFr={isFr}
                  onOpenPersonalSpace={() => setPanel("personalSpace")}
                  onAuthenticated={refreshAuthProfile}
                  canOpenPersonalSpace={Boolean(authProfile)}
                  onLogout={logoutAuth}
                />
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
              ) : panel === "personalSpace" || panel === "profileInfo" || panel === "friends" || panel === "sharedLists" ? (
                <PersonalSpacePanel
                  isFr={isFr}
                  places={allPlaces}
                  mode={panel === "profileInfo" ? "profile" : panel === "friends" ? "friends" : panel === "sharedLists" ? "sharedLists" : "dashboard"}
                  initialSharedListId={initialSharedListId}
                  incomingFriendRequestCount={incomingFriendRequestCount}
                  unseenSharedListCount={unseenSharedListCount}
                  onSharedListsSeen={() => {
                    setUnseenSharedListCount(0);
                  }}
                  authLoading={authLoading}
                  authProfile={authProfile}
                  authMode={authMode}
                  authEmail={authEmail}
                  authUsername={authUsername}
                  authPassword={authPassword}
                  authSending={authSending}
                  authResetDone={authResetDone}
                  authError={authError}
                  profileUsername={profileUsername}
                  profileAvatarColor={profileAvatarColor}
                  profileHomeCity={profileHomeCity}
                  profileAgeRange={profileAgeRange}
                  profileLocale={profileLocale}
                  commentsVisibleToFriends={commentsVisibleToFriends}
                  visitedPlacesVisibleToFriends={visitedPlacesVisibleToFriends}
                  profileSaving={profileSaving}
                  profileSuccess={profileSuccess}
                  profileError={profileError}
                  contributionsCount={authProfile?.contributionsCount ?? 0}
                  visitedPlacesCount={Object.values(placeNotes).filter((note) => note?.visited).length}
                  visitedCitiesCount={new Set(Object.entries(placeNotes).filter(([, note]) => note?.visited).map(([id]) => (allPlaces.find((item) => item.id === id)?.city || savedPlaces.find((item) => item.id === id)?.city || "").trim()).filter(Boolean)).size}
                  visitedThisMonthCount={Object.values(placeNotes).filter((note) => {
                    if (!note?.visited || !note.visitedAt) return false;
                    const visited = new Date(note.visitedAt);
                    const now = new Date();
                    return visited.getFullYear() === now.getFullYear() && visited.getMonth() === now.getMonth();
                  }).length}
                  onModeChange={(mode) => setPanel(mode === "profile" ? "profileInfo" : mode === "friends" ? "friends" : mode === "sharedLists" ? "sharedLists" : "personalSpace")}
                  onOpenSavedPlaces={() => setPanel("myPlacesList")}
                  onOpenPlace={(place, source) => {
                    const selected = place as DiscoverPlace;
                    const viewSource = String(source || "personal_space").trim() || "personal_space";
                    setSelectedHomePlaceSource(viewSource);
                    trackEvent({
                      eventType: "view_place_detail",
                      placeId: selected.id,
                      city: selected.city,
                      category: selected.category,
                      locale,
                      metadata: { name: selected.name, source: viewSource }
                    });
                    setSelectedHomePlace(selected);
                  }}
                  onSwitchLocale={switchLocale}
                  onSetAuthMode={setAuthMode}
                  onSetAuthEmail={setAuthEmail}
                  onSetAuthUsername={setAuthUsername}
                  onSetAuthPassword={setAuthPassword}
                  onSetAuthError={setAuthError}
                  onSetAuthResetDone={setAuthResetDone}
                  onSetAuthForceForm={setAuthForceForm}
                  onSetAuthResetToken={setAuthResetToken}
                  onSetProfileUsername={setProfileUsername}
                  onSetProfileAvatarColor={setProfileAvatarColor}
                  onSetProfileHomeCity={setProfileHomeCity}
                  onSetProfileAgeRange={setProfileAgeRange}
                  onSetProfileLocale={setProfileLocale}
                  onSetCommentsVisibleToFriends={setCommentsVisibleToFriends}
                  onSetVisitedPlacesVisibleToFriends={setVisitedPlacesVisibleToFriends}
                  onSubmitAuth={submitAuth}
                  onRequestPasswordReset={requestPasswordReset}
                  onConfirmPasswordReset={confirmPasswordReset}
                  onSaveProfile={saveProfile}
                  hasProfessionalAccess={Boolean(
                    (
                      authProfile as
                        | { hasProfessionalAccess?: boolean }
                        | null
                    )?.hasProfessionalAccess
                  )}
                  onOpenProfessionalSpace={() => setPanel("pros")}
                  onLogout={logoutAuth}
                />
              ) : panel === "myPlacesList" ? (
                <>
                  <button
                    type="button"
                    onClick={() => setPanel("personalSpace")}
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
                                    onPointerDown={(e) => {
                                      e.stopPropagation();
                                    }}
                                    onPointerUp={(e) => {
                                      e.stopPropagation();
                                    }}
                                    onTouchStart={(e) => {
                                      e.stopPropagation();
                                    }}
                                    onTouchEnd={(e) => {
                                      e.stopPropagation();
                                    }}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();

                                      const isVisited = Boolean(placeNotes[place.id]?.visited);
                                      const now = new Date().toISOString();
                                      const nextNotes: Record<string, PlaceNote> = {
                                        ...placeNotes,
                                        [place.id]: {
                                          ...(placeNotes[place.id] ?? {}),
                                          visited: !isVisited,
                                          visitedAt: isVisited ? undefined : now,
                                          updatedAt: now
                                        }
                                      };

                                      setPlaceNotes(nextNotes);
                                      writePlaceNotes(nextNotes, authProfile?.id ?? null);
                                      void syncPlaceNoteToServer(place.id, nextNotes[place.id]);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key !== "Enter" && e.key !== " ") return;
                                      e.preventDefault();
                                      e.stopPropagation();

                                      const isVisited = Boolean(placeNotes[place.id]?.visited);
                                      const now = new Date().toISOString();
                                      const nextNotes: Record<string, PlaceNote> = {
                                        ...placeNotes,
                                        [place.id]: {
                                          ...(placeNotes[place.id] ?? {}),
                                          visited: !isVisited,
                                          visitedAt: isVisited ? undefined : now,
                                          updatedAt: now
                                        }
                                      };

                                      setPlaceNotes(nextNotes);
                                      writePlaceNotes(nextNotes, authProfile?.id ?? null);
                                      void syncPlaceNoteToServer(place.id, nextNotes[place.id]);
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
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
