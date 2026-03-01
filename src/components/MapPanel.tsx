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
}) {
  const { items = [], selectedId, onSelect } = props;

  return (
    <section className="relative h-full w-full overflow-hidden bg-[#0B0F0C]">
      <div className="h-full">
        <GlobeMap items={items} selectedId={selectedId} onSelect={onSelect} />
      </div>
    </section>
  );
}
