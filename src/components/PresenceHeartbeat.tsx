"use client";

import React from "react";

function makeId() {
  try {
    if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
  } catch {}

  return "im_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 12);
}

function getPlatform() {
  if (typeof navigator === "undefined") return "web";

  const ua = navigator.userAgent || "";

  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";

  return "web";
}

export default function PresenceHeartbeat() {
  React.useEffect(() => {
    const sessionKey = "im_session_id";
    const launchKey = "im_launch_id";

    let sessionId = "";

    try {
      sessionId = window.localStorage.getItem(sessionKey) || "";

      if (!sessionId) {
        sessionId = makeId();
        window.localStorage.setItem(sessionKey, sessionId);
      }
    } catch {
      sessionId = makeId();
    }

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

    const send = () => {
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
        }).catch(() => {});
      } catch {}
    };

    send();

    const id = window.setInterval(send, 90000);

    return () => window.clearInterval(id);
  }, []);

  return null;
}
