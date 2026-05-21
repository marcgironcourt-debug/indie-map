"use client";

import React from "react";
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
  hideGeolocate?: boolean;
  searchMode?: boolean;
}) {
  const {
    items = [],
    selectedId,
    onSelect,
    overlaysReady = true,
    homeOverlay,
    topOverlay,
    hideGeolocate = false,
    searchMode = false
  } = props;

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
        <GlobeMap
          items={items}
          selectedId={selectedId}
          onSelect={onSelect}
          overlaysReady={overlaysReady}
          hideGeolocate={hideGeolocate}
          searchMode={searchMode}
        />
      </div>
      {overlaysReady ? homeOverlay : null}
      {overlaysReady ? topOverlay : null}
    </section>
  );
}
