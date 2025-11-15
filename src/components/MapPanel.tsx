"use client";

import React from "react";
import dynamic from "next/dynamic";

const ClientMap = dynamic(() => import("./ClientMap"), { ssr: false });

type Biz = {
  id: string;
  name: string;
  address?: string | null;
  website?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export default function MapPanel({
  items = [],
  selectedId,
  selectionVersion,
  onSelect,
}: {
  items?: Biz[];
  selectedId?: string | null;
  selectionVersion?: number;
  onSelect?: (id: string) => void;
}) {
  return (
    <section className="relative h-full overflow-hidden rounded-2xl border border-neutral-200/60 bg-white shadow-sm dark:border-neutral-700/60 dark:bg-neutral-900">
      <div className="h-full">
        <ClientMap items={items} selectedId={selectedId} selectionVersion={selectionVersion} onSelect={onSelect} />
      </div>
    </section>
  );
}
