"use client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

type Place = {
  id: string;
  name: string;
  description?: string | null;
  lat?: number | null;
  lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
};

const icon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function LeafletInner({ businesses }: { businesses: Place[] }) {
  return (
    <div style={{ height: "60vh", width: "100%", border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden" }}>
      <MapContainer center={[45.5019, -73.5674]} zoom={12} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution="© OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {businesses.map((b) => {
          const lat = (b.lat ?? b.latitude ?? 45.5) as number;
          const lng = (b.lng ?? b.longitude ?? -73.56) as number;
          return (
            <Marker key={b.id} position={[lat, lng]} icon={icon}>
              <Popup>
                <strong>{b.name}</strong>
                <br />
                {b.description ?? ""}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
