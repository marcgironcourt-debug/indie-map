export const PLACE_NOTES_KEY = "im:place-notes";

export type PlaceNote = {
  visited?: boolean;
  visitedAt?: string;
  comment?: string;
  updatedAt?: string;
  friendComments?: Array<{
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    avatarColor: string | null;
    comment: string;
    updatedAt: string;
  }>;
};

function getPlaceNotesKey(userId?: string | null) {
  const cleanUserId = typeof userId === "string" ? userId.trim() : "";
  return cleanUserId ? `${PLACE_NOTES_KEY}:${cleanUserId}` : PLACE_NOTES_KEY;
}

export function readPlaceNotes(userId?: string | null): Record<string, PlaceNote> {
  try {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem(getPlaceNotesKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, PlaceNote>;
  } catch {
    return {};
  }
}

export function writePlaceNotes(notes: Record<string, PlaceNote>, userId?: string | null) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(getPlaceNotesKey(userId), JSON.stringify(notes));
    window.dispatchEvent(new Event("im:place-notes-updated"));
  } catch {}
}
