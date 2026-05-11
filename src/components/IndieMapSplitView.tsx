"use client";
import React from "react";
import { useRouter } from "next/navigation";
import BottomNavBar from "@/components/BottomNavBar";
import MapPanel from "@/components/MapPanel";
import PersonalSpacePanel from "@/components/PersonalSpacePanel";
import ContributeForm from "@/components/ContributeForm";
import { readPlaceNotes, writePlaceNotes, type PlaceNote } from "@/lib/placeNotes";

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


function getCategoryStyle(cat: string, active: boolean): string {
  const key = cat.toLowerCase();


  if (key.includes("atelier")) {
    return active
      ? "bg-[#1E3A8A] text-white"
      : "bg-[#5C6E3B]/85 text-[#1E3A8A] border border-[#1E3A8A]/60";
  }
  if (key.includes("café") || key.includes("cafe")) {
    return active
      ? "bg-[hsl(var(--cafe))] text-white"
      : "bg-[#5C6E3B]/85 text-[hsl(var(--cafe))] border border-[hsl(var(--cafe))]/60";
  }

  if (key.includes("épicerie") || key.includes("epicerie")) {
    return active
      ? "bg-[#FF8FC7] text-black"
      : "bg-[#5C6E3B]/85 text-[#FF8FC7] border border-[#FF8FC7]/60";
  }


  if (key.includes("ferme") || key.includes("farm")) {
    return active
      ? "bg-[#F6FF00] text-black"
      : "bg-[#5C6E3B]/85 text-[#F6FF00] border border-[#F6FF00]/60";
  }

  if (key.includes("boutique")) {
    return active
      ? "bg-black text-white"
      : "bg-[#5C6E3B]/85 text-black border border-black/60";
  }

  if (key.includes("boulangerie")) {
    return active
      ? "bg-[#8C5A3C] text-white"
      : "bg-[#5C6E3B]/85 text-[#8C5A3C] border border-[#8C5A3C]/60";
  }

  if (
    key.includes("friperie") ||
    key.includes("mode éthique") ||
    key.includes("mode ethique") ||
    key.includes("vêtement") ||
    key.includes("vetement") ||
    key.includes("mode")
  ) {
    return active
      ? "bg-[hsl(var(--violet))] text-white"
      : "bg-[#5C6E3B]/85 text-[hsl(var(--violet))] border border-[hsl(var(--violet))]/60";
  }

  if (key.includes("restaurant")) {
    return active
      ? "bg-[hsl(var(--restaurant))] text-white"
      : "bg-[#5C6E3B]/85 text-[hsl(var(--restaurant))] border border-[hsl(var(--restaurant))]/60";
  }

  if (
    key.includes("microbrasserie") ||
    key.includes("brasserie") ||
    key.includes("bar") ||
    key.includes("pub")
  ) {
    return active
      ? "bg-[hsl(var(--micro))] text-white"
      : "bg-[#5C6E3B]/85 text-[hsl(var(--micro))] border border-[hsl(var(--micro))]/60";
  }

  if (key.includes("librairie") || key.includes("bouquinerie")) {
    return active
      ? "bg-[hsl(var(--blue))] text-white"
      : "bg-[#5C6E3B]/85 text-[hsl(var(--blue))] border border-[hsl(var(--blue))]/60";
  }

  if (key.includes("monument") || key.includes("poi")) {
    return active
      ? "bg-[hsl(var(--poi))] text-white"
      : "bg-[#5C6E3B]/85 text-[hsl(var(--poi))] border border-[hsl(var(--poi))]/60";
  }
  if (key.includes("lieu alternatif") || key.includes("lieu de vie")) {
    return active
      ? "bg-[#00F5FF] text-black"
      : "bg-[#5C6E3B]/85 text-[#00F5FF] border border-[#00F5FF]/60";
  }


  if (key.includes("marché") || key.includes("marche") || key.includes("market")) {
    return active
      ? "bg-[#39FF14] text-black"
      : "bg-[#5C6E3B]/85 text-[#39FF14] border border-[#39FF14]/60";
  }

  return active
    ? "bg-[hsl(var(--brand))] text-white"
    : "bg-[#5C6E3B]/85 text-[hsl(var(--brand))] border border-[hsl(var(--brand))]/60";
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



export default function IndieMapSplitView({ locale, discoverId, entry, searchIds }: { locale: UILocale; discoverId?: string | null; entry?: string | null; searchIds?: string | null }) {
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
  const [savedPlaces, setSavedPlaces] = React.useState<SavedPlace[]>(() => readSavedPlaces());
  const [placeNotes, setPlaceNotes] = React.useState<Record<string, PlaceNote>>({});
  const [selectedDetailPlace, setSelectedDetailPlace] = React.useState<Business | null>(null);
  const [addressCopied, setAddressCopied] = React.useState(false);
  const [selectedPlaceCommentsOpen, setSelectedPlaceCommentsOpen] = React.useState(false);
  const [selectedPlaceCommentInput, setSelectedPlaceCommentInput] = React.useState("");
  const [selectedPlaceCommentSaving, setSelectedPlaceCommentSaving] = React.useState(false);
  const [selectedPlaceCommentError, setSelectedPlaceCommentError] = React.useState("");
  const [savedPlaceIndexes, setSavedPlaceIndexes] = React.useState<Record<string, number>>({});
  const savedPlacesTouchStartXRef = React.useRef<number | null>(null);
  const savedPlacesTouchDeltaXRef = React.useRef(0);
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
  }, [locale]);

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
    const onOpenPlaceDetail = (event: Event) => {
      const id = String((event as CustomEvent<{ id?: string }>)?.detail?.id ?? "").trim();
      if (!id) return;
      const place = businesses.find((item) => String(item.id) === id);
      if (!place) return;
      setSelectedDetailPlace(place);
      setSelectedPlaceCommentsOpen(false);
      setSelectedPlaceCommentInput("");
      setSelectedPlaceCommentError("");
      setAddressCopied(false);
    };

    window.addEventListener("im:open-place-detail", onOpenPlaceDetail as EventListener);
    return () => window.removeEventListener("im:open-place-detail", onOpenPlaceDetail as EventListener);
  }, [businesses]);

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

    let cancelled = false;

    async function loadSavedPlacesFromServer() {
      try {
        const res = await fetch("/api/v1/me/saved-places", { cache: "no-store" });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok || !Array.isArray(data.places)) return;

        const ids = new Set(data.places.map((item: any) => String(item?.placeId ?? "").trim()).filter(Boolean));
        const next = businesses.filter((place) => ids.has(String(place.id)));

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
  }, [authProfile?.id, businesses, panel]);

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
  }, []);

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
          onOpenPersonal={() => setPanel("personalSpace")}
          onOpenContrib={() => setPanel("contrib")}
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
                        places={businesses}
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
                                      setPanel(null);
                                      setSelectedId(String(currentPlace.id));
                                      setSelectionVersion((v) => v + 1);
                                    }}
                                    onTouchStart={onSavedPlacesTouchStart}
                                    onTouchMove={onSavedPlacesTouchMove}
                                    onTouchEnd={() => onSavedPlacesTouchEnd(group.city, group.places.length)}
                                    className="relative w-full overflow-hidden rounded-xl bg-white/10 text-left hover:bg-white/14 active:bg-white/18 touch-pan-y"
                                    style={{
                                      minHeight: "148px",
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
              <button
                type="button"
                onClick={toggleSelectedDetailPlaceSaved}
                className="absolute left-4 z-[80] grid place-items-center"
                style={{
                  top: "calc(env(safe-area-inset-top) + 16px)",
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
            );
          })()}

          {selectedDetailPlace.panoramaImage ? (
            <img
              src={selectedDetailPlace.panoramaImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-white/10" />
          )}

          <div className="absolute inset-0 z-10 overflow-y-auto">
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
                        <div className="text-[14px] text-white/70">
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

                            window.open(url, "_blank");
                          }}
                          className="rounded-[9px] border border-white/10 bg-white/8 px-2 py-0.5 text-[11px] font-semibold text-white/75"
                        >
                          {isFr ? "Site web" : "Website"}
                        </button>
                      ) : null}
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
                              setAddressCopied(true);
                              window.setTimeout(() => setAddressCopied(false), 1500);
                            }
                          }}
                          className="rounded-[9px] border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-semibold text-white/75"
                        >
                          {addressCopied ? (isFr ? "Copié" : "Copied") : (isFr ? "Copier l'adresse" : "Copy address")}
                        </button>

                        {selectedDetailPlace?.phone ? (
                          <button
                            type="button"
                            onClick={() => {
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
                      {renderOpeningHours(selectedDetailPlace.openingHours, selectedDetailPlace.timeZone)}
                    </div>
                  ) : null}
                </div>

                {selectedDetailPlace.miniText ? (
                  <div className="mt-2">
                    <div className="mb-2 text-[12px] uppercase tracking-wide text-white/40">À propos</div>
                    <p className="text-[17px] leading-[1.7] text-white/90">
                      {selectedDetailPlace.miniText}
                    </p>
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
