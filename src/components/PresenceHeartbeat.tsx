"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { getOrCreateInstallationSessionId } from "@/lib/installationSession";

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

function getPlatform() {
  if (typeof navigator === "undefined") return "web";

  const ua = navigator.userAgent || "";

  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";

  return "web";
}

export default function PresenceHeartbeat() {
  const pathname = usePathname();
  React.useEffect(() => {
    const isAnalyticsPage =
      pathname === "/indie-analytics" ||
      pathname.startsWith("/indie-analytics/");

    if (isAnalyticsPage) return;

    const launchKey = "im_launch_id";
    const heartbeatLockKey = "im_presence_heartbeat_at";

    /*
     * Plusieurs onglets partagent localStorage.
     * Cette fenêtre empêche leurs heartbeats de partir simultanément.
     */
    const heartbeatLockMs = 60_000;

    const sessionId =
      getOrCreateInstallationSessionId();

    let launchId = "";

    try {
      launchId = window.sessionStorage.getItem(launchKey) || "";

      if (!launchId) {
        launchId = makeId();
        window.sessionStorage.setItem(launchKey, launchId);
      }
    } catch {
      launchId = makeId();
    }

    const platform = getPlatform();

    let inFlight = false;

    const reserveHeartbeat = () => {
      const now = Date.now();

      try {
        const previous = Number(
          window.localStorage.getItem(heartbeatLockKey) || "0",
        );

        if (Number.isFinite(previous) && now - previous < heartbeatLockMs) {
          return false;
        }

        window.localStorage.setItem(heartbeatLockKey, String(now));
        return true;
      } catch {
        /*
         * Si localStorage est indisponible, le verrou local inFlight
         * continue au moins à protéger cette instance.
         */
        return true;
      }
    };

    const send = () => {
      if (inFlight) return;
      if (document.visibilityState !== "visible") return;
      if (!reserveHeartbeat()) return;

      inFlight = true;

      try {
        fetch("/api/presence/heartbeat", {
          method: "POST",
          headers: {
            "x-session-id": sessionId,
            "x-launch-id": launchId,
            "x-platform": platform,
          },
          keepalive: true,
          cache: "no-store",
        })
          .catch(() => {})
          .finally(() => {
            inFlight = false;
          });
      } catch {
        inFlight = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        send();
      }
    };

    send();

    const intervalId = window.setInterval(send, 90_000);

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [pathname]);

  return null;
}
