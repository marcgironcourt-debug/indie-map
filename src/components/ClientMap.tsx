"use client";

import React from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

type Biz = {
  id: string;
  name: string;
  lat?: number | string | null;
  lng?: number | string | null;
};

const MAX_BOUNDS = L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180));

const defaultIcon = L.divIcon({
  html: `<div style="width:16px;height:16px;background:#d33;border-radius:50%;border:2px solid white;"></div>`,
  className: "custom-pin",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const selectedIcon = L.divIcon({
  html: `<div style="width:20px;height:20px;background:#f97316;border-radius:50%;border:2px solid white;"></div>`,
  className: "custom-pin-selected",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function FitOnData({ points }: { points: [number, number][] }) {
  const map = useMap();
  React.useEffect(() => {
    if (points.length) {
      const bounds = L.latLngBounds(points.map(([a, b]) => L.latLng(a, b)));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [points, map]);
  return null;
}

export default function ClientMap({ items = [], selectedId }: { items?: Biz[]; selectedId?: string | null }) {
  const valid = items
    .map((b) => ({ ...b, latN: Number(b.lat), lngN: Number(b.lng) }))
    .filter((b) => Number.isFinite(b.latN) && Number.isFinite(b.lngN));

  const points = valid.map((b) => [b.latN, b.lngN] as [number, number]);

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxBounds={MAX_BOUNDS}
        maxBoundsViscosity={1}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitOnData points={points} />
        {valid.map((b) => (
          <Marker
            key={`${b.id}-${selectedId === b.id}`}   // <--- clé unique par sélection
            position={[b.latN, b.lngN]}
            icon={b.id === selectedId ? selectedIcon : defaultIcon}
          >
            <Popup>
              <strong>{b.name}</strong>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
