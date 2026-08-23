"use client";
import { formatPlacePriceRange, type PlacePriceRange } from "@/lib/placePrice";
import { getCategoryStyle } from "@/lib/categoryStyle";
import React from "react";
import { useRouter } from "next/navigation";
import BottomNavBar from "@/components/BottomNavBar";
import MapPanel from "@/components/MapPanel";
import PersonalSpacePanel from "@/components/PersonalSpacePanel";
import ProfessionalSpacePanel from "@/components/ProfessionalSpacePanel";
import ContributeForm from "@/components/ContributeForm";
import { getAnalyticsHeaders, trackEvent } from "@/lib/analytics";
import { readPlaceNotes, writePlaceNotes, type PlaceNote } from "@/lib/placeNotes";
import { migrateLegacySavedPlacesToUser, readSavedPlacesStorage, setSavedPlacesUserId, syncSavedPlaceToServer, writeSavedPlacesStorage } from "@/lib/savedPlacesStorage";
import { getInstallationLocale, getOrCreateInstallationSessionId, readInstallationPushToken, rememberInstallationPushToken } from "@/lib/installationSession";
import {
  clearReferralToken,
  readReferralToken,
  rememberReferralToken,
} from "@/lib/referralStorage";

declare global {
  interface Window {
    __IM_PENDING_PUSH_TOKEN__?: string;
    __IM_REGISTER_PUSH_TOKEN__?: (token: string) => void;
  }
}

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

type SavedPlace = {
  id: string;
  name: string;
  city?: string;
  address?: string;
  panoramaImage?: string;
  lat?: number;
  lng?: number;
  createdAt?: string;
  updatedAt?: string;
};

type SharedListChoice = {
  id: string;
  title: string;
  places?: { placeId: string }[];
};



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

type UILocale = "fr" | "en";
const ui = (locale: UILocale, fr: string, en: string) => (locale === "en" ? en : fr);
const displayCategory = (locale: UILocale, cat: string) => {
  const c = String(cat || "").trim();
  if (locale !== "en") return c;
  const k = c.toLowerCase();
  if (k.includes("lieu alternatif") || k.includes("lieu de vie")) return "Alternative place";
  if (k.includes("ferme")) return "Farm";
  if (k.includes("marché") || k.includes("marche")) return "Market";
  if (k.includes("épicerie") || k.includes("epicerie")) return "Grocery";
  if (k.includes("café") || k.includes("cafe") || k.includes("coffee") || k.includes("brunch")) return "Coffee / brunch";
  if (k.includes("boulangerie")) return "Bakery";
  if (k.includes("librairie") || k.includes("bouquinerie")) return "Bookshop";
  if (k.includes("mode") || k.includes("friperie")) return "Fashion";
  if (k.includes("brasserie") || k.includes("microbrasserie") || k.includes("bar") || k.includes("pub")) return "Brewery / bar / pub";
  if (k.includes("atelier")) return "Workshop";
  if (k.includes("monument") || k.includes("poi")) return "Monument";
  if (k.includes("boutique")) return "Shop";
  if (k.includes("restaurant")) return "Restaurant";
  if (k.includes("lieu local")) return "Local place";
  return c;
};



function renderOpeningHours(openingHours: string | undefined, timeZone: string | undefined, locale: UILocale = "fr") {
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
    if (locale !== "en") return line;

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

type Business = {
  id: string;
  name: string;
  type: string;
  address?: string;
  website?: string;
  openingHours?: string;
  phone?: string;
  panoramaImage?: string;
  miniText?: string;
  timeZone?: string;
  lat?: number;
  lng?: number;
  city?: string;
  priceRange?: PlacePriceRange;
};

const DEMO: Business[] = [
  {
    id: "2",
    name: "Café Myriade",
    type: "Café / brunch",
    address: "1432 Rue Mackay, Montréal, QC H3G 2H7",
    website: "https://cafemyriade.com",
  },
];

function normalizeCategoryLabel(raw: string): string {
  const key = (raw || "").toLowerCase();

  if (key.includes("lieu alternatif") || key.includes("lieu de vie")) {
    return "Lieu alternatif";
  }

  if (key.includes("café") || key.includes("cafe") || key.includes("coffee") || key.includes("brunch")) {
    return "Café / brunch";
  }





  if (key.includes("épicerie") || key.includes("epicerie") || key.includes("zéro déchet") || key.includes("zero dechet")) {
    return "Épicerie";
  }

  if (key.includes("boulangerie")) {
    return "Boulangerie";
  }

  if (key.includes("librairie") || key.includes("bouquinerie")) {
    return "Librairie";
  }

  if (key.includes("restaurant") || key.includes("bistro") || key.includes("cuisine")) {
    return "Restaurant";
  }

  if (key.includes("microbrasserie") || key.includes("brasserie") || key.includes("pub") || key.includes("bar") || key.includes("bar à vin") || key.includes("bar a vin")) {
    return "Brasserie / bar / pub";
  }

  if (key.includes("friperie") || key.includes("mode éthique") || key.includes("mode ethique") || key.includes("vêtement") || key.includes("vetement") || key.includes("vêtements") || key.includes("vetements") || key.includes("textile") || key.includes("mode")) {
    return "Mode";
  }

  if (key.includes("atelier")) {
    return "Atelier";
  }

  if (key.includes("marché") || key.includes("marche") || key.includes("market") || key.includes("farmers market") || key.includes("public market") || key.includes("greenmarket")) {
    return "Marché";
  }

  
  if (key.includes("ferme") || key.includes("farm")) {
    return "Ferme";
  }

if (key.includes("boutique")) {
    return "Boutique";
  }

  return "Boutique";
}


function FilterPill({
  label,
  kind,
  active,
  onClick,
}: {
  label: string;
  
  kind?: string;
active: boolean;
  onClick: () => void;
}) {
  const styleClasses = getCategoryStyle((kind || label), active);
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "im-chip px-4 py-[4px] text-[13px] min-h-[28px] !rounded-2xl font-medium transition md:px-3 md:py-1 md:text-[11px] md:min-h-0 " + (active ? "im-chip-active " : "im-chip-idle ") + styleClasses
      }
    >
      {label}
    </button>
  );
}


function FilterBar({
  locale,
  categories,
  activeCategory,
  onCategoryChange,
}: {
  locale: UILocale;
  categories: string[];
  activeCategory: string | "ALL";
  onCategoryChange: (c: string | "ALL") => void;
}) {
  const rowClass =
    "flex items-center gap-2 px-0 py-2 overflow-x-auto overflow-y-visible whitespace-nowrap";

  return (
    <div
      className={rowClass}
      style={(
        {
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          scrollPaddingLeft: 0,
          scrollPaddingRight: 0,
        } as React.CSSProperties & { msOverflowStyle?: "none" | "auto" | "scrollbar" }
      )}>
      <FilterPill kind="ALL"
        label={ui(locale,"Tous","All")}
        active={activeCategory === "ALL"}
        onClick={() => onCategoryChange("ALL")}
        
      />

      {categories.map((c) => {
        const active = activeCategory === c;
        return (
          <FilterPill kind={c}
            key={c}
            label={displayCategory(locale, c)}
            active={active}
            onClick={() => onCategoryChange(c)}
            
          />
        );
      })}
    </div>
  );
}



export default function IndieMapSplitView({
  locale,
  discoverId,
  entry,
  searchIds,
}: {
  locale: UILocale;
  discoverId?: string | null;
  entry?: string | null;
  searchIds?: string | null;
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
  const [savedPlaces, setSavedPlaces] = React.useState<SavedPlace[]>(() => readSavedPlaces());
  const [serverSavedPlaceIds, setServerSavedPlaceIds] = React.useState<string[]>([]);
  const savedPlaceMutationIdsRef = React.useRef<Set<string>>(new Set());
  const [placeNotes, setPlaceNotes] = React.useState<Record<string, PlaceNote>>({});
  const [selectedDetailPlace, setSelectedDetailPlace] = React.useState<Business | null>(null);
  const [selectedDetailPlaceSource, setSelectedDetailPlaceSource] = React.useState("map");
  const [addressCopied, setAddressCopied] = React.useState(false);
  const [selectedPlaceCommentsOpen, setSelectedPlaceCommentsOpen] = React.useState(false);
  const [selectedPlaceCommentInput, setSelectedPlaceCommentInput] = React.useState("");
  const [selectedPlaceCommentSaving, setSelectedPlaceCommentSaving] = React.useState(false);
  const [selectedPlaceCommentError, setSelectedPlaceCommentError] = React.useState("");
  const [selectedPlaceSharedListPickerOpen, setSelectedPlaceSharedListPickerOpen] = React.useState(false);
  const [selectedPlaceSharedLists, setSelectedPlaceSharedLists] = React.useState<SharedListChoice[]>([]);
  const [selectedPlaceSharedListsLoading, setSelectedPlaceSharedListsLoading] = React.useState(false);
  const [selectedPlaceSharedListsSaving, setSelectedPlaceSharedListsSaving] = React.useState(false);
  const [selectedPlaceSharedListsError, setSelectedPlaceSharedListsError] = React.useState("");
  const [selectedPlaceSharedListsMessage, setSelectedPlaceSharedListsMessage] = React.useState("");
  const [selectedPlaceNewSharedListTitle, setSelectedPlaceNewSharedListTitle] = React.useState("");
  const [savedPlaceIndexes, setSavedPlaceIndexes] = React.useState<Record<string, number>>({});
  const savedPlacesTouchStartXRef = React.useRef<number | null>(null);
  const savedPlacesTouchDeltaXRef = React.useRef(0);
  const savedPlacesActionTouchRef = React.useRef(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selectionVersion, setSelectionVersion] = React.useState(0);
  const [businesses, setBusinesses] = React.useState<Business[]>([]);
  const [category, setCategory] = React.useState<string | "ALL">("ALL");
  const [heroOpen, setHeroOpen] = React.useState(false);
  const needsAtomicReveal = Boolean(discoverId) || entry === "explore";
  const [discoverUiReady, setDiscoverUiReady] = React.useState<boolean>(!needsAtomicReveal);

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

        const mergedSavedPlaceIds = Array.from(
          new Set([
            ...profileSavedPlaceIds,
            ...migratedSavedPlaces
              .map((place) => String(place?.id ?? "").trim())
              .filter(Boolean),
          ]),
        );

        setServerSavedPlaceIds(mergedSavedPlaceIds);
        setAuthProfile(user);
        setSavedPlacesUserId(user.id);
        setSavedPlaces(migratedSavedPlaces);
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
  }, [locale, router]);

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
    const onOpenPlaceDetail = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; source?: string }>)?.detail ?? {};
      const id = String(detail.id ?? "").trim();
      const source = String(detail.source ?? "map").trim() || "map";
      if (!id) return;
      const place = businesses.find((item) => String(item.id) === id);
      if (!place) return;
      trackEvent({
        eventType: "view_place_detail",
        placeId: place.id,
        city: place.city,
        category: place.type,
        locale,
        metadata: { name: place.name, source }
      });
      setSelectedDetailPlaceSource(source);
      setSelectedDetailPlace(place);
      setSelectedPlaceCommentsOpen(false);
      setSelectedPlaceCommentInput("");
      setSelectedPlaceCommentError("");
      setSelectedPlaceSharedListPickerOpen(false);
      setSelectedPlaceSharedLists([]);
      setSelectedPlaceSharedListsError("");
      setSelectedPlaceSharedListsMessage("");
      setSelectedPlaceNewSharedListTitle("");
      setAddressCopied(false);
    };

    window.addEventListener("im:open-place-detail", onOpenPlaceDetail as EventListener);
    return () => window.removeEventListener("im:open-place-detail", onOpenPlaceDetail as EventListener);
  }, [
    businesses,
    locale,
  ]);

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
    if (businesses.length === 0) return;

    const localSavedPlaces = readSavedPlaces(authProfile.id);
    const ids = new Set([
      ...serverSavedPlaceIds,
      ...localSavedPlaces
        .map((place) => String(place?.id ?? "").trim())
        .filter(Boolean),
    ]);

    if (savedPlaceMutationIdsRef.current.size > 0) return;

    const next = businesses.filter((place) =>
      ids.has(String(place.id)),
    );

    setSavedPlaces(next);
    writeSavedPlacesStorage(next, authProfile.id);
  }, [authProfile?.id, businesses, serverSavedPlaceIds]);

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
  }, [authProfile, panel]);

  React.useEffect(() => {
    if (!panel) return;
    window.requestAnimationFrame(() => {
      panelScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
  }, [panel]);

  React.useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);


  const savedPlacesByCity = React.useMemo(() => {
    const byId = new Map(businesses.map((place) => [place.id, place] as const));
    const groups = new Map<string, SavedPlace[]>();

    for (const place of savedPlaces) {
      const full = byId.get(place.id);
      const merged: SavedPlace = {
        ...place,
        city: place.city || full?.city || undefined,
        address: place.address || full?.address || undefined,
        panoramaImage: place.panoramaImage || full?.panoramaImage || undefined,
        lat: place.lat ?? full?.lat,
        lng: place.lng ?? full?.lng,
        createdAt: place.createdAt || undefined,
        updatedAt: place.updatedAt || undefined
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
  }, [savedPlaces, businesses, isFr]);

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

  function toggleSelectedDetailPlaceSaved() {
    if (!selectedDetailPlace?.id) return;

    const id = String(selectedDetailPlace.id);
    const exists = savedPlaces.some((item) => String(item.id) === id);
    savedPlaceMutationIdsRef.current.add(id);

    trackEvent({
      eventType: exists ? "unsave_place" : "save_place",
      placeId: selectedDetailPlace.id,
      city: selectedDetailPlace.city,
      category: selectedDetailPlace.type,
      locale,
      metadata: { name: selectedDetailPlace.name, source: selectedDetailPlaceSource }
    });

    const next = exists
      ? savedPlaces.filter((item) => String(item.id) !== id)
      : [
          {
            id,
            name: String(selectedDetailPlace.name ?? "").trim(),
            panoramaImage: String(selectedDetailPlace.panoramaImage ?? "").trim() || undefined,
            city: String(selectedDetailPlace.city ?? "").trim() || undefined,
            address: String(selectedDetailPlace.address ?? "").trim() || undefined,
            lat: Number.isFinite(Number(selectedDetailPlace.lat)) ? Number(selectedDetailPlace.lat) : undefined,
            lng: Number.isFinite(Number(selectedDetailPlace.lng)) ? Number(selectedDetailPlace.lng) : undefined
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

  async function reloadSelectedDetailPlaceSharedLists() {
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

  async function openSelectedDetailPlaceSharedListPicker() {
    if (!authProfile) {
      setPanel("personalSpace");
      return;
    }

    if (selectedDetailPlace?.id) {
      trackEvent({
        eventType: "open_shared_list_picker",
        placeId: selectedDetailPlace.id,
        city: selectedDetailPlace.city,
        category: selectedDetailPlace.type,
        locale,
        metadata: { name: selectedDetailPlace.name, source: selectedDetailPlaceSource }
      });
    }

    setSelectedPlaceSharedListPickerOpen(true);
    setSelectedPlaceSharedListsMessage("");
    await reloadSelectedDetailPlaceSharedLists();
  }

  async function addSelectedDetailPlaceToSharedList(listId: string) {
    if (!selectedDetailPlace?.id || !listId) return;

    setSelectedPlaceSharedListsSaving(true);
    setSelectedPlaceSharedListsMessage("");
    setSelectedPlaceSharedListsError("");

    try {
      const res = await fetch(`/api/v1/me/shared-lists/${encodeURIComponent(listId)}/places`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ placeId: String(selectedDetailPlace.id) })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error("shared_list_place_failed");
      }

      trackEvent({
        eventType: "add_place_to_shared_list",
        placeId: selectedDetailPlace.id,
        city: selectedDetailPlace.city,
        category: selectedDetailPlace.type,
        locale,
        metadata: { listId, name: selectedDetailPlace.name, source: selectedDetailPlaceSource }
      });

      setSelectedPlaceSharedListsMessage(isFr ? "Lieu ajouté à la liste." : "Place added to the list.");
      await reloadSelectedDetailPlaceSharedLists();
    } catch {
      setSelectedPlaceSharedListsError(isFr ? "Impossible d’ajouter ce lieu." : "Unable to add this place.");
    } finally {
      setSelectedPlaceSharedListsSaving(false);
    }
  }

  async function createSharedListAndAddSelectedDetailPlace() {
    if (!selectedDetailPlace?.id) return;

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
        body: JSON.stringify({ placeId: String(selectedDetailPlace.id) })
      });

      const addData = await addRes.json().catch(() => null);

      if (!addRes.ok || !addData?.ok) {
        throw new Error("shared_list_place_failed");
      }

      trackEvent({
        eventType: "create_shared_list",
        placeId: selectedDetailPlace.id,
        city: selectedDetailPlace.city,
        category: selectedDetailPlace.type,
        locale,
        metadata: { listId: createData.listId, title, source: selectedDetailPlaceSource }
      });

      trackEvent({
        eventType: "add_place_to_shared_list",
        placeId: selectedDetailPlace.id,
        city: selectedDetailPlace.city,
        category: selectedDetailPlace.type,
        locale,
        metadata: { listId: createData.listId, name: selectedDetailPlace.name, source: selectedDetailPlaceSource }
      });

      setSelectedPlaceNewSharedListTitle("");
      setSelectedPlaceSharedListsMessage(isFr ? "Liste créée et lieu ajouté." : "List created and place added.");
      await reloadSelectedDetailPlaceSharedLists();
    } catch {
      setSelectedPlaceSharedListsError(isFr ? "Impossible de créer cette liste." : "Unable to create this list.");
    } finally {
      setSelectedPlaceSharedListsSaving(false);
    }
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

  async function saveSelectedDetailPlaceComment() {
    if (!selectedDetailPlace?.id || !authProfile) return;

    const placeId = String(selectedDetailPlace.id);
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

  function onSavedPlacesTouchStart(e: React.TouchEvent<HTMLElement>) {
    savedPlacesTouchStartXRef.current = e.touches[0]?.clientX ?? null;
    savedPlacesTouchDeltaXRef.current = 0;
  }

  function onSavedPlacesTouchMove(e: React.TouchEvent<HTMLElement>) {
    const startX = savedPlacesTouchStartXRef.current;
    if (startX == null) return;
    const currentX = e.touches[0]?.clientX ?? startX;
    savedPlacesTouchDeltaXRef.current = currentX - startX;
  }

  function onSavedPlacesTouchEnd(city: string, length: number) {
    if (savedPlacesActionTouchRef.current) {
      savedPlacesActionTouchRef.current = false;
      savedPlacesTouchStartXRef.current = null;
      savedPlacesTouchDeltaXRef.current = 0;
      return;
    }

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

  React.useEffect(() => {
    type HeroDetail = { open?: boolean };
    const fn = (e: Event) => {
      const ce = e as CustomEvent<HeroDetail>;
      setHeroOpen(Boolean(ce.detail?.open));
    };
    try { window.addEventListener("im:hero", fn); } catch {}
    return () => { try { window.removeEventListener("im:hero", fn); } catch {} };
  }, [locale]);
  React.useEffect(() => {
    if (!discoverId) return;
    if (!businesses.some((b) => String(b.id) === String(discoverId))) return;
    setSelectedId(String(discoverId));
    setSelectionVersion((v) => v + 1);
  }, [discoverId, businesses]);

  React.useEffect(() => {
    setDiscoverUiReady(!needsAtomicReveal);
  }, [needsAtomicReveal]);

  React.useEffect(() => {
    if (!needsAtomicReveal) return;
    let revealTimer: number | null = null;
    const reveal = () => {
      try {
        if (revealTimer) window.clearTimeout(revealTimer);
      } catch {}
      setDiscoverUiReady(true);
    };
    const onDiscoverReady = (e: Event) => {
      try {
        const ce = e as CustomEvent<{ id?: string }>;
        if (discoverId && String(ce.detail?.id ?? "") !== String(discoverId)) return;
        reveal();
      } catch {}
    };
    const onMapReady = () => reveal();
    try { window.addEventListener("im:discover-ui-ready", onDiscoverReady as EventListener); } catch {}
    try { window.addEventListener("im:map-ui-ready", onMapReady as EventListener); } catch {}
    const t = window.setTimeout(reveal, 1800);
    return () => {
      try {
        window.clearTimeout(t);
        if (revealTimer) window.clearTimeout(revealTimer);
      } catch {}
      try { window.removeEventListener("im:discover-ui-ready", onDiscoverReady as EventListener); } catch {}
      try { window.removeEventListener("im:map-ui-ready", onMapReady as EventListener); } catch {}
    };
  }, [discoverId, needsAtomicReveal]);

React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/v1/places?locale=" + encodeURIComponent(locale));
        if (!r.ok) throw new Error(ui(locale,"Erreur de chargement","Loading error"));
        const j = await r.json();
        const arr = Array.isArray(j) ? j : j?.data || [];
        const list: Business[] = arr.map((p: {
          id: string;
          name: string;
          category?: string;
          address?: string;
          website?: string;
          openingHours?: string;
          opening_hours?: string;
          openinghours?: string;
          lat?: number;
          lng?: number;
          city?: string;
          phone?: string;
          panoramaImage?: string;
          miniText?: string;
          blurb?: string;
          description?: string;
          timeZone?: string;
          priceRange?: PlacePriceRange;
        }) => ({
          id: p.id,
          name: p.name,
          type: normalizeCategoryLabel(p.category ?? "Lieu local"),
          address: p.address ?? p.city ?? "",
          website: p.website,
          phone: p.phone ?? "",
          panoramaImage: p.panoramaImage ?? "",
          miniText: p.miniText ?? p.blurb ?? p.description ?? "",
          timeZone: p.timeZone ?? "",
          priceRange: p.priceRange,
          openingHours:
            typeof p.openingHours === "string"
              ? p.openingHours
              : typeof p.opening_hours === "string"
              ? p.opening_hours
              : typeof p.openinghours === "string"
              ? p.openinghours
              : undefined,
          lat: typeof p.lat === "number" ? p.lat : undefined,
          lng: typeof p.lng === "number" ? p.lng : undefined,
          city: p.city ?? "",
        }));
        if (!cancelled) setBusinesses(list);
      } catch {
        if (!cancelled) setBusinesses(DEMO);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale]);
  const hasData = businesses.length > 0;
  const source = hasData ? businesses : DEMO;
  const rawCategories = Array.from(
    new Set(
      source
        .map((b) => b.type)
        .filter((t) => !!t && t.trim().length > 0)
    )
  );

  const isClothing = (t: string) => {
    const k = t.toLowerCase();
    return (
      k.includes("friperie") ||
      k.includes("mode éthique") ||
      k.includes("mode ethique")
    );
  };

  const isBook = (t: string) => {
    const k = t.toLowerCase();
    return (
      k.includes("librairie") ||
      k.includes("bouquinerie") ||
      k.includes("spécialisée") ||
      k.includes("specialisee")
    );
  };

  const isGrocery = (t: string) => {
    const k = t.toLowerCase();
    return (
      k.includes("épicerie locale") ||
      k.includes("epicerie locale") ||
      k.includes("épicerie zéro") ||
      k.includes("epicerie zero") ||
      k.includes("zero déchet") ||
      k.includes("zerodechet") ||
      k.includes("épicerie") ||
      k.includes("epicerie")
    );
  };

  const isRestaurant = (t: string) => {
    const k = t.toLowerCase();
    return (
      k.includes("restaurant locavore") ||
      k.includes("restaurant lacovore") ||
      k.includes("restaurant locavore abordable") ||
      k.includes("bistrot terroir") ||
      k.includes("bistro terroir") ||
      k.includes("bistrot terroir et local") ||
      k.includes("bistro terroir et local") ||
      k.includes("cuisine du marché") ||
      k.includes("cuisine du marche") ||
      k.includes("restaurant")
    );
  };

  const isBakery = (t: string) => {
    const k = t.toLowerCase();
    return k.includes("boulangerie");
  };

  const isAtelier = (t: string) => {
    const k = t.toLowerCase();
    return k.includes("atelier");
  };

  const isMarket = (t: string) => {
    const k = t.toLowerCase();
    return (
      k.includes("marché") ||
      k.includes("marche") ||
      k.includes("market") ||
      k.includes("farmers market") ||
      k.includes("farmer\x27s market") ||
      k.includes("greenmarket") ||
      k.includes("public market")
    );
  };

  const hasBook = rawCategories.some(isBook);
  const hasGrocery = rawCategories.some(isGrocery);
  const hasRestaurant = rawCategories.some(isRestaurant);
  const hasBakery = rawCategories.some(isBakery);
  const hasAtelier = rawCategories.some(isAtelier);
  const hasMarket = rawCategories.some(isMarket);

  const stableCategories = [
    "Restaurant",
    "Lieu alternatif",
    "Ferme",
    "Marché",
    "Épicerie",
    "Café / brunch",
    "Boulangerie",
    "Librairie",
    "Mode",
    "Brasserie / bar / pub",
    "Atelier",
    "Boutique",
    "Monument",
  ];
  let categories = [
    ...rawCategories.filter(
      (t) =>
        !isClothing(t) &&
        !isBook(t) &&
        !isGrocery(t) &&
        !isRestaurant(t) &&
        !isBakery(t) &&
        !isAtelier(t) &&
        !isMarket(t)
    ),
    ...(hasBook ? ["Librairie"] : []),
    ...(hasGrocery ? ["Épicerie"] : []),
    ...(hasRestaurant ? ["Restaurant"] : []),
    ...(hasBakery ? ["Boulangerie"] : []),
    ...(hasAtelier ? ["Atelier"] : []),
    ...(hasMarket ? ["Marché"] : []),
  ];

  if (!categories.includes("Ferme")) categories.push("Ferme");
  if (!categories.includes("Marché")) categories.push("Marché");
  if (!categories.includes("Lieu alternatif")) categories.push("Lieu alternatif");
  categories = Array.from(new Set(categories));

  const priority = ["Restaurant", "Lieu alternatif", "Ferme", "Marché", "Épicerie"]; 
  categories = [
    ...priority.filter((x) => categories.includes(x)),
    ...categories.filter((x) => !priority.includes(x)),
  ];

  

  if (!hasData) categories = stableCategories;

  const searchIdSet = React.useMemo(() => {
    if (!searchIds) return null;
    const ids = searchIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    return ids.length > 0 ? new Set(ids) : null;
  }, [searchIds]);

const filtered = source.filter((b) => {
    if (searchIdSet && !searchIdSet.has(String(b.id))) return false;
    const k = (b.type || "").toLowerCase();

    if (category == null || category === "ALL") return true;

    if (category === "Librairie") {
      return (
        k.includes("librairie") ||
        k.includes("bouquinerie") ||
        k.includes("spécialisée") ||
        k.includes("specialisee")
      );
    }

    if (category === "Épicerie") {
      return (
        k.includes("épicerie locale") ||
        k.includes("epicerie locale") ||
        k.includes("épicerie zéro") ||
        k.includes("epicerie zero") ||
        k.includes("zero déchet") ||
        k.includes("zerodechet") ||
        k.includes("épicerie") ||
        k.includes("epicerie")
      );
    }

    if (category === "Restaurant") {
      return (
        k.includes("restaurant locavore") ||
        k.includes("restaurant lacovore") ||
        k.includes("restaurant locavore abordable") ||
        k.includes("bistrot terroir") ||
        k.includes("bistro terroir") ||
        k.includes("bistrot terroir et local") ||
        k.includes("bistro terroir et local") ||
        k.includes("cuisine du marché") ||
        k.includes("cuisine du marche") ||
        k.includes("restaurant")
      );
    }

    if (category === "Lieu alternatif") {
      return k.includes("alternatif") || k.includes("alternative");
    }

    if (category === "Marché") {
      return (
        k.includes("marché") ||
        k.includes("marche") ||
        k.includes("market") ||
        k.includes("farmers market") ||
        k.includes("farmer\x27s market") ||
        k.includes("greenmarket") ||
        k.includes("public market")
      );
    }

    if (category === "Boulangerie") {
      return k.includes("boulangerie");
    }

    if (category === "Atelier") {
      return k.includes("atelier");
    }

    return b.type === category;
  });

            return (
    <div className="h-full w-full relative">
      <div className="absolute inset-0">
        <MapPanel
          items={filtered}
          selectedId={selectedId}
          selectionVersion={selectionVersion}
          overlaysReady={discoverUiReady}
          searchMode={Boolean(searchIdSet)}
          homeOverlay={!heroOpen && !selectedDetailPlace ? (
            <div
              className="absolute z-[1450] pointer-events-auto"
              style={{ right: "12px", top: "calc(env(safe-area-inset-top) + 64px)" }}
            >
              <div className="flex flex-col items-center">
                <a
                  href={`/${locale}`}
                  aria-label={locale === "en" ? "Back to home" : "Retour à l'accueil"}
                  className="flex items-center justify-center w-11 h-11 rounded-xl bg-[#262626] text-white shadow-lg border border-[#404040]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 4l9 6.5M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9" />
                  </svg>
                </a>
              </div>
            </div>
          ) : null}
          topOverlay={!heroOpen && !selectedDetailPlace ? (
            <div className="absolute left-0 right-0 z-[1400] pointer-events-none" style={{ top: "env(safe-area-inset-top)" }}>
              <div id="im-filters" className="pointer-events-auto w-screen overflow-visible">
                <FilterBar locale={locale} categories={categories}
                activeCategory={category}
                onCategoryChange={setCategory} />
              </div>
            </div>
          ) : null}
          onSelect={(id) => {
            if (!id) {
              setSelectedId(null);
              return;
            }
            setSelectedId(id);
            setSelectionVersion((v) => v + 1);
          }}          />
      </div>

      {!heroOpen && !selectedDetailPlace ? (
        <BottomNavBar
          isFr={isFr}
          authProfile={authProfile}
        professionalPlace={
          businesses.find(
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
      ) : null}

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
                        places={businesses}
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
                        visitedCitiesCount={new Set(Object.entries(placeNotes).filter(([, note]) => note?.visited).map(([id]) => (businesses.find((item) => item.id === id)?.city || savedPlaces.find((item) => item.id === id)?.city || "").trim()).filter(Boolean)).size}
                        visitedThisMonthCount={Object.values(placeNotes).filter((note) => {
                          if (!note?.visited || !note.visitedAt) return false;
                          const visited = new Date(note.visitedAt);
                          const now = new Date();
                          return visited.getFullYear() === now.getFullYear() && visited.getMonth() === now.getMonth();
                        }).length}
                        onModeChange={(mode) => setPanel(mode === "profile" ? "profileInfo" : mode === "friends" ? "friends" : mode === "sharedLists" ? "sharedLists" : "personalSpace")}
                        onOpenSavedPlaces={() => setPanel("myPlacesList")}
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
                        hasProfessionalAccess={Boolean((authProfile as { hasProfessionalAccess?: boolean } | null)?.hasProfessionalAccess)}
                        onOpenProfessionalSpace={() => setPanel("pros")}
                        onLogout={logoutAuth}
                        onOpenPlace={(place, source) => {
                          const detailPlace = businesses.find((item) => String(item.id) === String(place.id));
                          if (!detailPlace) return;
                          const viewSource = String(source || "personal_space").trim() || "personal_space";
                          trackEvent({
                            eventType: "view_place_detail",
                            placeId: detailPlace.id,
                            city: detailPlace.city,
                            category: detailPlace.type,
                            locale,
                            metadata: { name: detailPlace.name, source: viewSource }
                          });
                          setSelectedDetailPlaceSource(viewSource);
                          setSelectedDetailPlace(detailPlace);
                          setPanel(null);
                          setSelectedPlaceCommentsOpen(false);
                          setSelectedPlaceCommentInput("");
                          setSelectedPlaceCommentError("");
                          setAddressCopied(false);
                        }}
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
                          <div className="grid grid-cols-2 gap-4">
                            {savedPlacesByCity.map((group) => {
                              const currentIndex = savedPlaceIndexes[group.city] ?? 0;
                              const currentPlace = group.places[currentIndex] ?? group.places[0] ?? null;
                              if (!currentPlace) return null;

                              return (
                                <div key={group.city}>
                                  <h2 className="mb-2 text-sm font-semibold tracking-wide text-white/80">{group.city}</h2>
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => {
                                      const detailPlace = businesses.find((item) => String(item.id) === String(currentPlace.id));
                                      if (!detailPlace) return;
                                      trackEvent({
                                        eventType: "view_place_detail",
                                        placeId: detailPlace.id,
                                        city: detailPlace.city,
                                        category: detailPlace.type,
                                        locale,
                                        metadata: { name: detailPlace.name, source: "personal_space_saved_place" }
                                      });
                                      setSelectedDetailPlaceSource("personal_space_saved_place");
                                      setSelectedDetailPlace(detailPlace);
                                      setPanel(null);
                                      setSelectedPlaceCommentsOpen(false);
                                      setSelectedPlaceCommentInput("");
                                      setSelectedPlaceCommentError("");
                                      setAddressCopied(false);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key !== "Enter" && e.key !== " ") return;
                                      e.preventDefault();

                                      const detailPlace = businesses.find((item) => String(item.id) === String(currentPlace.id));
                                      if (!detailPlace) return;
                                      trackEvent({
                                        eventType: "view_place_detail",
                                        placeId: detailPlace.id,
                                        city: detailPlace.city,
                                        category: detailPlace.type,
                                        locale,
                                        metadata: { name: detailPlace.name, source: "personal_space_saved_place" }
                                      });
                                      setSelectedDetailPlaceSource("personal_space_saved_place");
                                      setSelectedDetailPlace(detailPlace);
                                      setPanel(null);
                                      setSelectedPlaceCommentsOpen(false);
                                      setSelectedPlaceCommentInput("");
                                      setSelectedPlaceCommentError("");
                                      setAddressCopied(false);
                                    }}
                                    onTouchStart={onSavedPlacesTouchStart}
                                    onTouchMove={onSavedPlacesTouchMove}
                                    onTouchEnd={() => onSavedPlacesTouchEnd(group.city, group.places.length)}
                                    className="relative block w-full overflow-hidden rounded-xl bg-white/10 text-left hover:bg-white/14 active:bg-white/18 touch-pan-y"
                                    style={{
                                      minHeight: "148px",
                                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -6px 14px rgba(0,0,0,0.16), 0 14px 30px rgba(0,0,0,0.20), 0 40px 90px rgba(0,0,0,0.14)"
                                    }}
                                  >
                                    {currentPlace.panoramaImage ? (
                                      <img
                                        src={currentPlace.panoramaImage}
                                        alt=""
                                        className="absolute inset-x-0 top-0 h-[60vh] w-full bg-black object-contain"
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
                                        savedPlacesActionTouchRef.current = true;
                                        e.stopPropagation();
                                      }}
                                      onPointerUp={(e) => {
                                        e.stopPropagation();
                                      }}
                                      onTouchStart={(e) => {
                                        savedPlacesActionTouchRef.current = true;
                                        e.stopPropagation();
                                      }}
                                      onTouchEnd={(e) => {
                                        savedPlacesActionTouchRef.current = true;
                                        e.stopPropagation();
                                      }}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();

                                        const id = String(currentPlace.id);
                                        setPlaceNotes((prev) => {
                                          const isVisited = Boolean(prev[id]?.visited);
                                          const now = new Date().toISOString();
                                          const nextNotes: Record<string, PlaceNote> = {
                                            ...prev,
                                            [id]: {
                                              ...(prev[id] ?? {}),
                                              visited: !isVisited,
                                              visitedAt: isVisited ? undefined : now,
                                              updatedAt: now
                                            }
                                          };

                                          writePlaceNotes(nextNotes, authProfile?.id ?? null);
                                          void syncPlaceNoteToServer(id, nextNotes[id]);

                                          return nextNotes;
                                        });
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key !== "Enter" && e.key !== " ") return;
                                        e.preventDefault();
                                        e.stopPropagation();

                                        const id = String(currentPlace.id);
                                        setPlaceNotes((prev) => {
                                          const isVisited = Boolean(prev[id]?.visited);
                                          const now = new Date().toISOString();
                                          const nextNotes: Record<string, PlaceNote> = {
                                            ...prev,
                                            [id]: {
                                              ...(prev[id] ?? {}),
                                              visited: !isVisited,
                                              visitedAt: isVisited ? undefined : now,
                                              updatedAt: now
                                            }
                                          };

                                          writePlaceNotes(nextNotes, authProfile?.id ?? null);
                                          void syncPlaceNoteToServer(id, nextNotes[id]);

                                          return nextNotes;
                                        });
                                      }}
                                      className={placeNotes[String(currentPlace.id)]?.visited ? "absolute left-3 top-3 z-20 rounded-full bg-yellow-400 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-black shadow-[0_8px_18px_rgba(0,0,0,0.25)]" : "absolute left-3 top-3 z-20 rounded-full border border-white/35 bg-black/35 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/85 backdrop-blur-sm"}
                                    >
                                      {placeNotes[String(currentPlace.id)]?.visited ? (isFr ? "Visité" : "Visited") : (isFr ? "À visiter" : "To visit")}
                                    </div>
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
                                  </div>
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

      {selectedDetailPlace ? (
        <div className="fixed inset-0 z-[2200] overflow-hidden bg-[#2f2f2f] text-white">
          {(() => {
            const selectedDetailPlaceSaved = savedPlaces.some((item) => String(item.id) === String(selectedDetailPlace.id));

            return (
              <div className="absolute left-4 z-[80] flex flex-col gap-3" style={{ top: "calc(env(safe-area-inset-top) + 16px)" }}>
                <button
                  type="button"
                  onClick={toggleSelectedDetailPlaceSaved}
                  className="grid place-items-center"
                  style={{
                    width: 40,
                    height: 40,
                    background: "rgba(0,0,0,0.35)",
                    backdropFilter: "blur(8px)",
                    borderRadius: "9999px",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#ffffff",
                    padding: 0
                  }}
                  aria-label={selectedDetailPlaceSaved ? (isFr ? "Retirer des favoris" : "Remove from favorites") : (isFr ? "Ajouter aux favoris" : "Add to favorites")}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="22"
                    height="22"
                    fill={selectedDetailPlaceSaved ? "#6F6528" : "none"}
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
                  onClick={openSelectedDetailPlaceSharedListPicker}
                  className="grid place-items-center"
                  style={{
                    width: 40,
                    height: 40,
                    background: "rgba(0,0,0,0.35)",
                    backdropFilter: "blur(8px)",
                    borderRadius: "9999px",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#ffffff",
                    padding: 0
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
                  <p className="text-[14px] text-white/55">{isFr ? "Chargement..." : "Loading..."}</p>
                ) : selectedPlaceSharedLists.length > 0 ? (
                  <div className="space-y-2">
                    {selectedPlaceSharedLists.map((list) => {
                      const alreadyAdded = Array.isArray(list.places) && list.places.some((place) => String(place.placeId) === String(selectedDetailPlace.id));

                      return (
                        <button
                          key={list.id}
                          type="button"
                          onClick={() => addSelectedDetailPlaceToSharedList(list.id)}
                          disabled={selectedPlaceSharedListsSaving || alreadyAdded}
                          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-left text-white disabled:opacity-45"
                        >
                          <span className="min-w-0 truncate text-[15px] font-semibold">{list.title}</span>
                          <span className="shrink-0 text-[12px] uppercase tracking-[0.14em] text-white/45">
                            {alreadyAdded ? (isFr ? "Déjà ajouté" : "Added") : (isFr ? "Ajouter" : "Add")}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[14px] leading-relaxed text-white/55">
                    {isFr ? "Tu n’as pas encore de liste partagée." : "You do not have any shared list yet."}
                  </p>
                )}

                <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
                    {isFr ? "Nouvelle liste" : "New list"}
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={selectedPlaceNewSharedListTitle}
                      onChange={(event) => setSelectedPlaceNewSharedListTitle(event.target.value)}
                      placeholder={isFr ? "Ex. Week-end à Montréal" : "Ex. Weekend in Montreal"}
                      className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/35 px-4 py-2 text-[14px] text-white outline-none placeholder:text-white/30"
                    />
                    <button
                      type="button"
                      onClick={createSharedListAndAddSelectedDetailPlace}
                      disabled={selectedPlaceSharedListsSaving}
                      className="rounded-full bg-[#F97316] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-white disabled:opacity-45"
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

          {selectedDetailPlace.panoramaImage ? (
            <img
              src={selectedDetailPlace.panoramaImage}
              alt=""
              className="absolute inset-x-0 top-0 h-[60vh] w-full bg-black object-contain"
            />
          ) : (
            <div className="absolute inset-x-0 top-0 h-[60vh] bg-black" />
          )}

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 top-[60vh] bg-black"
          />

          <div className="absolute inset-0 z-10 overflow-y-auto overscroll-y-none">
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
                        const note = placeNotes[String(selectedDetailPlace.id)];
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
                                      onClick={saveSelectedDetailPlaceComment}
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
                    {selectedDetailPlace.name}
                  </div>

                  {(selectedDetailPlace.type || selectedDetailPlace.website) ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {selectedDetailPlace.type ? (
                        <div className="text-[14px] font-semibold text-white/70">
                          {displayCategory(locale, selectedDetailPlace.type)}
                        </div>
                      ) : null}

                      {selectedDetailPlace.website ? (
                        <button
                          type="button"
                          onClick={() => {
                            const website = selectedDetailPlace.website ?? "";
                            const url =
                              website.startsWith("http://") ||
                              website.startsWith("https://")
                                ? website
                                : `https://${website}`;

                            trackEvent({
                              eventType: "click_detail_website",
                              placeId: selectedDetailPlace.id,
                              city: selectedDetailPlace.city,
                              category: selectedDetailPlace.type,
                              locale,
                              metadata: { name: selectedDetailPlace.name, url, source: selectedDetailPlaceSource }
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

                  {selectedDetailPlace.priceRange ? (
                    <div className="mt-2 text-[13px] font-normal text-white/80">
                      {formatPlacePriceRange(selectedDetailPlace.priceRange, locale)}
                    </div>
                  ) : null}

                  {selectedDetailPlace.address ? (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <div className="text-[16px] font-serif leading-relaxed text-[#F97316]">
                        {selectedDetailPlace.address}
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const address = encodeURIComponent(selectedDetailPlace.address ?? "");
                            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                            const isAndroid = /Android/.test(navigator.userAgent);

                            trackEvent({
                              eventType: "click_detail_itinerary",
                              placeId: selectedDetailPlace.id,
                              city: selectedDetailPlace.city,
                              category: selectedDetailPlace.type,
                              locale,
                              metadata: { name: selectedDetailPlace.name, source: selectedDetailPlaceSource }
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
                            const text = selectedDetailPlace.address ?? "";
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
                                placeId: selectedDetailPlace.id,
                                city: selectedDetailPlace.city,
                                category: selectedDetailPlace.type,
                                locale,
                                metadata: { name: selectedDetailPlace.name, source: selectedDetailPlaceSource }
                              });
                              setAddressCopied(true);
                              window.setTimeout(() => setAddressCopied(false), 1500);
                            }
                          }}
                          className="rounded-[9px] border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-semibold text-white/75"
                        >
                          {addressCopied ? (isFr ? "Copié" : "Copied") : (isFr ? "Copier l'adresse" : "Copy address")}
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            const shareUrl = `https://www.indie-map.com/${locale}/carte?discover=${encodeURIComponent(selectedDetailPlace.id)}`;
                            const shareData = {
                              title: selectedDetailPlace.name,
                              text: isFr ? `Découvre ${selectedDetailPlace.name} sur Indie Map.` : `Discover ${selectedDetailPlace.name} on Indie Map.`,
                              url: shareUrl
                            };

                            trackEvent({
                              eventType: "click_detail_share",
                              placeId: selectedDetailPlace.id,
                              city: selectedDetailPlace.city,
                              category: selectedDetailPlace.type,
                              locale,
                              metadata: { name: selectedDetailPlace.name, url: shareUrl, source: selectedDetailPlaceSource }
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

                        {selectedDetailPlace?.phone ? (
                          <button
                            type="button"
                            onClick={() => {
                              trackEvent({
                                eventType: "click_detail_phone",
                                placeId: selectedDetailPlace.id,
                                city: selectedDetailPlace.city,
                                category: selectedDetailPlace.type,
                                locale,
                                metadata: { name: selectedDetailPlace.name, source: selectedDetailPlaceSource }
                              });
                              window.location.href = `tel:${selectedDetailPlace.phone}`;
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

                  {selectedDetailPlace.openingHours ? (
                    <div className="mt-5">
                      {renderOpeningHours(selectedDetailPlace.openingHours, selectedDetailPlace.timeZone, locale)}
                    </div>
                  ) : null}
                </div>

                {selectedDetailPlace.miniText ? (
                  <div className="mt-2">
                    <div className="mb-2 text-[12px] uppercase tracking-wide text-white/40">À propos</div>
                    <p className="text-[17px] leading-[1.7] text-white/90">
                      {selectedDetailPlace.miniText}
                    </p>

                    {Number.isFinite(Number(selectedDetailPlace.lat)) && Number.isFinite(Number(selectedDetailPlace.lng)) ? (
                      <button
                        type="button"
                        onClick={() => {
                          trackEvent({
                            eventType: "click_detail_view_on_map",
                            placeId: selectedDetailPlace.id,
                            city: selectedDetailPlace.city,
                            category: selectedDetailPlace.type,
                            locale,
                            metadata: { name: selectedDetailPlace.name, source: selectedDetailPlaceSource }
                          });
                          setSelectedId(String(selectedDetailPlace.id));
                          setSelectedDetailPlace(null);
                          setSelectedPlaceCommentsOpen(false);
                        }}
                        className="relative mt-6 block h-[108px] w-full overflow-hidden rounded-2xl bg-[#101510] text-white"
                      >
                        <div
                          className="absolute -inset-1 pointer-events-none scale-[1.03]"
                          style={{ filter: "blur(1.4px)" }}
                        >
                          <MapPanel
                            items={[selectedDetailPlace]}
                            overlaysReady={true}
                            hideGeolocate={true}
                              searchMode={true}
                          />
                        </div>

                        <div className="absolute inset-0 bg-black/25" />

                        <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between bg-gradient-to-t from-black/85 via-black/40 to-transparent px-5 pb-4 pt-9">
                          <div className="text-left">
                            <div className="font-serif text-[20px] font-medium tracking-[0.01em]">
                              {isFr ? "Voir sur la carte" : "View on map"}
                            </div>
                          </div>

                          <div className="pb-[1px] text-[24px] leading-none">→</div>
                        </div>
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedDetailPlace(null);
              setSelectedPlaceCommentsOpen(false);
            }}
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

    </div>
  );
}
