type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function arrStr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
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
  const miniText = str(x.miniText);
  const panoramaImage = str(x.panoramaImage);

  const lat = num(x.lat);
  const lng = num(x.lng);

  const tagsRaw = arrStr(x.tags);
  const tags = tagsRaw.length ? tagsRaw : (category ? [category] : []);

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
    phone,
    openingHours,
    timeZone,
    createdAt,
    updatedAt,
    tags,
    miniText,
    panoramaImage
  };
}
