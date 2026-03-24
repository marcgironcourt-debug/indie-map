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
}) {
  const { items = [], selectedId, onSelect } = props;

  useEffect(() => {
    const key = "im_session_id";

    const makeSessionId = () => {
      try {
        if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
          return globalThis.crypto.randomUUID();
        }
      } catch {}
      return "im_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 12);
    };

    let sessionId = "";
    try {
      sessionId = window.localStorage.getItem(key) || "";
      if (!sessionId) {
        sessionId = makeSessionId();
        window.localStorage.setItem(key, sessionId);
      }
    } catch {
      sessionId = makeSessionId();
    }

    const send = () => {
      try {
        fetch("/api/presence/heartbeat", {
          method: "POST",
          headers: {
            "x-session-id": sessionId,
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
    <section className="relative h-full w-full overflow-hidden bg-[#0B0F0C]">
      <div className="h-full">
        <GlobeMap items={items} selectedId={selectedId} onSelect={onSelect} />
      </div>
    </section>
  );
}
