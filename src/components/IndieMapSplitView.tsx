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
  { id: "2", name: "Café Myriade", type: "Café", address: "1432 Rue Mackay, Montréal, QC H3G 2H7", website: "https://cafemyriade.com" },
];

const GlobeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c3.5 3.5 3.5 14.5 0 18m0-18c-3.5 3.5-3.5 14.5 0 18" />
  </svg>
);

const PinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path d="M12 22s7-6.14 7-12a7 7 0 1 0-14 0c0 5.86 7 12 7 12Z" />
    <circle cx="12" cy="10" r="2.6" />
  </svg>
);

const SearchIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-3.6-3.6" />
  </svg>
);

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-200/60 bg-white/70 px-2.5 py-1 text-xs font-medium text-neutral-700 shadow-sm backdrop-blur dark:border-neutral-700/60 dark:bg-neutral-900/60 dark:text-neutral-200">
      {children}
    </span>
  );
}

function BusinessCard({
  b,
  selected,
  onClick,
}: {
  b: Business;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <article onClick={onClick} className="group relative isolate cursor-pointer">
      <div
        className={
          "rounded-2xl border border-neutral-200/60 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-neutral-700/60 dark:bg-neutral-900 " +
          (selected ? "ring-2 ring-[hsl(var(--brand))]" : "")
        }
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold tracking-tight text-[hsl(var(--text))]">{b.name}</h3>
          <Tag>{b.type}</Tag>
        </div>
        <div className="mt-3 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
          {b.address && (
            <div className="flex items-center gap-2">
              <PinIcon className="h-4 w-4 opacity-75" />
              <span>{b.address}</span>
            </div>
          )}
          {b.website && (
            <div className="flex items-center gap-2">
              <GlobeIcon className="h-4 w-4 opacity-75" />
              <a
                className="underline decoration-[hsl(var(--brand))]/40 underline-offset-4 hover:decoration-[hsl(var(--brand))]"
                href={b.website}
                target="_blank"
                rel="noreferrer"
              >
                {new URL(b.website).hostname.replace("www.", "")}
              </a>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function Sidebar({
  businesses = DEMO,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  categories,
  activeCategory,
  onCategoryChange,
}: {
  businesses?: Business[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  categories: string[];
  activeCategory: string | "ALL";
  onCategoryChange: (value: string | "ALL") => void;
}) {
  const listRef = React.useRef<HTMLUListElement>(null);

  React.useEffect(() => {
    if (!selectedId) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-biz="${selectedId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedId]);

  return (
    <aside className="flex h-full flex-col gap-4">
      <div className="warm-gradient rounded-2xl border border-neutral-200/60 p-4 shadow-sm dark:border-neutral-700/60">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-neutral-600 dark:text-neutral-300">Indie Map</p>
            <h2 className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-50">Trouver local, vraiment.</h2>
          </div>
        </div>
        <div className="mt-4">
          <label className="relative block">
            <span className="sr-only">Rechercher</span>
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <SearchIcon className="h-5 w-5 text-neutral-600/70" />
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Café, friperie, librairie…"
              className="w-full rounded-xl border border-neutral-300/60 bg-white px-10 py-2.5 text-sm text-neutral-800 shadow-sm placeholder:text-neutral-500 dark:border-neutral-700/60 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onCategoryChange("ALL")}
            className={
              "rounded-full border px-3 py-1 text-xs font-medium transition " +
              (activeCategory === "ALL"
                ? "border-[hsl(var(--brand))] bg-[hsl(var(--brand))]/10 text-[hsl(var(--brand))]"
                : "border-neutral-300/70 bg-white/60 text-neutral-700 hover:border-[hsl(var(--brand))]/60 hover:text-[hsl(var(--brand))]")
            }
          >
            Toutes
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              className={
                "rounded-full border px-3 py-1 text-xs font-medium transition " +
                (activeCategory === cat
                  ? "border-[hsl(var(--brand))] bg-[hsl(var(--brand))]/10 text-[hsl(var(--brand))]"
                  : "border-neutral-300/70 bg-white/60 text-neutral-700 hover:border-[hsl(var(--brand))]/60 hover:text-[hsl(var(--brand))]")
              }
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-y-auto rounded-2xl border border-neutral-200/60 bg-[hsl(var(--card))] p-2 shadow-sm dark:border-neutral-700/60 h-[calc(100vh-14rem)]">
        <ul ref={listRef} className="divide-y divide-neutral-200/70 dark:divide-neutral-700/60">
          {businesses.map((b) => (
            <li key={b.id} data-biz={b.id} className="p-2">
              <BusinessCard b={b} selected={selectedId === b.id} onClick={() => onSelect?.(b.id)} />
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

export default function IndieMapSplitView() {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selectionVersion, setSelectionVersion] = React.useState(0);
  const [businesses, setBusinesses] = React.useState<Business[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<string | "ALL">("ALL");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await fetch("/api/places");
        if (!r.ok) throw new Error("Erreur de chargement");
        const j = await r.json();
        const arr = Array.isArray(j) ? j : j?.data || [];
        const list: Business[] = arr.map((p: any) => ({
          id: p.id,
          name: p.name,
          type: p.category ?? "Lieu local",
          address: p.address ?? p.city ?? "",
          website: p.website ?? undefined,
          lat: typeof p.lat === "number" ? p.lat : undefined,
          lng: typeof p.lng === "number" ? p.lng : undefined,
          city: p.city ?? "",
        }));
        if (!cancelled) setBusinesses(list);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Erreur de chargement");
          setBusinesses(DEMO);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setSelectionVersion((v) => v + 1);
  };

  const source = businesses.length ? businesses : DEMO;
  const categories = Array.from(
    new Set(source.map((b) => b.type).filter((t) => t && t.trim().length > 0))
  );

  const query = search.trim().toLowerCase();
  const filtered = source.filter((b) => {
    if (category !== "ALL" && b.type !== category) return false;
    if (!query) return true;
    const text = [b.name, b.type, b.city, b.address].filter(Boolean).join(" ").toLowerCase();
    return text.includes(query);
  });

  const layoutCols = "grid-cols-[minmax(320px,420px)_minmax(0,1fr)]";

  return (
    <main className="h-screen bg-[hsl(var(--bg))] p-3 text-[hsl(var(--text))] antialiased overflow-hidden">
      <div className={"mx-auto grid h-full max-w-7xl gap-3 " + layoutCols}>
        <div className="relative h-full">
          <Sidebar
            businesses={filtered}
            selectedId={selectedId}
            onSelect={handleSelect}
            search={search}
            onSearchChange={setSearch}
            categories={categories}
            activeCategory={category}
            onCategoryChange={setCategory}
          />
        </div>
        <MapPanel
          items={filtered}
          selectedId={selectedId}
          selectionVersion={selectionVersion}
          onSelect={handleSelect}
        />
      </div>
    </main>
  );
}
