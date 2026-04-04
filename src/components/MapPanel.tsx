"use client";

import React, { useEffect } from "react";
import GlobeMap from "./GlobeMap";

type Biz = {
  id: string;
  name: string;
  address?: string | null;
  website?: string | null;
  openingHours?: string | null;
  phone?: string | null;
  panoramaImage?: string | null;
  lat?: number | null;
  lng?: number | null;
  type?: string | null;
  timeZone?: string | null;
  miniText?: string | null;
};

export default function MapPanel(props: {
  items?: Biz[];
  selectedId?: string | null;
  selectionVersion?: number;
  onSelect?: (id: string) => void;
  overlaysReady?: boolean;
  homeOverlay?: React.ReactNode;
  topOverlay?: React.ReactNode;
}) {
  const { items = [], selectedId, onSelect, overlaysReady = true, homeOverlay, topOverlay } = props;

  useEffect(() => {
    const sessionKey = "im_session_id";
    const launchKey = "im_launch_id";

    const makeId = () => {
      try {
        if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
          return globalThis.crypto.randomUUID();
        }
      } catch {}
      return "im_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 12);
    };

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

    const launchId = makeId();
    try {
      window.sessionStorage.setItem(launchKey, launchId);
    } catch {}

    const send = () => {
      try {
        fetch("/api/presence/heartbeat", {
          method: "POST",
          headers: {
            "x-session-id": sessionId,
            "x-launch-id": launchId,
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

  return (
    <section
      className="relative h-full w-full overflow-hidden bg-[#0B0F0C]"
      style={{
        opacity: 1,
        transition: "opacity 120ms ease",
        willChange: "opacity"
      }}
    >
      <div className="h-full">
        <GlobeMap items={items} selectedId={selectedId} onSelect={onSelect} overlaysReady={overlaysReady} />
      </div>
      {overlaysReady ? homeOverlay : null}
      {overlaysReady ? topOverlay : null}
    </section>
  );
}
