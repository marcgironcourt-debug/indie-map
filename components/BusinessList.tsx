"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Business } from "../lib/types";

export type BusinessListProps = {
  items: Business[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

export default function BusinessList({ items, selectedId, onSelect }: BusinessListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const index = useMemo(() => new Map(items.map((b, i) => [b.id, i])), [items]);

  useEffect(() => {
    if (!selectedId || !containerRef.current) return;
    const i = index.get(selectedId);
    if (i === undefined) return;
    const card = containerRef.current.querySelector<HTMLDivElement>(`[data-id="${selectedId}"]`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedId, index]);

  return (
    <div
      ref={containerRef}
      style={{ height: "100%", overflowY: "auto" }}
      className="select-none"
    >
      {items.map((b, i) => {
        const active = b.id === selectedId;
        return (
          <div key={b.id}>
            <div
              data-id={b.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect?.(b.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect?.(b.id); }}
              className={
                "p-4 transition-colors outline-none " +
                (active
                  ? "bg-neutral-100 dark:bg-neutral-900/60"
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-900/30")
              }
              style={{ cursor: "pointer" }}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold leading-5">{b.name}</h3>
                {b.category ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                    {b.category}
                  </span>
                ) : null}
              </div>

              {b.address ? (
                <p className="mt-1 text-xs text-neutral-500">{b.address}</p>
              ) : null}

              {b.website ? (
                <p className="mt-1 text-xs">
                  <a
                    href={b.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {b.website}
                  </a>
                </p>
              ) : null}
            </div>

            {/* Séparateur horizontal manuel (sauf après le dernier) */}
            {i < items.length - 1 ? (
              <div style={{ borderTop: "1px solid #e5e7eb" }} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
