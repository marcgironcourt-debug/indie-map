"use client";
import React from "react";
import MapPanel from "@/components/MapPanel";

export type Business = {
  id: string;
  name: string;
  type: string;
  address?: string;
  website?: string;
  lat?: number;
  lng?: number;
  city?: string;
};

const DEMO: Business[] = [
  {
    id: "2",
    name: "Café Myriade",
    type: "Café",
    address: "1432 Rue Mackay, Montréal, QC H3G 2H7",
    website: "https://cafemyriade.com",
  },
];

function getCategoryStyle(cat: string, active: boolean): string {
  const key = cat.toLowerCase();

  if (key.includes("café") || key.includes("cafe")) {
    return active
      ? "bg-[hsl(var(--brand))] text-white shadow-md"
      : "bg-white/80 text-[hsl(var(--brand))] border border-[hsl(var(--brand))]/60 shadow-sm hover:bg-[hsl(var(--brand))]/10";
  }

  if (key.includes("épicerie") || key.includes("epicerie")) {
    return active
      ? "bg-[hsl(var(--leaf))] text-white shadow-md"
      : "bg-white/80 text-[hsl(var(--leaf))] border border-[hsl(var(--leaf))]/60 shadow-sm hover:bg-[hsl(var(--leaf))]/10";
  }

  if (key.includes("friperie")) {
    return active
      ? "bg-[hsl(var(--violet))] text-white shadow-md"
      : "bg-white/80 text-[hsl(var(--violet))] border border-[hsl(var(--violet))]/60 shadow-sm hover:bg-[hsl(var(--violet))]/10";
  }

  if (key.includes("microbrasserie") || key.includes("brasserie")) {
    return active
      ? "bg-[hsl(var(--amber))] text-white shadow-md"
      : "bg-white/80 text-[hsl(var(--amber))] border border-[hsl(var(--amber))]/60 shadow-sm hover:bg-[hsl(var(--amber))]/10";
  }

  if (key.includes("librairie") || key.includes("bouquinerie")) {
    return active
      ? "bg-[hsl(var(--blue))] text-white shadow-md"
      : "bg-white/80 text-[hsl(var(--blue))] border border-[hsl(var(--blue))]/60 shadow-sm hover:bg-[hsl(var(--blue))]/10";
  }

  if (key.includes("monument") || key.includes("poi")) {
    return active
      ? "bg-[hsl(var(--poi))] text-white shadow-md"
      : "bg-white/80 text-[hsl(var(--poi))] border border-[hsl(var(--poi))]/60 shadow-sm hover:bg-[hsl(var(--poi))]/10";
  }

  return active
    ? "bg-[hsl(var(--brand))] text-white shadow-md"
    : "bg-white/80 text-[hsl(var(--brand))] border border-[hsl(var(--brand))]/60 shadow-sm hover:bg-[hsl(var(--brand))]/10";
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const styleClasses = getCategoryStyle(label, active);
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full px-3 py-1 text-[11px] font-medium transition " + styleClasses
      }
    >
      {label}
    </button>
  );
}

function FilterBar({
  categories,
  activeCategory,
  onCategoryChange,
}: {
  categories: string[];
  activeCategory: string | "ALL";
  onCategoryChange: (value: string | "ALL") => void;
}) {
  const [showAll, setShowAll] = React.useState(false);
  const MAX = 3;
  const visible = showAll ? categories : categories.slice(0, MAX);
  const hidden = showAll ? 0 : Math.max(0, categories.length - MAX);

  return (
    <div className="flex flex-wrap gap-1.5 justify-end">
      <FilterPill
        label="Toutes"
        active={activeCategory === "ALL"}
        onClick={() => onCategoryChange("ALL")}
      />

      {visible.map((cat) => (
        <FilterPill
          key={cat}
          label={cat}
          active={activeCategory === cat}
          onClick={() => onCategoryChange(cat)}
        />
      ))}

      {hidden > 0 && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="rounded-full px-3 py-1 text-[11px] font-medium bg-white/80 text-[hsl(var(--brand))] border border-[hsl(var(--brand))]/60 shadow-sm hover:bg-[hsl(var(--brand))]/10"
        >
          +{hidden}
        </button>
      )}

      {showAll && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="rounded-full px-3 py-1 text-[11px] font-medium bg-white/80 text-[hsl(var(--brand))] border border-[hsl(var(--brand))]/60 shadow-sm hover:bg-[hsl(var(--brand))]/10"
        >
          - masquer
        </button>
      )}
    </div>
  );
}

export default function IndieMapSplitView() {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selectionVersion, setSelectionVersion] = React.useState(0);
  const [businesses, setBusinesses] = React.useState<Business[]>([]);
  const [category, setCategory] = React.useState<string | "ALL">("ALL");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/places");
        if (!r.ok) throw new Error("Erreur de chargement");
        const j = await r.json();
        const arr = Array.isArray(j) ? j : j?.data || [];
        const list: Business[] = arr.map((p: any) => ({
          id: p.id,
          name: p.name,
          type: p.category ?? "Lieu local",
          address: p.address ?? p.city ?? "",
          website: p.website,
          lat: typeof p.lat === "number" ? p.lat : undefined,
          lng: typeof p.lng === "number" ? p.lng : undefined,
          city: p.city ?? "",
        }));
        if (!cancelled) setBusinesses(list);
      } catch {
        if (!cancelled) setBusinesses(DEMO);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const source = businesses.length ? businesses : DEMO;
  const categories = Array.from(
    new Set(source.map((b) => b.type).filter((t) => !!t && t.trim().length > 0))
  );

  const filtered = source.filter((b) => {
    if (category !== "ALL" && b.type !== category) return false;
    return true;
  });

  return (
    <div className="h-full w-full relative">
      <div className="absolute inset-0">
        <MapPanel
          items={filtered}
          selectedId={selectedId}
          selectionVersion={selectionVersion}
          onSelect={(id) => {
            setSelectedId(id);
            setSelectionVersion((v) => v + 1);
          }}
        />
      </div>

      

      <div className="absolute top-3 inset-x-0 z-[1200] flex justify-center pointer-events-none">
                                                
      </div>

            <div className="absolute top-3 right-4 z-[1300] pointer-events-none">
        <div className="text-[11px] font-medium px-3 py-[3px] bg-white border border-neutral-300 rounded-lg shadow-sm text-black">
          Indiemap
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-[1300] w-[min(380px,60vw)]">
        <FilterBar
          categories={categories}
          activeCategory={category}
          onCategoryChange={setCategory}
        />
      </div>
    </div>
  );
}
