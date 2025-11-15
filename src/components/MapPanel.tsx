"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const ClientMap = dynamic(() => import("./ClientMap"), { ssr: false });

type Biz = {
  id: string;
  name: string;
  address?: string | null;
  website?: string | null;
  category?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
};

function normalize(input: any): Biz[] {
  if (Array.isArray(input)) return input as Biz[];
  if (Array.isArray(input?.businesses)) return input.businesses as Biz[];
  if (Array.isArray(input?.data)) {
    return input.data.map((b: any) => ({
      id: b.id,
      name: b.name,
      address: b.city ?? null,
      website: b.website ?? null,
      category: b.category ?? null,
      lat: b.lat ?? null,
      lng: b.lng ?? null,
    })) as Biz[];
  }
  return [];
}

export default function MapPanel({
  selectedId,
  onSelect,
}: {
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const [items, setItems] = useState<Biz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await fetch("/api/businesses");
        if (r.ok) {
          const j = await r.json();
          const list = normalize(j);
          if (!cancelled) setItems(list);
        } else {
          const r2 = await fetch("/api/places");
          if (r2.ok) {
            const j2 = await r2.json();
            const list2: Biz[] = (Array.isArray(j2) ? j2 : j2?.places || []).map((p: any) => ({
              id: p.id,
              name: p.name,
              address: p.city ?? null,
              lat: p.lat ?? null,
              lng: p.lng ?? null,
            }));
            if (!cancelled) setItems(list2);
          } else {
            throw new Error("Aucune donnée");
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Erreur inconnue");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="rounded-2xl border p-4">Chargement…</div>;
  if (error) return <div className="rounded-2xl border p-4 text-red-600">Erreur : {error}</div>;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-neutral-200/60 bg-white shadow-sm dark:border-neutral-700/60 dark:bg-neutral-900">
      <div className="h-[calc(100vh-6rem)]">
        <ClientMap items={items} selectedId={selectedId} onSelect={onSelect} />
      </div>
    </section>
  );
}
