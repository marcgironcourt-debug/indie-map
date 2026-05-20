"use client";

import React from "react";

declare global {
  interface Window {
    __IM_NATIVE_APP__?: {
      platform?: string;
      version?: string;
      build?: string;
    };
    webkit?: {
      messageHandlers?: Record<string, unknown>;
    };
  }
}

type Props = {
  locale: string;
  minimumBuild: number;
  appStoreUrl: string;
};

function readBuild(value: string | undefined) {
  const n = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

function isIosDevice() {
  return /iPhone|iPad|iPod/i.test(window.navigator.userAgent || "");
}

function isIndieMapIosWrapper() {
  return Boolean(window.webkit?.messageHandlers?.imlog);
}

function shouldBlock(minimumBuild: number) {
  if (minimumBuild <= 0) return false;
  if (!isIosDevice()) return false;
  if (!isIndieMapIosWrapper()) return false;

  const native = window.__IM_NATIVE_APP__;
  if (!native || native.platform !== "ios") return true;

  return readBuild(native.build) < minimumBuild;
}

export default function IosAppVersionGate({ locale, minimumBuild, appStoreUrl }: Props) {
  const isFr = locale !== "en";
  const [blocked, setBlocked] = React.useState(false);

  React.useEffect(() => {
    let done = false;

    const check = () => {
      if (done) return;
      setBlocked(shouldBlock(minimumBuild));
    };

    check();

    const onReady = () => check();
    window.addEventListener("im:native-app-ready", onReady);

    const timer = window.setTimeout(() => {
      done = true;
      setBlocked(shouldBlock(minimumBuild));
    }, 600);

    return () => {
      window.removeEventListener("im:native-app-ready", onReady);
      window.clearTimeout(timer);
    };
  }, [minimumBuild]);

  if (!blocked) return null;

  const title = isFr ? "Mise à jour nécessaire" : "Update required";
  const body = isFr
    ? "Une nouvelle version d’Indie Map est disponible. Mets l’app à jour depuis l’App Store pour accéder à la nouvelle expérience."
    : "A new version of Indie Map is available. Update the app from the App Store to access the new experience.";
  const button = isFr ? "Ouvrir l’App Store" : "Open the App Store";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#6F6528] px-6 text-white">
      <div className="w-full max-w-sm rounded-[2rem] bg-black/25 p-6 text-center shadow-2xl backdrop-blur">
        <div className="text-2xl font-semibold">{title}</div>
        <p className="mt-4 text-sm leading-6 text-white/85">{body}</p>
        {appStoreUrl ? (
          <button
            type="button"
            onClick={() => {
              window.location.href = appStoreUrl;
            }}
            className="mt-6 w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-black"
          >
            {button}
          </button>
        ) : null}
      </div>
    </div>
  );
}
