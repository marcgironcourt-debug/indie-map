"use client";

import React from "react";
import dynamic from "next/dynamic";

const ClientMap = dynamic(() => import("./ClientMap"), { ssr: false });

type Biz = {
  id: string;
  name: string;
  address?: string | null;
  website?: string | null;
  openingHours?: string | null;
  lat?: number | null;
  lng?: number | null;
  type?: string | null;
};

export default function MapPanel({
  items = [],
  selectedId,
  selectionVersion,
  onSelect,
  searchCity,
  darkMap,
  onToggleDarkMap,
}: {
  items?: Biz[];
  selectedId?: string | null;
  selectionVersion?: number;
  onSelect?: (id: string) => void;
  searchCity?: string;
  darkMap?: boolean;
  onToggleDarkMap?: () => void;
}) {
  return (
    <div className="absolute inset-0">
      <ClientMap
        items={items}
        selectedId={selectedId}
        selectionVersion={selectionVersion}
        onSelect={onSelect}
        searchCity={searchCity}
        darkMap={darkMap}
        onToggleDarkMap={onToggleDarkMap}
      />
    </div>
  );
}
