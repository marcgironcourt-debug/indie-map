type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function normalizePlace(x: unknown): unknown {
  if (!isObj(x)) return x;

  const out: Obj = { ...x };

  if (typeof out.phone !== "string") out.phone = "";
  if (typeof out.openingHours !== "string") out.openingHours = "";

  if (!Array.isArray(out.tags)) {
    const cat = typeof out.category === "string" ? out.category : "";
    out.tags = cat ? [cat] : [];
  }

  return out;
}
