"use client";

import { useMemo } from "react";
import type { Business } from "../lib/types";

export type Filters = {
  q: string;
  city: string;
  category: string;
};

export default function FiltersBar({
  items,
  filters,
  onChange
}: {
  items: Business[];
  filters: Filters;
  onChange: (next: Filters) => void;
}) {
  const cities = useMemo(() => {
    const set = new Set(items.map(i => (i.city ?? "").trim()).filter(Boolean));
    return ["", ...Array.from(set).sort()];
  }, [items]);

  const categories = useMemo(() => {
    const set = new Set(items.map(i => (i.category ?? "").trim()).filter(Boolean));
    return ["", ...Array.from(set).sort()];
  }, [items]);

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 border-b border-neutral-200 dark:border-neutral-800">
      <input
        type="text"
        placeholder="Recherche..."
        value={filters.q}
        onChange={(e) => onChange({ ...filters, q: e.target.value })}
        className="w-[180px] rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1 text-sm"
      />
      <select
        value={filters.city}
        onChange={(e) => onChange({ ...filters, city: e.target.value })}
        className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1 text-sm"
      >
        <option value="">Toutes les villes</option>
        {cities.map((c) => (
          <option key={c || "_"} value={c}>{c || "—"}</option>
        ))}
      </select>
      <select
        value={filters.category}
        onChange={(e) => onChange({ ...filters, category: e.target.value })}
        className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1 text-sm"
      >
        <option value="">Tous les types</option>
        {categories.map((c) => (
          <option key={c || "_"} value={c}>{c || "—"}</option>
        ))}
      </select>
    </div>
  );
}
