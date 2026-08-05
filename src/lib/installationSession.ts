"use client";

const SESSION_KEY = "im_session_id";
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
      window.localStorage.getItem(PUSH_TOKEN_KEY);

    return token?.trim() || null;
  } catch {
    return null;
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
