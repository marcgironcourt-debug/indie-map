"use client";
import React from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

type Biz = {
  id: string;
  name: string;
  address?: string | null;
  website?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
};

if (typeof window !== "undefined") {
  L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });
}

const MAX_BOUNDS = L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180));

function FitOnData({ points }: { points: [number, number][] }) {
  const map = useMap();
  React.useEffect(() => {
    if (points.length) {
      const b = L.latLngBounds(points.map(([a,b]) => L.latLng(a,b)));
      map.fitBounds(b, { padding: [40, 40] });
    }
  }, [points, map]);
  return null;
}

export default function ClientMap({ items = [] as Biz[] }: { items?: Biz[] }) {
  const markers = items
    .map(b => {
      const latN = Number(b.lat);
      const lngN = Number(b.lng);
      return Number.isFinite(latN) && Number.isFinite(lngN)
        ? { ...b, latN, lngN }
        : null;
    })
    .filter(Boolean) as (Biz & { latN: number; lngN: number })[];

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
          <Marker key={b.id} position={[b.latN, b.lngN]}>
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
