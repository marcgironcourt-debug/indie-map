// @ts-nocheck
"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer    = dynamic(() => import("react-leaflet").then(m => m.TileLayer),    { ssr: false });
const Marker       = dynamic(() => import("react-leaflet").then(m => m.Marker),       { ssr: false });
const Popup        = dynamic(() => import("react-leaflet").then(m => m.Popup),        { ssr: false });

type Place = {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  description?: string | null;
};

export default function Map() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [icon, setIcon] = useState<any>(null);
  const center: [number, number] = [45.5019, -73.5674];

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (typeof window === "undefined") return; // sécurité SSR
      const L = await import("leaflet");
      const defaultIcon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });
      if (!cancelled) setIcon(defaultIcon);
    })();

    fetch("/api/places")
      .then(r => r.json())
      .then((data: Place[]) => setPlaces(data))
      .catch(() => setPlaces([]));

    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ height: "60vh", width: "100%", border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden" }}>
      <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution="© OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {icon && places.map(p => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={icon}>
            <Popup>
              <div style={{ minWidth: 180 }}>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{p.city}</div>
                {p.description ? <p style={{ marginTop: 8 }}>{p.description}</p> : null}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
