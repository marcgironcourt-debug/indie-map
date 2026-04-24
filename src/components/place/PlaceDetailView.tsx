import React from "react";

type Props = {
  place: {
    id: string;
    name: string;
    city?: string;
    address?: string;
    category?: string;
    panoramaImage?: string;
    miniText?: string;
    homeTextNear?: string;
    homeTextFar?: string;
    openingHours?: string;
    phone?: string;
    website?: string;
    lat?: number;
    lng?: number;
  };
  onBack?: () => void;
  onOpenMap?: (id: string) => void;
};

export default function PlaceDetailView({ place, onBack, onOpenMap }: Props) {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#111" }}>
      
      {/* HERO PANORAMA FIXE */}
      <div
        style={{
          height: "40vh",
          backgroundImage: place.panoramaImage ? `url(${place.panoramaImage})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          position: "relative"
        }}
      >
        <button
          onClick={onBack}
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            padding: "8px 12px",
            background: "rgba(0,0,0,0.6)",
            color: "white",
            border: "none",
            borderRadius: 8
          }}
        >
          Retour
        </button>
      </div>

      {/* CONTENU SCROLLABLE */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16, color: "white" }}>
        <h1 style={{ marginBottom: 4 }}>{place.name}</h1>
        <p style={{ opacity: 0.7, marginTop: 0 }}>{place.category} · {place.city}</p>

        <p style={{ marginTop: 16 }}>{place.miniText}</p>

        {place.homeTextNear && (
          <p style={{ marginTop: 12 }}>{place.homeTextNear}</p>
        )}

        {place.homeTextFar && (
          <p style={{ marginTop: 12, opacity: 0.8 }}>{place.homeTextFar}</p>
        )}

        <div style={{ marginTop: 20 }}>
          {place.openingHours && <p>Horaires: {place.openingHours}</p>}
          {place.phone && <p>Téléphone: {place.phone}</p>}
          {place.address && <p>Adresse: {place.address}</p>}
          {place.website && <p>Site: {place.website}</p>}
        </div>

        {/* GLObE PLACEHOLDER */}
        <div
          onClick={() => onOpenMap?.(place.id)}
          style={{
            marginTop: 30,
            height: 180,
            borderRadius: 12,
            background: "#222",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer"
          }}
        >
          Voir sur la carte (globe)
        </div>
      </div>
    </div>
  );
}
