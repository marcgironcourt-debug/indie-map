export type GeoPoint = { lat: number; lng: number };

export type Business = {
  id: string;
  name: string;
  city?: string | null;
  lat: number;
  lng: number;
  description?: string | null;

  // Nouveaux champs affichés dans la liste (optionnels)
  address?: string | null;
  website?: string | null;  // URL complète, ex: "https://exemple.com"
  category?: string | null; // ex: "café", "épicerie", "bijouterie", etc.
};
