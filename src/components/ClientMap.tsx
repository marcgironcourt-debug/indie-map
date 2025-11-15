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
};

const MAX_BOUNDS = L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180));

const defaultPin = L.divIcon({
  className: "indie-pin",
  html: `
    <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg" style="display:block">
      <path d="M12 36s-10-9-10-20A10 10 0 1 1 22 16c0 11-10 20-10 20Z" fill="#e11d48" stroke="white" stroke-width="2"/>
      <circle cx="12" cy="12" r="4" fill="white"/>
    </svg>
  `,
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -30],
});

const selectedPin = L.divIcon({
  className: "indie-pin indie-pin-selected",
  html: `
    <svg width="26" height="38" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg" style="display:block">
      <defs>
        <filter id="shadow">
          <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="rgba(0,0,0,0.4)" />
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <path d="M12 36s-10-9-10-20A10 10 0 1 1 22 16c0 11-10 20-10 20Z" fill="#b91c1c" stroke="white" stroke-width="2"/>
        <circle cx="12" cy="12" r="4.5" fill="white"/>
      </g>
    </svg>
  `,
  iconSize: [26, 38],
  iconAnchor: [13, 38],
  popupAnchor: [0, -32],
});

function FitOnData({ points }: { points: [number, number][] }) {
  const map = useMap();

  React.useEffect(() => {
    if (!points.length) return;
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

    map.flyTo(target, targetZoom, {
      animate: true,
      duration: 1.4,
    });

    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) {
        const ll = layer.getLatLng();
        if (ll.lat === m.latN && ll.lng === m.lngN) {
          layer.openPopup();
        }
      }
    });
  }, [selectedId, markers, map]);

  return null;
}

export default function ClientMap({
  items = [] as Biz[],
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
    { id: string; name: string; address?: string | null; website?: string | null; latN: number; lngN: number }
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
            icon={selectedId === b.id ? selectedPin : defaultPin}
            eventHandlers={
              onSelect
                ? {
                    click: () => onSelect(b.id),
                  }
                : undefined
            }
          >
            <Popup autoPan={true} autoPanPadding={[40, 40]}>
              <div className="space-y-1">
                <div className="font-semibold">{b.name}</div>
                {b.address ? <div className="text-sm opacity-80">{b.address}</div> : null}
                {b.website ? (
                  <a
                    href={b.website}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-sm underline underline-offset-2"
                  >
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
