import fs from "node:fs";
import path from "node:path";

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export type PrivateSuggestionPatch = {
  homeTextNear?: string;
  homeTextFar?: string;
  translations?: {
    en?: {
      homeTextNear?: string;
      homeTextFar?: string;
    };
  };
};

export function readPrivateHomeSuggestionPatches(): Record<string, PrivateSuggestionPatch> {
  try {
    const filePath = path.join(process.cwd(), "data", "private", "home-suggestions.private.json");
    if (!fs.existsSync(filePath)) return {};

    const raw = fs.readFileSync(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isObj(parsed)) return {};

    const places = parsed.places;
    if (!isObj(places)) return {};

    const out: Record<string, PrivateSuggestionPatch> = {};

    for (const [id, value] of Object.entries(places)) {
      if (!isObj(value)) continue;

      const patch: PrivateSuggestionPatch = {};

      if (typeof value.homeTextNear === "string" && value.homeTextNear.trim()) {
        patch.homeTextNear = value.homeTextNear;
      }

      if (typeof value.homeTextFar === "string" && value.homeTextFar.trim()) {
        patch.homeTextFar = value.homeTextFar;
      }

      const tr = value.translations;
      if (isObj(tr) && isObj(tr.en)) {
        const enPatch: { homeTextNear?: string; homeTextFar?: string } = {};

        if (typeof tr.en.homeTextNear === "string" && tr.en.homeTextNear.trim()) {
          enPatch.homeTextNear = tr.en.homeTextNear;
        }

        if (typeof tr.en.homeTextFar === "string" && tr.en.homeTextFar.trim()) {
          enPatch.homeTextFar = tr.en.homeTextFar;
        }

        if (Object.keys(enPatch).length > 0) {
          patch.translations = { en: enPatch };
        }
      }

      if (Object.keys(patch).length > 0) {
        out[id] = patch;
      }
    }

    return out;
  } catch {
    return {};
  }
}

export function applyPrivateHomeSuggestionPatches<T>(places: T[]): T[] {
  const patches = readPrivateHomeSuggestionPatches();
  if (!Array.isArray(places) || places.length === 0 || Object.keys(patches).length === 0) {
    return places;
  }

  return places.map((place) => {
    if (!isObj(place)) return place;

    const id = typeof place.id === "string" ? place.id : "";
    if (!id) return place;

    const patch = patches[id];
    if (!patch) return place;

    const next: Record<string, unknown> = { ...place };

    if (patch.homeTextNear) next.homeTextNear = patch.homeTextNear;
    if (patch.homeTextFar) next.homeTextFar = patch.homeTextFar;

    if (patch.translations?.en) {
      const currentTranslations = isObj(next.translations) ? next.translations : {};
      const currentEn = isObj(currentTranslations.en) ? currentTranslations.en : {};
      next.translations = {
        ...currentTranslations,
        en: {
          ...currentEn,
          ...(patch.translations.en.homeTextNear ? { homeTextNear: patch.translations.en.homeTextNear } : {}),
          ...(patch.translations.en.homeTextFar ? { homeTextFar: patch.translations.en.homeTextFar } : {}),
        },
      };
    }

    return next as T;
  });
}
