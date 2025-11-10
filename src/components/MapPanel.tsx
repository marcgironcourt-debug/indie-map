"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const ClientMap = dynamic(() => import("./ClientMap"), { ssr: false });

type Biz = {
  id: string;
  name: string;
  lat?: number | string | null;
  lng?: number | string | null;
};

function normalize(input: any): Biz[] {
  if (Array.isArray(input)) return input as Biz[];
  if (Array.isArray(input?.data)) return input.data as Biz[];
  return [];
}

export default function MapPanel({ selectedId }: { selectedId?: string | null }) {
  const [items, setItems] = useState<Biz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/businesses");
        const j = await r.json();
        const list = normalize(j);
        if (!cancelled) setItems(list);
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
        <ClientMap items={items} selectedId={selectedId} />
      </div>
    </section>
  );
}
