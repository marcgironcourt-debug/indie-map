"use client";
import React from "react";
import Link from "next/link";
import MapPanel from "@/components/MapPanel";

type UILocale = "fr" | "en";
const ui = (locale: UILocale, fr: string, en: string) => (locale === "en" ? en : fr);
const displayCategory = (locale: UILocale, cat: string) => {
  const c = String(cat || "").trim();
  if (locale !== "en") return c;
  const k = c.toLowerCase();
  if (k.includes("lieu alternatif") || k.includes("lieu de vie")) return "Alternative place";
  if (k.includes("ferme")) return "Farm";
  if (k.includes("marché") || k.includes("marche")) return "Market";
  if (k.includes("épicerie") || k.includes("epicerie")) return "Grocery";
  if (k.includes("café") || k.includes("cafe") || k.includes("coffee") || k.includes("brunch")) return "Coffee / brunch";
  if (k.includes("boulangerie")) return "Bakery";
  if (k.includes("librairie") || k.includes("bouquinerie")) return "Bookshop";
  if (k.includes("mode") || k.includes("friperie")) return "Fashion";
  if (k.includes("brasserie") || k.includes("microbrasserie") || k.includes("bar") || k.includes("pub")) return "Brewery / bar / pub";
  if (k.includes("atelier")) return "Workshop";
  if (k.includes("monument") || k.includes("poi")) return "Monument";
  if (k.includes("boutique")) return "Shop";
  if (k.includes("restaurant")) return "Restaurant";
  if (k.includes("lieu local")) return "Local place";
  return c;
};



type Business = {
  id: string;
  name: string;
  type: string;
  address?: string;
  website?: string;
  openingHours?: string;
  phone?: string;
  panoramaImage?: string;
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
  const key = (raw || "").toLowerCase();

  if (key.includes("lieu alternatif") || key.includes("lieu de vie")) {
    return "Lieu alternatif";
  }

  if (key.includes("café") || key.includes("cafe") || key.includes("coffee") || key.includes("brunch")) {
    return "Café / brunch";
  }





  if (key.includes("épicerie") || key.includes("epicerie") || key.includes("zéro déchet") || key.includes("zero dechet")) {
    return "Épicerie";
  }

  if (key.includes("boulangerie")) {
    return "Boulangerie";
  }

  if (key.includes("librairie") || key.includes("bouquinerie")) {
    return "Librairie";
  }

  if (key.includes("restaurant") || key.includes("bistro") || key.includes("cuisine")) {
    return "Restaurant";
  }

  if (key.includes("microbrasserie") || key.includes("brasserie") || key.includes("pub") || key.includes("bar") || key.includes("bar à vin") || key.includes("bar a vin")) {
    return "Brasserie / bar / pub";
  }

  if (key.includes("friperie") || key.includes("mode éthique") || key.includes("mode ethique") || key.includes("vêtement") || key.includes("vetement") || key.includes("vêtements") || key.includes("vetements") || key.includes("textile") || key.includes("mode")) {
    return "Mode";
  }

  if (key.includes("atelier")) {
    return "Atelier";
  }

  if (key.includes("marché") || key.includes("marche") || key.includes("market") || key.includes("farmers market") || key.includes("public market") || key.includes("greenmarket")) {
    return "Marché";
  }

  
  if (key.includes("ferme") || key.includes("farm")) {
    return "Ferme";
  }

if (key.includes("boutique")) {
    return "Boutique";
  }

  return "Boutique";
}


function getCategoryStyle(cat: string, active: boolean): string {
  const key = cat.toLowerCase();


  if (key.includes("atelier")) {
    return active
      ? "bg-[#1E3A8A] text-white"
      : "bg-[#5C6E3B]/85 text-[#1E3A8A] border border-[#1E3A8A]/60";
  }
  if (key.includes("café") || key.includes("cafe")) {
    return active
      ? "bg-[hsl(var(--cafe))] text-white"
      : "bg-[#5C6E3B]/85 text-[hsl(var(--cafe))] border border-[hsl(var(--cafe))]/60";
  }

  if (key.includes("épicerie") || key.includes("epicerie")) {
    return active
      ? "bg-[#FF8FC7] text-black"
      : "bg-[#5C6E3B]/85 text-[#FF8FC7] border border-[#FF8FC7]/60";
  }


  if (key.includes("ferme") || key.includes("farm")) {
    return active
      ? "bg-[#F6FF00] text-black"
      : "bg-[#5C6E3B]/85 text-[#F6FF00] border border-[#F6FF00]/60";
  }

  if (key.includes("boutique")) {
    return active
      ? "bg-black text-white"
      : "bg-[#5C6E3B]/85 text-black border border-black/60";
  }

  if (key.includes("boulangerie")) {
    return active
      ? "bg-[#8C5A3C] text-white"
      : "bg-[#5C6E3B]/85 text-[#8C5A3C] border border-[#8C5A3C]/60";
  }

  if (
    key.includes("friperie") ||
    key.includes("mode éthique") ||
    key.includes("mode ethique") ||
    key.includes("vêtement") ||
    key.includes("vetement") ||
    key.includes("mode")
  ) {
    return active
      ? "bg-[hsl(var(--violet))] text-white"
      : "bg-[#5C6E3B]/85 text-[hsl(var(--violet))] border border-[hsl(var(--violet))]/60";
  }

  if (key.includes("restaurant")) {
    return active
      ? "bg-[hsl(var(--restaurant))] text-white"
      : "bg-[#5C6E3B]/85 text-[hsl(var(--restaurant))] border border-[hsl(var(--restaurant))]/60";
  }

  if (
    key.includes("microbrasserie") ||
    key.includes("brasserie") ||
    key.includes("bar") ||
    key.includes("pub")
  ) {
    return active
      ? "bg-[hsl(var(--micro))] text-white"
      : "bg-[#5C6E3B]/85 text-[hsl(var(--micro))] border border-[hsl(var(--micro))]/60";
  }

  if (key.includes("librairie") || key.includes("bouquinerie")) {
    return active
      ? "bg-[hsl(var(--blue))] text-white"
      : "bg-[#5C6E3B]/85 text-[hsl(var(--blue))] border border-[hsl(var(--blue))]/60";
  }

  if (key.includes("monument") || key.includes("poi")) {
    return active
      ? "bg-[hsl(var(--poi))] text-white"
      : "bg-[#5C6E3B]/85 text-[hsl(var(--poi))] border border-[hsl(var(--poi))]/60";
  }
  if (key.includes("lieu alternatif") || key.includes("lieu de vie")) {
    return active
      ? "bg-[#00F5FF] text-black"
      : "bg-[#5C6E3B]/85 text-[#00F5FF] border border-[#00F5FF]/60";
  }


  if (key.includes("marché") || key.includes("marche") || key.includes("market")) {
    return active
      ? "bg-[#39FF14] text-black"
      : "bg-[#5C6E3B]/85 text-[#39FF14] border border-[#39FF14]/60";
  }

  return active
    ? "bg-[hsl(var(--brand))] text-white"
    : "bg-[#5C6E3B]/85 text-[hsl(var(--brand))] border border-[hsl(var(--brand))]/60";
}

function FilterPill({
  label,
  kind,
  active,
  onClick,
}: {
  label: string;
  
  kind?: string;
active: boolean;
  onClick: () => void;
}) {
  const styleClasses = getCategoryStyle((kind || label), active);
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "im-chip px-4 py-[4px] text-[13px] min-h-[28px] !rounded-2xl font-medium transition md:px-3 md:py-1 md:text-[11px] md:min-h-0 " + (active ? "im-chip-active " : "im-chip-idle ") + styleClasses
      }
    >
      {label}
    </button>
  );
}


function FilterBar({
  locale,
  categories,
  activeCategory,
  onCategoryChange,
}: {
  locale: UILocale;
  categories: string[];
  activeCategory: string | "ALL";
  onCategoryChange: (c: string | "ALL") => void;
}) {
  const rowClass =
    "flex items-center gap-2 px-0 py-2 overflow-x-auto overflow-y-visible whitespace-nowrap";

  return (
    <div
      className={rowClass}
      style={(
        {
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          scrollPaddingLeft: 0,
          scrollPaddingRight: 0,
        } as React.CSSProperties & { msOverflowStyle?: "none" | "auto" | "scrollbar" }
      )}>
      <FilterPill kind="ALL"
        label={ui(locale,"Tous","All")}
        active={activeCategory === "ALL"}
        onClick={() => onCategoryChange("ALL")}
        
      />

      {categories.map((c) => {
        const active = activeCategory === c;
        return (
          <FilterPill kind={c}
            key={c}
            label={displayCategory(locale, c)}
            active={active}
            onClick={() => onCategoryChange(c)}
            
          />
        );
      })}
    </div>
  );
}



export default function IndieMapSplitView({ locale, discoverId, entry }: { locale: UILocale; discoverId?: string | null; entry?: string | null }) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selectionVersion, setSelectionVersion] = React.useState(0);
  const [businesses, setBusinesses] = React.useState<Business[]>([]);
  const [category, setCategory] = React.useState<string | "ALL">("ALL");
  const [heroOpen, setHeroOpen] = React.useState(false);
  const needsAtomicReveal = Boolean(discoverId) || entry === "explore";
  const [discoverUiReady, setDiscoverUiReady] = React.useState<boolean>(!needsAtomicReveal);

  React.useEffect(() => {
    type HeroDetail = { open?: boolean };
    const fn = (e: Event) => {
      const ce = e as CustomEvent<HeroDetail>;
      setHeroOpen(Boolean(ce.detail?.open));
    };
    try { window.addEventListener("im:hero", fn); } catch {}
    return () => { try { window.removeEventListener("im:hero", fn); } catch {} };
  }, [locale]);
  React.useEffect(() => {
    if (!discoverId) return;
    if (!businesses.some((b) => String(b.id) === String(discoverId))) return;
    setSelectedId(String(discoverId));
    setSelectionVersion((v) => v + 1);
  }, [discoverId, businesses]);

  React.useEffect(() => {
    setDiscoverUiReady(!needsAtomicReveal);
  }, [needsAtomicReveal]);

  React.useEffect(() => {
    if (!needsAtomicReveal) return;
    let revealTimer: number | null = null;
    const reveal = () => {
      try {
        if (revealTimer) window.clearTimeout(revealTimer);
      } catch {}
      revealTimer = window.setTimeout(() => setDiscoverUiReady(true), 60);
    };
    const onDiscoverReady = (e: Event) => {
      try {
        const ce = e as CustomEvent<{ id?: string }>;
        if (discoverId && String(ce.detail?.id ?? "") !== String(discoverId)) return;
        reveal();
      } catch {}
    };
    const onMapReady = () => reveal();
    try { window.addEventListener("im:discover-ui-ready", onDiscoverReady as EventListener); } catch {}
    try { window.addEventListener("im:map-ui-ready", onMapReady as EventListener); } catch {}
    const t = window.setTimeout(reveal, 1800);
    return () => {
      try {
        window.clearTimeout(t);
        if (revealTimer) window.clearTimeout(revealTimer);
      } catch {}
      try { window.removeEventListener("im:discover-ui-ready", onDiscoverReady as EventListener); } catch {}
      try { window.removeEventListener("im:map-ui-ready", onMapReady as EventListener); } catch {}
    };
  }, [discoverId, needsAtomicReveal]);

React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/v1/places?locale=" + encodeURIComponent(locale));
        if (!r.ok) throw new Error(ui(locale,"Erreur de chargement","Loading error"));
        const j = await r.json();
        const arr = Array.isArray(j) ? j : j?.data || [];
        const list: Business[] = arr.map((p: {
          id: string;
          name: string;
          category?: string;
          address?: string;
          website?: string;
          openingHours?: string;
          opening_hours?: string;
          openinghours?: string;
          lat?: number;
          lng?: number;
          city?: string;
          phone?: string;
          panoramaImage?: string;
          miniText?: string;
          blurb?: string;
          description?: string;
          timeZone?: string;
        }) => ({
          id: p.id,
          name: p.name,
          type: normalizeCategoryLabel(p.category ?? "Lieu local"),
          address: p.address ?? p.city ?? "",
          website: p.website,
          phone: p.phone ?? "",
          panoramaImage: p.panoramaImage ?? "",
          miniText: p.miniText ?? p.blurb ?? p.description ?? "",
          timeZone: p.timeZone ?? "",
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
  }, [locale]);
  const hasData = businesses.length > 0;
  const source = hasData ? businesses : DEMO;
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

  const isAtelier = (t: string) => {
    const k = t.toLowerCase();
    return k.includes("atelier");
  };

  const isMarket = (t: string) => {
    const k = t.toLowerCase();
    return (
      k.includes("marché") ||
      k.includes("marche") ||
      k.includes("market") ||
      k.includes("farmers market") ||
      k.includes("farmer\x27s market") ||
      k.includes("greenmarket") ||
      k.includes("public market")
    );
  };

  const hasBook = rawCategories.some(isBook);
  const hasGrocery = rawCategories.some(isGrocery);
  const hasRestaurant = rawCategories.some(isRestaurant);
  const hasBakery = rawCategories.some(isBakery);
  const hasAtelier = rawCategories.some(isAtelier);
  const hasMarket = rawCategories.some(isMarket);

  const stableCategories = [
    "Restaurant",
    "Lieu alternatif",
    "Ferme",
    "Marché",
    "Épicerie",
    "Café / brunch",
    "Boulangerie",
    "Librairie",
    "Mode",
    "Brasserie / bar / pub",
    "Atelier",
    "Boutique",
    "Monument",
  ];
  let categories = [
    ...rawCategories.filter(
      (t) =>
        !isClothing(t) &&
        !isBook(t) &&
        !isGrocery(t) &&
        !isRestaurant(t) &&
        !isBakery(t) &&
        !isAtelier(t) &&
        !isMarket(t)
    ),
    ...(hasBook ? ["Librairie"] : []),
    ...(hasGrocery ? ["Épicerie"] : []),
    ...(hasRestaurant ? ["Restaurant"] : []),
    ...(hasBakery ? ["Boulangerie"] : []),
    ...(hasAtelier ? ["Atelier"] : []),
    ...(hasMarket ? ["Marché"] : []),
  ];

  if (!categories.includes("Ferme")) categories.push("Ferme");
  if (!categories.includes("Marché")) categories.push("Marché");
  if (!categories.includes("Lieu alternatif")) categories.push("Lieu alternatif");
  categories = Array.from(new Set(categories));

  const priority = ["Restaurant", "Lieu alternatif", "Ferme", "Marché", "Épicerie"]; 
  categories = [
    ...priority.filter((x) => categories.includes(x)),
    ...categories.filter((x) => !priority.includes(x)),
  ];

  

  if (!hasData) categories = stableCategories;
const filtered = source.filter((b) => {
    const k = (b.type || "").toLowerCase();

    if (category == null || category === "ALL") return true;

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

    if (category === "Lieu alternatif") {
      return k.includes("alternatif") || k.includes("alternative");
    }

    if (category === "Marché") {
      return (
        k.includes("marché") ||
        k.includes("marche") ||
        k.includes("market") ||
        k.includes("farmers market") ||
        k.includes("farmer\x27s market") ||
        k.includes("greenmarket") ||
        k.includes("public market")
      );
    }

    if (category === "Boulangerie") {
      return k.includes("boulangerie");
    }

    if (category === "Atelier") {
      return k.includes("atelier");
    }

    return b.type === category;
  });

            return (
    <div className="h-full w-full relative">
      <div className="absolute inset-0">
        <MapPanel
          items={filtered}
          selectedId={selectedId}
          selectionVersion={selectionVersion}
          overlaysReady={discoverUiReady}
          homeOverlay={!heroOpen ? (
            <div
              className="absolute z-[1450] pointer-events-auto"
              style={{ right: "12px", bottom: "calc(env(safe-area-inset-bottom) + 56px)" }}
            >
              <Link
                href={`/${locale}`}
                aria-label={locale === "en" ? "Back to home" : "Retour à l'accueil"}
                className="flex items-center justify-center w-11 h-11 rounded-t-xl rounded-b-none bg-[#262626] text-white shadow-lg backdrop-blur-md border border-[#404040] border-b border-b-transparent"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 4l9 6.5M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9" />
                </svg>
              </Link>
            </div>
          ) : null}
          topOverlay={!heroOpen ? (
            <div className="absolute left-0 right-0 z-[1400] pointer-events-none" style={{ top: "env(safe-area-inset-top)" }}>
              <div id="im-filters" className="pointer-events-auto w-screen overflow-visible">
                <FilterBar locale={locale} categories={categories}
                activeCategory={category}
                onCategoryChange={setCategory} />
              </div>
            </div>
          ) : null}
          onSelect={(id) => {
            if (!id) {
              setSelectedId(null);
              return;
            }
            setSelectedId(id);
            setSelectionVersion((v) => v + 1);
          }}          />
      </div>
      <div className="absolute bottom-3 left-0 right-0 z-[1340] flex justify-center">
        <Link href="/privacy" className="text-xs opacity-70 hover:opacity-100 underline"></Link>
      </div>


    </div>
  );
}
