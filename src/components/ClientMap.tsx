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

const MAX_BOUNDS = L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180));

function normalizeType(t?: string | null): "cafe" | "epicerie" | "friperie" | "librairie" | "restaurant" | "boutique" | "microbrasserie" | "other" {
  const v = (t || "").toLowerCase();
  if (v.includes("café") || v.includes("cafe") || v.includes("coffee") || v.includes("brunch")) return "cafe";
  if (
    v.includes("microbrasserie") ||
    v.includes("brasserie") ||
    v.includes("bar") ||
    v.includes("pub")
  ) return "microbrasserie";
  if (
    v.includes("épicerie") ||
    v.includes("epicerie") ||
    v.includes("grocery")
  )
    return "epicerie";
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
    v.includes("microbrasserie") ||
    v.includes("brasserie artisanale")
  )
    return "microbrasserie";
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
  if (v.includes("librairie") || v.includes("bouquinerie") || v.includes("bookstore") || v.includes("book"))
    return "librairie";
  if (v.includes("boutique locale") || v.includes("boutique"))
    return "boutique";
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
    '<svg width="' + size + '" height="' + height + '" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">' +
    shadow +
    groupOpen +
    '<path d="M12 36s-10-9-10-20A10 10 0 1 1 22 16c0 11-10 20-10 20Z" fill="' + color + '" stroke="' + stroke + '" stroke-width="2"/>' +
    '<circle cx="12" cy="12" r="' + circleR + '" fill="white"/>' +
    groupClose +
    "</svg>";
  return L.divIcon({
    className: "indie-pin",
    html,
    iconSize: [size, height],
    iconAnchor: [size / 2, height],
    popupAnchor: [0, -height + 4],
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

function resolveCityCenter(query: string): { center: [number, number]; zoom: number } | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  if (q.includes("montréal") || q.includes("montreal")) {
    return { center: [45.5017, -73.5673], zoom: 13 };
  }
  if (q.includes("paris")) {
    return { center: [48.8566, 2.3522], zoom: 13 };
  }
  if (q.includes("new york") || q.includes("nyc")) {
    return { center: [40.7128, -74.006], zoom: 12 };
  }
  if (q.includes("bordeaux")) {
    return { center: [44.8378, -0.5792], zoom: 13 };
  }
  if (q.includes("toronto")) {
    return { center: [43.6532, -79.3832], zoom: 12 };
  }
  if (q.includes("los angeles") || q.includes("la ")) {
    return { center: [34.0522, -118.2437], zoom: 11 };
  }
  if (q.includes("tokyo")) {
    return { center: [35.6762, 139.6503], zoom: 12 };
  }
  if (q.includes("lausanne")) {
    return { center: [46.5197, 6.6323], zoom: 13 };
  }
  if (q.includes("marseille")) {
    return { center: [43.2965, 5.3698], zoom: 12 };
  }
  if (q.includes("vancouver")) {
    return { center: [49.2827, -123.1207], zoom: 12 };
  }
  if (q.includes("chicago")) {
    return { center: [41.8781, -87.6298], zoom: 12 };
  }

  return null;
}

export default function ClientMap({
  items = [],
  selectedId,
  selectionVersion,
  onSelect,
  searchCity,
  darkMap,
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

  const markers = Array.from(byId.values());
  const [isMobile, setIsMobile] = React.useState(false);
  const mapRef = React.useRef<L.Map | null>(null);

  const [center, setCenter] = React.useState<[number, number]>([45.5017, -73.5673]);
  const [zoom, setZoom] = React.useState<number>(12);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMobile(window.innerWidth < 768);
    }
  }, []);

  React.useEffect(() => {
    if (!searchCity) return;
    const preset = resolveCityCenter(searchCity);
    if (!preset) return;
    setCenter(preset.center);
    setZoom(preset.zoom);
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
    if (typeof navigator === "undefined" || !navigator.geolocation || !mapRef.current) return;
    const map = mapRef.current;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.flyTo(L.latLng(latitude, longitude), 14, { animate: true, duration: 0.8 });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 5000 }
    );
  }, []);

  const mapKey = `${center[0]}-${center[1]}-${zoom}-${darkMap ? "dark" : "light"}`;

  const tileUrl = darkMap
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const locateClassName = isMobile
    ? "absolute top-[68px] right-3 z-[1300] rounded-full bg-white p-2 text-black shadow-md border border-neutral-300 hover:bg-neutral-100"
    : "absolute top-3 left-3 z-[1300] rounded-full bg-white p-2 text-black shadow-md border border-neutral-300 hover:bg-neutral-100";

  const themeToggleClassName = "absolute top-3 right-3 z-[1300] rounded-full bg-white/95 p-2 shadow-md border border-neutral-300 hover:bg-neutral-100";

  const circleOuterFill = darkMap ? "#020617" : "#F9FAFB";
  const circleInnerFill = darkMap ? "#F9FAFB" : "#020617";

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
        whenCreated={(mapInstance) => {
          mapRef.current = mapInstance;
        }}
      >
        <MapClickClear
          onClear={() => {
            if (onSelect) onSelect("");
          }}
        />
        <TileLayer
          url={tileUrl}
          attribution=""
        />
        {markers.map((b) => {
          const isFlo = b.name.trim().toLowerCase() === "espace flo";

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
                {isFlo ? (
                  <div className="space-y-2 max-w-xs border border-[#E4D4C2] rounded-[18px] px-3 pt-2 pb-4 bg-[#FDF7F2] shadow-md">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-1">
                          <h3 className="text-[15px] font-semibold text-neutral-900">
                            {b.name}
                          </h3>
                          <div>
                            <span className="inline-flex items-center rounded-full bg-[#E4D4C2] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-800">
                              mode, art, déco
                            </span>
                          </div>
                        </div>
                        {b.website && (
                          <a
                            href={b.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-full bg-[#728A4A] px-2 py-1 text-[10px] font-semibold textblack shadow-sm hover:bg-[#5C6E3B] transition"
                            style={{ color: "#000000" }}
                          >
                            Site web
                          </a>
                        )}
                      </div>

                      {b.address && (
                        <a
                          href={"https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(b.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-neutral-700 underline"
                        >
                          {b.address}
                        </a>
                      )}

                      {b.openingHours ? (
                        <details className="mt-1 text-[11px] leading-snug text-neutral-800 group">
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
                        <p className="text-[10px] text-neutral-600">
                          Horaires : voir le site
                        </p>
                      )}
                    </div>

                    <p className="mt-2 text-[11px] leading-snug text-neutral-800">
                      La mission d’ESPACE FLO : faire rayonner le talent d&apos;ici et valoriser l&apos;achat local avec des produits éthiques et écoresponsables. À l&apos;opposé du fast fashion et de la production de masse, ESPACE FLO propose une sélection de produits entièrement conçus et fabriqués au Québec par des designers sélectionnés, avec des pièces durables, indémodables et exclusives.
                    </p>

                    <div className="mt-2">
                      <div className="h-[120px] w-full rounded-md overflow-hidden border border-neutral-300 bg-neutral-200">
                        <img
                          src="/images/espace-flo-inside.jpg"
                          alt="Intérieur Espace FLO"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 max-w-xs border border-[#E4D4C2] rounded-[14px] px-3 py-2 bg-[#FDF7F2] shadow-sm">
                    <h3 className="font-semibold text-sm text-neutral-900">{b.name}</h3>
                    {b.address && (
                      <a
                        href={"https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(b.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-neutral-700 underline"
                      >
                        {b.address}
                      </a>
                    )}
                    {b.openingHours ? (
                      <details className="mt-1 text-[11px] leading-snug text-neutral-800 group">
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
                      <p className="text-xs text-neutral-600">
                        Horaires : voir le site
                      </p>
                    )}
                    {b.website && (
                      <a
                        href={b.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-xs underline text-amber-700"
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
        onClick={handleLocate}
        className={locateClassName}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="black"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <circle cx="12" cy="12" r="7.5" />
          <path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => {
          if (onToggleDarkMap) onToggleDarkMap();
        }}
        className={themeToggleClassName}
        aria-label="Basculer mode clair/sombre"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className="h-5 w-5"
        >
          <defs>
            <clipPath id="halfCircle">
              <rect x="0" y="0" width="12" height="24" />
            </clipPath>
          </defs>
          <circle cx="12" cy="12" r="10" fill={circleOuterFill} stroke="#0F172A" strokeWidth="1.2" />
          <circle cx="12" cy="12" r="10" fill={circleInnerFill} clipPath="url(#halfCircle)" />
        </svg>
      </button>
    </div>
  );
}
