import { isOpenNowFR } from "@/lib/openingHours";

export type ContextSuggestionPlace = {
  id: string;
  category?: string;
  openingHours?: string;
  timeZone?: string;
  createdAt?: string;
  updatedAt?: string;
};

export function normalizeContextCategory(value: string | undefined) {
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

function getLocalHourAndDay(
  now: Date,
  timeZone?: string,
) {
  const fallback = {
    hour: now.getHours(),
    day: now.getDay(),
  };

  const zone = String(timeZone ?? "").trim();
  if (!zone) return fallback;

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);

    const hour = Number(
      parts.find((part) => part.type === "hour")?.value,
    );

    const weekday =
      parts.find((part) => part.type === "weekday")?.value ??
      "";

    const days: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

    const day = days[weekday];

    if (!Number.isFinite(hour) || day === undefined) {
      return fallback;
    }

    return {
      hour,
      day,
    };
  } catch {
    return fallback;
  }
}

export function getContextCategoryTargets(
  now: Date,
  timeZone?: string,
) {
  const { hour, day } = getLocalHourAndDay(
    now,
    timeZone,
  );

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
    targets.push(
      "marche",
      "ferme",
      "brunch",
      "librairie",
      "alternatif",
      "cafe",
    );
  }

  if (targets.length === 0) {
    targets.push("cafe", "restaurant", "boutique");
  }

  return [...new Set(targets)];
}

export function pickContextPlaces<
  T extends ContextSuggestionPlace,
>(
  list: T[],
  now: Date,
) {
  return list
    .map((item) => {
      const targets = getContextCategoryTargets(
        now,
        item.timeZone,
      );

      const normalized = normalizeContextCategory(
        item.category,
      );

      const targetIndex = targets.indexOf(normalized);
      const matchesCurrentContext = targetIndex >= 0;

      return {
        item,
        matchesCurrentContext,
        targetIndex: matchesCurrentContext
          ? targetIndex
          : Number.MAX_SAFE_INTEGER,
        updatedAt:
          Date.parse(
            item.updatedAt || item.createdAt || "",
          ) || 0,
      };
    })
    .sort((a, b) => {
      if (
        a.matchesCurrentContext !==
        b.matchesCurrentContext
      ) {
        return a.matchesCurrentContext ? -1 : 1;
      }

      if (a.targetIndex !== b.targetIndex) {
        return a.targetIndex - b.targetIndex;
      }

      return b.updatedAt - a.updatedAt;
    })
    .map((entry) => entry.item);
}

export function pickContextPlace<T extends ContextSuggestionPlace>(list: T[], now: Date) {
  return pickContextPlaces(list, now)[0] ?? null;
}

export function isContextSuggestionCandidateOpen(place: ContextSuggestionPlace) {
  const opening = String(place.openingHours ?? "").trim();
  const timeZone = String(place.timeZone ?? "").trim();
  if (!opening || !timeZone) return true;
  return isOpenNowFR(opening, timeZone) !== false;
}
