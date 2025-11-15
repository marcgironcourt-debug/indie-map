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
  onSelect,
}: {
  items?: Biz[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-neutral-200/60 bg-white shadow-sm dark:border-neutral-700/60 dark:bg-neutral-900">
      <div className="h-[calc(100vh-6rem)]">
        <ClientMap items={items} selectedId={selectedId} onSelect={onSelect} />
      </div>
    </section>
  );
}
