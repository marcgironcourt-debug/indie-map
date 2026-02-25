"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import MapPanel from "@/components/MapPanel";

export type Business = {
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

function getCategoryEmotion(type: string): string {
  const key = (type || "").toLowerCase();

  if (key.includes("café") || key.includes("cafe") || key.includes("brunch")) {
    return "Un endroit où l’on vient pour le café, et où l’on reste pour l’atmosphère.";
  }

  if (key.includes("épicerie") || key.includes("epicerie")) {
    return "Une façon plus humaine de remplir son panier — plus proche des gens et du territoire.";
  }

  if (key.includes("boulangerie")) {
    return "Le genre d’adresse qu’on garde pour soi… puis qu’on finit par partager.";
  }

  if (key.includes("librairie") || key.includes("bouquinerie")) {
    return "Un espace pour ralentir, feuilleter, et laisser une idée nous attraper.";
  }

  if (key.includes("restaurant") || key.includes("bistro") || key.includes("cuisine")) {
    return "Une table sincère, où l’on sent qu’ici, on fait les choses avec attention.";
  }

  if (key.includes("brasserie") || key.includes("bar") || key.includes("pub")) {
    return "Une adresse vivante, parfaite pour s’arrêter… et prolonger la soirée.";
  }

  if (key.includes("vêtement") || key.includes("vetement") || key.includes("friperie") || key.includes("mode")) {
    return "Un lieu qui prouve qu’on peut s’habiller avec du sens, sans renoncer au style.";
  }

  if (key.includes("boutique")) {
    return "Des trouvailles choisies avec goût — on ressort rarement les mains vides.";
  }

  return "Un lieu indépendant sélectionné pour ce qu’il apporte au tissu local.";
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
      ? "bg-[#5E2A6E] text-black"
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
        "im-chip px-3 py-1 text-[11px] font-medium transition " + (active ? "im-chip-active " : "im-chip-idle ") + styleClasses
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
  onCategoryChange: (c: string | "ALL") => void;
}) {
  const rowClass =
    "flex items-center gap-2 px-6 py-2 overflow-x-auto whitespace-nowrap";

  return (
    <div
      className={rowClass}
      style={(
        {
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          scrollPaddingLeft: 24,
          scrollPaddingRight: 24,
        } as React.CSSProperties & { msOverflowStyle?: "none" | "auto" | "scrollbar" }
      )}>
      <FilterPill
        label="Tous"
        active={activeCategory === "ALL"}
        onClick={() => onCategoryChange("ALL")}
        
      />

      {categories.map((c) => {
        const active = activeCategory === c;
        return (
          <FilterPill
            key={c}
            label={c}
            active={active}
            onClick={() => onCategoryChange(c)}
            
          />
        );
      })}
    </div>
  );
}



function MobileBottomSheet({
  business,
  mode,
  dark,
  onClose,
  onExpand,
  onPeek,
}: {
  business: Business | null;
  mode: "closed" | "peek" | "full";
  dark: boolean;
  onClose: () => void;
  onExpand: () => void;
  onPeek: () => void;
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
      ? "h-[70vh] max-h-[72vh]"
      : "h-[32vh] max-h-[36vh]";

  const isFlo = renderedBusiness.name.trim().toLowerCase() === "espace flo";
  const isSuper = renderedBusiness.name.trim().toLowerCase() === "super condiments";
  const isRacines = renderedBusiness.name.trim().toLowerCase() === "racines boréales";
  const isPremium = isFlo || isSuper || isRacines;

  const sheetOuterClass = dark
    ? "mx-3 rounded-2xl bg-neutral-900 border border-neutral-700 shadow-lg overflow-visible"
    : "mx-3 rounded-2xl bg-[#5C6E3B]/85 border border-neutral-200 shadow-lg overflow-visible";

  const titleClass = "text-[15px] font-semibold text-neutral-900 truncate";

    const closeButtonClass = "inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 text-[14px] text-neutral-600";

  const typeTextClass = "text-[11px] text-neutral-700 mb-1";

  const hoursTextClass = "mt-1 text-[11px] leading-snug text-neutral-800 group";

  const addressLinkClass = "block text-[11px] text-neutral-700 underline mt-2 mb-3";

  const floParagraphClass = "text-[11px] leading-snug text-neutral-800";

  const floImageWrapperClass = "h-[140px] w-full rounded-md overflow-hidden border border-neutral-300 bg-neutral-200";

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
            <span className="text-neutral-500 text-lg">
              {animationState === "full" ? "▼" : "▲"}
            </span>
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
                ✕
              </button>
            </div>

            {renderedBusiness.website && (
              <div className="mb-2">
                <a
                  href={renderedBusiness.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={
                    isPremium
                      ? "inline-flex items-center rounded-full bg-[#FF8FC7] px-3 py-1 text-[11px] font-semibold text-black hover:bg-[#FF6FB6] transition"
                      : "inline-flex items-center rounded-full bg-black px-3 py-1 text-[11px] font-semibold text-white hover:bg-neutral-800 transition"
                  }
                >
                  Site web
                </a>
              </div>
            )}

            {renderedBusiness.type && (
              <div className="mb-1">
                {!isPremium && (
                  <p className={typeTextClass}>
                    {renderedBusiness.type}
                  </p>
                )}
                {isPremium && (
                  <div className="mt-1">
                    <span className="inline-flex items-center rounded-full bg-[#E4D4C2] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-800">
                      {isFlo ? "mode, art, déco" : isSuper ? "épicerie, café, brunch et buvette" : "épicerie nordique"}
                    </span>
                  </div>
                )}
              </div>
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

            {!isPremium && (
              <p className="mt-1 text-[11px] leading-snug text-[hsl(var(--leaf))]">
      {getCategoryEmotion(renderedBusiness.type)}
    </p>
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
                  <Image
                    src="/images/espace-flo-inside.jpg"
                    alt="Intérieur Espace FLO"
                    width={800}
                    height={400}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            )}

            {isSuper && (
              <div className="mb-3 space-y-2">
                <p className={floParagraphClass}>
                  Super Condiments, c’est une épicerie-café-buvette qui rassemble des produits locaux : fromages, farines, tartinades, pains, condiments et autres beaux produits du Québec. On y boit un café de microtorréfaction ou un jus frais, on mange des plats et sandwichs de saison, avec brunch le week-end et 5 à 7 autour de vins nature, bières de micro et autres breuvages d’ici.
                </p>
                <div className={floImageWrapperClass}>
                  <Image
                    src="/images/super-condiments.jpg"
                    alt="Super Condiments à Montréal"
                    width={800}
                    height={400}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            )}

            {isRacines && (
              <div className="mb-3 space-y-2">
                <p className={floParagraphClass}>
                  Racines Boréales remet le Nord au centre de l’assiette avec des produits forestiers et nordiques du Québec, transformés en condiments et ingrédients d’inspiration boréale. Qualité restaurant accessible à tout le monde, en circuit court, pour une cuisine locale, écologique et enracinée.
                </p>
                <div className={floImageWrapperClass}>
                  <Image
                    src="/images/racines-boreales.jpg"
                    alt="Racines Boréales à Montréal"
                    width={800}
                    height={400}
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
  const [heroOpen, setHeroOpen] = React.useState(false);

  React.useEffect(() => {
    type HeroDetail = { open?: boolean };
    const fn = (e: Event) => {
      const ce = e as CustomEvent<HeroDetail>;
      setHeroOpen(Boolean(ce.detail?.open));
    };
    try { window.addEventListener("im:hero", fn); } catch {}
    return () => { try { window.removeEventListener("im:hero", fn); } catch {} };
  }, []);
      const darkMap = false;
React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/v1/places");
        if (!r.ok) throw new Error("Erreur de chargement");
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
          }}          darkMap={darkMap}
          />
      </div>
      {!heroOpen && (

            <div className="absolute top-3 left-0 right-0 z-[1400] pointer-events-none flex justify-center">
        <div className="pointer-events-auto w-[calc(100%-2rem)] max-w-[520px] overflow-visible">
          <FilterBar categories={categories}
          activeCategory={category}
          onCategoryChange={setCategory} />
        </div>
      </div>
      )}

      <div className="absolute bottom-3 left-0 right-0 z-[1340] flex justify-center">
        <Link href="privacy" className="text-xs opacity-70 hover:opacity-100 underline">
          Privacy / Confidentialité
        </Link>
      </div>

      <MobileBottomSheet business={selectedBusiness}
        mode={sheetMode}
        onClose={() => {
          setSheetMode("closed");
          setSelectedBusiness(null);
          setSelectedId(null);
        }}
        onExpand={() => setSheetMode("full")}
        onPeek={() => setSheetMode("peek")}
        dark={darkMap} />
    </div>
  );
}
