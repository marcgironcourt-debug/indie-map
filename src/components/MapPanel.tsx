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

export default function MapPanel({
  items = [],
  selectedId,
  selectionVersion,
  onSelect,
  darkMap,
  onToggleDarkMap,
}: {
  items?: Biz[];
  selectedId?: string | null;
  selectionVersion?: number;
  onSelect?: (id: string) => void;
    darkMap?: boolean;
  onToggleDarkMap?: () => void;
}) {
  return (
    <section className="relative h-full overflow-hidden rounded-2xl border border-neutral-200/60 bg-white shadow-sm dark:border-neutral-700/60 dark:bg-neutral-900">
      <div className="h-full">
        <ClientMap
          items={items}
          selectedId={selectedId}
onSelect={onSelect}
          darkMap={darkMap}
/>
      </div>
    </section>
  );
}
