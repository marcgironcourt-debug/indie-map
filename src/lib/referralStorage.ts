const REFERRAL_STORAGE_KEY =
  "im:referral-token:v1";

function normalizeReferralToken(
  value: unknown,
) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, 200);
}

export function rememberReferralToken(
  value: unknown,
) {
  if (typeof window === "undefined") {
    return;
  }

  const token =
    normalizeReferralToken(value);

  if (!token) {
    return;
  }

  try {
    window.localStorage.setItem(
      REFERRAL_STORAGE_KEY,
      token,
    );
  } catch {}
}

export function readReferralToken() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return normalizeReferralToken(
      window.localStorage.getItem(
        REFERRAL_STORAGE_KEY,
      ),
    );
  } catch {
    return "";
  }
}

export function clearReferralToken() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(
      REFERRAL_STORAGE_KEY,
    );
  } catch {}
}
