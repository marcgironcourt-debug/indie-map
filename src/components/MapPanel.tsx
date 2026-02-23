"use client";

import React from "react";
import dynamic from "next/dynamic";

const ClientMap = dynamic(() => import("./GlobeMap"), { ssr: false });

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
  darkMap?: boolean;
  onToggleDarkMap?: () => void;
}) {
  const { items = [], selectedId, onSelect, darkMap } = props;

  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    type IdleDeadline = {
      readonly didTimeout: boolean;
      timeRemaining: () => number;
    };

    type RequestIdleCallback = (
      cb: (deadline: IdleDeadline) => void,
      opts?: { timeout?: number }
    ) => number;

    const run = () => {
      try {
        void import("./GlobeMap");
      } catch {}
    };

    const ric = (globalThis as unknown as { requestIdleCallback?: RequestIdleCallback }).requestIdleCallback;

    if (typeof ric === "function") {
      ric(() => run(), { timeout: 1200 });
    } else {
      setTimeout(run, 600);
    }
  }, []);

  return (
    <section className="relative h-full overflow-hidden rounded-2xl border border-neutral-200/60 bg-white shadow-sm dark:border-neutral-700/60 dark:bg-neutral-900">
      <div className="h-full">
        {mounted ? (
          <ClientMap
            items={items}
            selectedId={selectedId}
            onSelect={onSelect}
            darkMap={darkMap}
          />
        ) : (
          <div className="h-full w-full" />
        )}
      </div>
    </section>
  );
}
