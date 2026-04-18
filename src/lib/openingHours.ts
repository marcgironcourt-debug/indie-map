function normalizeDayFR(value: string) {
  const v = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (!v) return "";
  if (v.startsWith("lundi") || v === "lun") return "lundi";
  if (v.startsWith("mardi") || v === "mar") return "mardi";
  if (v.startsWith("mercredi") || v === "mer") return "mercredi";
  if (v.startsWith("jeudi") || v === "jeu") return "jeudi";
  if (v.startsWith("vendredi") || v === "ven") return "vendredi";
  if (v.startsWith("samedi") || v === "sam") return "samedi";
  if (v.startsWith("dimanche") || v === "dim") return "dimanche";
  return "";
}

function parseTimeToMinFR(value: string) {
  const m = String(value || "").match(/^(\d{1,2})(?:h|:)(\d{2})$/i);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  return h * 60 + mm;
}

export function parseOpeningHoursFR(opening: string) {
  const byDay = new Map<string, Array<[number, number]>>();
  const lines = String(opening || "").split(/\r?\n/).map(x => x.trim()).filter(Boolean);

  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length === 0) continue;
    const day = normalizeDayFR(parts[0]);
    if (!day) continue;

    const rest = line.slice(parts[0].length).trim();
    if (!rest) continue;

    const restNorm = rest.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    if (restNorm.includes("ferme")) {
      byDay.set(day, []);
      continue;
    }

    const chunks = rest.split(/\s*(?:,|\/|\||;|et)\s*/i).map(x => x.trim()).filter(Boolean);
    const ranges: [number, number][] = [];

    for (const c of chunks) {
      const mm = c.match(/(\d{1,2}\s*(?:h|:)\s*\d{2})\s*[-–—]\s*(\d{1,2}\s*(?:h|:)\s*\d{2})/i);
      if (!mm) continue;
      const a = parseTimeToMinFR(mm[1].replace(/\s+/g, ""));
      const b = parseTimeToMinFR(mm[2].replace(/\s+/g, ""));
      if (a == null || b == null) continue;
      ranges.push([a, b]);
    }

    if (!byDay.has(day)) byDay.set(day, []);
    const cur = byDay.get(day)!;
    for (const r of ranges) cur.push(r);
  }

  return byDay;
}

export function nowPartsInTZ(timeZone: string) {
  try {
    const fmt = new Intl.DateTimeFormat("fr-FR", {
      timeZone,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const wd = parts.find(p => p.type === "weekday")?.value ?? "";
    const hh = parts.find(p => p.type === "hour")?.value ?? "";
    const mm = parts.find(p => p.type === "minute")?.value ?? "";
    const day = normalizeDayFR(wd);
    const h = Number(hh);
    const m = Number(mm);
    if (!day || !Number.isFinite(h) || !Number.isFinite(m)) return null;
    return { day, minutes: h * 60 + m };
  } catch {
    return null;
  }
}

export function isOpenNowFR(opening: string, timeZone: string) {
  const map = parseOpeningHoursFR(opening);
  const now = nowPartsInTZ(timeZone);
  if (!now) return null;
  const ranges = map.get(now.day);
  if (!ranges) return null;

  const t = now.minutes;
  for (const [a, b] of ranges) {
    if (a === b) continue;
    if (b > a) {
      if (t >= a && t < b) return true;
    } else {
      if (t >= a || t < b) return true;
    }
  }
  return false;
}
