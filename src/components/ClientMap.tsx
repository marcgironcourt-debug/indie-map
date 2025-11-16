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
  lat?: number | string | null;
  lng?: number | string | null;
  type?: string | null;
};

const MAX_BOUNDS = L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180));

function normalizeType(t?: string | null): "cafe" | "epicerie" | "friperie" | "librairie" | "restaurant" | "boutique" | "microbrasserie" | "other" {
  const v = (t || "").toLowerCase();
  if (v.includes("café") || v.includes("cafe") || v.includes("coffee")) return "cafe";
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
    ? `<defs>
         <filter id="shadow">
           <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="rgba(0,0,0,0.4)" />
         </filter>
       </defs>`
    : "";
  const groupOpen = selected ? `<g filter="url(#shadow)">` : "";
  const groupClose = selected ? `</g>` : "";
  return L.divIcon({
    className: "indie-pin",
    html: `
      <svg width="${size}" height="${height}" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
        ${shadow}
        ${groupOpen}
        <path d="M12 36s-10-9-10-20A10 10 0 1 1 22 16c0 11-10 20-10 20Z" fill="${color}" stroke="${stroke}" stroke-width="2"/>
        <circle cx="12" cy="12" r="${circleR}" fill="white"/>
        ${groupClose}
      </svg>
    `,
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

function FitOnData({ points }: { points: [number, number][] }) {
  const map = useMap();
  const hasFitted = React.useRef(false);

  React.useEffect(() => {
    if (!points.length) return;
    if (hasFitted.current) return;
    hasFitted.current = true;
    const bounds = L.latLngBounds(points.map(([lat, lng]) => L.latLng(lat, lng)));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [points, map]);

  return null;
}

function FocusOnSelected({
  markers,
  selectedId,
}: {
  markers: { id: string; latN: number; lngN: number }[];
  selectedId?: string | null;
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
  }, [selectedId, markers, map]);
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
    { id: string; name: string; address?: string | null; website?: string | null; latN: number; lngN: number; type?: string | null }
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
        latN,
        lngN,
        type: b.type ?? null,
      });
    }
  }

  const markers = Array.from(byId.values());
  const points = markers.map((m) => [m.latN, m.lngN] as [number, number]);

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxBounds={MAX_BOUNDS}
        maxBoundsViscosity={1}
        worldCopyJump={false}
        zoomControl={true}
        attributionControl={false}
        className="h-full w-full"
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" noWrap={true} />
        <FitOnData points={points} />
        <FocusOnSelected markers={markers} selectedId={selectedId} />
        {markers.map((b) => (
          <Marker
            key={b.id}
            position={[b.latN, b.lngN]}
            icon={iconForType(b.type, selectedId === b.id)}
            eventHandlers={onSelect ? { click: () => onSelect(b.id) } : undefined}
          >
            <Popup autoPan={true} autoPanPadding={[40, 40]}>
              <div className="space-y-1">
                <div className="font-semibold">{b.name}</div>
                {b.address ? <div className="text-sm opacity-80">{b.address}</div> : null}
                {b.website ? (
                  <a href={b.website} target="_blank" rel="noreferrer noopener" className="text-sm underline underline-offset-2">
                    {new URL(b.website).host}
                  </a>
                ) : null}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
