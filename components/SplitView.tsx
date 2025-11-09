"use client";

import { useEffect, useMemo, useState } from "react";
import BusinessPane from "./BusinessPane";
import ClientMap from "./ClientMap";
import { useBusinesses } from "../hooks/useBusinesses";
import type { Business } from "../lib/types";

export default function SplitView() {
  const { data, loading, error } = useBusinesses();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // données brutes
  const items = useMemo(() => (data ?? []) as Business[], [data]);

  useEffect(() => {
    if (!selectedId && items.length) setSelectedId(items[0].id);
  }, [items, selectedId]);

  if (loading) return <div style={{ padding: 16, fontSize: 14 }}>Chargement…</div>;
  if (error) return <div style={{ padding: 16, fontSize: 14, color: "red" }}>Erreur: {error}</div>;
  if (!items.length) return <div style={{ padding: 16, fontSize: 14 }}>Aucun commerce pour le moment.</div>;

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        justifyContent: "stretch",
        height: "100vh",
        width: "100%",
        gap: 16,
        boxSizing: "border-box",
        padding: 16,
      }}
    >
      <div
        style={{
          width: 380,
          minWidth: 320,
          maxWidth: 440,
          height: "100%",
          overflow: "hidden",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          position: "relative",
          zIndex: 10
        }}
      >
        <BusinessPane items={items} selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: "100%",
          minHeight: 400,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
          position: "relative",
          zIndex: 0
        }}
      >
        <ClientMap items={items} selectedId={selectedId ?? undefined} onSelect={setSelectedId} />
      </div>
    </section>
  );
}
