const RECENT_VIEWED_PLACES_KEY =
  "im:recent-viewed-places:v1";

const MAX_STORED_RECENT_PLACES = 20;

export function readRecentViewedPlaceIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(
      RECENT_VIEWED_PLACES_KEY,
    );

    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    const seen = new Set<string>();

    return parsed
      .map((value) => String(value ?? "").trim())
      .filter((id) => {
        if (!id || seen.has(id)) return false;

        seen.add(id);
        return true;
      })
      .slice(0, MAX_STORED_RECENT_PLACES);
  } catch {
    return [];
  }
}

export function rememberRecentViewedPlace(
  placeIdRaw: unknown,
): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  const placeId =
    String(placeIdRaw ?? "").trim();

  if (!placeId) {
    return readRecentViewedPlaceIds();
  }

  const current =
    readRecentViewedPlaceIds();

  const next = [
    placeId,
    ...current.filter(
      (id) => id !== placeId,
    ),
  ].slice(0, MAX_STORED_RECENT_PLACES);

  try {
    window.localStorage.setItem(
      RECENT_VIEWED_PLACES_KEY,
      JSON.stringify(next),
    );

    window.dispatchEvent(
      new Event(
        "im:recent-viewed-places-updated",
      ),
    );
  } catch {}

  return next;
}
