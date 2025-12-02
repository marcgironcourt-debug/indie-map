"use client";
import React from "react";
import MapPanel from "@/components/MapPanel";

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
    address: "1432 Rue Mackay, Montréal, QC H3G 2H7",
    website: "https://cafemyriade.com",
  },
];

function normalizeCategoryLabel(raw: string): string {
  const key = raw.toLowerCase();
  if (
    key.includes("café") ||
    key.includes("cafe") ||
    key.includes("coffee") ||
    key.includes("brunch")
  ) {
    return "Café / brunch";
  }
  if (
    key.includes("microbrasserie") ||
    key.includes("brasserie") ||
    key.includes("pub") ||
    key.includes("bar")
  ) {
    return "Brasserie / bar / pub";
  }
  return raw;
}

function getCategoryStyle(cat: string, active: boolean, dark: boolean): string {
  const key = cat.toLowerCase();

  if (key.includes("café") || key.includes("cafe")) {
    return active
      ? "bg-[hsl(var(--cafe))] text-white shadow-md"
      : dark
      ? "bg-neutral-900/80 text-[hsl(var(--cafe))] border border-[hsl(var(--cafe))]/70 shadow-sm"
      : "bg-white text-[hsl(var(--cafe))] border border-[hsl(var(--cafe))]/60 shadow-sm";
  }

  if (key.includes("épicerie") || key.includes("epicerie")) {
    return active
      ? "bg-[hsl(var(--leaf))] text-white shadow-md"
      : dark
      ? "bg-neutral-900/80 text-[hsl(var(--leaf))] border border-[hsl(var(--leaf))]/70 shadow-sm"
      : "bg-white text-[hsl(var(--leaf))] border border-[hsl(var(--leaf))]/60 shadow-sm";
  }

  if (key.includes("boutique")) {
    return active
      ? "bg-black text-white shadow-md"
      : dark
      ? "bg-neutral-900/80 text-white border border-white/60 shadow-sm"
      : "bg-white text-black border border-black/60 shadow-sm";
  }

  if (key.includes("boulangerie")) {
    return active
      ? "bg-[#8C5A3C] text-white shadow-md"
      : dark
      ? "bg-neutral-900/80 text-[#E3B08A] border border-[#E3B08A]/70 shadow-sm"
      : "bg-white text-[#8C5A3C] border border-[#8C5A3C]/60 shadow-sm";
  }

  if (
    key.includes("friperie") ||
    key.includes("mode éthique") ||
    key.includes("mode ethique") ||
    key.includes("vêtement") ||
    key.includes("vetement")
  ) {
    return active
      ? "bg-[hsl(var(--violet))] text-white shadow-md"
      : dark
      ? "bg-neutral-900/80 text-[hsl(var(--violet))] border border-[hsl(var(--violet))]/70 shadow-sm"
      : "bg-white text-[hsl(var(--violet))] border border-[hsl(var(--violet))]/60 shadow-sm";
  }

  if (key.includes("restaurant")) {
    return active
      ? "bg-[hsl(var(--restaurant))] text-white shadow-md"
      : dark
      ? "bg-neutral-900/80 text-[hsl(var(--restaurant))] border border-[hsl(var(--restaurant))]/70 shadow-sm"
      : "bg-white text-[hsl(var(--restaurant))] border border-[hsl(var(--restaurant))]/60 shadow-sm";
  }

  if (
    key.includes("microbrasserie") ||
    key.includes("brasserie") ||
    key.includes("bar") ||
    key.includes("pub")
  ) {
    return active
      ? "bg-[hsl(var(--micro))] text-white shadow-md"
      : dark
      ? "bg-neutral-900/80 text-[hsl(var(--micro))] border border-[hsl(var(--micro))]/70 shadow-sm"
      : "bg-white text-[hsl(var(--micro))] border border-[hsl(var(--micro))]/60 shadow-sm";
  }

  if (key.includes("librairie") || key.includes("bouquinerie")) {
    return active
      ? "bg-[hsl(var(--blue))] text-white shadow-md"
      : dark
      ? "bg-neutral-900/80 text-[hsl(var(--blue))] border border-[hsl(var(--blue))]/70 shadow-sm"
      : "bg-white text-[hsl(var(--blue))] border border-[hsl(var(--blue))]/60 shadow-sm";
  }

  if (key.includes("monument") || key.includes("poi")) {
    return active
      ? "bg-[hsl(var(--poi))] text-white shadow-md"
      : dark
      ? "bg-neutral-900/80 text-[hsl(var(--poi))] border border-[hsl(var(--poi))]/70 shadow-sm"
      : "bg-white text-[hsl(var(--poi))] border border-[hsl(var(--poi))]/60 shadow-sm";
  }

  return active
    ? "bg-[hsl(var(--brand))] text-white shadow-md"
    : dark
    ? "bg-neutral-900/80 text-[hsl(var(--brand))] border border-[hsl(var(--brand))]/70 shadow-sm"
    : "bg-white text-[hsl(var(--brand))] border border-[hsl(var(--brand))]/60 shadow-sm";
}

function FilterPill({
  label,
  active,
  onClick,
  dark,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  dark: boolean;
}) {
  const styleClasses = getCategoryStyle(label, active, dark);
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full px-3 py-1 text-[11px] font-medium transition " +
        styleClasses
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
  dark,
}: {
  categories: string[];
  activeCategory: string | "ALL";
  onCategoryChange: (value: string | "ALL") => void;
  dark: boolean;
}) {
  const [showAll, setShowAll] = React.useState(false);
  const MAX = 3;
  const visible = showAll ? categories : categories.slice(0, MAX);
  const hidden = showAll ? 0 : Math.max(0, categories.length - MAX);

  const moreButtonClass = dark
    ? "rounded-full px-3 py-1 text-[11px] font-medium bg-neutral-900/80 text-neutral-100 border border-neutral-600 shadow-sm hover:bg-neutral-800"
    : "rounded-full px-3 py-1 text-[11px] font-medium bg-[#A7A7A7] text-black border border-[#7A7A7A] shadow-sm hover:bg-[#8F8F8F]";

  return (
    <div className="flex flex-wrap gap-1.5 justify-end">
      <FilterPill
        label="Tous"
        active={activeCategory === "ALL"}
        onClick={() => onCategoryChange("ALL")}
        dark={dark}
      />

      {visible.map((cat) => (
        <FilterPill
          key={cat}
          label={cat}
          active={activeCategory === cat}
          onClick={() => onCategoryChange(cat)}
          dark={dark}
        />
      ))}

      {hidden > 0 && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className={moreButtonClass}
        >
          +{hidden}
        </button>
      )}

      {showAll && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className={moreButtonClass}
        >
          - masquer
        </button>
      )}
    </div>
  );
}

function MobileBottomSheet({
  business,
  mode,
  onClose,
  onExpand,
  onPeek,
  dark,
}: {
  business: Business | null;
  mode: "closed" | "peek" | "full";
  onClose: () => void;
  onExpand: () => void;
  onPeek: () => void;
  dark: boolean;
}) {
  const [renderedBusiness, setRenderedBusiness] = React.useState<Business | null>(business);
  const [animationState, setAnimationState] = React.useState<"closed" | "peek" | "full" | "closing">("closed");

  React.useEffect(() => {
  if (mode === "closed") {
    setAnimationState("closed");
    setRenderedBusiness(null);
    return;
  }

  if (business) {
    setRenderedBusiness(business);
  }
  setAnimationState(mode);
}, [business, mode]);

  if (!renderedBusiness) return null;

  const heightClass =
    animationState === "full"
      ? "h-[80vh] max-h-[85vh]"
      : "h-[32vh] max-h-[36vh]";

  const isFlo = renderedBusiness.name.trim().toLowerCase() === "espace flo";

  const sheetOuterClass = dark
    ? "mx-3 rounded-2xl bg-neutral-900 border border-neutral-700 shadow-lg overflow-hidden"
    : "mx-3 rounded-2xl bg-white border border-neutral-200 shadow-lg overflow-hidden";

  const titleClass = dark
    ? "text-[15px] font-semibold text-neutral-50 truncate"
    : "text-[15px] font-semibold text-neutral-900 truncate";

  const closeButtonClass = dark
    ? "rounded-full border border-neutral-600 px-2 py-1 text-[10px] text-neutral-300"
    : "rounded-full border border-neutral-300 px-2 py-1 text-[10px] text-neutral-600";

  const typeTextClass = dark
    ? "text-[11px] text-neutral-300 mb-1"
    : "text-[11px] text-neutral-700 mb-1";

  const hoursTextClass = dark
    ? "mt-1 text-[11px] leading-snug text-neutral-100 group"
    : "mt-1 text-[11px] leading-snug text-neutral-800 group";

  const addressLinkClass = dark
    ? "block text-[11px] text-neutral-300 underline mt-2 mb-3"
    : "block text-[11px] text-neutral-700 underline mt-2 mb-3";

  const floParagraphClass = dark
    ? "text-[11px] leading-snug text-neutral-100"
    : "text-[11px] leading-snug text-neutral-800";

  const floImageWrapperClass = dark
    ? "h-[140px] w-full rounded-md overflow-hidden border border-neutral-700 bg-neutral-800"
    : "h-[140px] w-full rounded-md overflow-hidden border border-neutral-300 bg-neutral-200";

  const translateClass =
    animationState === "closed"
      ? "translate-y-full"
      : animationState === "closing"
      ? "translate-y-full"
      : "translate-y-0";

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1400] md:hidden pointer-events-none pb-3">
      <div className={sheetOuterClass + " bottom-sheet-transition " + translateClass + " pointer-events-auto"}>
        <div className={"flex flex-col " + heightClass}>
          <button
            type="button"
            onClick={() => {
              if (animationState === "full") {
                onPeek();
              } else {
                onExpand();
              }
            }}
            className="flex flex-col items-center justify-center pt-2 pb-1 gap-1"
          >
            <div className="h-1 w-10 rounded-full bg-neutral-500" />
          </button>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <h3 className={titleClass}>
                {renderedBusiness.name}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className={closeButtonClass}
              >
                Fermer
              </button>
            </div>

            {renderedBusiness.website && (
              <div className="mb-2">
                <a
                  href={renderedBusiness.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full bg-black px-3 py-1 text-[11px] font-semibold text-white"
                >
                  Site web
                </a>
              </div>
            )}

            {renderedBusiness.type && (
              <p className={typeTextClass}>
                {renderedBusiness.type}
              </p>
            )}

            {renderedBusiness.openingHours && (
              <details className={hoursTextClass}>
                <summary className="cursor-pointer select-none font-medium flex items-center gap-1">
                  Horaires
                  <span className="text-red-600 inline-block transition-transform duration-200 group-open:rotate-90">
                    ➤
                  </span>
                </summary>
                <pre className="mt-1 whitespace-pre-wrap font-sans">
                  {renderedBusiness.openingHours}
                </pre>
              </details>
            )}

            {renderedBusiness.address && (
              <a
                href={
                  "https://www.google.com/maps/search/?api=1&query=" +
                  encodeURIComponent(renderedBusiness.address)
                }
                target="_blank"
                rel="noopener noreferrer"
                className={addressLinkClass}
              >
                {renderedBusiness.address}
              </a>
            )}

            {isFlo && (
              <div className="mb-3 space-y-2">
                <p className={floParagraphClass}>
                  La mission d’ESPACE FLO : faire rayonner le talent d’ici et
                  valoriser l’achat local avec des produits éthiques et
                  écoresponsables. À l’opposé du fast fashion et de la
                  production de masse, ESPACE FLO propose une sélection de
                  produits entièrement conçus et fabriqués au Québec par des
                  designers sélectionnés, avec des pièces durables,
                  indémodables et exclusives.
                </p>
                <div className={floImageWrapperClass}>
                  <img
                    src="/images/espace-flo-inside.jpg"
                    alt="Intérieur Espace FLO"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export default function IndieMapSplitView() {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selectionVersion, setSelectionVersion] = React.useState(0);
  const [businesses, setBusinesses] = React.useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = React.useState<Business | null>(null);
  const [sheetMode, setSheetMode] = React.useState<"closed" | "peek" | "full">("closed");
  const [category, setCategory] = React.useState<string | "ALL">("ALL");
  const [cityInput, setCityInput] = React.useState("");
  const [searchCity, setSearchCity] = React.useState("");
  const [darkMap, setDarkMap] = React.useState(false);

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
          type: normalizeCategoryLabel(p.category ?? "Lieu local"),
          address: p.address ?? p.city ?? "",
          website: p.website,
          openingHours:
            typeof p.openingHours === "string"
              ? p.openingHours
              : typeof p.opening_hours === "string"
              ? p.opening_hours
              : typeof p.openinghours === "string"
              ? p.openinghours
              : undefined,
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

  const rawCategories = Array.from(
    new Set(
      source
        .map((b) => b.type)
        .filter((t) => !!t && t.trim().length > 0)
    )
  );

  const isClothing = (t: string) => {
    const k = t.toLowerCase();
    return (
      k.includes("friperie") ||
      k.includes("mode éthique") ||
      k.includes("mode ethique")
    );
  };

  const isBook = (t: string) => {
    const k = t.toLowerCase();
    return (
      k.includes("librairie") ||
      k.includes("bouquinerie") ||
      k.includes("spécialisée") ||
      k.includes("specialisee")
    );
  };

  const isGrocery = (t: string) => {
    const k = t.toLowerCase();
    return (
      k.includes("épicerie locale") ||
      k.includes("epicerie locale") ||
      k.includes("épicerie zéro") ||
      k.includes("epicerie zero") ||
      k.includes("zero déchet") ||
      k.includes("zerodechet") ||
      k.includes("épicerie") ||
      k.includes("epicerie")
    );
  };

  const isRestaurant = (t: string) => {
    const k = t.toLowerCase();
    return (
      k.includes("restaurant locavore") ||
      k.includes("restaurant lacovore") ||
      k.includes("restaurant locavore abordable") ||
      k.includes("bistrot terroir") ||
      k.includes("bistro terroir") ||
      k.includes("bistrot terroir et local") ||
      k.includes("bistro terroir et local") ||
      k.includes("cuisine du marché") ||
      k.includes("cuisine du marche") ||
      k.includes("restaurant")
    );
  };

  const isBakery = (t: string) => {
    const k = t.toLowerCase();
    return k.includes("boulangerie");
  };

  const hasClothing = rawCategories.some(isClothing);
  const hasBook = rawCategories.some(isBook);
  const hasGrocery = rawCategories.some(isGrocery);
  const hasRestaurant = rawCategories.some(isRestaurant);
  const hasBakery = rawCategories.some(isBakery);

  const categories = [
    ...rawCategories.filter(
      (t) =>
        !isClothing(t) &&
        !isBook(t) &&
        !isGrocery(t) &&
        !isRestaurant(t) &&
        !isBakery(t)
    ),
    ...(hasBook ? ["Librairie"] : []),
    ...(hasGrocery ? ["Épicerie"] : []),
    ...(hasRestaurant ? ["Restaurant"] : []),
    ...(hasBakery ? ["Boulangerie"] : []),
  ];

  const filtered = source.filter((b) => {
    const k = (b.type || "").toLowerCase();

    if (category === "ALL") return true;

    if (category === "Librairie") {
      return (
        k.includes("librairie") ||
        k.includes("bouquinerie") ||
        k.includes("spécialisée") ||
        k.includes("specialisee")
      );
    }

    if (category === "Épicerie") {
      return (
        k.includes("épicerie locale") ||
        k.includes("epicerie locale") ||
        k.includes("épicerie zéro") ||
        k.includes("epicerie zero") ||
        k.includes("zero déchet") ||
        k.includes("zerodechet") ||
        k.includes("épicerie") ||
        k.includes("epicerie")
      );
    }

    if (category === "Restaurant") {
      return (
        k.includes("restaurant locavore") ||
        k.includes("restaurant lacovore") ||
        k.includes("restaurant locavore abordable") ||
        k.includes("bistrot terroir") ||
        k.includes("bistro terroir") ||
        k.includes("bistrot terroir et local") ||
        k.includes("bistro terroir et local") ||
        k.includes("cuisine du marché") ||
        k.includes("cuisine du marche") ||
        k.includes("restaurant")
      );
    }

    if (category === "Boulangerie") {
      return k.includes("boulangerie");
    }

    return b.type === category;
  });

  const handleCitySearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSearchCity(cityInput);
  };

  const searchFormClass = darkMap
    ? "flex items-center gap-2 rounded-full bg-neutral-900/95 border border-neutral-700 px-3 py-1.5 shadow-sm"
    : "flex items-center gap-2 rounded-full bg-white/95 border border-neutral-300 px-3 py-1.5 shadow-sm";

  const searchLabelClass = darkMap
    ? "text-[11px] text-neutral-300"
    : "text-[11px] text-neutral-500";

  const searchInputClass = darkMap
    ? "flex-1 bg-transparent text-[16px] md:text-[11px] text-neutral-50 placeholder:text-neutral-500 focus:outline-none"
    : "flex-1 bg-transparent text-[16px] md:text-[11px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none";

  const clearButtonClass = darkMap
    ? "text-[11px] text-neutral-300"
    : "text-[11px] text-neutral-500";

  return (
    <div className="h-full w-full relative">
      <div className="absolute inset-0">
        <MapPanel
          items={filtered}
          selectedId={selectedId}
          selectionVersion={selectionVersion}
          onSelect={(id) => {
            if (!id) {
              setSelectedId(null);
              setSelectedBusiness(null);
              setSheetMode("closed");
              return;
            }
            setSelectedId(id);
            setSelectionVersion((v) => v + 1);
            const biz =
              filtered.find((b) => b.id === id) ||
              source.find((b) => b.id === id) ||
              null;
            setSelectedBusiness(biz);
            if (typeof window !== "undefined" && window.innerWidth < 768) {
              setSheetMode("peek");
            }
          }}
          searchCity={searchCity}
          darkMap={darkMap}
          onToggleDarkMap={() => setDarkMap((prev) => !prev)}
        />
      </div>

      <div className="absolute top-3 left-0 right-0 z-[1300] pointer-events-none flex justify-center">
        <div className="pointer-events-auto w-[calc(100%-2rem)] max-w-[420px]">
          <form
            onSubmit={handleCitySearchSubmit}
            className={searchFormClass}
          >
            <span className={searchLabelClass}>Ville</span>
            <input
              type="text"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              placeholder="Montréal, Paris..."
              className={searchInputClass}
            />
            {cityInput && (
              <button
                type="button"
                onClick={() => {
                  setCityInput("");
                  setSearchCity("");
                }}
                className={clearButtonClass}
              >
                ✕
              </button>
            )}
          </form>
        </div>
      </div>

      <div className="absolute bottom-40 md:bottom-6 right-4 z-[1400] w-[min(380px,60vw)] indie-filter-bar">
        <FilterBar
          categories={categories}
          activeCategory={category}
          onCategoryChange={setCategory}
          dark={darkMap}
        />
      </div>


      <div className="absolute bottom-3 left-0 right-0 z-[1350] flex justify-center">
        <nav
          className={
            (darkMap
              ? "bg-neutral-900/95 text-neutral-100 border border-neutral-700"
              : "bg-white/95 text-neutral-900 border border-neutral-200") +
            " rounded-full px-4 py-2 shadow-md flex items-center gap-6 text-xs font-medium"
          }
        >
          <a href="/a-propos" className="flex items-center gap-1 hover:opacity-80">
            <span>À propos</span>
          </a>
          <a href="/contribution" className="flex items-center gap-1 hover:opacity-80">
            <span>Contribution</span>
          </a>
          <a
            href="/pour-les-commercants"
            className="flex items-center gap-1 hover:opacity-80"
          >
            <span>Pour les commerçants</span>
          </a>
        </nav>
      </div>

      <MobileBottomSheet
        business={selectedBusiness}
        mode={sheetMode}
        onClose={() => {
          setSheetMode("closed");
          setSelectedBusiness(null);
          setSelectedId(null);
        }}
        onExpand={() => setSheetMode("full")}
        onPeek={() => setSheetMode("peek")}
        dark={darkMap}
      />
    </div>
  );
}
