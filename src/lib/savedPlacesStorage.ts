"use client";

const LEGACY_SAVED_PLACES_KEY = "im-saved-places";
const GUEST_SAVED_PLACES_KEY = "im-saved-places:guest";
const ACTIVE_USER_KEY = "im-saved-places:active-user";
const LEGACY_OWNER_KEY = "im-saved-places:legacy-owner";

function normalizeUserId(value: string | null | undefined) {
  const userId = String(value ?? "").trim();
  return userId || null;
}

export function getSavedPlacesUserId() {
  if (typeof window === "undefined") return null;

  try {
    return normalizeUserId(window.localStorage.getItem(ACTIVE_USER_KEY));
  } catch {
    return null;
  }
}

export function setSavedPlacesUserId(userId: string | null) {
  if (typeof window === "undefined") return;

  try {
    const normalized = normalizeUserId(userId);

    if (normalized) {
      window.localStorage.setItem(ACTIVE_USER_KEY, normalized);
    } else {
      window.localStorage.removeItem(ACTIVE_USER_KEY);
    }
  } catch {}
}

function storageKey(userId: string | null | undefined) {
  const resolved =
    userId === undefined
      ? getSavedPlacesUserId()
      : normalizeUserId(userId);

  return resolved
    ? `${LEGACY_SAVED_PLACES_KEY}:user:${resolved}`
    : GUEST_SAVED_PLACES_KEY;
}

export function readSavedPlacesStorage<T>(
  userId?: string | null,
): T[] {
  if (typeof window === "undefined") return [];

  try {
    const key = storageKey(userId);
    let raw = window.localStorage.getItem(key);

    if (!raw && key === GUEST_SAVED_PLACES_KEY) {
      const legacy = window.localStorage.getItem(LEGACY_SAVED_PLACES_KEY);

      if (legacy) {
        window.localStorage.setItem(GUEST_SAVED_PLACES_KEY, legacy);
        raw = legacy;
      }
    }

    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

export function writeSavedPlacesStorage<T>(
  places: T[],
  userId?: string | null,
) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      storageKey(userId),
      JSON.stringify(Array.isArray(places) ? places : []),
    );
  } catch {}
}


export async function migrateLegacySavedPlacesToUser<
  T extends { id?: unknown },
>(userId: string): Promise<T[]> {
  const normalizedUserId = normalizeUserId(userId);
  const current = readSavedPlacesStorage<T>(normalizedUserId);

  if (!normalizedUserId || typeof window === "undefined") {
    return current;
  }

  try {
    const existingOwner = normalizeUserId(
      window.localStorage.getItem(LEGACY_OWNER_KEY),
    );

    if (existingOwner) {
      return current;
    }

    const raw = window.localStorage.getItem(
      LEGACY_SAVED_PLACES_KEY,
    );

    if (!raw) {
      return current;
    }

    const parsed: unknown = JSON.parse(raw);
    const legacy = Array.isArray(parsed)
      ? parsed.filter(
          (item): item is T =>
            !!item &&
            typeof item === "object" &&
            String((item as T).id ?? "").trim().length > 0,
        )
      : [];

    const seen = new Set<string>();
    const merged = [...current, ...legacy].filter((item) => {
      const id = String(item.id ?? "").trim();

      if (!id || seen.has(id)) {
        return false;
      }

      seen.add(id);
      return true;
    });

    writeSavedPlacesStorage(merged, normalizedUserId);

    const legacyIds = Array.from(
      new Set(
        legacy
          .map((item) => String(item.id ?? "").trim())
          .filter(Boolean),
      ),
    );

    if (legacyIds.length > 0) {
      const res = await fetch("/api/v1/me/saved-places", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          placeIds: legacyIds,
          saved: true,
        }),
      });

      if (res.ok) {
        window.localStorage.setItem(
          LEGACY_OWNER_KEY,
          normalizedUserId,
        );
      }
    } else {
      window.localStorage.setItem(
        LEGACY_OWNER_KEY,
        normalizedUserId,
      );
    }

    return merged;
  } catch {
    return current;
  }
}

export async function syncSavedPlaceToServer(
  userId: string,
  placeId: string,
  saved: boolean,
): Promise<{ ok: boolean; unauthorized: boolean }> {
  if (!userId || !placeId) {
    return { ok: false, unauthorized: false };
  }

  try {
    const res = await fetch("/api/v1/me/saved-places", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        placeId,
        saved,
      }),
    });

    return {
      ok: res.ok,
      unauthorized: res.status === 401,
    };
  } catch {
    return {
      ok: false,
      unauthorized: false,
    };
  }
}
