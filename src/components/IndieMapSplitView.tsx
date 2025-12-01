"use client";
import React from "react";
import MapPanel from "@/components/MapPanel";
import SiteNav from "@/components/SiteNav";

export type Business = {
  id: string;
  name: string;
  address?: string | null;
  website?: string | null;
  openingHours?: string | null;
  lat?: number | null;
  lng?: number | null;
  type?: string | null;
};

export default function IndieMapSplitView() {
  const [cityQuery, setCityQuery] = React.useState("");
  const [searchCity, setSearchCity] = React.useState<string | undefined>(undefined);
  const [businesses, setBusinesses] = React.useState<Business[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [darkMap, setDarkMap] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/places");
        if (!res.ok) {
          console.error("Erreur /api/places", res.status);
          return;
        }
        const data = await res.json();
        let list: any[] = [];

        if (Array.isArray(data)) {
          list = data;
        } else if (data && Array.isArray((data as any).places)) {
          list = (data as any).places;
        }

        const mapped = list.map((raw: any) => {
          return {
            ...raw,
            type:
              raw.type ??
              raw.category ??
              raw.kind ??
              raw.categoryFr ??
              raw.categoryEn ??
              raw.name,
          };
        });

        if (!cancelled) {
          setBusinesses(mapped as Business[]);
        }
      } catch (e) {
        console.error("Erreur chargement des lieux", e);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = cityQuery.trim();
    setSearchCity(value || undefined);
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteNav />
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4">
        <form
          onSubmit={handleSubmit}
          className="mt-2 flex w-full max-w-md items-center gap-2"
        >
          <input
            type="text"
            value={cityQuery}
            onChange={(e) => setCityQuery(e.target.value)}
            placeholder="Rechercher une ville (Montréal, Paris, etc.)"
            className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-slate-500"
          />
          <button
            type="submit"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50"
          >
            OK
          </button>
        </form>

        <section className="mt-4 h-[70vh] w-full relative">
          <MapPanel
            items={businesses}
            selectedId={undefined}
            selectionVersion={0}
            onSelect={() => {}}
            searchCity={searchCity}
            darkMap={darkMap}
            onToggleDarkMap={() => setDarkMap((prev) => !prev)}
          />
          {loading && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-500">
              Chargement des lieux…
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
