export function getCategoryStyle(cat: string, active: boolean): string {
  const key = cat.toLowerCase();

  if (key.includes("atelier")) {
    return active
      ? "bg-[#1E3A8A] text-white"
      : "bg-[#5C6E3B]/85 text-[#1E3A8A] border border-[#1E3A8A]/60";
  }

  if (key.includes("café") || key.includes("cafe")) {
    return active
      ? "bg-[hsl(var(--cafe))] text-white"
      : "bg-[#5C6E3B]/85 text-[hsl(var(--cafe))] border border-[hsl(var(--cafe))]/60";
  }

  if (key.includes("épicerie") || key.includes("epicerie")) {
    return active
      ? "bg-[#FF8FC7] text-black"
      : "bg-[#5C6E3B]/85 text-[#FF8FC7] border border-[#FF8FC7]/60";
  }

  if (key.includes("ferme") || key.includes("farm")) {
    return active
      ? "bg-[#F6FF00] text-black"
      : "bg-[#5C6E3B]/85 text-[#F6FF00] border border-[#F6FF00]/60";
  }

  if (key.includes("boutique")) {
    return active
      ? "bg-black text-white"
      : "bg-[#5C6E3B]/85 text-black border border-black/60";
  }

  if (key.includes("boulangerie")) {
    return active
      ? "bg-[#8C5A3C] text-white"
      : "bg-[#5C6E3B]/85 text-[#8C5A3C] border border-[#8C5A3C]/60";
  }

  if (
    key.includes("friperie") ||
    key.includes("mode éthique") ||
    key.includes("mode ethique") ||
    key.includes("vêtement") ||
    key.includes("vetement") ||
    key.includes("mode")
  ) {
    return active
      ? "bg-[hsl(var(--violet))] text-white"
      : "bg-[#5C6E3B]/85 text-[hsl(var(--violet))] border border-[hsl(var(--violet))]/60";
  }

  if (key.includes("restaurant")) {
    return active
      ? "bg-[hsl(var(--restaurant))] text-white"
      : "bg-[#5C6E3B]/85 text-[hsl(var(--restaurant))] border border-[hsl(var(--restaurant))]/60";
  }

  if (
    key.includes("microbrasserie") ||
    key.includes("brasserie") ||
    key.includes("bar") ||
    key.includes("pub")
  ) {
    return active
      ? "bg-[hsl(var(--micro))] text-white"
      : "bg-[#5C6E3B]/85 text-[hsl(var(--micro))] border border-[hsl(var(--micro))]/60";
  }

  if (key.includes("librairie") || key.includes("bouquinerie")) {
    return active
      ? "bg-[hsl(var(--blue))] text-white"
      : "bg-[#5C6E3B]/85 text-[hsl(var(--blue))] border border-[hsl(var(--blue))]/60";
  }

  if (key.includes("monument") || key.includes("poi")) {
    return active
      ? "bg-[hsl(var(--poi))] text-white"
      : "bg-[#5C6E3B]/85 text-[hsl(var(--poi))] border border-[hsl(var(--poi))]/60";
  }

  if (key.includes("lieu alternatif") || key.includes("lieu de vie")) {
    return active
      ? "bg-[#00F5FF] text-black"
      : "bg-[#5C6E3B]/85 text-[#00F5FF] border border-[#00F5FF]/60";
  }

  if (
    key.includes("marché") ||
    key.includes("marche") ||
    key.includes("market")
  ) {
    return active
      ? "bg-[#39FF14] text-black"
      : "bg-[#5C6E3B]/85 text-[#39FF14] border border-[#39FF14]/60";
  }

  return active
    ? "bg-[hsl(var(--brand))] text-white"
    : "bg-[#5C6E3B]/85 text-[hsl(var(--brand))] border border-[hsl(var(--brand))]/60";
}
