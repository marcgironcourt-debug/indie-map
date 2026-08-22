export function getLocalizedCategory(
  category: string | undefined,
  isFr: boolean,
) {
  const key = String(category ?? "").trim().toLowerCase();

  const categories: Record<string, { fr: string; en: string }> = {
    "grocery": { fr: "Épicerie", en: "Grocery" },
    "épicerie": { fr: "Épicerie", en: "Grocery" },
    "epicerie": { fr: "Épicerie", en: "Grocery" },
    "café": { fr: "Café", en: "Cafe" },
    "cafe": { fr: "Café", en: "Cafe" },
    "restaurant": { fr: "Restaurant", en: "Restaurant" },
    "marché": { fr: "Marché", en: "Market" },
    "market": { fr: "Marché", en: "Market" },
    "boutique": { fr: "Boutique", en: "Shop" },
    "shop": { fr: "Boutique", en: "Shop" },
    "librairie": { fr: "Librairie", en: "Bookstore" },
    "bookstore": { fr: "Librairie", en: "Bookstore" },
    "boulangerie": { fr: "Boulangerie", en: "Bakery" },
    "bakery": { fr: "Boulangerie", en: "Bakery" },
    "ferme": { fr: "Ferme", en: "Farm" },
    "farm": { fr: "Ferme", en: "Farm" },
    "atelier": { fr: "Atelier", en: "Workshop" },
    "workshop": { fr: "Atelier", en: "Workshop" },
    "lieu alternatif": { fr: "Lieu alternatif", en: "Alternative place" },
    "lieu de vie": { fr: "Lieu de vie", en: "Alternative place" },
    "alternative place": { fr: "Lieu alternatif", en: "Alternative place" },
    "mode": { fr: "Mode", en: "Fashion" },
    "fashion": { fr: "Mode", en: "Fashion" },
    "brasserie": { fr: "Brasserie", en: "Brewery" },
    "brasserie / bar": { fr: "Brasserie / bar", en: "Brewery / bar" },
    "brasserie / bar / pub": { fr: "Brasserie / bar / pub", en: "Brewery / bar / pub" },
    "brasserie bar": { fr: "Brasserie / bar", en: "Brewery / bar" },
    "bar": { fr: "Bar", en: "Bar" },
    "pub": { fr: "Pub", en: "Pub" },
    "brunch": { fr: "Brunch", en: "Brunch" },
    "café / brunch": { fr: "Café / brunch", en: "Cafe / brunch" },
    "cafe / brunch": { fr: "Café / brunch", en: "Cafe / brunch" },
  };

  return (
    categories[key]?.[isFr ? "fr" : "en"] ??
    String(category ?? "").trim()
  );
}
