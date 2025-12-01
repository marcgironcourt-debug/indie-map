"use client";
import React from "react";
import MapPanel from "@/components/MapPanel";
import SiteNav from "@/components/SiteNav";

export type Business = {
  id: string;
  name: string;
  type: string;
  address?: string;
  website?: string;
  openingHours?: string;
  lat?: number;
  lng?: number;
  city?: string;
};

const DEMO: Business[] = [
  {
    id: "2",
    name: "Café Myriade",
    type: "Café / brunch",
    address: "1432 Rue Mackay, Montréal, QC H3G 2H3",
    website: "https://cafemyriade.com",
    openingHours: "Lundi au dimanche : 8h00–18h00",
    lat: 45.4978,
    lng: -73.579,
    city: "Montréal",
  },
];

export default function IndieMapSplitView() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteNav />
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Montréal
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Indie Map – marcher, ressentir, découvrir
          </h1>
          <p className="text-sm text-slate-600">
            Une sélection de lieux locaux, éthiques et responsables à explorer
            à pied ou en transport, sans pubs ni greenwashing.
          </p>
        </header>
        <section className="h-[70vh] w-full">
          <MapPanel
            items={DEMO}
            selectedId={undefined}
            selectionVersion={0}
            onSelect={() => {}}
            searchCity={undefined}
            darkMap={false}
            onToggleDarkMap={() => {}}
          />
        </section>
      </div>
    </main>
  );
}
