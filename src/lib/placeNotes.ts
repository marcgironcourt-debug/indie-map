export const PLACE_NOTES_KEY = "im:place-notes";

export type PlaceNote = {
  visited?: boolean;
  visitedAt?: string;
  comment?: string;
  updatedAt?: string;
};

export function readPlaceNotes(): Record<string, PlaceNote> {
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

export function writePlaceNotes(notes: Record<string, PlaceNote>) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PLACE_NOTES_KEY, JSON.stringify(notes));
    window.dispatchEvent(new Event("im:place-notes-updated"));
  } catch {}
}
