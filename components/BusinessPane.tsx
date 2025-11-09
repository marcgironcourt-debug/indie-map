"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import type { Business } from "../lib/types";
import FiltersBar, { Filters } from "./FiltersBar";

export default function BusinessPane({
  items,
  selectedId,
  onSelect
}: {
  items: Business[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const [filters, setFilters] = useState<Filters>({ q: "", city: "", category: "" });
  const containerRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return items.filter(b => {
      if (filters.city && (b.city ?? "") !== filters.city) return false;
      if (filters.category && (b.category ?? "") !== filters.category) return false;
      if (!q) return true;
      const hay = [b.name, b.address, b.category, b.city, b.description].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [items, filters]);

  useEffect(() => {
    if (!selectedId || !containerRef.current) return;
    const card = containerRef.current.querySelector<HTMLDivElement>(`[data-id="${selectedId}"]`);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedId, filtered]);

  return (
    <div className="h-full flex flex-col">
      <FiltersBar items={items} filters={filters} onChange={setFilters} />
      <div ref={containerRef} className="flex-1 overflow-y-auto">
        {filtered.map((b, i) => (
          <div key={b.id}>
            <div
              data-id={b.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect?.(b.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect?.(b.id); }}
              className={
                "p-4 transition-colors outline-none cursor-pointer " +
                (b.id === selectedId
                  ? "bg-neutral-100 dark:bg-neutral-900/60"
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-900/30")
              }
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold leading-5">{b.name}</h3>
                {b.category ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                    {b.category}
                  </span>
                ) : null}
              </div>
              {b.address ? <p className="mt-1 text-xs text-neutral-500">{b.address}</p> : null}
              {b.website ? (
                <p className="mt-1 text-xs">
                  <a href={b.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" onClick={(e)=>e.stopPropagation()}>
                    {b.website}
                  </a>
                </p>
              ) : null}
            </div>
            {i < filtered.length - 1 ? <div style={{ borderTop: "1px solid #e5e7eb" }} /> : null}
          </div>
        ))}
        {!filtered.length ? (
          <div className="p-4 text-xs text-neutral-500">Aucun résultat avec ces filtres.</div>
        ) : null}
      </div>
    </div>
  );
}
