type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function optStr(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length ? v : undefined;
}

function num(v: unknown): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function arrStr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

function normalizePriceRange(v: unknown) {
  if (!isObj(v)) return undefined;

  const min = num(v.min);
  const max = num(v.max);
  const currency = str(v.currency).trim().toUpperCase();
  const basis = str(v.basis).trim();

  if (
    min === null ||
    max === null ||
    min < 0 ||
    max < min ||
    !/^[A-Z]{3}$/.test(currency) ||
    basis !== "per_person"
  ) {
    return undefined;
  }

  return {
    min,
    max,
    currency,
    basis: "per_person" as const,
  };
}

export function normalizePlace(x: unknown): unknown {
  if (!isObj(x)) return x;

  const id = str(x.id);
  const name = str(x.name);
  const city = str(x.city);
  const country = str(x.country);
  const address = str(x.address);
  const website = str(x.website);
  const category = str(x.category);
  const phone = str(x.phone);
const openingHours = str(x.openingHours);
const timeZone = str(x.timeZone);
  const createdAt = str(x.createdAt);
  const updatedAt = str(x.updatedAt);
  const miniText = optStr(x.miniText);
  const homeTextNear = optStr(x.homeTextNear);
  const homeTextFar = optStr(x.homeTextFar);
  const panoramaImage = optStr(x.panoramaImage);

  const lat = num(x.lat);
  const lng = num(x.lng);

  if (lat === null || lng === null) return x;

  const tagsRaw = arrStr(x.tags);
  const tags = tagsRaw.length ? tagsRaw : (category ? [category] : []);

  const priceRange = normalizePriceRange(x.priceRange);

  return {
    id,
    name,
    city,
    country,
    address,
    website,
    lat,
    lng,
    category,
    timeZone,
    createdAt,
    updatedAt,
    tags,
    ...(priceRange ? { priceRange } : {}),
    phone,
    openingHours,
    ...(miniText ? { miniText } : {}),
    ...(homeTextNear ? { homeTextNear } : {}),
    ...(homeTextFar ? { homeTextFar } : {}),
    ...(panoramaImage ? { panoramaImage } : {})
  };
}
