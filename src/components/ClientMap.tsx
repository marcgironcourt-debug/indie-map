"use client";
import React from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
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
    ? "<defs>\n         <filter id=\"shadow\">\n           <feDropShadow dx=\"0\" dy=\"1\" stdDeviation=\"1.2\" flood-color=\"rgba(0,0,0,0.4)\" />\n         </filter>\n       </defs>"
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

const ICONS =  {
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

function FocusOnSelected({
  markers,
  selectedId,
  selectionVersion,
}: {
  markers: { id: string; latN: number; lngN: number }[];
  selectedId?: string | null;
  selectionVersion?: number;
}) {
  const map = useMap();
  React.useEffect(() => {
    if (!selectedId) return;
    const m = markers.find((mm) => mm.id === selectedId);
    if (!m) return;
    const target = L.latLng(m.latN, m.lngN);
    const currentZoom = map.getZoom();
    const targetZoom = Math.max(currentZoom || 2, 13);
    map.flyTo(target, targetZoom, { animate: true, duration: 0.8 });
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) {
        const ll = layer.getLatLng();
        if (ll.lat === m.latN && ll.lng === m.lngN) layer.openPopup();
      }
    });
  }, [selectedId, selectionVersion, map]);
  return null;
}

function ApplyCenter({ center, zoom }: { center?: [number, number] | null; zoom?: number }) {
  const map = useMap();
  React.useEffect(() => {
    if (!center) return;
    map.setView(L.latLng(center[0], center[1]), zoom ?? map.getZoom());
  }, [center, zoom, map]);
  return null;
}

export default function ClientMap({
  items = [],
  selectedId,
  selectionVersion,
  onSelect,
}: {
  items?: Biz[];
  selectedId?: string | null;
  selectionVersion?: number;
  onSelect?: (id: string) => void;
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

  const [mapCenter, setMapCenter] = React.useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = React.useState<number>(12);

  React.useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setMapCenter([latitude, longitude]);
        setMapZoom(14);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 5000 }
    );
  }, []);

  const handleLocate = React.useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setMapCenter([latitude, longitude]);
        setMapZoom(14);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 5000 }
    );
  }, []);

  return (
    <div style={{ height: "100%", width: "100%" }} className="relative">
      <MapContainer
        center={mapCenter ?? [45.5017, -73.5673]}
        zoom={mapZoom}
        minZoom={2}
        maxBounds={MAX_BOUNDS}
        maxBoundsViscosity={1}
        worldCopyJump={false}
        zoomControl={true}
        attributionControl={false}
        className="h-full w-full"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
          noWrap={true}
        />
        <ApplyCenter center={mapCenter} zoom={mapZoom} />
        <FocusOnSelected markers={markers} selectedId={selectedId} selectionVersion={selectionVersion} />
        {markers.map((b) => {
          const isFlo = b.name.trim().toLowerCase() === "espace flo";
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
                            className="inline-flex items-center rounded-full bg-[#728A4A] px-2 py-1 text-[10px] font-semibold text-black shadow-sm hover:bg-[#5C6E3B] transition"
                            style={{ color: "#000000" }}
                          >
                            Site web
                          </a>
                        )}
                      </div>

                      {b.address && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-neutral-700 underline"
                        >
                          {b.address}
                        </a>
                      )}

                      {b.openingHours ? (
                        <p className="text-[10px] text-emerald-700">
                          Horaires : {b.openingHours}
                        </p>
                      ) : (
                        <p className="text-[10px] text-neutral-600">
                          Horaires : voir le site
                        </p>
                      )}
                    </div>

                    <p className="mt-2 text-[11px] leading-snug text-neutral-800">
                      La mission d’ESPACE FLO : faire rayonner le talent d'ici et valoriser l'achat local avec des produits éthiques & écoresponsables. « À l'opposé du "fast fashion" et de la production de masse, nous vous proposons une sélection de produits entièrement conçus & fabriqués au Québec par nos talentueux designers sélectionnés. ESPACE FLO vous offre une sélection de produits durables, indémodables & exclusifs fabriqués à la main avec passion par des créateurs d'ici.»
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
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-neutral-700 underline"
                      >
                        {b.address}
                      </a>
                    )}
                    {b.openingHours ? (
                      <p className="text-xs text-emerald-700">
                        Horaires : {b.openingHours}
                      </p>
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
        className="absolute top-3 left-3 z-[1300] rounded-full bg-white p-2 text-black shadow-md border border-neutral-300 hover:bg-neutral-100"
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
    </div>
  );
}
