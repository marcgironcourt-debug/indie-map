"use client";
import React from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Biz = {
  id: string;
  name: string;
  address?: string | null;
  website?: string | null;
  openingHours?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  type?: string | null;
};

const BUSINESS_DESCRIPTIONS: Record<string, string> = {
  "Espace FLO": "Boutique-galerie qui réunit des créateurs locaux, loin du fast fashion, avec des pièces durables et fabriquées au Québec.",
  "Café Myriade": "Café de spécialité et lieu de rendez-vous chaleureux pour boire un bon café, bruncher et faire une pause en plein centre-ville.",
  "Automne Boulangerie": "Boulangerie de quartier qui travaille des farines de qualité pour des pains et viennoiseries faits avec soin.",
  "Sarrasin Boulangerie": "Boulangerie axée sur le sarrasin et les céréales anciennes, avec une approche artisanale et locale.",
  "Hof Kelsten": "Boulangerie emblématique de Montréal, connue pour ses pains généreux et sa cuisine d’inspiration européenne.",
};

const MAX_BOUNDS = L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180));

function normalizeType(t?: string | null): "cafe" | "epicerie" | "friperie" | "librairie" | "restaurant" | "boutique" | "microbrasserie" | "other" {
  const v = (t || "").toLowerCase();
  if (v.includes("café") || v.includes("cafe") || v.includes("coffee") || v.includes("brunch")) return "cafe";
  if (v.includes("microbrasserie") || v.includes("brasserie") || v.includes("bar") || v.includes("pub")) return "microbrasserie";
  if (v.includes("épicerie") || v.includes("epicerie") || v.includes("grocery")) return "epicerie";
  if (
    v.includes("friperie") ||
    v.includes("frip") ||
    v.includes("thrift") ||
    v.includes("mode éthique") ||
    v.includes("mode ethique") ||
    v.includes("vêtement") ||
    v.includes("vetement") ||
    v.includes("clothes") ||
    v.includes("fashion")
  )
    return "friperie";
  if (
    v.includes("restaurant locavore") ||
    v.includes("restaurant lacovore") ||
    v.includes("restaurant locavore abordable") ||
    v.includes("bistrot terroir") ||
    v.includes("bistro terroir") ||
    v.includes("bistrot terroir et local") ||
    v.includes("bistro terroir et local") ||
    v.includes("cuisine du marché") ||
    v.includes("cuisine du marche") ||
    v.includes("restaurant")
  )
    return "restaurant";
  if (v.includes("librairie") || v.includes("bouquinerie") || v.includes("bookstore") || v.includes("book")) return "librairie";
  if (v.includes("boutique locale") || v.includes("boutique")) return "boutique";
  return "other";
}

function makePin(color: string, stroke: string, selected: boolean) {
  const size = selected ? 26 : 24;
  const height = selected ? 38 : 36;
  const circleR = selected ? 4.5 : 4;
  const shadow = selected
    ? "<defs><filter id=\"shadow\"><feDropShadow dx=\"0\" dy=\"1\" stdDeviation=\"1.2\" flood-color=\"rgba(0,0,0,0.4)\" /></filter></defs>"
    : "";
  const groupOpen = selected ? "<g filter=\"url(#shadow)\">" : "";
  const groupClose = selected ? "</g>" : "";
  const html =
    '<svg width="' +
    size +
    '" height="' +
    height +
    '" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">' +
    shadow +
    groupOpen +
    '<path d="M12 2C7 2 3 6.2 3 11.5C3 18.5 8 24 12 29C16 24 21 18.5 21 11.5C21 6.2 17 2 12 2Z" fill="' +
    color +
    '" stroke="' +
    stroke +
    '" stroke-width="1.2"/>' +
    '<path d="M8.8 7.2C9.6 6.1 10.7 5.4 12 5.2C13.4 5 14.9 5.4 16.1 6.2" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="1.1" stroke-linecap="round"/>' +
    groupClose +
    "</svg>";
  return L.divIcon({
    className: "indie-pin",
    html,
    iconSize: [size * 0.45, height * 0.45],
    iconAnchor: [size * 0.3, height * 0.6],
    popupAnchor: [0, -height * 0.6 + 4],
  });
}

const ICONS = {
  cafe: {
    normal: makePin("hsl(var(--cafe))", "#FDF7F2", false),
    selected: makePin("hsl(var(--cafe))", "#FDF7F2", true),
  },
  epicerie: {
    normal: makePin("#728A4A", "#FDF7F2", false),
    selected: makePin("#5C6E3B", "#FDF7F2", true),
  },
  friperie: {
    normal: makePin("hsl(var(--violet))", "#FDF7F2", false),
    selected: makePin("hsl(var(--violet))", "#FDF7F2", true),
  },
  librairie: {
    normal: makePin("#3B82F6", "#FDF7F2", false),
    selected: makePin("#1D4ED8", "#FDF7F2", true),
  },
  restaurant: {
    normal: makePin("hsl(var(--restaurant))", "#FDF7F2", false),
    selected: makePin("hsl(var(--restaurant))", "#FDF7F2", true),
  },
  boutique: {
    normal: makePin("#000000", "#FDF7F2", false),
    selected: makePin("#000000", "#FDF7F2", true),
  },
  microbrasserie: {
    normal: makePin("hsl(var(--micro))", "#FDF7F2", false),
    selected: makePin("hsl(var(--micro))", "#FDF7F2", true),
  },
  other: {
    normal: makePin("#8C5A3C", "#FDF7F2", false),
    selected: makePin("#6D4330", "#FDF7F2", true),
  },
};

function iconForType(t?: string | null, selected?: boolean) {
  const key = normalizeType(t);
  const set = ICONS[key as keyof typeof ICONS];
  return selected ? set.selected : set.normal;
}

function MapClickClear({ onClear }: { onClear?: () => void }) {
  useMapEvents({
    click() {
      if (onClear) onClear();
    },
  });
  return null;
}

function MapViewPersistence({
  onUpdate,
}: {
  onUpdate: (center: [number, number], zoom: number) => void;
}) {
  const map = useMapEvents({
    moveend() {
      const c = map.getCenter();
      const z = map.getZoom();
      const payload = {
        center: [c.lat, c.lng],
        zoom: z,
      };
      try {
        window.localStorage.setItem("indieMapView", JSON.stringify(payload));
      } catch {}
    },
  });
  return null;
}

function resolveCityCenter(query: string): { center: [number, number]; zoom: number } | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  if (q.includes("montréal") || q.includes("montreal")) return { center: [45.5017, -73.5673], zoom: 13 };
  if (q.includes("paris")) return { center: [48.8566, 2.3522], zoom: 13 };
  if (q.includes("new york") || q.includes("nyc")) return { center: [40.7128, -74.006], zoom: 12 };
  if (q.includes("bordeaux")) return { center: [44.8378, -0.5792], zoom: 13 };
  if (q.includes("toronto")) return { center: [43.6532, -79.3832], zoom: 12 };
  if (q.includes("los angeles") || q.includes("la ")) return { center: [34.0522, -118.2437], zoom: 11 };
  if (q.includes("tokyo")) return { center: [35.6762, 139.6503], zoom: 12 };
  if (q.includes("lausanne")) return { center: [46.5197, 6.6323], zoom: 13 };
  if (q.includes("marseille")) return { center: [43.2965, 5.3698], zoom: 12 };
  if (q.includes("vancouver")) return { center: [49.2827, -123.1207], zoom: 12 };
  if (q.includes("chicago")) return { center: [41.8781, -87.6298], zoom: 12 };
  return null;
}

export default function ClientMap({
  items = [],
  selectedId,
  selectionVersion,
  onSelect,
  searchCity,
  darkMap = false,
  onToggleDarkMap,
}: {
  items?: Biz[];
  selectedId?: string | null;
  selectionVersion?: number;
  onSelect?: (id: string) => void;
  searchCity?: string;
  darkMap?: boolean;
  onToggleDarkMap?: () => void;
}) {
  const markers = React.useMemo(() => {
    const byId = new Map<
      string,
      {
        id: string;
        name: string;
        address?: string | null;
        website?: string | null;
        openingHours?: string | null;
        latN: number;
        lngN: number;
        type?: string | null;
      }
    >();

    for (const b of items) {
      const latN = Number(b.lat);
      const lngN = Number(b.lng);
      if (!Number.isFinite(latN) || !Number.isFinite(lngN)) continue;
      if (!byId.has(b.id)) {
        byId.set(b.id, {
          id: b.id,
          name: b.name,
          address: b.address ?? null,
          website: b.website ?? null,
          openingHours: b.openingHours ?? null,
          latN,
          lngN,
          type: b.type ?? null,
        });
      }
    }

    return Array.from(byId.values());
  }, [items]);
  const mapRef = React.useRef<L.Map | null>(null);
  const tileUrl = darkMap
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const mapKey = React.useMemo(() => `${searchCity ?? "default"}`, [searchCity]);

  const [center, setCenter] = React.useState<[number, number]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("indieMapView");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (
            Array.isArray(parsed.center) &&
            typeof parsed.center[0] === "number" &&
            typeof parsed.center[1] === "number"
          ) {
            return [parsed.center[0], parsed.center[1]];
          }
        }
      } catch {}
    }
    return [45.5017, -73.5673];
  });

  const [zoom, setZoom] = React.useState<number>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("indieMapView");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed.zoom === "number") {
            return parsed.zoom;
          }
        }
      } catch {}
    }
    return 12;
  });

  const isMobile = typeof window !== "undefined" ? window.innerWidth < 768 : false;

  React.useEffect(() => {
    if (!searchCity) return;
    const preset = resolveCityCenter(searchCity);
    if (!preset) return;
    setCenter(preset.center);
    setZoom(preset.zoom);
  }, [searchCity]);

  React.useEffect(() => {
    if (!searchCity || !mapRef.current) return;
    const preset = resolveCityCenter(searchCity);
    if (!preset) return;
    const map = mapRef.current;
    map.flyTo(preset.center as any, preset.zoom ?? 12, { animate: true, duration: 0.8 });
  }, [searchCity]);

  React.useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const map = mapRef.current;
    const m = markers.find((mm) => mm.id === selectedId);
    if (!m) return;
    const target = L.latLng(m.latN, m.lngN);
    const currentZoom = map.getZoom();
    const targetZoom = Math.max(currentZoom || 2, 13);
    map.flyTo(target, targetZoom, { animate: true, duration: 0.8 });
  }, [selectedId, selectionVersion, markers]);

  const handleLocate = React.useCallback(() => {
    if (!navigator.geolocation) {
      console.warn("Geolocation non supportée par ce navigateur");
      alert("La géolocalisation n'est pas supportée par ce navigateur.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const target: [number, number] = [latitude, longitude];

        if (!mapRef.current) {
          console.warn("mapRef.current est null dans handleLocate");
          alert("La carte n'est pas encore prête. Réessaie dans une seconde.");
          return;
        }

        console.log("GEO OK", latitude, longitude);
        mapRef.current.setView(target, 15, { animate: true });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            console.warn("Permission de géolocalisation refusée");
            alert("Tu as refusé la géolocalisation pour ce site. Vérifie les réglages de localisation.");
            break;
          case error.POSITION_UNAVAILABLE:
            console.warn("Position indisponible");
            alert("La position est actuellement indisponible.");
            break;
          case error.TIMEOUT:
            console.warn("Timeout de géolocalisation");
            alert("La demande de géolocalisation a expiré. Réessaie.");
            break;
          default:
            console.warn("Erreur de géolocalisation inconnue", error);
            alert("Une erreur est survenue lors de la géolocalisation.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  const locateBase = isMobile
    ? "absolute z-[1300] top-16 right-4 flex items-center justify-center cursor-pointer"
    : "absolute z-[1300] top-4 left-4 flex items-center justify-center cursor-pointer";

  const locateTheme = "hover:opacity-90 transition";

  const locateButtonClass = locateBase + " " + locateTheme;

  const toggleBase = isMobile ? "absolute top-16 left-4 z-[1300]" : "absolute top-3 right-3 z-[1300]";

  const toggleButtonClass =
    toggleBase +
    " rounded-full p-[2px] shadow-md border " +
    (darkMap ? "border-neutral-700 bg-black/80" : "border-neutral-300 bg-white/90");

  const trackClass =
    "relative flex items-center w-[40px] h-[22px] rounded-full overflow-hidden transition-colors duration-200 " +
    (darkMap ? "bg-black" : "bg-neutral-200");

  const thumbClass =
    "absolute w-[18px] h-[18px] rounded-full bg-white shadow-sm border border-neutral-300 transform transition-transform duration-200 " +
    (darkMap ? "translate-x-[18px]" : "translate-x-[2px]");

  return (
    <div style={{ height: "100%", width: "100%" }} className="relative">
      <MapContainer
        key={mapKey}
        center={center}
        zoom={zoom}
        minZoom={2}
        maxBounds={MAX_BOUNDS}
        maxBoundsViscosity={1}
        worldCopyJump={false}
        zoomControl={!isMobile}
        attributionControl={false}
        className="h-full w-full"
        ref={mapRef}
      >
        <MapViewPersistence
          onUpdate={(c, z) => {
            setCenter(c);
            setZoom(z);
          }}
        />
        <MapClickClear
          onClear={() => {
            if (onSelect) onSelect("");
          }}
        />
        <TileLayer url={tileUrl} />
        {markers.map((b) => {
          const isFlo = b.name.trim().toLowerCase() === "espace flo";
          const isSuper = b.name.trim().toLowerCase() === "super condiments";
          const isRacines = b.name.trim().toLowerCase() === "racines boréales";
          const isPremium = isFlo || isSuper || isRacines;

          if (isMobile) {
            return (
              <Marker
                key={b.id}
                position={[b.latN, b.lngN]}
                icon={iconForType(b.type, selectedId === b.id)}
                eventHandlers={{
                  click: () => {
                    if (onSelect) onSelect(b.id);
                  },
                }}
              />
            );
          }

          return (
            <Marker
              key={b.id}
              position={[b.latN, b.lngN]}
              icon={iconForType(b.type, selectedId === b.id)}
              eventHandlers={{
                click: () => {
                  if (onSelect) onSelect(b.id);
                },
              }}
            >
              <Popup autoPan autoPanPaddingTopLeft={[10, 200]} autoPanPaddingBottomRight={[10, 10]}>
                {isPremium ? (
                  <div
                    className={
                      "space-y-2 max-w-xs rounded-[18px] px-3 pt-2 pb-4 shadow-md border " +
                      (darkMap
                        ? "bg-neutral-900 border-neutral-700 text-white"
                        : "bg-white border-[#E4D4C2] text-neutral-900")
                    }
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-1">
                          <h3 className="text-[15px] font-semibold">{b.name}</h3>
                          <div>
                            <span className="inline-flex items-center rounded-full bg-[#E4D4C2] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-800">
                              {isFlo ? "mode, art, déco" : "épicerie nordique"}
                            </span>
                          </div>
                        </div>


                    {b.website && (
                          <a
                            href={b.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-full bg-[#728A4A] px-2 py-1 text-[10px] font-semibold shadow-sm hover:bg-[#5C6E3B] transition"
                            style={{ color: "#000000" }}
                          >
                            Site web
                          </a>
                        )}
                      </div>

                      {b.address && (
                        <a
                          href={
                            "https://www.google.com/maps/search/?api=1&query=" +
                            encodeURIComponent(b.address)
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] underline"
                        >
                          {b.address}
                        </a>
                      )}

                      {b.openingHours ? (
                        <details className="mt-1 text-[11px] leading-snug group">
                          <summary className="cursor-pointer select-none font-medium flex items-center gap-1">
                            Horaires
                            <span className="text-red-600 inline-block transition-transform duration-200 group-open:rotate-90">
                              ➤
                            </span>
                          </summary>
                          <pre className="mt-1 whitespace-pre-wrap font-sans">
                            {b.openingHours}
                          </pre>
                        </details>
                      ) : (
                        <p className="text-[10px]">
                          Horaires : voir le site
                        </p>
                      )}
                    </div>

                    <p className="mt-2 text-[11px] leading-snug">
                      {isFlo
                        ? "La mission d’ESPACE FLO : faire rayonner le talent d’ici et valoriser l’achat local avec des produits éthiques et écoresponsables. À l’opposé du fast fashion et de la production de masse, ESPACE FLO propose une sélection de pièces durables, indémodables et fabriquées au Québec."
                        : isSuper
                        ? "Super Condiments, c’est une épicerie-café-buvette qui rassemble des produits locaux : fromages, farines, tartinades, pains, condiments et autres beaux produits du Québec. On y boit un café de microtorréfaction ou un jus frais, on mange des plats et sandwichs de saison, avec brunch le week-end et 5 à 7 autour de vins nature, bières de micro et autres breuvages d’ici."
                        : "Racines Boréales remet le Nord au centre de l’assiette avec des produits forestiers et nordiques du Québec, transformés en condiments et ingrédients d’inspiration boréale. Qualité restaurant accessible à tout le monde, en circuit court, pour une cuisine locale, écologique et enracinée."}
                    </p>

                    {isFlo && (
                      <div className="mt-2">
                        <div className="h-[120px] w-full rounded-md overflow-hidden border border-neutral-300 bg-neutral-200">
                          <img
                            src="/images/espace-flo-inside.jpg"
                            alt="Intérieur Espace FLO"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className={
                      "space-y-1 max-w-xs rounded-[14px] px-3 py-2 shadow-sm border " +
                      (darkMap
                        ? "bg-neutral-900 border-neutral-700 text-white"
                        : "bg-white border-[#E4D4C2] text-neutral-900")
                    }
                  >
                    <h3 className="font-semibold text-sm">
                      {b.name}
                    </h3>
                    {BUSINESS_DESCRIPTIONS[b.name] && (
                      <p className="mt-0.5 text-[11px] leading-snug text-[hsl(var(--leaf))]">
                        {BUSINESS_DESCRIPTIONS[b.name]}
                      </p>
                    )}
                    {b.address && (
                      <a
                        href={
                          "https://www.google.com/maps/search/?api=1&query=" +
                          encodeURIComponent(b.address)
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline"
                      >
                        {b.address}
                      </a>
                    )}
                    {b.openingHours ? (
                      <details className="mt-1 text-[11px] leading-snug group">
                        <summary className="cursor-pointer select-none font-medium flex items-center gap-1">
                          Horaires
                          <span className="text-red-600 inline-block transition-transform duration-200 group-open:rotate-90">
                            ➤
                          </span>
                        </summary>
                        <pre className="mt-1 whitespace-pre-wrap font-sans">
                          {b.openingHours}
                        </pre>
                      </details>
                    ) : (
                      <p className="text-xs">
                        Horaires : voir le site
                      </p>
                    )}
                    <p className="mt-1 text-[11px] leading-snug text-[hsl(var(--leaf))]">
                      Lieu indépendant sélectionné pour sa démarche locale, éthique ou artisanale.
                    </p>
                    {b.website && (
                      <a
                        href={b.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={
                          "inline-block text-xs underline " +
                          (darkMap ? "text-amber-300" : "text-amber-700")
                        }
                      >
                        Site web
                      </a>
                    )}
                  </div>
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      <button
        type="button"
        className={locateButtonClass}
        onClick={handleLocate}
        aria-label="Me localiser"
      >
        <span
        className={
          "flex h-9 w-9 items-center justify-center rounded-full border shadow-sm " +
          (darkMap ? "bg-black/80 border-neutral-700" : "bg-white border-neutral-300")
        }
      >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="h-8 w-8"
          >
                        
                        <polygon
              points="12,6 9,16 12,14 15,16"
              fill={darkMap ? "white" : "black"}
            />
          </svg>
        </span>
      </button>
      <button
        type="button"
        onClick={() => {
          if (onToggleDarkMap) onToggleDarkMap();
        }}
        className={toggleButtonClass}
      >
        <div className={trackClass}>
          <div className={thumbClass} />
        </div>
      </button>
    </div>
  );
}
