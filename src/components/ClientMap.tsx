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

const redPin = L.divIcon({
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

function FitOnData({ points }: { points: [number, number][] }) {
  const map = useMap();
  React.useEffect(() => {
    if (points.length) {
      const b = L.latLngBounds(points.map(([a, b]) => L.latLng(a, b)));
      map.fitBounds(b, { padding: [40, 40] });
    }
  }, [points, map]);
  return null;
}

export default function ClientMap({ items = [] as Biz[] }: { items?: Biz[] }) {
  const byId = new Map<string, { id: string; name: string; address?: string | null; website?: string | null; latN: number; lngN: number }>();
  for (const b of items) {
    const latN = Number(b.lat);
    const lngN = Number(b.lng);
    if (!Number.isFinite(latN) || !Number.isFinite(lngN)) continue;
    if (!byId.has(b.id)) byId.set(b.id, { id: b.id, name: b.name, address: b.address ?? null, website: b.website ?? null, latN, lngN });
  }
  const markers = Array.from(byId.values());
  const points = markers.map(m => [m.latN, m.lngN] as [number, number]);

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
        {markers.map(b => (
          <Marker key={b.id} position={[b.latN, b.lngN]} icon={redPin}>
            <Popup>
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
