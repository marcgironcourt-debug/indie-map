"use client";
import dynamic from "next/dynamic";

const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer    = dynamic(() => import("react-leaflet").then(m => m.TileLayer),    { ssr: false });

export default function Map() {
  return (
    <div style={{ height: "60vh", width: "100%", border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden" }}>
      <MapContainer center={[45.5019, -73.5674]} zoom={12} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution="© OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      </MapContainer>
    </div>
  );
}
