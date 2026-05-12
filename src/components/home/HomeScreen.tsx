"use client";

import { useRouter } from "next/navigation";
import React from "react";

import BottomNavBar from "@/components/BottomNavBar";
import ContributeForm from "@/components/ContributeForm";
import MapPanel from "@/components/MapPanel";
import PersonalSpacePanel from "@/components/PersonalSpacePanel";
import { trackEvent } from "@/lib/analytics";
import { isContextSuggestionCandidateOpen, normalizeContextCategory, pickContextPlaces } from "@/lib/contextSuggestions";
import { readPlaceNotes, writePlaceNotes, type PlaceNote } from "@/lib/placeNotes";

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

type SharedListChoice = {
  id: string;
  title: string;
  places: {
    placeId: string;
  }[];
};


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

  interface Window {
    __IM_PENDING_PUSH_TOKEN__?: string;
    __IM_REGISTER_PUSH_TOKEN__?: (token: string) => void;
  }
}

const homeMemoryCache: Record<string, { discoverPlace: DiscoverPlace | null; contextPlace: DiscoverPlace | null; newPlaces: NewPlace[] } | undefined> = {};
const SAVED_PLACES_KEY = "im-saved-places";

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
    body: JSON.stringify({ platform: "ios", token }),
  });

  if (res.status === 401) return false;
  return res.ok;
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
  const picks = pickContextPlaces(pool.filter(isContextSuggestionCandidateOpen), now);
  const fallback = pickContextPlaces(pool, now);
  const list = (picks.length > 0 ? picks : fallback).slice(0, 3);
  if (list.length > 0) return list;
  return contextPlace ? [contextPlace] : [];
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
  const [profileDisplayName, setProfileDisplayName] = React.useState("");
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

  const refreshAuthProfile = React.useCallback(async () => {
    setAuthLoading(true);
    try {
      const res = await fetch("/api/v1/me/profile", { cache: "no-store" });
      if (res.status === 401) {
        setAuthProfile(null);
        return null;
      }
      const data = await res.json().catch(() => null);
      const user = data?.user ?? null;
      if (data?.ok && user) {
        setAuthProfile(user);
        setProfileUsername(user.username || "");
        setProfileDisplayName(user.displayName || "");
        setProfileAvatarUrl(user.avatarUrl || "");
        setProfileAvatarColor(user.avatarColor || "#F97316");
        setProfileHomeCity(user.homeCity || "");
        setProfileAgeRange(user.ageRange || "");
        setProfileLocale(user.preferredLocale || locale);
        setCommentsVisibleToFriends(user.commentsVisibleToFriends === true);
        setVisitedPlacesVisibleToFriends(user.visitedPlacesVisibleToFriends === true);
        return user as AuthProfile;
      }
      setAuthProfile(null);
      return null;
    } catch {
      setAuthProfile(null);
      return null;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refreshAuthProfile();
  }, [refreshAuthProfile]);
  React.useEffect(() => {
    window.__IM_REGISTER_PUSH_TOKEN__ = (rawToken: string) => {
      const token = normalizePushToken(rawToken);
      if (!token) return;
      window.__IM_PENDING_PUSH_TOKEN__ = token;

      if (!authProfile) return;

      registerPushToken(token)
        .then((ok) => {
          if (ok && window.__IM_PENDING_PUSH_TOKEN__ === token) {
            delete window.__IM_PENDING_PUSH_TOKEN__;
          }
        })
        .catch(() => null);
    };

    const pendingToken = normalizePushToken(window.__IM_PENDING_PUSH_TOKEN__);
    if (pendingToken && authProfile) {
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
    if (panel === "personalSpace" && !authProfile) {
      refreshAuthProfile();
    }
  }, [panel, authProfile, refreshAuthProfile]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "ok") {
      setPanel("personalSpace");
      refreshAuthProfile();
    }

    if (params.get("panel") === "friends") {
      setPanel("friends");
      refreshAuthProfile();
    }

    if (params.get("panel") === "sharedLists") {
      const sharedListId = params.get("sharedListId") || params.get("listId");
      setInitialSharedListId(sharedListId);
      setPanel("sharedLists");
      refreshAuthProfile();
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
            ? { email, username, password }
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
      setProfileDisplayName(data.user.displayName || "");
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


  async function logoutAuth() {
    setAuthError("");
    setAuthSending(true);

    try {
      const res = await fetch("/api/v1/auth/logout", {
        method: "POST",
      });

      if (!res.ok) {
        setAuthError(isFr ? "Impossible de se déconnecter pour l’instant." : "Unable to sign out right now.");
        return;
      }

      setAuthProfile(null);
      setAuthMode("login");
      setAuthEmail("");
      setAuthUsername("");
      setAuthPassword("");
      setAuthResetToken("");
      setAuthResetDone(false);
      setAuthForceForm(false);
      setProfileUsername("");
      setProfileDisplayName("");
      setProfileAvatarUrl("");
      setProfileAvatarColor("#F97316");
      setProfileHomeCity("");
      setProfileAgeRange("");
      setProfileLocale(locale);
      setCommentsVisibleToFriends(false);
      setVisitedPlacesVisibleToFriends(false);
    } catch {
      setAuthError(isFr ? "Impossible de se déconnecter pour l’instant." : "Unable to sign out right now.");
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
          displayName: profileDisplayName.trim() || username,
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
    return Boolean(cached?.discoverPlace || cached?.contextPlace || (cached?.newPlaces?.length ?? 0) > 0 || initialDiscoverPlace || initialContextPlace || initialNewPlaces.length > 0);
  });
  const [newPlaces, setNewPlaces] = React.useState<NewPlace[]>(() => homeMemoryCache[locale]?.newPlaces ?? initialNewPlaces ?? []);
  const [selectedHomePlace, setSelectedHomePlace] = React.useState<DiscoverPlace | null>(null);
  const [selectedHomePlaceSource, setSelectedHomePlaceSource] = React.useState("home_detail");
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
  const [addressCopied, setAddressCopied] = React.useState(false);
  const [selectedPlaceCommentsOpen, setSelectedPlaceCommentsOpen] = React.useState(false);
  const [selectedPlaceCommentInput, setSelectedPlaceCommentInput] = React.useState("");
  const [selectedPlaceCommentSaving, setSelectedPlaceCommentSaving] = React.useState(false);
  const [selectedPlaceCommentError, setSelectedPlaceCommentError] = React.useState("");
  const [savedPlaces, setSavedPlaces] = React.useState<SavedPlace[]>(() => readSavedPlaces());
  const [placeNotes, setPlaceNotes] = React.useState<Record<string, PlaceNote>>({});
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
    if (!authProfile) return;
    if (panel !== "myPlacesList") return;

    const userId = authProfile.id;
    let cancelled = false;

    async function loadSavedPlacesFromServer() {
      try {
        const res = await fetch("/api/v1/me/saved-places", { cache: "no-store" });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok || !Array.isArray(data.places)) return;

        const ids = new Set(data.places.map((item: any) => String(item?.placeId ?? "").trim()).filter(Boolean));
        const next = allPlaces.filter((place) => ids.has(String(place.id)));

        if (cancelled) return;

        setSavedPlaces(next);
        window.localStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent("im:saved-places-updated"));
      } catch {}
    }

    void loadSavedPlacesFromServer();

    return () => {
      cancelled = true;
    };
  }, [authProfile?.id, allPlaces, panel]);

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
          "Content-Type": "application/json"
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
    window.localStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("im:saved-places-updated"));

    try {
      fetch("/api/v1/me/saved-places", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          placeId: id,
          saved: !exists
        })
      }).catch(() => {});
    } catch {}
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
          "Content-Type": "application/json"
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
          const openContextBasePool = contextBasePool.filter(isContextSuggestionCandidateOpen);
          const openContextFallbackPool = contextFallbackPool.filter(isContextSuggestionCandidateOpen);

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
          fetch("/api/v1/me/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: pos.lat, lng: pos.lng }),
            keepalive: true,
          }).catch(() => null);

          const nearby = all.filter((item) => {
            const lat = Number(item.lat);
            const lng = Number(item.lng);
            return Number.isFinite(lat) && Number.isFinite(lng) && haversineKm(pos.lat, pos.lng, lat, lng) <= 30;
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

                trackEvent({
                  eventType: "search_ai_used",
                  locale,
                  metadata: { query }
                });

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
                        const searchCategory = rawCategory.includes("brunch") ? "brunch" : normalizeContextCategory(place.category);

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
                          const placeCategory = rawCategory.includes("brunch") ? "brunch" : normalizeContextCategory(place.category);
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
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-white/10" />
          )}

          <div className="absolute inset-0 z-10 overflow-y-auto">
          {selectedHomePlace?.miniText ? (
            <div className="relative mt-[55vh] min-h-[45vh] rounded-t-3xl bg-black/80 px-6 pt-6 pb-8">
              <div>
                <div className="absolute inset-x-0 bottom-full z-40 -mb-px flex justify-center">
                  <button
                    type="button"
                    onClick={() => setSelectedPlaceCommentsOpen((value) => !value)}
                    className="inline-flex rounded-t-xl rounded-b-none bg-black/55 px-4 py-2 text-center text-[12px] font-semibold uppercase tracking-[0.18em] text-white/75 hover:bg-black/60 active:bg-black/65"
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

                            trackEvent({
                              eventType: "click_detail_website",
                              placeId: selectedHomePlace.id,
                              city: selectedHomePlace.city,
                              category: selectedHomePlace.category,
                              locale,
                              metadata: { name: selectedHomePlace.name, url, source: selectedHomePlaceSource }
                            });

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
                              trackEvent({
                                eventType: "click_detail_copy_address",
                                placeId: selectedHomePlace.id,
                                city: selectedHomePlace.city,
                                category: selectedHomePlace.category,
                                locale,
                                metadata: { name: selectedHomePlace.name, source: selectedHomePlaceSource }
                              });
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
                        trackEvent({
                          eventType: "click_detail_view_on_map",
                          placeId: selectedHomePlace.id,
                          city: selectedHomePlace.city,
                          category: selectedHomePlace.category,
                          locale,
                          metadata: { name: selectedHomePlace.name }
                        });
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
                              trackEvent({
                                eventType: "click_search_result_detail",
                                placeId: item.id,
                                city: item.city,
                                category: item.category,
                                locale,
                                metadata: { name: item.name }
                              });
                              trackEvent({
                                eventType: "view_place_detail",
                                placeId: item.id,
                                city: item.city,
                                category: item.category,
                                locale,
                                metadata: { source: "search_result", name: item.name }
                              });
                              setSelectedHomePlaceSource("search_result");
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
                        trackEvent({
                          eventType: "click_search_results_map",
                          locale,
                          metadata: {
                            resultCount: (searchResults ?? []).length,
                            ids
                          }
                        });
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

      <BottomNavBar
        isFr={isFr}
        authProfile={authProfile}
        onOpenPersonal={() => setPanel("personalSpace")}
        onOpenContrib={() => setPanel("contrib")}
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
              ) : panel === "personalSpace" || panel === "profileInfo" || panel === "friends" || panel === "sharedLists" ? (
                <PersonalSpacePanel
                  isFr={isFr}
                  places={allPlaces}
                  mode={panel === "profileInfo" ? "profile" : panel === "friends" ? "friends" : panel === "sharedLists" ? "sharedLists" : "dashboard"}
                  initialSharedListId={initialSharedListId}
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
                  profileDisplayName={profileDisplayName}
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
                  onSetProfileDisplayName={setProfileDisplayName}
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



