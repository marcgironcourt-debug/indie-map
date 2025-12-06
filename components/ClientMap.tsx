"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import type { Business } from "../lib/types";
import L, { divIcon } from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import Supercluster from "supercluster";

type LeafletImage = string | { src: string };

function resolveIconUrl(img: LeafletImage): string {
  if (typeof img === "string") return img;
  return img.src;
}

L.Icon.Default.mergeOptions({
  iconRetinaUrl: resolveIconUrl(markerIcon2x as LeafletImage),
  iconUrl: resolveIconUrl(markerIcon as LeafletImage),
  shadowUrl: resolveIconUrl(markerShadow as LeafletImage),
});

type ClusterPoint = {
  type: "Feature";
  properties: { cluster: boolean; businessId?: string; point_count?: number };
  geometry: { type: "Point"; coordinates: [number, number] };
  id?: string | number;
};

type SuperclusterPoint = {
  type: "Feature";
  properties: ClusterPoint["properties"];
  geometry: ClusterPoint["geometry"];
};

function useLeafletBounds() {
  const map = useMap();
  const [state, setState] = useState({ bounds: map.getBounds(), zoom: map.getZoom() });

  useMapEvents({
    moveend() {
      setState({ bounds: map.getBounds(), zoom: map.getZoom() });
    },
    zoomend() {
      setState({ bounds: map.getBounds(), zoom: map.getZoom() });
    },
  });

  return state;
}

function Clusters({
  items,
  onSelect,
}: {
  items: Business[];
  onSelect?: (id: string) => void;
}) {
  const map = useMap();
  const { bounds, zoom } = useLeafletBounds();

  const points: ClusterPoint[] = useMemo(
    () =>
      items.map((b) => ({
        type: "Feature",
        properties: { cluster: false, businessId: b.id },
        geometry: { type: "Point", coordinates: [b.lng as number, b.lat as number] },
        id: b.id,
      })),
    [items]
  );

  const index = useMemo(() => {
    const idx = new Supercluster({
      radius: 60,
      maxZoom: 18,
    });
    idx.load(points as SuperclusterPoint[]);
    return idx;
  }, [points]);

  const bbox = useMemo<[number, number, number, number]>(() => {
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    return [sw.lng, sw.lat, ne.lng, ne.lat];
  }, [bounds]);

  const clusters = useMemo<ClusterPoint[]>(() => {
    return index.getClusters(bbox, Math.round(zoom)) as ClusterPoint[];
  }, [index, bbox, zoom]);

  return (
    <>
      {clusters.map((c) => {
        const [lng, lat] = c.geometry.coordinates;
        const isCluster = c.properties.cluster;
        if (isCluster) {
          const count = c.properties.point_count ?? 0;
          const html = `<div style="
              background:#2b2b2b;color:#fff;border-radius:9999px;display:flex;
              align-items:center;justify-content:center;width:34px;height:34px;
              font-size:12px;font-weight:600;border:2px solid #fff;
            ">${count}</div>`;
          const icon: L.DivIcon = divIcon({ html, className: "" });
          return (
            <Marker
              key={`cluster-${c.id}`}
              position={[lat, lng]}
              icon={icon}
              eventHandlers={{
                click: () => {
                  const expansionZoom = Math.min(index.getClusterExpansionZoom(c.id as number), 18);
                  map.flyTo([lat, lng], expansionZoom, { duration: 0.5 });
                },
              }}
            />
          );
        } else {
          const bizId = c.properties.businessId;
          if (!bizId) return null;
          return (
            <Marker
              key={bizId}
              position={[lat, lng]}
              eventHandlers={{ click: () => onSelect?.(bizId) }}
            >
              <Popup>
                <div className="text-sm">Point</div>
              </Popup>
            </Marker>
          );
        }
      })}
    </>
  );
}

function FlyToSelected({ items, selectedId }: { items: Business[]; selectedId?: string | null }) {
  const map = useMap();

  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 0);
    if (!selectedId) return;
    const target = items.find((b) => b.id === selectedId);
    if (!target) return;
    map.flyTo([target.lat as number, target.lng as number], Math.max(map.getZoom(), 14), {
      duration: 0.6,
    });
  }, [selectedId, items, map]);

  return null;
}

export default function ClientMap({
  items,
  selectedId,
  onSelect,
}: {
  items: Business[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const center: [number, number] = items.length
    ? [
        items.reduce((sum, b) => sum + (b.lat as number), 0) / items.length,
        items.reduce((sum, b) => sum + (b.lng as number), 0) / items.length,
      ]
    : [45.5019, -73.5674];

  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ height: "100%", width: "100%", minHeight: 400 }}
      className="rounded-lg"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap"
      />
      <FlyToSelected items={items} selectedId={selectedId} />
      <Clusters items={items} onSelect={onSelect} />
    </MapContainer>
  );
}
