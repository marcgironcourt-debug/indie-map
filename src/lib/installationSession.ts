"use client";

const SESSION_KEY = "im_session_id";
const LAUNCH_KEY = "im_launch_id";
const PUSH_TOKEN_KEY = "im_push_token";

function makeId() {
  try {
    if (
      typeof globalThis.crypto !== "undefined" &&
      typeof globalThis.crypto.randomUUID === "function"
    ) {
      return globalThis.crypto.randomUUID();
    }
  } catch {}

  return (
    "im_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 12)
  );
}

export function getOrCreateInstallationSessionId() {
  if (typeof window === "undefined") return "";

  try {
    let sessionId =
      window.localStorage.getItem(SESSION_KEY) || "";

    if (!sessionId) {
      sessionId = makeId();

      window.localStorage.setItem(
        SESSION_KEY,
        sessionId,
      );
    }

    return sessionId;
  } catch {
    return makeId();
  }
}

export function getOrCreateLaunchId() {
  if (typeof window === "undefined") return "";

  try {
    let launchId =
      window.sessionStorage.getItem(LAUNCH_KEY) || "";

    if (!launchId) {
      launchId = makeId();

      window.sessionStorage.setItem(
        LAUNCH_KEY,
        launchId,
      );
    }

    return launchId;
  } catch {
    return makeId();
  }
}

export function getClientTimeZone() {
  if (typeof window === "undefined") return "";

  try {
    return (
      Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone || ""
    );
  } catch {
    return "";
  }
}

export function getUtcOffsetMinutes() {
  try {
    return -new Date().getTimezoneOffset();
  } catch {
    return 0;
  }
}

export function getInstallationLocale() {
  if (typeof window === "undefined") return "fr";

  return /^\/en(?:\/|$)/.test(
    window.location.pathname,
  )
    ? "en"
    : "fr";
}

export function getAnalyticsDeviceContext() {
  if (typeof navigator === "undefined") {
    return {
      platform: "web",
      deviceType: "desktop",
      os: "unknown",
      browser: "unknown",
    };
  }

  const ua = navigator.userAgent || "";

  const isIPad =
    /iPad/i.test(ua) ||
    (
      /Macintosh/i.test(ua) &&
      Number(navigator.maxTouchPoints || 0) > 1
    );

  const isIPhone =
    /iPhone|iPod/i.test(ua);

  const isAndroid =
    /Android/i.test(ua);

  let platform = "web";

  if (isIPad || isIPhone) {
    platform = "ios";
  } else if (isAndroid) {
    platform = "android";
  }

  let deviceType = "desktop";

  if (isIPad || /Tablet/i.test(ua)) {
    deviceType = "tablet";
  } else if (
    isIPhone ||
    isAndroid ||
    /Mobile/i.test(ua)
  ) {
    deviceType = "mobile";
  }

  let os = "unknown";

  if (isIPad || isIPhone) {
    os = "ios";
  } else if (isAndroid) {
    os = "android";
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = "macos";
  } else if (/Windows/i.test(ua)) {
    os = "windows";
  } else if (/Linux/i.test(ua)) {
    os = "linux";
  }

  let browser = "other";

  if (/Edg\//i.test(ua)) {
    browser = "edge";
  } else if (/Firefox|FxiOS/i.test(ua)) {
    browser = "firefox";
  } else if (/Chrome|CriOS/i.test(ua)) {
    browser = "chrome";
  } else if (
    /Safari/i.test(ua) &&
    !/Chrome|CriOS|Chromium|Edg\//i.test(ua)
  ) {
    browser = "safari";
  }

  return {
    platform,
    deviceType,
    os,
    browser,
  };
}

export function rememberInstallationPushToken(
  token: string,
) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      PUSH_TOKEN_KEY,
      token,
    );
  } catch {}
}

export function readInstallationPushToken() {
  if (typeof window === "undefined") return null;

  try {
    const token =
      window.localStorage.getItem(
        PUSH_TOKEN_KEY,
      );

    return token?.trim() || null;
  } catch {
    return null;
  }
}


type AnalyticsLocation = {
  lat: number;
  lng: number;
  observedAt: number;
};

const ANALYTICS_LOCATION_MAX_AGE_MS =
  30 * 60 * 1000;

const ANALYTICS_LOCATION_SESSION_KEY =
  "im:analytics-location";

export function rememberAnalyticsLocation(
  latRaw: unknown,
  lngRaw: unknown,
  observedAtRaw?: unknown,
) {
  if (typeof window === "undefined") return;

  const lat = Number(latRaw);
  const lng = Number(lngRaw);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return;
  }

  const observedAtCandidate =
    Number(observedAtRaw);

  const observedAt =
    Number.isFinite(observedAtCandidate) &&
    observedAtCandidate > 0
      ? observedAtCandidate
      : Date.now();

  const location: AnalyticsLocation = {
    lat,
    lng,
    observedAt,
  };

  try {
    (
      window as typeof window & {
        __IM_ANALYTICS_LOCATION__?:
          AnalyticsLocation;
      }
    ).__IM_ANALYTICS_LOCATION__ =
      location;
  } catch {}

  try {
    window.sessionStorage.setItem(
      ANALYTICS_LOCATION_SESSION_KEY,
      JSON.stringify(location),
    );
  } catch {}
}

export function readRecentAnalyticsLocation() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    let location =
      (
        window as typeof window & {
          __IM_ANALYTICS_LOCATION__?:
            AnalyticsLocation;
        }
      ).__IM_ANALYTICS_LOCATION__;

    if (!location) {
      try {
        const raw =
          window.sessionStorage.getItem(
            ANALYTICS_LOCATION_SESSION_KEY,
          );

        if (raw) {
          const parsed =
            JSON.parse(raw) as
              Partial<AnalyticsLocation>;

          location = {
            lat: Number(parsed.lat),
            lng: Number(parsed.lng),
            observedAt: Number(
              parsed.observedAt,
            ),
          };
        }
      } catch {}
    }

    if (!location) {
      return null;
    }

    const age =
      Date.now() -
      Number(location.observedAt);

    if (
      !Number.isFinite(age) ||
      age < 0 ||
      age >
        ANALYTICS_LOCATION_MAX_AGE_MS
    ) {
      try {
        window.sessionStorage.removeItem(
          ANALYTICS_LOCATION_SESSION_KEY,
        );
      } catch {}

      return null;
    }

    const lat =
      Number(location.lat);

    const lng =
      Number(location.lng);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return null;
    }

    return {
      lat,
      lng,
    };
  } catch {
    return null;
  }
}
