"use client";

import React from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const isEnUI = typeof window !== "undefined" ? /^\/en(\/|$)/.test(window.location.pathname) : false;
const ui = (fr: string, en: string) => (isEnUI ? en : fr);


const TEXTILERIE_PANORAMA_IMAGE = "/places/la-textilerie-panorama.png";
const MAPTILER_MAP_ID = "019bed44-2daf-78d1-abfb-c41cf8eecbd9";
const STYLE_URL = `https://api.maptiler.com/maps/${MAPTILER_MAP_ID}/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY ?? ""}`;
type Biz = {
  id: string;
  name: string;
  address?: string | null;
  website?: string | null;
  openingHours?: string | null;
  phone?: string | null;
  panoramaImage?: string | null;
  timeZone?: string | null;
  miniText?: string | null;
  lat?: number | null;
  lng?: number | null;
  type?: string | null;
};

type Kind =
  | "cafe"
  | "epicerie"
  | "friperie"
  | "librairie"
  | "restaurant"
  | "boutique"
  | "atelier"
  | "atelier"
  | "microbrasserie"
  | "alternatif"
  | "ferme"
  | "marche"
  | "other";

function normalizeType(t?: string | null): Kind {
  const v = (t || "").toLowerCase();
  if (v.includes("café") || v.includes("cafe") || v.includes("coffee") || v.includes("brunch")) return "cafe";
  if (v.includes("microbrasserie") || v.includes("brasserie") || v.includes("bar") || v.includes("pub")) return "microbrasserie";
  if (v.includes("épicerie") || v.includes("epicerie") || v.includes("grocery")) return "epicerie";
  if (
    v.includes("friperie") ||
    v.includes("frip") ||
    v.includes("thrift") ||
    v.includes("mode éthique") ||
    v.includes("mode ethique") ||
    v.includes("vêtement") ||
    v.includes("vetement") ||
    v.includes("clothes") ||
    v.includes("fashion") ||
    v.includes("mode")
  )
    return "friperie";
  if (
    v.includes("restaurant locavore") ||
    v.includes("restaurant lacovore") ||
    v.includes("restaurant locavore abordable") ||
    v.includes("bistrot terroir") ||
    v.includes("bistro terroir") ||
    v.includes("bistrot terroir et local") ||
    v.includes("bistro terroir et local") ||
    v.includes("cuisine du marché") ||
    v.includes("cuisine du marche") ||
    v.includes("restaurant")
  )
    return "restaurant";
  if (v.includes("librairie") || v.includes("bouquinerie") || v.includes("bookstore") || v.includes("book")) return "librairie";
  if (v.includes("atelier")) return "atelier";
  if (
    v.includes("marché") ||
    v.includes("marche") ||
    v.includes("market") ||
    v.includes("farmers market") ||
    v.includes("farmer\x27s market") ||
    v.includes("greenmarket") ||
    v.includes("public market")
  ) return "marche";
  if (v.includes("ferme") || v.includes("farm")) return "ferme";
  if (v.includes("alternatif") || v.includes("alternative")) return "alternatif";
  if (v.includes("boutique locale") || v.includes("boutique")) return "boutique";
  return "other";
}


function getCategorySentence(type: string): string {
  return "";
}

if (typeof window !== "undefined") {
  try { (window as any).getCategorySentence = getCategorySentence; } catch {}
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const SAVED_PLACES_KEY = "im-saved-places";

function readSavedPlaces() {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(SAVED_PLACES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isSavedPlace(id: string) {
  return readSavedPlaces().some((item: any) => String(item?.id ?? "") === String(id ?? ""));
}

function toggleSavedPlace(place: any) {
  try {
    if (typeof window === "undefined") return false;
    const current = readSavedPlaces();
    const id = String(place?.id ?? "").trim();
    if (!id) return false;

    const exists = current.some((item: any) => String(item?.id ?? "") === id);
    const next = exists
      ? current.filter((item: any) => String(item?.id ?? "") !== id)
      : [
          {
            id,
            name: String(place?.name ?? "").trim(),
            city: String(place?.city ?? "").trim() || undefined,
            address: String(place?.address ?? "").trim() || undefined,
            panoramaImage: String(place?.panoramaImage ?? "").trim() || undefined,
            lat: Number.isFinite(Number(place?.lat)) ? Number(place.lat) : undefined,
            lng: Number.isFinite(Number(place?.lng)) ? Number(place.lng) : undefined
          },
          ...current
        ];

    window.localStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("im:saved-places-updated"));
    return !exists;
  } catch {
    return false;
  }
}

function heartButtonHtml(place: any) {
  const active = isSavedPlace(String(place?.id ?? ""));
  const stroke = "rgba(245,245,232,0.95)";
  const fill = active ? "#6F6528" : "none";
  const glow = "none";
  return "<button data-fav=\"1\" data-place-id=\"" + escapeHtml(String(place?.id ?? "")) + "\" data-place-name=\"" + escapeHtml(String(place?.name ?? "")) + "\" data-place-city=\"" + escapeHtml(String(place?.city ?? "")) + "\" data-place-address=\"" + escapeHtml(String(place?.address ?? "")) + "\" data-place-panorama=\"" + escapeHtml(String(place?.panoramaImage ?? "")) + "\" data-place-lat=\"" + escapeHtml(String(place?.lat ?? "")) + "\" data-place-lng=\"" + escapeHtml(String(place?.lng ?? "")) + "\" aria-label=\"" + ui("Mes lieux","My places") + "\" title=\"" + ui("Mes lieux","My places") + "\" style=\"position:absolute; left:-7px; top:-7px; margin:0; padding:0; background:transparent; border:none; color:" + stroke + "; font-size:22px; line-height:1; cursor:pointer; box-shadow:" + glow + "; z-index:3;\" onclick=\"return false;\" ><svg viewBox='0 0 24 24' width='21' height='21' fill='" + fill + "' stroke='" + stroke + "' stroke-width='2.1' stroke-linecap='round' stroke-linejoin='round' style='display:block;'><path d='M12 21.2c-.3 0-.6-.1-.8-.3C8.1 18.4 2.5 13.9 2.5 8.4C2.5 5.5 4.8 3.3 7.7 3.3c1.8 0 3.4.8 4.3 2.2c.9-1.4 2.5-2.2 4.3-2.2c2.9 0 5.2 2.2 5.2 5.1c0 5.5-5.6 10-8.7 12.5c-.2.2-.5.3-.8.3z'/></svg></button>";
}

function bindFavButton(root: HTMLElement) {
  try {
    const fav = root.querySelector("[data-fav=\"1\"]") as HTMLElement | null;
    if (!fav) return;

    const paint = (active: boolean) => {
      try {
        const svg = fav.querySelector("svg");
        if (!svg) return;
        const stroke = "rgba(245,245,232,0.95)";
        const fill = active ? "#6F6528" : "none";
        (fav as any).style.color = stroke;
        (fav as any).style.boxShadow = "none";
        svg.setAttribute("stroke", stroke);
        svg.setAttribute("fill", fill);
      } catch {}
    };

    paint(isSavedPlace(String(fav.getAttribute("data-place-id") || "")));

    fav.addEventListener("click", (ev: any) => {
      try { ev.preventDefault(); ev.stopPropagation(); } catch {}
      const next = toggleSavedPlace({
        id: fav.getAttribute("data-place-id") || "",
        name: fav.getAttribute("data-place-name") || "",
        city: fav.getAttribute("data-place-city") || "",
        address: fav.getAttribute("data-place-address") || "",
        panoramaImage: fav.getAttribute("data-place-panorama") || "",
        lat: Number(fav.getAttribute("data-place-lat") || ""),
        lng: Number(fav.getAttribute("data-place-lng") || "")
      });
      paint(next);
    });
  } catch {}
}



/* __INDIEMAP_OPENING_HOURS_FR__ */
function normalizeDayFR(x: string) {
  const v = String(x || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (v.startsWith("lundi")) return "lundi";
  if (v.startsWith("mardi")) return "mardi";
  if (v.startsWith("mercredi")) return "mercredi";
  if (v.startsWith("jeudi")) return "jeudi";
  if (v.startsWith("vendredi")) return "vendredi";
  if (v.startsWith("samedi")) return "samedi";
  if (v.startsWith("dimanche")) return "dimanche";
  return "";
}

function parseTimeToMinFR(t: string) {
  const m = String(t || "").trim().match(/^(\d{1,2})\s*(?:h|:)\s*(\d{2})$/i);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function parseOpeningHoursFR(opening: string) {
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
      const a = parseTimeToMinFR(mm[1].replace(/\s+/g,""));
      const b = parseTimeToMinFR(mm[2].replace(/\s+/g,""));
      if (a == null || b == null) continue;
      ranges.push([a, b]);
    }

    if (!byDay.has(day)) byDay.set(day, []);
    const cur = byDay.get(day)!;
    for (const r of ranges) cur.push(r);
  }

  return byDay;
}

function nowPartsInTZ(timeZone: string) {
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
}

function isOpenNowFR(opening: string, timeZone: string) {
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
/* __INDIEMAP_OPENING_HOURS_FR__ */








function computeOpenInfo(openingHoursRaw: string, cityRaw: string) {
  const norm = (x: string) =>
    String(x || "")
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");

  const tzForCity = (city: string) => {
    const c = norm(city);
    if (c === "paris") return "Europe/Paris";
    if (c === "montreal" || c === "montreal qc" || c.includes("montreal")) return "America/Montreal";
    return "";
  };

  const nowParts = (tz: string) => {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz || undefined,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(new Date());
      const get = (t: string) => (parts.find((p: any) => p.type === t)?.value || "");
      const wd = get("weekday");
      const hh = Number(get("hour"));
      const mm = Number(get("minute"));
      const widx =
        wd === "Mon" ? 1 :
        wd === "Tue" ? 2 :
        wd === "Wed" ? 3 :
        wd === "Thu" ? 4 :
        wd === "Fri" ? 5 :
        wd === "Sat" ? 6 : 0;
      const mins = (Number.isFinite(hh) ? hh : 0) * 60 + (Number.isFinite(mm) ? mm : 0);
      return { widx, mins };
    } catch {
      const d = new Date();
      const widx = d.getDay();
      const mins = d.getHours() * 60 + d.getMinutes();
      return { widx, mins };
    }
  };

  const dayIndexFromLine = (line: string) => {
    const x = norm(line);
    const first = x.split(/s+/)[0] || "";
    return (
      first === "lundi" ? 1 :
      first === "mardi" ? 2 :
      first === "mercredi" ? 3 :
      first === "jeudi" ? 4 :
      first === "vendredi" ? 5 :
      first === "samedi" ? 6 :
      first === "dimanche" ? 0 : -1
    );
  };

  const isOpenNow = () => {
    const tz = tzForCity(cityRaw);
    const now = nowParts(tz);
    const raw = String(openingHoursRaw || "").trim();
    if (!raw) return null;

    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    const todays = lines.find((l) => dayIndexFromLine(l) === now.widx);
    if (!todays) return null;

    const t = norm(todays);
    if (t.includes("ferme")) return false;

    const re = /(d{1,2})h(d{2})s*-s*(d{1,2})h(d{2})/g;
    let m;
    const ranges = [];
    while ((m = re.exec(todays)) !== null) {
      const h1 = Number(m[1]), m1 = Number(m[2]), h2 = Number(m[3]), m2 = Number(m[4]);
      if (![h1,m1,h2,m2].every(Number.isFinite)) continue;
      const a = h1 * 60 + m1;
      const b = h2 * 60 + m2;
      ranges.push([a,b]);
    }
    if (!ranges.length) return null;

    for (const [a,b] of ranges) {
      if (now.mins >= a && now.mins < b) return true;
    }
    return false;
  };

  const r = isOpenNow();
  const open = r === true;
  const known = r !== null;

  const kaki = "#728A4A";
  const orange = "#F59E0B";

  const fmt = (minsTotal: any) => {
    const h = Math.floor(Math.max(0, Number(minsTotal) || 0) / 60);
    const m = Math.floor(Math.max(0, Number(minsTotal) || 0) % 60);
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    return hh + "h" + mm;
  };

  const parseRangesForLine = (line: any) => {
    try {
      const t = String(line || "");
      const re = /(\d{1,2})h(\d{2})\s*[–-]\s*(\d{1,2})h(\d{2})/g;
      let m: any;
      const ranges: any[] = [];
      while ((m = re.exec(t)) !== null) {
        const h1 = Number(m[1]), m1 = Number(m[2]), h2 = Number(m[3]), m2 = Number(m[4]);
        if (![h1,m1,h2,m2].every(Number.isFinite)) continue;
        ranges.push([h1 * 60 + m1, h2 * 60 + m2]);
      }
      ranges.sort((a,b)=>a[0]-b[0]);
      return ranges;
    } catch {
      return [];
    }
  };

  const nextInfoText = () => {
    try {
      const tz = tzForCity(cityRaw);
      const now = nowParts(tz);
      const raw = String(openingHoursRaw || "").trim();
      if (!raw) return null;

      const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
      const lineForDay = (widx: number) => lines.find((l) => dayIndexFromLine(l) === widx) || null;

      const todayLine = lineForDay(now.widx);
      const todayRanges = todayLine && !norm(todayLine).includes("ferme") ? parseRangesForLine(todayLine) : [];

      if (open) {
        for (const [a,b] of todayRanges) {
          if (now.mins >= a && now.mins < b) return ui("Ouvert — jusqu’à ","Open — until ") + fmt(b);
        }
        return ui("Ouvert","Open");
      }

      for (const [a,b] of todayRanges) {
        if (now.mins < a) return ui("Fermé — ouvre à ","Closed — opens at ") + fmt(a);
      }

      for (let d=1; d<=7; d++) {
        const w = (now.widx + d) % 7;
        const ln = lineForDay(w);
        if (!ln) continue;
        const nn = norm(ln);
        if (nn.includes("ferme")) continue;
        const rr = parseRangesForLine(ln);
        if (!rr.length) continue;
        return ui("Fermé — ouvre ","Closed — opens ") + (d === 1 ? ui("demain","tomorrow") : ui("bientôt","soon")) + ui(" à "," at ") + fmt(rr[0][0]);
      }

      return ui("Fermé","Closed");
    } catch {
      return open ? ui("Ouvert","Open") : ui("Fermé","Closed");
    }
  };

  if (!known) {
    return { known: false, open: false, text: ui("Horaires inconnus","Hours unknown"), color: "rgba(245,245,232,.55)", dot: "rgba(245,245,232,.35)" };
  }

  const text = nextInfoText() || (open ? ui("Ouvert","Open") : ui("Fermé","Closed"));

  return open
    ? { known: true, open: true, text, color: kaki, dot: kaki }
    : { known: true, open: false, text, color: orange, dot: orange };
}


function buildMiniPinPopupHtml(props: any, dark: boolean, walkMins?: number | null) {
  const name = String(props?.name ?? props?.title ?? "").trim();
  const type = String(props?.type ?? "").trim();
  const id = String(props?.id ?? "").trim();
  const openingHoursRaw = String(props?.openingHours ?? "").trim();

  const lower = name.toLowerCase();
  const isTextilerie = id === "98ce3443-2512-4285-9b47-535d2a369cb4" || lower.includes("textilerie");

  const phoneDial = String((props as any)?.phone ?? (props as any)?.properties?.phone ?? "").trim();

  const miniTextRaw =
    (props as any)?.miniText ??
    (props as any)?.properties?.miniText ??
    (props as any)?.blurb ??
    (props as any)?.properties?.blurb ??
    (props as any)?.description ??
    (props as any)?.properties?.description ??
    "";
  const miniText = String(miniTextRaw || "").trim();
  const miniTextFinal = miniText;

  const sentence = isTextilerie
    ? ""
    : getCategorySentence(type);

  const bg = "rgba(31,31,24,.68)";
  const kindRaw = String(
    (props as any)?.kind ??
      (props as any)?.properties?.kind ??
      (props as any)?.feature?.properties?.kind ??
      ""
  ).trim();

  const kind = (kindRaw || normalizeType(type || null)) as any;

  const cssVar = (name: string, fallback: string) => {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      if (!v) return fallback;
      return "hsl(" + v + ")";
    } catch {
      return fallback;
    }
  };

  const pal: any = {
    cafe: cssVar("--cafe", "#c26b3a"),
    epicerie: "#FF8FC7",
    friperie: cssVar("--violet", "#7c3aed"),
    librairie: "#3B82F6",
    restaurant: cssVar("--restaurant", "#ef4444"),
    boutique: "#000000",
    atelier: "#1E3A8A",
    ferme: "#F6FF00",
    microbrasserie: cssVar("--micro", "#f59e0b"),
    alternatif: "#00F5FF",
    other: "#8C5A3C",
  };

  const baseBorder = String(pal[kind] || "rgba(228,212,194,.18)").trim();
  const border = "color-mix(in srgb, " + baseBorder + " 22%, transparent)";
  const titleColor = "rgba(245,245,232,.92)";
  const textColor = "rgba(245,245,232,.78)";
  const metaColor = "rgba(245,245,232,.62)";
  const shadow = "0 0 0 1px rgba(245,245,232,.14), 0 12px 26px rgba(0,0,0,.26), 0 0 28px rgba(245,245,232,.16)";


  const bgCss = bg;



  const badgesHtml = "";


  const OPEN_COLOR = "#728A4A";
  const CLOSED_COLOR = "#F59E0B";

  const status = (() => {
    const raw = String(openingHoursRaw || "").trim();
    if (!raw) return null;

    let wd = "";
    let hh = "";
    let mm = "";
    try {
      const tzRaw = String(
        (props as any)?.timeZone ??
          (props as any)?.properties?.timeZone ??
          (props as any)?.feature?.properties?.timeZone ??
          ""
      ).trim();

      const cityRaw = String(
        (props as any)?.city ??
          (props as any)?.properties?.city ??
          (props as any)?.feature?.properties?.city ??
          ""
      );

      const norm = (x: unknown) =>
        String(x || "")
          .toLowerCase()
          .trim()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");

      const tzForCity = (city: unknown) => {
        const c = norm(city);
        if (c.includes("new york") || c === "nyc") return "America/New_York";
        return "";
      };

      const tz = tzRaw || tzForCity(cityRaw);

      const fmt = tz
        ? new Intl.DateTimeFormat("fr-FR", { timeZone: tz, weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false })
        : new Intl.DateTimeFormat("fr-FR", { weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false });

      const parts = fmt.formatToParts(new Date());
      for (const pt of parts) {
        if (pt.type === "weekday") wd = String(pt.value || "").toLowerCase();
        if (pt.type === "hour") hh = String(pt.value || "");
        if (pt.type === "minute") mm = String(pt.value || "");
      }
    } catch {
      return null;
    }

    const nowMin = Number(hh) * 60 + Number(mm);
    if (!Number.isFinite(nowMin)) return null;

    const dayNames = ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"];
    const widx = dayNames.indexOf((wd || "").trim());
    if (widx === -1) return null;

    const lines = raw.split(/\r?\n/).map((l) => String(l || "").trim()).filter(Boolean);
    const day = dayNames[widx];

    const todaysLine = lines.find((l) => String(l).toLowerCase().startsWith(day));
    if (!todaysLine) return null;

    const rest = String(todaysLine).slice(day.length).trim();
    if (!rest) return null;
    const isClosedToday = rest.toLowerCase().includes("fermé") || rest.toLowerCase().includes("ferme");

    const parts = isClosedToday ? [] : rest.split(/\s*(?:,|\/|;)\s*/).map((x) => x.trim()).filter(Boolean);
    const parsed = parts
      .map((p) => {
        const m = p.match(/(\d{1,2})h(\d{2})\s*[–-]\s*(\d{1,2})h(\d{2})/i);
        if (!m) return null;
        const sh = Number(m[1]);
        const sm = Number(m[2] ?? "00");
        const eh = Number(m[3]);
        const em = Number(m[4] ?? "00");
        if (![sh,sm,eh,em].every(Number.isFinite)) return null;
        const a = sh * 60 + sm;
        const b = eh * 60 + em;
        return { a, b, sh, sm, eh, em };
      })
      .filter(Boolean) as Array<{ a:number; b:number; sh:number; sm:number; eh:number; em:number }>;

    const fmt = (h:number, m:number) => String(h).padStart(2,"0") + "h" + String(m).padStart(2,"0");
    const cap = (x:string) => x ? (x.charAt(0).toUpperCase() + x.slice(1)) : x;

    let open = false;
    let closesAt = "";
    let nextOpenAt = "";
    let nextOpenDay = "";
    let nextOpenOffset = -1;

    for (const r of parsed) {
      if (r.b >= r.a) {
        if (nowMin >= r.a && nowMin < r.b) {
          open = true;
          closesAt = fmt(r.eh, r.em);
          break;
        }
      } else {
        if (nowMin >= r.a || nowMin < r.b) {
          open = true;
          closesAt = fmt(r.eh, r.em);
          break;
        }
      }
    }

    if (!open) {
      let bestStart = Infinity;
      for (const r of parsed) {
        if (r.b >= r.a) {
          if (nowMin < r.a && r.a < bestStart) {
            bestStart = r.a;
            nextOpenAt = fmt(r.sh, r.sm);
            nextOpenOffset = 0;
          }
        }
      }

      if (!nextOpenAt) {
        for (let off = 1; off <= 7; off++) {
          const di = (widx + off) % 7;
          const dn = dayNames[di];
          const line = lines.find((l) => String(l).toLowerCase().startsWith(dn));
          if (!line) continue;

          const r2 = String(line).slice(dn.length).trim();
          if (!r2) continue;

          const low2 = r2.toLowerCase();
          if (low2.includes("fermé") || low2.includes("ferme")) continue;

          const parts2 = r2.split(/\s*(?:,|\/|;)\s*/).map((x) => x.trim()).filter(Boolean);
          let found = null as null | { sh:number; sm:number; a:number };
          for (const p of parts2) {
            const m = p.match(/(\d{1,2})h(\d{2})\s*[–-]\s*(\d{1,2})h(\d{2})/i);
            if (!m) continue;
            const sh = Number(m[1]);
            const sm = Number(m[2] ?? "00");
            if (![sh,sm].every(Number.isFinite)) continue;
            const a = sh * 60 + sm;
            if (!found || a < found.a) found = { sh, sm, a };
          }
          if (found) {
            nextOpenAt = fmt(found.sh, found.sm);
            nextOpenDay = cap(dn);
            nextOpenOffset = off;
            break;
          }
        }
      }
    }

    if (open) {
      return { label: closesAt ? ui("Ouvert · ferme à ","Open · closes at ") + closesAt : ui("Ouvert","Open"), color: OPEN_COLOR };
    }
    if (nextOpenAt) {
      return nextOpenOffset > 0
        ? { label: ui("Fermé · ouvre ","Closed · opens ") + nextOpenDay + ui(" à "," at ") + nextOpenAt, color: CLOSED_COLOR }
        : { label: ui("Fermé · ouvre à ","Closed · opens at ") + nextOpenAt, color: CLOSED_COLOR };
    }
    return { label: ui("Fermé","Closed"), color: CLOSED_COLOR };
  })();

  const statusHtml = status
    ? "<span style=\"font-weight:800; color:" + status.color + ";\">" + status.label + "</span>"
    : "<span style=\"font-weight:700; color:" + metaColor + ";\">" + ui("Horaires inconnus","Hours unknown") + "</span>";

  const wm = Number(walkMins);
  const walkTxt = Number.isFinite(wm) ? (String(Math.max(1, Math.round(wm))) + ui(" min à pied"," min walk")) : ui("— min à pied","— min walk");
  const walkHtml = "<span style=\"margin-left:14px; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:11.5px; letter-spacing:.02em; color:rgba(245,245,232,.88); font-weight:650;\" >" + "<span style=\"font-weight:800; margin:0 6px;\">·</span>" + walkTxt + "<span style=\"font-weight:800; margin-left:6px;\">·</span></span>";
  const closeHtml = "<button data-mini-close=\"1\" style=\"position:absolute; top:12px; right:12px; width:28px; height:28px; padding:0; border-radius:0; display:flex; align-items:center; justify-content:center; background:transparent; border:none; color:rgba(245,245,232,.92); font-size:20px; line-height:28px; cursor:pointer; box-shadow:none;\" onclick=\"return false;\" aria-label=\"" + ui("Fermer","Close") + "\" ><span style='display:inline-block; transform: translateY(-4px);'>×</span></button>";
  return (
    "<div style=\"position:relative; width:min(420px, calc(100vw - 40px)); max-width:420px; padding:16px 16px 14px; background:" + bgCss + "; border:1px solid rgba(245,245,232,.14); border-radius:16px 6px 16px 6px; box-shadow:" + shadow + "; overflow:visible; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);\" >" + closeHtml +
      heartButtonHtml(props) +
      "<div style=\"font-family: ui-serif, Georgia, Cambria, 'Times New Roman', serif; font-size:15px; font-weight:700; line-height:1.2; color:" + titleColor + "; letter-spacing:.02em; margin-bottom:12px; padding-left:0; padding-right:34px;\" >" +
        escapeHtml(name || ui("Lieu","Place")) +
      "</div>" +
      "<div style=\"margin-top:4px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;font-size:15px;line-height:1.6;max-height:38vh;overflow:auto;color:" + textColor + ";opacity:.92;\" >" + escapeHtml(miniTextFinal) + "</div>" +
       badgesHtml +
       "<div style=\"margin-top:8px; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:12.5px; line-height:1.35; color:" + textColor + ";\" >" +
         escapeHtml(sentence) +
      "</div>" +
      "<div style=\"margin-top:10px; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:10.5px; letter-spacing:.02em; color:" + metaColor + ";\" >" +
        statusHtml + walkHtml +
      "</div>" + "<div style=\"margin-top:10px; display:flex; align-items:center; gap:8px;\" >" + "<button data-discover=\"1\" style=\"display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;padding:5px 12px;border-radius:10px 4px 10px 4px;background:transparent;border:1px solid rgba(255,255,255,0.30);color:rgba(245,245,232,.92);font-size:13px;letter-spacing:.02em;cursor:pointer;box-shadow:none;text-align:center;font-weight:650;\" onclick=\"return false;\" >" + ui("Immersion →","Immerse →") + "</button>" + "<button data-hours=\"1\" aria-label=\"Horaires\" title=\"Horaires\" style=\"display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:32px;height:32px;padding:0;border-radius:10px 4px 10px 4px;background:rgba(0,0,0,0.14);border:1px solid rgba(255,255,255,0.30);color:rgba(245,245,232,.92);font-size:14px;line-height:26px;cursor:pointer;box-shadow:0 6px 14px rgba(0,0,0,0.18);\" onclick=\"return false;\"\" ><svg viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round' style='display:block;'><path d='M12 4.4a7.6 7.6 0 1 1 0 15.2a7.6 7.6 0 1 1 0-15.2'/><path d='M12.2 6.8v5.1'/><path d='M12.2 11.9l3.3 1.6'/></svg></button><button data-phone=\"1\" data-tel=\"" + (phoneDial || "") + "\" aria-label=\"Téléphone\" title=\"Téléphone\" style=\"display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:32px;height:32px;padding:0;border-radius:10px 4px 10px 4px;background:rgba(0,0,0,0.14);border:1px solid rgba(255,255,255,0.30);color:rgba(245,245,232,.92);font-size:14px;line-height:26px;cursor:pointer;box-shadow:0 6px 14px rgba(0,0,0,0.18);\" onclick=\"return false;\" ><svg viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' stroke-width='1.35' stroke-linecap='round' stroke-linejoin='round' style='display:block;'><path d='M8.2 4.8c.9-.7 2.1-.4 2.9.6l.6.8c.7.9.7 2-.1 2.8l-1 1c-.4.4-.5 1-.2 1.5l2.7 4.1c.3.5.9.7 1.4.4l1.2-.7c1-.6 2.2-.3 2.9.6l.6.8c.7.9.5 2.2-.4 2.9l-.8.6c-1.2.9-2.8 1-4.1.2c-2.1-1.2-4.1-3.3-5.8-5.8c-1.7-2.6-2.6-5-2.7-7.4c0-1.5.7-2.9 1.9-3.8z'/><path d='M8.7 5.2c.7-.5 1.6-.2 2.2.6l.5.7c.5.7.5 1.6-.1 2.2l-1 1c-.6.6-.7 1.5-.2 2.2l2.7 4.1c.5.7 1.4 1 2.2.5l1.2-.7c.8-.5 1.7-.3 2.2.5l.5.7c.5.7.4 1.7-.3 2.2'/></svg></button><button data-addr=\"1\" aria-label=\"Adresse\" title=\"Adresse\" style=\"display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:32px;height:32px;padding:0;border-radius:10px 4px 10px 4px;background:rgba(0,0,0,0.14);border:1px solid rgba(255,255,255,0.30);color:rgba(245,245,232,.92);font-size:14px;line-height:26px;cursor:pointer;box-shadow:0 6px 14px rgba(0,0,0,0.18);\" onclick=\"return false;\" ><svg viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round' style='display:block;'><path d='M12 4.5v15'/><path d='M12 6.5h6l-2.4-2.2'/><path d='M18 6.5l-2.4 2.2'/><path d='M12 10.5h-6l2.4-2.2'/><path d='M6 10.5l2.4 2.2'/></svg></button><button data-site=\"1\" aria-label=\"Site web\" title=\"Site web\" style=\"display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:32px;height:32px;padding:0;border-radius:10px 4px 10px 4px;background:rgba(0,0,0,0.14);border:1px solid rgba(255,255,255,0.30);color:rgba(245,245,232,.92);font-size:14px;line-height:26px;cursor:pointer;box-shadow:0 6px 14px rgba(0,0,0,0.18);\" onclick=\"return false;\" ><svg viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round' style='display:block;'><path d='M3.2 12l8.8-8.8l8.8 8.8'/><path d='M6 11v8h12v-8'/><path d='M10 19v-4h4v4'/></svg></button>" + "</div>" + "<div style=\"position:absolute; left:50%; bottom:-10px; width:16px; height:10px; background:" + bg + "; clip-path: polygon(50% 100%, 0 0, 100% 0); transform: translateX(-50%); filter: drop-shadow(0 1px 0 " + border + ");\" ></div>" +
    "</div>"
  );
}

function svgPin(color: string, stroke: string, selected: boolean) {
  const size = selected ? 26 : 24;
  const height = selected ? 38 : 36;
  const shadow = selected
    ? "<defs><filter id=\"shadow\"><feDropShadow dx=\"0\" dy=\"1\" stdDeviation=\"1.2\" flood-color=\"rgba(0,0,0,0.4)\" /></filter></defs>"
    : "";
  const groupOpen = selected ? "<g filter=\"url(#shadow)\">" : "";
  const groupClose = selected ? "</g>" : "";
  const html =
    "<svg width=\"" +
    size +
    "\" height=\"" +
    height +
    "\" viewBox=\"0 0 24 36\" xmlns=\"http://www.w3.org/2000/svg\">" +
    shadow +
    groupOpen +
    "<path d=\"M12 2C7 2 3 6.2 3 11.5C3 18.5 8 24 12 29C16 24 21 18.5 21 11.5C21 6.2 17 2 12 2Z\" fill=\"" +
    color +
    "\" stroke=\"" +
    stroke +
    "\" stroke-width=\"1.2\"/>" +
    "<path d=\"M8.8 7.2C9.6 6.1 10.7 5.4 12 5.2C13.4 5 14.9 5.4 16.1 6.2\" fill=\"none\" stroke=\"rgba(255,255,255,0.7)\" stroke-width=\"1.1\" stroke-linecap=\"round\"/>" +
    groupClose +
    "</svg>";
  return html;
}

function svgToDataUri(svg: string) {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


function buildPopupHtml(p: any, darkMap: boolean) {
  const _popupProps = p;
  const _lowerName = String((_popupProps as any)?.name ?? (_popupProps as any)?.title ?? "").trim().toLowerCase();
  const isTextilerie = _lowerName.includes("textilerie");
  const nameRaw = String(p?.name ?? "");
  const name = escapeHtml(nameRaw || ui("Lieu","Place"));
  const typeRaw = String(p?.type ?? "");
  const addressRaw = String(p?.address ?? "");
  const websiteRaw = String(p?.website ?? "");
  const openingHoursRaw = String(p?.openingHours ?? "");
  const latRaw = Number(p?.lat);
  const lngRaw = Number(p?.lng);

  const addressBlock = addressRaw
    ? "<div class=\"mt-1\">" +
      "<a href=\"https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(addressRaw) +
      "\" data-addr=\"" +
        escapeHtml(addressRaw) +
      "\" onclick=\"(function(el){try{var raw=el.getAttribute('data-addr')||'';var q=encodeURIComponent(raw);var ua=navigator.userAgent||'';if(/iPhone|iPad|iPod/i.test(ua)){window.location.href='maps://?q='+q;}else{window.location.href='geo:0,0?q='+q;}}catch(e){} })(this);\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"text-[12px] font-medium\">" +
        escapeHtml(addressRaw) +
      "</a>" +
      "</div>"
    : "";

  const hoursBlock = openingHoursRaw
    ? "<details class=\"mt-2 text-[12px] leading-snug group\">" +
      "<summary class=\"cursor-pointer select-none font-semibold flex items-center gap-2\">" +
      ui("Horaires","Hours") +
      "<span class=\"text-red-600 inline-block transition-transform duration-200 group-open:rotate-90\">➤</span>" +
      "</summary>" +
      "<pre class=\"mt-1 whitespace-pre-wrap font-sans text-[12px]\">" +
      escapeHtml(openingHoursRaw) +
      "</pre>" +
      "</details>"
    : "<p class=\"mt-2 text-[12px]\">" + ui("Horaires : voir le site","Hours: see website") + "</p>";

  const routeBlock = Number.isFinite(latRaw) && Number.isFinite(lngRaw)
    ? "<div class=\"mt-2\">" +
        "<a href=\"#\" data-route=\"1\" class=\"inline-flex items-center rounded-full bg-[#E4D4C2] px-3 py-[2px] text-[11px] font-semibold text-neutral-800 hover:opacity-90\">" + ui("Itinéraire","Directions") + "</a>" +
      "</div>"
    : "";

  const normalFooter =
    "<p class=\"mt-2 text-[12px] leading-snug\" style=\"color:hsl(var(--leaf))\">" +
    escapeHtml(getCategorySentence(typeRaw)) +
    "</p>";

  const websiteLink = websiteRaw
    ? "<div class=\"mt-2\"><a href=\"" +
      escapeHtml(websiteRaw) +
      "\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"text-[12px] font-semibold\" style=\"" +
      (darkMap ? "color:#ffd27a" : "color:#ffd27a") +
      "\">" + ui("Site web","Website") + "</a></div>"
    : "";

  if (isTextilerie) {
    const sentence = escapeHtml(getCategorySentence(typeRaw));
    const addr = escapeHtml(addressRaw);
        return (
      "<div class=\"relative overflow-hidden rounded-2xl\" style=\"background:rgba(31,31,24,0.72);height:100%;min-height:100%\">" +
        "<div class=\"relative p-4 flex flex-col justify-end gap-2\" style=\"height:100%;min-height:100%;color:#fff\">" +
          "<p class=\"text-[14px] leading-snug font-semibold\" style=\"max-width:30rem\">" + sentence + "</p>" +
          "<h3 class=\"font-semibold leading-tight\" style=\"font-size:30px !important;line-height:1.08\">" + name + "</h3>" +
          (addressRaw ? "<div class=\"text-[12px] opacity-90\">" + addr + "</div>" : "") +
        "</div>" +
      "</div>"
    );
  }

  return (
    "<div class=\"space-y-2\">" +
      "<h3 class=\"font-semibold\" style=\"font-size:26px !important;line-height:1.08\">" + name + "</h3>" +
            (addressBlock ? addressBlock : "") +
      (routeBlock ? routeBlock : "") +
      hoursBlock +
      normalFooter +
      websiteLink +
    "</div>"
  );
}



export default function GlobeMap({
  items = [],
  selectedId,
  onSelect,
  darkMap = false,
  overlaysReady = true,
}: {
  items?: Biz[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  darkMap?: boolean;
  overlaysReady?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<maplibregl.Map | null>(null);
  const geolocateElRef = React.useRef<HTMLDivElement | null>(null);
  const readyRef = React.useRef(false);
  const pendingNativeLocationRef = React.useRef<{ lat: number; lng: number } | null>(null);
  const [mapReadyTick, setMapReadyTick] = React.useState(0);

  React.useEffect(() => {
    const fn = () => {
      try {
        const btn = geolocateElRef.current?.querySelector("button") as HTMLButtonElement | null;
        if (btn) btn.click();
      } catch {}
    };
    try { window.addEventListener("im:geolocate", fn); } catch {}
    return () => { try { window.removeEventListener("im:geolocate", fn); } catch {} };
  }, []);

  React.useEffect(() => {
    const fn = (ev: Event) => {
      try {
        const e = ev as CustomEvent<{ lat?: number; lng?: number }>;
        const lat = Number(e?.detail?.lat);
        const lng = Number(e?.detail?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const m = mapRef.current;
        if (!m) {
          try { pendingNativeLocationRef.current = { lat: Number(lat), lng: Number(lng) }; } catch {}
          return;
        }

        const SRC = "indie-user-location";
        const HALO = "indie-user-location-halo";
        const DOT = "indie-user-location-dot";

        const apply = () => {
          try {
            if (!m.getSource(SRC)) {
              m.addSource(SRC, {
                type: "geojson",
                data: {
                  type: "FeatureCollection",
                  features: [{
                    type: "Feature",
                    properties: {},
                    geometry: { type: "Point", coordinates: [Number(lng), Number(lat)] }
                  }]
                }
              } as any);
            }
          } catch {}

          try {
            if (!m.getLayer(HALO)) {
              m.addLayer({
                id: HALO,
                type: "circle",
                source: SRC,
                paint: {
                  "circle-radius": 12,
                  "circle-color": "#F97316",
                  "circle-opacity": 0.25
                }
              } as any);
            }
          } catch {}

          try {
            if (!m.getLayer(DOT)) {
              m.addLayer({
                id: DOT,
                type: "circle",
                source: SRC,
                paint: {
                  "circle-radius": 6,
                  "circle-color": "#F97316",
                  "circle-stroke-width": 2,
                  "circle-stroke-color": "#FFFFFF",
                  "circle-opacity": 1
                }
              } as any);
            }
          } catch {}

          try {
            const src = m.getSource(SRC) as any;
            if (src && src.setData) {
              src.setData({
                type: "FeatureCollection",
                features: [{
                  type: "Feature",
                  properties: {},
                  geometry: { type: "Point", coordinates: [Number(lng), Number(lat)] }
                }]
              });
            }
          } catch {}

          try { lastUserPosRef.current = { lng: Number(lng), lat: Number(lat), ts: Date.now() }; } catch {}

          try {
            const targetCenter: [number, number] = [Number(lng), Number(lat)];
            const targetZoom = 12.4;
            m.jumpTo({ center: targetCenter, zoom: targetZoom });
            window.setTimeout(() => {
              try {
                const m2 = mapRef.current;
                if (!m2) return;
                m2.easeTo({
                  center: targetCenter,
                  zoom: targetZoom,
                  duration: 900
                });
              } catch {}
            }, 450);
          } catch {}
        };

        try {
          if (typeof m.isStyleLoaded === "function" && !m.isStyleLoaded()) {
            m.once("load", apply);
          } else {
            apply();
          }
        } catch { try { apply(); } catch {} }
      } catch {}
    };
    try { window.addEventListener("im:native-location", fn as EventListener); } catch {}
    try {
      const cached = (window as any).__IM_NATIVE_LOCATION__;
      const lat = Number(cached?.lat);
      const lng = Number(cached?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        fn(new CustomEvent("im:native-location", { detail: { lat, lng } }) as unknown as Event);
      }
    } catch {}
    return () => { try { window.removeEventListener("im:native-location", fn as EventListener); } catch {} };
  }, []);

  const SOURCE_ID = "indie-places";
  const LAYER_ID = "indie-places-pin";
const GLOW_LAYER_ID = "indie-places-pin-glow";
  const SELECT_LAYER_ID = "indie-places-pin-selected";
  const ROUTE_SOURCE_ID = "indie-route";
  const ROUTE_LAYER_ID = "indie-route-line";

  const fcRef = React.useRef<any>({ type: "FeatureCollection", features: [] });
  const popupRef = React.useRef<maplibregl.Marker | null>(null);
  const selectedPinMarkerRef = React.useRef<maplibregl.Marker | null>(null);
  const lastUserPosRef = React.useRef<{ lng: number; lat: number; ts: number } | null>(null);
    const [sheetOpen, setSheetOpen] = React.useState(false);
  const [sheetExpanded, setSheetExpanded] = React.useState(false);
  const [sheetHtml, setSheetHtml] = React.useState<string>("");
  const [discoverOpen, setDiscoverOpen] = React.useState(false);
  const [discoverHeroOpen, setDiscoverHeroOpen] = React.useState(false);
  const [heroUiHide, setHeroUiHide] = React.useState(false);

  React.useEffect(() => {
    try {
    } catch {}
  }, [discoverHeroOpen]);

  const [discoverHeroPan, setDiscoverHeroPan] = React.useState(0.5);
  const [discoverHeroZoom, setDiscoverHeroZoom] = React.useState(false);
  const [discoverHeroUrl, setDiscoverHeroUrl] = React.useState<string | null>(null);
  const [tableauFade, setTableauFade] = React.useState(0);
  React.useEffect(() => {
    try { window.dispatchEvent(new CustomEvent("im:hero", { detail: { open: Boolean(discoverHeroOpen) } })); } catch {}
  }, [discoverHeroOpen]);

  React.useEffect(() => {
    try { if (tableauFadeRafRef.current != null) cancelAnimationFrame(tableauFadeRafRef.current); } catch {}
    tableauFadeRafRef.current = null;

    if (!discoverHeroOpen) {
      try { setTableauFade(0); } catch {}
      return;
    }

    const tick = () => {
      try {
        const p0 = Number((discoverHeroPan as any) ?? 0.5);
        const target = Math.max(0, Math.min(1, (p0 - 0.78) / 0.18));
        setTableauFade((prev) => {
          const cur = Number(prev ?? 0);
          const next = cur + (target - cur) * 0.12;
          return Math.abs(next - target) < 0.002 ? target : next;
        });
      } catch {}
      tableauFadeRafRef.current = requestAnimationFrame(tick);
    };

    tableauFadeRafRef.current = requestAnimationFrame(tick);

    return () => {
      try { if (tableauFadeRafRef.current != null) cancelAnimationFrame(tableauFadeRafRef.current); } catch {}
      tableauFadeRafRef.current = null;
    };
  }, [discoverHeroOpen, discoverHeroPan]);
  const heroPanRef = React.useRef<number>(0.5);
  const heroDragRef = React.useRef<any>(null);
  const heroPointerDown = (e: any) => {
    try {
      const x0 = Number(e?.clientX || 0);
      const p0 = Number(heroPanRef.current ?? 0.5);
      heroDragRef.current = { active: true, lastX: x0, pan: p0, pid: Number(e?.pointerId ?? -1), moved: false } as any;
      try { if (e?.currentTarget?.setPointerCapture) e.currentTarget.setPointerCapture(Number(e?.pointerId ?? -1)); } catch {}
    } catch {}
  };
  const heroPointerMove = (e: any) => {
    try {
      const st: any = heroDragRef.current as any;
      if (!st || !st.active) return;
      const pid = Number(e?.pointerId ?? -1);
      if (Number.isFinite(st.pid) && st.pid !== -1 && pid !== -1 && pid !== st.pid) return;
      const x = Number(e?.clientX || 0);
      const lastX = Number(st.lastX ?? x);
      const dx = x - lastX;
      st.lastX = x;
      if (!st.moved && Math.abs(dx) > 1.5) {
        st.moved = true;
        try { heroHadMoveRef.current = true; } catch {}
        try { setHeroHintOff(true); } catch {}
        try { if (heroHintTimerRef.current) clearTimeout(heroHintTimerRef.current); } catch {}
        heroHintTimerRef.current = null;
        try { if (heroHintRafRef.current != null) cancelAnimationFrame(heroHintRafRef.current); } catch {}
        heroHintRafRef.current = null;
      }
      if (!st.moved) return;
      try { e.preventDefault(); e.stopPropagation(); } catch {}
      const w = Number((typeof window !== "undefined" ? window.innerWidth : 1) || 1);
      const curPan = Number(st.pan ?? heroPanRef.current ?? 0.5);
      const next = Math.max(0, Math.min(1, curPan - (dx / w)));
      st.pan = next;
      try { heroPanRef.current = next; } catch {}
      try { setDiscoverHeroPan(next); } catch {}
    } catch {}
  };
  const heroPointerUp = (e: any) => {
    try {
      const st: any = heroDragRef.current as any;
      const pid = Number(e?.pointerId ?? -1);
      if (st && st.pid != null && st.pid !== -1 && pid !== -1 && pid !== st.pid) return;
      try { if (e?.currentTarget?.releasePointerCapture) e.currentTarget.releasePointerCapture(Number(e?.pointerId ?? -1)); } catch {}
    } catch {}
    try { heroDragRef.current = null; } catch {}
  };
  const heroHadMoveRef = React.useRef(false);
  const heroHintRafRef = React.useRef<number | null>(null);
  const heroHintTimerRef = React.useRef<any>(null);
  const tableauFadeRafRef = React.useRef<number | null>(null);
  const [heroHintOff, setHeroHintOff] = React.useState(false);

  const heroImgSizeRef = React.useRef<{ w: number; h: number } | null>(null);
  const tableauPrevPRef = React.useRef<number>(0.5);
  React.useEffect(() => {
    try { if (heroHintTimerRef.current) clearTimeout(heroHintTimerRef.current); } catch {}
    heroHintTimerRef.current = null;
    try { if (heroHintRafRef.current != null) cancelAnimationFrame(heroHintRafRef.current); } catch {}
    heroHintRafRef.current = null;

    if (!discoverHeroOpen) return;
    if (heroHintOff) return;

    const start0 = Number(heroPanRef.current ?? 0.5);
    const turnedRight = () => {
      const cur = Number(heroPanRef.current ?? 0.5);
      return cur > (start0 + 0.02);
    };

    const runBump = (start:number) => {
      const bump = 0.014;
      const dur = 260;
      const pause = 8;
      const ease = (t:number) => (t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2);

      const kick = (from:number, to:number, cb?:()=>void) => {
        const t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
        const tick = () => {
          try {
            if (!discoverHeroOpen || heroHintOff || heroHadMoveRef.current) { heroHintRafRef.current = null; return; }
            const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
            const p = Math.max(0, Math.min(1, (now - t0) / dur));
            const e = ease(p);
            const next = from + (to - from) * e;
            heroPanRef.current = next;
            setDiscoverHeroPan(next);
            if (p >= 1) {
              heroHintRafRef.current = null;
              if (cb) setTimeout(cb, pause);
              return;
            }
            heroHintRafRef.current = requestAnimationFrame(tick);
          } catch {
            heroHintRafRef.current = null;
          }
        };
        heroHintRafRef.current = requestAnimationFrame(tick);
      };

      const p1 = Math.min(1, start + bump);
      kick(start, p1, () => {
        kick(p1, start, () => {
          const p2 = Math.min(1, start + bump * 0.9);
          kick(start, p2, () => {
            kick(p2, start);
          });
        });
      });
    };

    heroHintTimerRef.current = setTimeout(() => {
      try {
        if (!discoverHeroOpen) return;
        if (heroHintOff) return;
        if (heroHadMoveRef.current) return;

        runBump(Number(heroPanRef.current ?? 0.5));

        setTimeout(() => {
          try {
            if (!discoverHeroOpen) return;
            if (heroHintOff) return;
            if (heroHadMoveRef.current) return;
            if (turnedRight()) return;
            runBump(Number(heroPanRef.current ?? 0.5));
          } catch {}
        }, 3200);
      } catch {}
    }, 900);

    return () => {
      try { if (heroHintTimerRef.current) clearTimeout(heroHintTimerRef.current); } catch {}
      heroHintTimerRef.current = null;
      try { if (heroHintRafRef.current != null) cancelAnimationFrame(heroHintRafRef.current); } catch {}
      heroHintRafRef.current = null;
    };
  }, [discoverHeroOpen, heroHintOff]);
  const heroBubbleLeft = (anchor: number) => {
    try {
      const cur = Number(heroPanRef.current ?? discoverHeroPan ?? 0.5);
      if (typeof window === "undefined") return (Number(anchor) * 100).toFixed(1) + "%";
      const vw = Number(window.innerWidth || 1);
      const vh = Number(window.innerHeight || 1);
      const sz = heroImgSizeRef.current;
      if (!sz || !Number.isFinite(sz.w) || !Number.isFinite(sz.h) || sz.w <= 0 || sz.h <= 0) return (Number(anchor) * 100).toFixed(1) + "%";
      const dispW = vh * (Number(sz.w) / Number(sz.h));
      const free = vw - dispW;
      const left = free * cur;
      const x = left + (Number(anchor) * dispW);
      const pct = (x / vw) * 100;
      return pct.toFixed(1) + "%";
    } catch {
      return (Number(anchor) * 100).toFixed(1) + "%";
    }
  };

  const heroBubbleVis = (anchor: number) => {
    try {
      const cur = Number(heroPanRef.current ?? discoverHeroPan ?? 0.5);
      if (typeof window === "undefined") return 1;
      const vw = Number(window.innerWidth || 1);
      const vh = Number(window.innerHeight || 1);
      const sz = heroImgSizeRef.current;
      if (!sz || !Number.isFinite(sz.w) || !Number.isFinite(sz.h) || sz.w <= 0 || sz.h <= 0) return 1;
      const dispW = vh * (Number(sz.w) / Number(sz.h));
      const free = vw - dispW;
      const left = free * cur;
      const x = left + (Number(anchor) * dispW);
      const fade = 64;
      if (x >= fade && x <= (vw - fade)) return 1;
      if (x <= -fade || x >= (vw + fade)) return 0;
      if (x < fade) return Math.max(0, Math.min(1, (x + fade) / (fade + fade)));
      if (x > (vw - fade)) return Math.max(0, Math.min(1, ((vw + fade) - x) / (fade + fade)));
      return 1;
    } catch {
      return 1;
    }
  };

  const [discoverDoorOpen, setDiscoverDoorOpen] = React.useState(false);
  const [discoverPanel, setDiscoverPanel] = React.useState<null | "place" | "approach" | "know">(null);
  const [discoverMeta, setDiscoverMeta] = React.useState<{ id: string; name: string } | null>(null);
  const heroReturnPopupRef = React.useRef<{ lng: number; lat: number; props: any; fid: string | null } | null>(null);
  const heroReturnCamRef = React.useRef<{ center: [number, number]; zoom: number; bearing: number; pitch: number } | null>(null);
  const [sheetHeightVh, _setSheetHeightVh] = React.useState(25);
  const [sheetDragging, setSheetDragging] = React.useState(false);
  const sheetHeightRef = React.useRef(25);
  const dragStartYRef = React.useRef<number | null>(null);
  const dragStartHeightRef = React.useRef<number>(25);
  const dragRafRef = React.useRef<number | null>(null);
  const dragPendingVhRef = React.useRef<number | null>(null);
  const dragHadMoveRef = React.useRef(false);
  const dragActiveRef = React.useRef(false);
  const lastTouchTsRef = React.useRef(0);
  const endLockRef = React.useRef(0);
  const viewportHRef = React.useRef<number>(0);
  const dragPointerIdRef = React.useRef<number | null>(null);
  const dragCleanupRef = React.useRef<(() => void) | null>(null);

  const clampVh = (v: number) => Math.max(25, Math.min(80, v));

  const setSheetHeightNow = (v: number) => {
    try {
      const cv = clampVh(v);
      sheetHeightRef.current = cv;
      _setSheetHeightVh(cv);
    } catch {}
  };

  const setHeightVhRaf = (v: number) => {
    try {
      dragPendingVhRef.current = clampVh(v);
      if (dragRafRef.current != null) return;
      dragRafRef.current = requestAnimationFrame(() => {
        dragRafRef.current = null;
        const pv = dragPendingVhRef.current;
        if (pv == null) return;
        setSheetHeightNow(pv);
      });
    } catch {}
  };

  const startDrag = (y: number) => {
    try {
      dragActiveRef.current = true;
      try { setSheetDragging(true); } catch {}
      dragHadMoveRef.current = false;
      dragStartYRef.current = y;
      dragStartHeightRef.current = sheetHeightRef.current;
      try {
        viewportHRef.current = typeof window !== "undefined" && window.visualViewport?.height ? window.visualViewport.height : (typeof window !== "undefined" && window.innerHeight ? window.innerHeight : 1);
      } catch {}
    } catch {}
  };

  const moveDrag = (y: number) => {
    try {
      if (!dragActiveRef.current) return;
      const y0 = dragStartYRef.current;
      if (y0 == null) return;
      const dy = y - y0;
      if (Math.abs(dy) > 2) dragHadMoveRef.current = true;
    } catch {}
  };

  const endDrag = (y: number | null, snapTap: boolean) => {
    try {
      const now = Date.now();
      if (now - endLockRef.current < 220) return;
      endLockRef.current = now;

      const y0 = dragStartYRef.current;
      dragStartYRef.current = null;

      const hadMove = Boolean(dragHadMoveRef.current);
      dragHadMoveRef.current = false;
      dragActiveRef.current = false;
      try { setSheetDragging(false); } catch {}

      if (!hadMove) {
        if (snapTap) {
          setSheetHeightNow(sheetHeightRef.current >= 60 ? 25 : 80);
        } else {
          setSheetHeightNow(sheetHeightRef.current);
        }
        return;
      }

      const dy = y0 == null || y == null ? 0 : (y - y0);

      if (dy < 0) {
        setSheetHeightNow(80);
        return;
      }

      if (dy > 0) {
        setSheetHeightNow(25);
        return;
      }

      setSheetHeightNow(sheetHeightRef.current);
    } catch {}
  };

  React.useEffect(() => {
    try {
      if (geolocateElRef.current) {
        geolocateElRef.current.style.display = (sheetOpen || heroUiHide || !overlaysReady) ? "none" : "block";
      }
    } catch {}
  }, [sheetOpen, discoverHeroUrl, heroUiHide, overlaysReady]);

  React.useEffect(() => {
    sheetHeightRef.current = sheetHeightVh;
    try { setSheetExpanded(sheetHeightVh >= 60); } catch {}
  }, [sheetHeightVh]);
  const darkMapRef = React.useRef<boolean>(Boolean(darkMap));
  React.useEffect(() => {
    darkMapRef.current = Boolean(darkMap);
  }, [darkMap]);

  const onSelectRef = React.useRef<typeof onSelect | undefined>(onSelect);
  React.useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const autoOpenedIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const sid = String(selectedId ?? "").trim();
    const map = mapRef.current;
    if (!sid || !map || !readyRef.current) return;
    if (autoOpenedIdRef.current === sid) return;

    const found = (items ?? []).find((b) => String(b?.id ?? "") === sid);
    const lat = Number(found?.lat);
    const lng = Number(found?.lng);
    if (!found || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

    autoOpenedIdRef.current = sid;

    try {
      for (const feat of fcRef.current.features) {
        const id = String(feat.id ?? feat?.properties?.id ?? "");
        try { feat.properties.selected = id === sid; } catch {}
      }
      const src = getSource(map);
      if (src) src.setData(fcRef.current);
    } catch {}

    const props = {
      id: String(found.id ?? ""),
      name: String(found.name ?? ""),
      title: String(found.name ?? ""),
      type: String(found.type ?? ""),
      address: String(found.address ?? ""),
      website: String(found.website ?? ""),
      openingHours: String(found.openingHours ?? ""),
      phone: String(found.phone ?? ""),
      panoramaImage: String(found.panoramaImage ?? ""),
      lat: Number(lat),
      lng: Number(lng),
      kind: normalizeType(String(found.type ?? "")),
      miniText: String((found as any).miniText ?? ""),
      timeZone: String((found as any).timeZone ?? "")
    };

    const openAutoPopup = () => {
      try { setSheetOpen(false); } catch {}
      try { setSheetHtml(""); } catch {}
      try { if (popupRef.current) popupRef.current.remove(); } catch {}
      try { if (selectedPinMarkerRef.current) selectedPinMarkerRef.current.remove(); } catch {}
      selectedPinMarkerRef.current = null;
      try {
        const selEl = document.createElement("div");
        selEl.style.pointerEvents = "none";
        selEl.style.filter = "drop-shadow(0 0 10px rgba(245,245,232,.28)) drop-shadow(0 0 18px rgba(114,138,74,.55))";
        const kindSel = normalizeType(String((props as any)?.kind ?? (props as any)?.properties?.kind ?? (props as any)?.feature?.properties?.kind ?? (props as any)?.category ?? (props as any)?.type ?? ""));
        const palSel = palette();
        const selColor = String((palSel as any)[kindSel] || (palSel as any).other || "#8C5A3C");
        selEl.innerHTML = svgPin(selColor, "rgba(245,245,232,0.92)", true);
        selectedPinMarkerRef.current = new maplibregl.Marker({ element: selEl, anchor: "bottom" } as any)
          .setLngLat([lng, lat])
          .addTo(map);
      } catch {}
      try {
        let walkMins = null;
        try {
          const up = lastUserPosRef.current;
          if (up && Number.isFinite(up.lng) && Number.isFinite(up.lat)) {
            const meters = haversineMeters(Number(up.lat), Number(up.lng), Number(lat), Number(lng));
            if (Number.isFinite(meters)) walkMins = meters / 83.3333333333;
          }
        } catch {}
        const html = buildMiniPinPopupHtml(props, Boolean(darkMapRef.current), walkMins);
        const el = document.createElement("div");
        el.style.pointerEvents = "auto";
        el.innerHTML = html;

        const recenterMini = () => {
          try {
            const pr = el.getBoundingClientRect();
            const vh = Math.max(1, Number(window.innerHeight || 0));
            const filtersBottom = 112;
            const bottomSafe = 110;
            const targetCenterY = filtersBottom + Math.max(190, ((vh - filtersBottom - bottomSafe) * 0.52));
            const popupCenterY = pr.top + (pr.height / 2);
            const dy = popupCenterY - targetCenterY;
            if (Math.abs(dy) < 6) return;
            map.panBy([0, dy] as any, {
              duration: 260,
              essential: true
            } as any);
          } catch {}
        };

        try {
          const btn = el.querySelector("[data-mini-close=\"1\"]");
          if (btn) {
            btn.addEventListener("click", (ev) => {
              try { ev.preventDefault(); ev.stopPropagation(); } catch {}
              try { popupRef.current?.remove(); } catch {}
              try { if (selectedPinMarkerRef.current) selectedPinMarkerRef.current.remove(); } catch {}
              selectedPinMarkerRef.current = null;
              try { document.querySelectorAll(".im-globe-dim").forEach((n) => { try { (n as any)?.classList?.remove("im-globe-dim"); } catch {} }); } catch {}
              try {
                for (const feat of fcRef.current.features) {
                  try { feat.properties.selected = false; } catch {}
                }
                const src = getSource(map);
                if (src) src.setData(fcRef.current);
              } catch {}
              popupRef.current = null;
            });
          }
        } catch {}

        try { bindFavButton(el); } catch {}

        try {
          const db = el.querySelector("[data-discover=\"1\"]");
          const pb = el.querySelector("[data-phone=\"1\"]") as HTMLElement | null;
          const setPhoneActive = (on: boolean) => {
            try {
              if (!pb) return;
              if (on) {
                (pb as any).style.boxShadow = "0 0 0 1px rgba(114,138,74,.65), 0 10px 22px rgba(0,0,0,0.26), 0 0 18px rgba(114,138,74,.50)";
                (pb as any).style.background = "rgba(114,138,74,.20)";
                (pb as any).style.borderColor = "rgba(114,138,74,.70)";
              } else {
                (pb as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)";
                (pb as any).style.background = "rgba(0,0,0,0.14)";
                (pb as any).style.borderColor = "rgba(255,255,255,0.30)";
              }
            } catch {}
          };
          if (pb) {
            pb.addEventListener("click", (ev: any) => {
              try { ev.preventDefault(); ev.stopPropagation(); } catch {}
              try { const n1 = el.querySelector("[data-addr-panel=\"1\"]"); if (n1 && n1.parentNode) n1.parentNode.removeChild(n1); } catch {}
              try { const ab0 = el.querySelector("[data-addr=\"1\"]"); if (ab0) { (ab0 as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)"; (ab0 as any).style.background = "rgba(0,0,0,0.14)"; (ab0 as any).style.borderColor = "rgba(255,255,255,0.30)"; } } catch {}
              try { const n2 = el.querySelector("[data-hours-panel=\"1\"]"); if (n2 && n2.parentNode) n2.parentNode.removeChild(n2); } catch {}
              try { const hb0 = el.querySelector("[data-hours=\"1\"]"); if (hb0) { (hb0 as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)"; (hb0 as any).style.background = "rgba(0,0,0,0.14)"; (hb0 as any).style.borderColor = "rgba(255,255,255,0.30)"; } } catch {}
              try {
                const dial = String((pb as any).getAttribute("data-tel") || "").trim();
                let panel = el.querySelector("[data-phone-panel=\"1\"]") as HTMLDivElement | null;

                if (panel) {
                  const cur = String((panel as HTMLElement).style.display || "");
                  const showing = (cur === "none");
                  (panel as HTMLElement).style.display = showing ? "block" : "none";
                  try { setPhoneActive(showing); } catch {}
                  try { setTimeout(recenterMini, 0); } catch {}
                  return;
                }

                panel = document.createElement("div");
                panel.setAttribute("data-phone-panel","1");
                panel.style.position = "absolute";
                panel.style.left = "50%";
                panel.style.top = "100%";
                panel.style.width = "260px";
                panel.style.maxWidth = "260px";
                panel.style.transform = "translateX(-50%) translateY(8px)";
                panel.style.zIndex = "3";
                panel.style.padding = "10px 10px";
                panel.style.background = "rgba(31,31,24,0.78)";
                panel.style.border = "1px solid rgba(245,245,232,.14)";
                panel.style.borderRadius = "16px 6px 16px 6px";
                panel.style.boxShadow = "0 10px 22px rgba(0,0,0,0.26)";
                panel.style.backdropFilter = "blur(10px)";
                (panel.style as any).webkitBackdropFilter = "blur(10px)";
                panel.style.color = "rgba(245,245,232,.92)";
                panel.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
                panel.style.fontSize = "12px";
                panel.style.lineHeight = "18px";
                panel.style.letterSpacing = ".02em";

                if (!dial) {
                  panel.innerHTML =
                    "<div style=\"font-weight:800;letter-spacing:.02em;\" >" + ui("Téléphone","Phone") + "</div>" +
                    "<div style=\"margin-top:6px;opacity:.90;\" >" + ui("Téléphone inconnu","Phone unknown") + "</div>";
                  el.appendChild(panel);
                  try { setPhoneActive(true); } catch {}
                  try { setTimeout(recenterMini, 0); } catch {}
                  return;
                }

                panel.innerHTML =
                  "<div style=\"font-weight:800;letter-spacing:.02em;\" >" + ui("Téléphone","Phone") + "</div>" +
                  "<div style=\"margin-top:6px;display:flex;align-items:center;justify-content:space-between;gap:10px;\" >" +
                    "<span style=\"opacity:.92;font-weight:700;\" >" + escapeHtml(dial) + "</span>" +
                    "<button data-phone-call=\"1\" style=\"flex:0 0 auto;padding:6px 10px;border-radius:10px 4px 10px 4px;background:rgba(0,0,0,0.18);border:1px solid rgba(245,245,232,.18);color:rgba(245,245,232,.92);font-size:12px;font-weight:750;cursor:pointer;box-shadow:0 6px 14px rgba(0,0,0,0.18);\" onclick=\"return false;\" >" + ui("Appeler","Call") + "</button>" +
                  "</div>";

                el.appendChild(panel);
                try { setPhoneActive(true); } catch {}
                try { setTimeout(recenterMini, 0); } catch {}

                const cb = panel.querySelector("[data-phone-call=\"1\"]") as HTMLElement | null;
                if (cb) {
                  cb.addEventListener("click", (ev2: any) => {
                    try { ev2.preventDefault(); ev2.stopPropagation(); } catch {}
                    try { window.location.href = "tel:" + dial; } catch {}
                  });
                }
              } catch {}
            });
          }

          const sb = el.querySelector("[data-site=\"1\"]") as HTMLElement | null;
          if (sb) {
            sb.addEventListener("click", (ev: any) => {
              try { ev.preventDefault(); ev.stopPropagation(); } catch {}
              try {
                let url = String((props as any)?.website ?? "").trim();
                if (!url) return;
                if (!/^https?:\/\//i.test(url)) url = "https://" + url;
                try { window.open(url, "_blank", "noopener,noreferrer"); }
                catch { window.location.href = url; }
              } catch {}
            });
          }

          const rb = el.querySelector("[data-route=\"1\"]") as HTMLElement | null;
          if (rb) {
            rb.addEventListener("click", (ev: any) => {
              try { ev.preventDefault(); ev.stopPropagation(); } catch {}
              try { (rb as any)?.blur?.(); } catch {}
              try {
                const dlat = Number(lat);
                const dlng = Number(lng);
                if (!Number.isFinite(dlat) || !Number.isFinite(dlng)) return;
                const ua = String((navigator as any)?.userAgent ?? "");
                if (/iPhone|iPad|iPod/i.test(ua)) {
                  window.location.href = "http://maps.apple.com/?daddr=" + dlat + "," + dlng;
                } else {
                  window.location.href = "geo:" + dlat + "," + dlng + "?q=" + dlat + "," + dlng;
                }
              } catch {}
            });
          }

          const ab = el.querySelector("[data-addr=\"1\"]") as HTMLElement | null;
          const setAddrActive = (on: boolean) => {
            try {
              if (!ab) return;
              if (on) {
                (ab as any).style.boxShadow = "0 0 0 1px rgba(114,138,74,.65), 0 10px 22px rgba(0,0,0,0.26), 0 0 18px rgba(114,138,74,.50)";
                (ab as any).style.background = "rgba(114,138,74,.20)";
                (ab as any).style.borderColor = "rgba(114,138,74,.70)";
              } else {
                (ab as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)";
                (ab as any).style.background = "rgba(0,0,0,0.14)";
                (ab as any).style.borderColor = "rgba(255,255,255,0.30)";
              }
            } catch {}
          };
          if (ab) {
            ab.addEventListener("click", (ev: any) => {
              try { ev.preventDefault(); ev.stopPropagation(); } catch {}
              try { const n1 = el.querySelector("[data-phone-panel=\"1\"]"); if (n1 && n1.parentNode) n1.parentNode.removeChild(n1); } catch {}
              try { const pb0 = el.querySelector("[data-phone=\"1\"]"); if (pb0) { (pb0 as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)"; (pb0 as any).style.background = "rgba(0,0,0,0.14)"; (pb0 as any).style.borderColor = "rgba(255,255,255,0.30)"; } } catch {}
              try { const n2 = el.querySelector("[data-hours-panel=\"1\"]"); if (n2 && n2.parentNode) n2.parentNode.removeChild(n2); } catch {}
              try { const hb0 = el.querySelector("[data-hours=\"1\"]"); if (hb0) { (hb0 as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)"; (hb0 as any).style.background = "rgba(0,0,0,0.14)"; (hb0 as any).style.borderColor = "rgba(255,255,255,0.30)"; } } catch {}
              try {
                const addr = String(((props as any)?.address ?? "")).trim();
                let panel = el.querySelector("[data-addr-panel=\"1\"]") as HTMLDivElement | null;
                if (!addr) {
                  if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
                  try { setAddrActive(false); } catch {}
                  return;
                }
                if (panel) {
                  const cur = String((panel as HTMLElement).style.display || "");
                  const showing = (cur === "none");
                  (panel as HTMLElement).style.display = showing ? "block" : "none";
                  try { setAddrActive(showing); } catch {}
                  try { setTimeout(recenterMini, 0); } catch {}
                  return;
                }

                panel = document.createElement("div");
                panel.setAttribute("data-addr-panel","1");
                panel.style.position = "absolute";
                panel.style.left = "50%";
                panel.style.top = "100%";
                panel.style.width = "260px";
                panel.style.maxWidth = "260px";
                panel.style.transform = "translateX(-50%) translateY(8px)";
                panel.style.zIndex = "3";
                panel.style.padding = "10px 10px";
                panel.style.background = "rgba(31,31,24,0.78)";
                panel.style.border = "1px solid rgba(245,245,232,.14)";
                panel.style.borderRadius = "16px 6px 16px 6px";
                panel.style.boxShadow = "0 10px 22px rgba(0,0,0,0.26)";
                panel.style.backdropFilter = "blur(10px)";
                (panel.style as any).webkitBackdropFilter = "blur(10px)";
                panel.style.color = "rgba(245,245,232,.92)";
                panel.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
                panel.style.fontSize = "12px";
                panel.style.lineHeight = "18px";
                panel.style.letterSpacing = ".02em";

                const text = document.createElement("div");
                text.textContent = addr;
                text.style.whiteSpace = "pre-wrap";
                (text.style as any).userSelect = "text";
                (text.style as any).webkitUserSelect = "text";
                panel.appendChild(text);

                const row = document.createElement("div");
                row.style.marginTop = "10px";
                row.style.display = "flex";
                row.style.alignItems = "center";
                row.style.justifyContent = "space-between";
                row.style.gap = "8px";

                const mkBtn = (label: string) => {
                  const b = document.createElement("button");
                  b.textContent = label;
                  b.style.flex = "1";
                  b.style.padding = "7px 8px";
                  b.style.borderRadius = "12px 5px 12px 5px";
                  b.style.border = "1px solid rgba(245,245,232,.18)";
                  b.style.background = "rgba(0,0,0,0.14)";
                  b.style.color = "rgba(245,245,232,.92)";
                  b.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
                  b.style.fontSize = "12px";
                  b.style.letterSpacing = ".02em";
                  b.style.cursor = "pointer";
                  b.style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)";
                  return b;
                };

                const copyBtn = mkBtn(ui("Copier","Copy"));
                copyBtn.addEventListener("click", async (e2: any) => {
                  try { e2.preventDefault(); e2.stopPropagation(); } catch {}
                  const prev = String((copyBtn as any)?.textContent ?? ui("Copier","Copy"));
                  const flash = (t: string) => {
                    try { (copyBtn as any).textContent = t; } catch {}
                    try { setTimeout(() => { try { (copyBtn as any).textContent = prev; } catch {} }, 1200); } catch {}
                  };
                  try {
                    const txt = String(addr || "");
                    if (!txt.trim()) { flash(ui("Erreur","Error")); return; }
                    const clip = (navigator as any)?.clipboard?.writeText;
                    if (clip) {
                      try { await (navigator as any).clipboard.writeText(txt); flash(ui("Copié ✓","Copied ✓")); return; } catch {}
                    }
                    const ta = document.createElement("textarea");
                    ta.value = txt;
                    ta.setAttribute("readonly", "true");
                    ta.style.position = "fixed";
                    ta.style.left = "-9999px";
                    document.body.appendChild(ta);
                    ta.select();
                    let ok = false;
                    try { ok = !!document.execCommand("copy"); } catch {}
                    try { document.body.removeChild(ta); } catch {}
                    flash(ok ? ui("Copié ✓","Copied ✓") : ui("Erreur","Error"));
                  } catch {
                    flash(ui("Erreur","Error"));
                  }
                });
                const goBtn = mkBtn(ui("Itinéraire →","Directions →"));
                goBtn.addEventListener("click", (e2: any) => {
                  try { e2.preventDefault(); e2.stopPropagation(); } catch {}
                  try {
                    const isIOS = /iPad|iPhone|iPod/.test(String((navigator as any)?.userAgent || ""));
                    const latN = Number(lat);
                    const lngN = Number(lng);
                    let url = "";
                    if (isIOS) {
                      url = "http://maps.apple.com/?q=" + encodeURIComponent(addr);
                    } else if (Number.isFinite(latN) && Number.isFinite(lngN)) {
                      const dest = encodeURIComponent(String(latN) + "," + String(lngN));
                      url = "https://www.google.com/maps/dir/?api=1&destination=" + dest;
                    } else {
                      url = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(addr);
                    }
                    window.location.href = url;
                  } catch {}
                });

                row.appendChild(copyBtn);
                row.appendChild(goBtn);
                panel.appendChild(row);

                el.appendChild(panel);
                try { setAddrActive(true); } catch {}
              } catch {}
            });
          }

          if (db) {
            db.addEventListener("click", (ev) => {
              try { ev.preventDefault(); ev.stopPropagation(); } catch {}
              try { setSheetOpen(false); } catch {}
              try { setSheetHtml(""); } catch {}
              try { if (geolocateElRef.current) geolocateElRef.current.style.display = "none"; } catch {}
              try { setDiscoverMeta({ id: String(props?.id ?? sid ?? ""), name: String(props?.name ?? props?.title ?? "") }); } catch {}
              try { heroReturnPopupRef.current = { lng: Number(lng), lat: Number(lat), props, fid: sid ? String(sid) : null }; } catch {}
              try { setDiscoverPanel(null); } catch {}
              try { setHeroUiHide(true); } catch {}
              try { heroPanRef.current = 0.5; } catch {}
              try { setDiscoverHeroPan(0.5); } catch {}
              try { tableauPrevPRef.current = 0.5; } catch {}
              try { heroHadMoveRef.current = false; } catch {}
              try { setHeroHintOff(false); } catch {}
              try {
                let hero = null as null | string;
                try { hero = String(((props as any)?.panoramaImage ?? (props as any)?.properties?.panoramaImage ?? "") || ""); } catch {}
                try { setDiscoverHeroUrl(hero && hero.trim() ? hero : null); } catch {}
                try { setDiscoverHeroOpen(false); } catch {}
                try { window.dispatchEvent(new CustomEvent("im:hero", { detail: { open: true } })); } catch {}
                try { setDiscoverHeroZoom(false); } catch {}
                try { setDiscoverDoorOpen(false); } catch {}
                try { setHeroUiHide(true); } catch {}
                try { if (geolocateElRef.current) geolocateElRef.current.style.display = "none"; } catch {}
                try { heroPanRef.current = 0.5; } catch {}
                try { setDiscoverHeroPan(0.5); } catch {}
                try { tableauPrevPRef.current = 0.5; } catch {}
                try { heroHadMoveRef.current = false; } catch {}
                try { setHeroHintOff(false); } catch {}
                try { setDiscoverHeroOpen(true); } catch {}
                try { window.dispatchEvent(new CustomEvent("im:hero", { detail: { open: true } })); } catch {}
                try { setTimeout(() => { try { setDiscoverHeroZoom(true); } catch {} }, 30); } catch {}
                try { setTimeout(() => { try { setDiscoverDoorOpen(true); } catch {} }, 220); } catch {}
              } catch {}
              try { popupRef.current?.remove(); } catch {}
              try { if (selectedPinMarkerRef.current) selectedPinMarkerRef.current.remove(); } catch {}
              selectedPinMarkerRef.current = null;
              try { document.querySelectorAll(".im-globe-dim").forEach((n) => { try { (n as any)?.classList?.remove("im-globe-dim"); } catch {} }); } catch {}
              try {
                for (const feat of fcRef.current.features) {
                  try { feat.properties.selected = false; } catch {}
                }
                const src = getSource(map);
                if (src) src.setData(fcRef.current);
              } catch {}
              popupRef.current = null;
            });
          }
        } catch {}

        try {
          const hb = el.querySelector("[data-hours=\"1\"]") as HTMLElement | null;
          const opening = String(((props as any)?.openingHours ?? "")).trim();
          const setHoursActive = (on: boolean) => {
            try {
              if (on) {
                (hb as any).style.boxShadow = "0 0 0 1px rgba(114,138,74,.65), 0 10px 22px rgba(0,0,0,0.26), 0 0 18px rgba(114,138,74,.50)";
                (hb as any).style.background = "rgba(114,138,74,.20)";
                (hb as any).style.borderColor = "rgba(114,138,74,.70)";
              } else {
                (hb as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)";
                (hb as any).style.background = "rgba(0,0,0,0.14)";
                (hb as any).style.borderColor = "rgba(255,255,255,0.30)";
              }
            } catch {}
          };

          if (hb) {
            hb.addEventListener("click", (ev: any) => {
              try { ev.preventDefault(); ev.stopPropagation(); } catch {}
              try { const n1 = el.querySelector("[data-phone-panel=\"1\"]"); if (n1 && n1.parentNode) n1.parentNode.removeChild(n1); } catch {}
              try { const pb0 = el.querySelector("[data-phone=\"1\"]"); if (pb0) { (pb0 as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)"; (pb0 as any).style.background = "rgba(0,0,0,0.14)"; (pb0 as any).style.borderColor = "rgba(255,255,255,0.30)"; } } catch {}
              try { const n2 = el.querySelector("[data-addr-panel=\"1\"]"); if (n2 && n2.parentNode) n2.parentNode.removeChild(n2); } catch {}
              try { const ab0 = el.querySelector("[data-addr=\"1\"]"); if (ab0) { (ab0 as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)"; (ab0 as any).style.background = "rgba(0,0,0,0.14)"; (ab0 as any).style.borderColor = "rgba(255,255,255,0.30)"; } } catch {}
              try {
                let panel = el.querySelector("[data-hours-panel=\"1\"]") as HTMLDivElement | null;
                if (!opening) {
                  if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
                  try { setHoursActive(false); } catch {}
                  return;
                }
                if (panel) {
                  const cur = String((panel as HTMLElement).style.display || "");
                  const showing = (cur === "none");
                  (panel as HTMLElement).style.display = showing ? "block" : "none";
                  try { setHoursActive(showing); } catch {}
                  try { setTimeout(recenterMini, 0); } catch {}
                  try { setTimeout(recenterMini, 0); } catch {}
                  return;
                }
                panel = document.createElement("div");
                panel.setAttribute("data-hours-panel","1");
                panel.style.position = "absolute";
                panel.style.left = "50%";
                panel.style.top = "100%";
                panel.style.width = "260px";
                panel.style.maxWidth = "260px";
                panel.style.transform = "translateX(-50%) translateY(8px)";
                panel.style.zIndex = "3";
                panel.style.padding = "10px 10px";
                panel.style.background = "rgba(31,31,24,0.78)";
                panel.style.border = "1px solid rgba(245,245,232,.14)";
                panel.style.borderRadius = "16px 6px 16px 6px";
                panel.style.boxShadow = "0 10px 22px rgba(0,0,0,0.26)";
                panel.style.backdropFilter = "blur(10px)";
                (panel.style as any).webkitBackdropFilter = "blur(10px)";
                panel.style.color = "rgba(245,245,232,.92)";
                panel.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
                panel.style.fontSize = "12px";
                panel.style.lineHeight = "18px";
                panel.style.letterSpacing = ".02em";
                const parts = opening.split("\n").map(x => String(x||"").trim()).filter(Boolean);
                panel.style.display = "flex";
                panel.style.flexDirection = "column";
                panel.style.gap = "6px";
                for (const l of parts) {
                  const m = String(l || "").match(/^([A-Za-zÀ-ÿ]+)\s+(.*)$/);
                  if (m && m[1] && m[2]) {
                    const row = document.createElement("div");
                    row.style.display = "flex";
                    row.style.alignItems = "baseline";
                    row.style.gap = "10px";

                    const day = document.createElement("span");
                    day.textContent = (function(){const fr=String(m[1]||"").trim();const k=fr.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();if(k.startsWith("lun")) return ui("Lundi","Monday");if(k.startsWith("mar")) return ui("Mardi","Tuesday");if(k.startsWith("mer")) return ui("Mercredi","Wednesday");if(k.startsWith("jeu")) return ui("Jeudi","Thursday");if(k.startsWith("ven")) return ui("Vendredi","Friday");if(k.startsWith("sam")) return ui("Samedi","Saturday");if(k.startsWith("dim")) return ui("Dimanche","Sunday");return fr;})();
                    day.style.fontWeight = "750";
                    day.style.color = "rgba(245,245,232,.78)";
                    day.style.whiteSpace = "nowrap";
                    day.style.flex = "0 0 92px";

                    const hours = document.createElement("span");
                    hours.textContent = (function(){const fr=String(m[2]||"").trim();const k=fr.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();if(k==="ferme"||k.startsWith("ferme")) return ui("Fermé","Closed");return fr;})();
                    hours.style.fontWeight = "650";
                    hours.style.color = "rgba(245,245,232,.92)";
                    hours.style.textAlign = "right";
                    hours.style.whiteSpace = "normal";
                    (hours.style as any).overflowWrap = "anywhere";
                    (hours.style as any).wordBreak = "break-word";
                    hours.style.maxWidth = "150px";
                    hours.style.flex = "0 1 150px";

                    const leader = document.createElement("span");
                    leader.style.flex = "1";
                    leader.style.minWidth = "24px";
                    leader.style.borderBottom = "1px dotted rgba(245,245,232,.26)";
                    leader.style.transform = "translateY(-2px)";
                    leader.style.opacity = "0.9";

                    row.appendChild(day);
                    row.appendChild(leader);
                    row.appendChild(hours);
                    panel.appendChild(row);
                  } else {
                    const d = document.createElement("div");
                    d.textContent = l;
                    panel.appendChild(d);
                  }
                }
                el.appendChild(panel);
                try { setHoursActive(true); } catch {}
                try { setTimeout(recenterMini, 0); } catch {}
                try { setTimeout(recenterMini, 0); } catch {}
              } catch {}
            });
          }
        } catch {}

        popupRef.current = new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -48] } as any)
          .setLngLat([lng, lat])
          .addTo(map);

        try { setTimeout(recenterMini, 0); } catch {}
        try { setTimeout(recenterMini, 80); } catch {}
        try {
          let tries = 0;
          const emitWhenGeolocVisible = () => {
            try {
              const geoBtn = geolocateElRef.current?.querySelector("button") as HTMLButtonElement | null;
              const visible =
                !!geoBtn &&
                geoBtn.isConnected &&
                geoBtn.offsetParent !== null &&
                window.getComputedStyle(geoBtn).display !== "none" &&
                window.getComputedStyle(geoBtn).visibility !== "hidden" &&
                window.getComputedStyle(geoBtn).opacity !== "0";
              if (visible || tries >= 24) {
                window.dispatchEvent(new CustomEvent("im:discover-ui-ready", { detail: { id: sid } }));
                return;
              }
            } catch {
              if (tries >= 24) {
                try { window.dispatchEvent(new CustomEvent("im:discover-ui-ready", { detail: { id: sid } })); } catch {}
                return;
              }
            }
            tries += 1;
            try { window.requestAnimationFrame(emitWhenGeolocVisible); } catch {
              try { setTimeout(emitWhenGeolocVisible, 16); } catch {}
            }
          };
          emitWhenGeolocVisible();
        } catch {}
      } catch {}

      try { heroReturnPopupRef.current = { lng: Number(lng), lat: Number(lat), props, fid: sid }; } catch {}
    };
    try {
      map.once("moveend", openAutoPopup);
      map.easeTo({
        center: [Number(lng), Number(lat)],
        zoom: Math.max(Number(map.getZoom() || 0), 9.9),
        duration: 0,
        offset: [0, 220],
        essential: true
      });
    } catch {
      try { openAutoPopup(); } catch {}
    }
  }, [items, selectedId, mapReadyTick]);

  function cssHslVar(varName: string, fallback: string) {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
      if (!v) return fallback;
      return "hsl(" + v + ")";
    } catch {
      return fallback;
    }
  }

  function palette() {
    return {
      cafe: cssHslVar("--cafe", "#c26b3a"),
      epicerie: "#FF8FC7",
      marche: "#39FF14",
      friperie: cssHslVar("--violet", "#7c3aed"),
      librairie: "#3B82F6",
      restaurant: cssHslVar("--restaurant", "#ef4444"),
      boutique: "#000000",
      atelier: "#1E3A8A",
      microbrasserie: cssHslVar("--micro", "#f59e0b"),
      alternatif: "#00F5FF",
      ferme: "#F6FF00",
      other: "#8C5A3C",
    } as Record<Kind, string>;
  }

  async function ensureImages(map: maplibregl.Map) {
    const stroke = "#FDF7F2";
    const pal = palette();
    const kinds: Kind[] = ["cafe","epicerie","marche","friperie","librairie","restaurant","boutique","atelier","ferme","microbrasserie","alternatif","other"];

    const loadOne = (uri: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("image load failed"));
        img.src = uri;
      });

    for (const k of kinds) {
      const baseId = "pin-" + k;
      const selId = "pin-" + k + "-sel";

      if (!map.hasImage(baseId)) {
        const svg = svgPin(pal[k], stroke, false);
        const img = await loadOne(svgToDataUri(svg));
        map.addImage(baseId, img, { pixelRatio: 2 });
      }

      if (!map.hasImage(selId)) {
        const svg = svgPin(pal[k], stroke, true);
        const img = await loadOne(svgToDataUri(svg));
        map.addImage(selId, img, { pixelRatio: 2 });
      }
    }
  }

  function getSource(map: maplibregl.Map): maplibregl.GeoJSONSource | null {
    try {
      const s = map.getSource(SOURCE_ID) as any;
      return s ? (s as maplibregl.GeoJSONSource) : null;
    } catch {
      return null;
    }

  function ensureRouteLayer(map: maplibregl.Map) {
    try {
      if (!map.getSource(ROUTE_SOURCE_ID)) {
        map.addSource(ROUTE_SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        } as any);
      }
      if (!map.getLayer(ROUTE_LAYER_ID)) {
        map.addLayer({
          id: ROUTE_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-width": 3, "line-opacity": 0.9, "line-color": "#F59E0B", "line-dasharray": [1.5, 1.5] },
        } as any);
      }
    } catch {}
  }

  function setRouteGeojson(map: maplibregl.Map, geojson: any) {
    try {
      const src = map.getSource(ROUTE_SOURCE_ID) as any;
      if (src && src.setData) src.setData(geojson);
    } catch {}
  }

  async function routeTo(destLng: number, destLat: number) {
    const m = mapRef.current;
    if (!m) return;

    try { ensureRouteLayer(m); } catch {}

    const getPos = () =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("no geolocation"));
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos),
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });

    let pos: GeolocationPosition;
    try {
      pos = await getPos();
    } catch {
      return;
    }

    const fromLng = Number(pos.coords.longitude);
    const fromLat = Number(pos.coords.latitude);

    try { lastUserPosRef.current = { lng: fromLng, lat: fromLat, ts: Date.now() }; } catch {}

    const url =
      "https://router.project-osrm.org/route/v1/driving/" +
      fromLng + "," + fromLat + ";" + destLng + "," + destLat +
      "?overview=full&geometries=geojson&steps=false";

    let data: any;
    try {
      const r = await fetch(url);
      if (!r.ok) return;
      data = await r.json();
    } catch {
      return;
    }

    const coords = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return;

    const fc = {
      type: "FeatureCollection",
      features: [
        { type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} },
      ],
    };

    try { ensureRouteLayer(m); } catch {}
    setRouteGeojson(m, fc);

    try {
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
      for (const c of coords) {
        const x = Number(c?.[0]), y = Number(c?.[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (x < minLng) minLng = x;
        if (y < minLat) minLat = y;
        if (x > maxLng) maxLng = x;
        if (y > maxLat) maxLat = y;
      }
      if (Number.isFinite(minLng)) {
        m.fitBounds([[minLng, minLat], [maxLng, maxLat]] as any, { padding: 60, duration: 800 });
      }
    } catch {}
  }
  }

  function ensureLayer(map: maplibregl.Map) {
    const src = getSource(map);
    if (!src) {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: fcRef.current,
      });
    }


    if (!map.getLayer(GLOW_LAYER_ID)) {
      const glowLayer = {
        id: GLOW_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        filter: ["==", ["get", "selected"], true] as any,
        paint: {
          "circle-color": "rgba(245,245,232,0.98)",
          "circle-opacity": [
            "interpolate", ["linear"], ["zoom"],
            3, 0.40,
            6, 0.55,
            10, 0.70,
            14, 0.78
          ] as any,
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            3, 22,
            6, 34,
            10, 52,
            14, 72
          ] as any,
          "circle-blur": 1.85,
          "circle-stroke-color": "rgba(114,138,74,0.65)",
          "circle-stroke-width": 2.6
        }
      } as any;
      try {
        if (map.getLayer(LAYER_ID)) map.addLayer(glowLayer, LAYER_ID);
        else map.addLayer(glowLayer);
      } catch {
        try { map.addLayer(glowLayer); } catch {}
      }
    }
    if (!map.getLayer(LAYER_ID)) {
      map.addLayer({
        id: LAYER_ID,
        type: "symbol",
        source: SOURCE_ID,
        layout: {
          "icon-image": ["concat", "pin-", ["get", "kind"]],
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            1, 0.6,
            3, 0.75,
            5, 0.9,
            8, 1.05,
            11, 1.25,
            14, 1.45
          ],
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });


       // __INDIEMAP_CLOSE_POPUP_ON_BG_CLICK__
      map.on("click", (ev: any) => {
        try {
          const feats = map.queryRenderedFeatures(ev.point, { layers: [LAYER_ID] } as any);
          if (!feats || feats.length === 0) {
            try { popupRef.current?.remove(); } catch {}
            try { (ref.current as any)?.classList?.remove("im-globe-dim"); } catch {}
            try { if (selectedPinMarkerRef.current) selectedPinMarkerRef.current.remove(); } catch {}
            selectedPinMarkerRef.current = null;
            try { document.querySelectorAll(".im-globe-dim").forEach((n) => { try { (n as any)?.classList?.remove("im-globe-dim"); } catch {} }); } catch {}
                   try { document.querySelectorAll(".maplibregl-canvas").forEach((c)=>{ try{ (c as any).style.filter=""; }catch{} }); } catch {}
            try {
              for (const feat of fcRef.current.features) {
                try { feat.properties.selected = false; } catch {}
              }
              const src = getSource(map);
              if (src) src.setData(fcRef.current);
            } catch {}

            popupRef.current = null;
          }
        } catch {}
      });

map.on("mouseenter", LAYER_ID, () => {
        try { map.getCanvas().style.cursor = "pointer"; } catch {}
      });

      map.on("mouseleave", LAYER_ID, () => {
        try { map.getCanvas().style.cursor = ""; } catch {}
      });

      map.on("click", LAYER_ID, (e) => {
        const f = e?.features?.[0] as any;
        if (!f) return;

        const coords = f.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) return;

        const fid = String(f.id ?? f?.properties?.id ?? "");

        const lng = coords[0];
        const lat = coords[1];

        let isGlobe = false;
        try {
          const p = (map as any).getProjection?.();
          const name = typeof p === "string" ? p : String(p?.name ?? "");
          isGlobe = name.toLowerCase().includes("globe");
        } catch {}

        const z = map.getZoom();

        try {
          for (const feat of fcRef.current.features) {
            const id = String(feat.id ?? feat?.properties?.id ?? "");
            feat.properties.selected = Boolean(fid) && id === fid;
          }
          const src = getSource(map);
          if (src) src.setData(fcRef.current);
        } catch {}

        if (isGlobe || z < 7.2) {
          try { heroReturnCamRef.current = { center: [lng, lat], zoom: 9.9, bearing: map.getBearing(), pitch: map.getPitch() }; } catch {}
        }

        const props = f?.properties || {};

        const openPopup = () => {

          try { setSheetOpen(false); } catch {}
          try { setSheetHtml(""); } catch {}
          try { if (popupRef.current) popupRef.current.remove(); } catch {}
          try { if (selectedPinMarkerRef.current) selectedPinMarkerRef.current.remove(); } catch {}
          selectedPinMarkerRef.current = null;
          try {
            const selEl = document.createElement("div");
            selEl.style.pointerEvents = "none";
            selEl.style.filter = "drop-shadow(0 0 10px rgba(245,245,232,.28)) drop-shadow(0 0 18px rgba(114,138,74,.55))";
            const kindSel = normalizeType(String((props as any)?.kind ?? (props as any)?.properties?.kind ?? (props as any)?.feature?.properties?.kind ?? (props as any)?.category ?? (props as any)?.type ?? ""));
            const palSel = palette();
            const selColor = String((palSel as any)[kindSel] || (palSel as any).other || "#8C5A3C");
            selEl.innerHTML = svgPin(selColor, "rgba(245,245,232,0.92)", true);
            selectedPinMarkerRef.current = new maplibregl.Marker({ element: selEl, anchor: "bottom" } as any)
              .setLngLat([lng, lat])
              .addTo(map);
          } catch {}
          try {
            let walkMins = null;
            try {
              const up = lastUserPosRef.current;
              if (up && Number.isFinite(up.lng) && Number.isFinite(up.lat)) {
                const meters = haversineMeters(Number(up.lat), Number(up.lng), Number(lat), Number(lng));
                if (Number.isFinite(meters)) walkMins = meters / 83.3333333333;
              }
            } catch {}
            const html = buildMiniPinPopupHtml(props, Boolean(darkMapRef.current), walkMins);
            const el = document.createElement("div");
            el.style.pointerEvents = "auto";
            el.innerHTML = html;

            try { bindFavButton(el); } catch {}

            const recenterMini = () => {
                      try {
                        const proj = (map as any).getProjection?.();
                        const projName = typeof proj === "string" ? proj : String(proj?.name ?? "");
                        const isGlobeNow = projName.toLowerCase().includes("globe");
                        if (isGlobeNow || map.getZoom() < 7.2) return;

                        const pr = el.getBoundingClientRect();
                        const vh = Math.max(1, Number(window.innerHeight || 0));
                        const filtersBottom = 112;
                        const bottomSafe = 110;
                        const targetCenterY = filtersBottom + Math.max(190, ((vh - filtersBottom - bottomSafe) * 0.52));
                        const popupCenterY = pr.top + (pr.height / 2);
                        const dy = popupCenterY - targetCenterY;
                        if (Math.abs(dy) < 6) return;
                        map.panBy([0, dy] as any, {
                          duration: 700,
                          essential: true
                        } as any);
                      } catch {}
                    };
            try {
              const btn = el.querySelector("[data-mini-close=\"1\"]");
              if (btn) {
                btn.addEventListener("click", (ev) => {
                  try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
                  try { popupRef.current?.remove(); } catch (e) {}
                                    try { if (selectedPinMarkerRef.current) selectedPinMarkerRef.current.remove(); } catch (e) {}
                  selectedPinMarkerRef.current = null;
try { document.querySelectorAll(".im-globe-dim").forEach((n) => { try { (n as any)?.classList?.remove("im-globe-dim"); } catch {} }); } catch {}
                   try {
              for (const feat of fcRef.current.features) {
                try { feat.properties.selected = false; } catch {}
              }
              const src = getSource(map);
              if (src) src.setData(fcRef.current);
            } catch {}

popupRef.current = null;
                });
              }
            } catch {}
            try {
              const db = el.querySelector("[data-discover=\"1\"]");
              const pb = el.querySelector("[data-phone=\"1\"]") as HTMLElement | null;
              const setPhoneActive = (on: boolean) => {
                try {
                  if (!pb) return;
                  if (on) {
                    (pb as any).style.boxShadow = "0 0 0 1px rgba(114,138,74,.65), 0 10px 22px rgba(0,0,0,0.26), 0 0 18px rgba(114,138,74,.50)";
                    (pb as any).style.background = "rgba(114,138,74,.20)";
                    (pb as any).style.borderColor = "rgba(114,138,74,.70)";
                  } else {
                    (pb as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)";
                    (pb as any).style.background = "rgba(0,0,0,0.14)";
                    (pb as any).style.borderColor = "rgba(255,255,255,0.30)";
                  }
                } catch {}
              };
              if (pb) {
                pb.addEventListener("click", (ev: any) => {
                  try { ev.preventDefault(); ev.stopPropagation(); } catch {}
                  try { const n1 = el.querySelector("[data-addr-panel=\"1\"]"); if (n1 && n1.parentNode) n1.parentNode.removeChild(n1); } catch {}
                  try { const ab0 = el.querySelector("[data-addr=\"1\"]"); if (ab0) { (ab0 as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)"; (ab0 as any).style.background = "rgba(0,0,0,0.14)"; (ab0 as any).style.borderColor = "rgba(255,255,255,0.30)"; } } catch {}
                  try { const n2 = el.querySelector("[data-hours-panel=\"1\"]"); if (n2 && n2.parentNode) n2.parentNode.removeChild(n2); } catch {}
                  try { const hb0 = el.querySelector("[data-hours=\"1\"]"); if (hb0) { (hb0 as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)"; (hb0 as any).style.background = "rgba(0,0,0,0.14)"; (hb0 as any).style.borderColor = "rgba(255,255,255,0.30)"; } } catch {}
                  try {
                    const dial = String((pb as any).getAttribute("data-tel") || "").trim();
                    let panel = el.querySelector("[data-phone-panel=\"1\"]") as HTMLDivElement | null;

                    if (panel) {
                      const cur = String((panel as HTMLElement).style.display || "");
                      const showing = (cur === "none");
                      (panel as HTMLElement).style.display = showing ? "block" : "none";
                      try { setPhoneActive(showing); } catch {}
                      try { setTimeout(recenterMini, 0); } catch {}
                      return;
                    }

                    panel = document.createElement("div");
                    panel.setAttribute("data-phone-panel","1");
                    panel.style.position = "absolute";
                    panel.style.left = "50%";
                    panel.style.top = "100%";
                    panel.style.width = "260px";
                    panel.style.maxWidth = "260px";
                    panel.style.transform = "translateX(-50%) translateY(8px)";
                    panel.style.zIndex = "3";
                    panel.style.padding = "10px 10px";
                    panel.style.background = "rgba(31,31,24,0.78)";
                    panel.style.border = "1px solid rgba(245,245,232,.14)";
                    panel.style.borderRadius = "16px 6px 16px 6px";
                    panel.style.boxShadow = "0 10px 22px rgba(0,0,0,0.26)";
                    panel.style.backdropFilter = "blur(10px)";
                    (panel.style as any).webkitBackdropFilter = "blur(10px)";
                    panel.style.color = "rgba(245,245,232,.92)";
                    panel.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
                    panel.style.fontSize = "12px";
                    panel.style.lineHeight = "18px";
                    panel.style.letterSpacing = ".02em";

                    if (!dial) {
                      panel.innerHTML =
                        "<div style=\"font-weight:800;letter-spacing:.02em;\" >" + ui("Téléphone","Phone") + "</div>" +
                        "<div style=\"margin-top:6px;opacity:.90;\" >" + ui("Téléphone inconnu","Phone unknown") + "</div>";
                      el.appendChild(panel);
                      try { setPhoneActive(true); } catch {}
                      try { setTimeout(recenterMini, 0); } catch {}
                      return;
                    }

                    panel.innerHTML =
                      "<div style=\"font-weight:800;letter-spacing:.02em;\" >" + ui("Téléphone","Phone") + "</div>" +
                      "<div style=\"margin-top:6px;display:flex;align-items:center;justify-content:space-between;gap:10px;\" >" +
                        "<span style=\"opacity:.92;font-weight:700;\" >" + escapeHtml(dial) + "</span>" +
                        "<button data-phone-call=\"1\" style=\"flex:0 0 auto;padding:6px 10px;border-radius:10px 4px 10px 4px;background:rgba(0,0,0,0.18);border:1px solid rgba(245,245,232,.18);color:rgba(245,245,232,.92);font-size:12px;font-weight:750;cursor:pointer;box-shadow:0 6px 14px rgba(0,0,0,0.18);\" onclick=\"return false;\" >" + ui("Appeler","Call") + "</button>" +
                      "</div>";

                    el.appendChild(panel);
                    try { setPhoneActive(true); } catch {}
                    try { setTimeout(recenterMini, 0); } catch {}

                    const cb = panel.querySelector("[data-phone-call=\"1\"]") as HTMLElement | null;
                    if (cb) {
                      cb.addEventListener("click", (ev2: any) => {
                        try { ev2.preventDefault(); ev2.stopPropagation(); } catch {}
                        try { window.location.href = "tel:" + dial; } catch {}
                      });
                    }
                  } catch {}
                });
              }
              const sb = el.querySelector("[data-site=\"1\"]") as HTMLElement | null;
              if (sb) {
                sb.addEventListener("click", (ev: any) => {
                  try { ev.preventDefault(); ev.stopPropagation(); } catch {}
                  try {
                    let url = String((props as any)?.website ?? "").trim();
                    if (!url) return;
                    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
                    try { window.open(url, "_blank", "noopener,noreferrer"); }
                    catch { window.location.href = url; }
                  } catch {}
                });
              }

              const rb = el.querySelector("[data-route=\"1\"]") as HTMLElement | null;
              if (rb) {
                rb.addEventListener("click", (ev: any) => {
                  try { ev.preventDefault(); ev.stopPropagation(); } catch {}
                  try { (rb as any)?.blur?.(); } catch {}
                  try {
                    const dlat = Number(lat);
                    const dlng = Number(lng);
                    if (!Number.isFinite(dlat) || !Number.isFinite(dlng)) return;
                    const ua = String((navigator as any)?.userAgent ?? "");
                    if (/iPhone|iPad|iPod/i.test(ua)) {
                      window.location.href = "http://maps.apple.com/?daddr=" + dlat + "," + dlng;
                    } else {
                      window.location.href = "geo:" + dlat + "," + dlng + "?q=" + dlat + "," + dlng;
                    }
                  } catch {}
                });
              }

              const ab = el.querySelector("[data-addr=\"1\"]") as HTMLElement | null;
              const setAddrActive = (on: boolean) => {
                try {
                  if (!ab) return;
                  if (on) {
                    (ab as any).style.boxShadow = "0 0 0 1px rgba(114,138,74,.65), 0 10px 22px rgba(0,0,0,0.26), 0 0 18px rgba(114,138,74,.50)";
                    (ab as any).style.background = "rgba(114,138,74,.20)";
                    (ab as any).style.borderColor = "rgba(114,138,74,.70)";
                  } else {
                    (ab as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)";
                    (ab as any).style.background = "rgba(0,0,0,0.14)";
                    (ab as any).style.borderColor = "rgba(255,255,255,0.30)";
                  }
                } catch {}
              };
              if (ab) {
                ab.addEventListener("click", (ev: any) => {
                  try { ev.preventDefault(); ev.stopPropagation(); } catch {}
                  try { const n1 = el.querySelector("[data-phone-panel=\"1\"]"); if (n1 && n1.parentNode) n1.parentNode.removeChild(n1); } catch {}
                  try { const pb0 = el.querySelector("[data-phone=\"1\"]"); if (pb0) { (pb0 as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)"; (pb0 as any).style.background = "rgba(0,0,0,0.14)"; (pb0 as any).style.borderColor = "rgba(255,255,255,0.30)"; } } catch {}
                  try { const n2 = el.querySelector("[data-hours-panel=\"1\"]"); if (n2 && n2.parentNode) n2.parentNode.removeChild(n2); } catch {}
                  try { const hb0 = el.querySelector("[data-hours=\"1\"]"); if (hb0) { (hb0 as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)"; (hb0 as any).style.background = "rgba(0,0,0,0.14)"; (hb0 as any).style.borderColor = "rgba(255,255,255,0.30)"; } } catch {}
                  try {
                    const addr = String(((props as any)?.address ?? "")).trim();
                    let panel = el.querySelector("[data-addr-panel=\"1\"]") as HTMLDivElement | null;
                    if (!addr) {
                      if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
                      try { setAddrActive(false); } catch {}
                      return;
                    }
                    if (panel) {
                      const cur = String((panel as HTMLElement).style.display || "");
                      const showing = (cur === "none");
                      (panel as HTMLElement).style.display = showing ? "block" : "none";
                      try { setAddrActive(showing); } catch {}
                      try { setTimeout(recenterMini, 0); } catch {}
                      return;
                    }

                    panel = document.createElement("div");
                    panel.setAttribute("data-addr-panel","1");
                    panel.style.position = "absolute";
                    panel.style.left = "50%";
                    panel.style.top = "100%";
                    panel.style.width = "260px";
                    panel.style.maxWidth = "260px";
                    panel.style.transform = "translateX(-50%) translateY(8px)";
                    panel.style.zIndex = "3";
                    panel.style.padding = "10px 10px";
                    panel.style.background = "rgba(31,31,24,0.78)";
                    panel.style.border = "1px solid rgba(245,245,232,.14)";
                    panel.style.borderRadius = "16px 6px 16px 6px";
                    panel.style.boxShadow = "0 10px 22px rgba(0,0,0,0.26)";
                    panel.style.backdropFilter = "blur(10px)";
                    (panel.style as any).webkitBackdropFilter = "blur(10px)";
                    panel.style.color = "rgba(245,245,232,.92)";
                    panel.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
                    panel.style.fontSize = "12px";
                    panel.style.lineHeight = "18px";
                    panel.style.letterSpacing = ".02em";

                    const text = document.createElement("div");
                    text.textContent = addr;
                    text.style.whiteSpace = "pre-wrap";
                    (text.style as any).userSelect = "text";
                    (text.style as any).webkitUserSelect = "text";
                    panel.appendChild(text);

                    const row = document.createElement("div");
                    row.style.marginTop = "10px";
                    row.style.display = "flex";
                    row.style.alignItems = "center";
                    row.style.justifyContent = "space-between";
                    row.style.gap = "8px";

                    const mkBtn = (label: string) => {
                      const b = document.createElement("button");
                      b.textContent = label;
                      b.style.flex = "1";
                      b.style.padding = "7px 8px";
                      b.style.borderRadius = "12px 5px 12px 5px";
                      b.style.border = "1px solid rgba(245,245,232,.18)";
                      b.style.background = "rgba(0,0,0,0.14)";
                      b.style.color = "rgba(245,245,232,.92)";
                      b.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
                      b.style.fontSize = "12px";
                      b.style.letterSpacing = ".02em";
                      b.style.cursor = "pointer";
                      b.style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)";
                      return b;
                    };

                    const copyBtn = mkBtn(ui("Copier","Copy"));
                    copyBtn.addEventListener("click", async (e2: any) => {
                      try { e2.preventDefault(); e2.stopPropagation(); } catch {}
                      const prev = String((copyBtn as any)?.textContent ?? ui("Copier","Copy"));
                      const flash = (t: string) => {
                        try { (copyBtn as any).textContent = t; } catch {}
                        try { setTimeout(() => { try { (copyBtn as any).textContent = prev; } catch {} }, 1200); } catch {}
                      };
                      try {
                        const txt = String(addr || "");
                        if (!txt.trim()) { flash(ui("Erreur","Error")); return; }
                        const clip = (navigator as any)?.clipboard?.writeText;
                        if (clip) {
                          try { await (navigator as any).clipboard.writeText(txt); flash(ui("Copié ✓","Copied ✓")); return; } catch {}
                        }
                        const ta = document.createElement("textarea");
                        ta.value = txt;
                        ta.setAttribute("readonly", "true");
                        ta.style.position = "fixed";
                        ta.style.left = "-9999px";
                        document.body.appendChild(ta);
                        ta.select();
                        let ok = false;
                        try { ok = !!document.execCommand("copy"); } catch {}
                        try { document.body.removeChild(ta); } catch {}
                        flash(ok ? ui("Copié ✓","Copied ✓") : ui("Erreur","Error"));
                      } catch {
                        flash(ui("Erreur","Error"));
                      }
                    });
const goBtn = mkBtn(ui("Itinéraire →","Directions →"));
                    goBtn.addEventListener("click", (e2: any) => {
                      try { e2.preventDefault(); e2.stopPropagation(); } catch {}
                      try {
                        const isIOS = /iPad|iPhone|iPod/.test(String((navigator as any)?.userAgent || ""));
                        const latN = Number(lat);
                        const lngN = Number(lng);
                        let url = "";
                        if (isIOS) {
                          url = "http://maps.apple.com/?q=" + encodeURIComponent(addr);
                        } else if (Number.isFinite(latN) && Number.isFinite(lngN)) {
                          const dest = encodeURIComponent(String(latN) + "," + String(lngN));
                          url = "https://www.google.com/maps/dir/?api=1&destination=" + dest;
                        } else {
                          url = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(addr);
                        }
                        window.location.href = url;
                      } catch {}
                    });

                    row.appendChild(copyBtn);
                    row.appendChild(goBtn);
                    panel.appendChild(row);

                    el.appendChild(panel);
                    try { setAddrActive(true); } catch {}
                  } catch {}
                });
              }
              if (db) {
                db.addEventListener("click", (ev) => {
                  try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
                  try { setSheetOpen(false); } catch (e) {}
                  try { setSheetHtml(""); } catch (e) {}
                  try { if (geolocateElRef.current) geolocateElRef.current.style.display = "none"; } catch (e) {}
                  try { setDiscoverMeta({ id: String(props?.id ?? fid ?? ""), name: String(props?.name ?? props?.title ?? "") }); } catch (e) {}
                  try { heroReturnPopupRef.current = { lng: Number(lng), lat: Number(lat), props, fid: fid ? String(fid) : null }; } catch (e) {}
                  try { setDiscoverPanel(null); } catch (e) {}
                  try { setHeroUiHide(true); } catch (e) {}
                  try { heroPanRef.current = 0.5; } catch (e) {}
                  try { setDiscoverHeroPan(0.5); } catch (e) {}
                  try { tableauPrevPRef.current = 0.5; } catch (e) {}
                  try { heroHadMoveRef.current = false; } catch (e) {}
                  try { setHeroHintOff(false); } catch (e) {}
                  try {
                    try {
                      const pid = String(props?.id ?? fid ?? "");
                      const pname = String(props?.name ?? props?.title ?? "");
                      let hero = null as null | string;
                      try {
                        hero = String(((props as any)?.panoramaImage ?? (props as any)?.properties?.panoramaImage ?? "") || "");
                      } catch {}
                      try { setDiscoverHeroUrl(hero && hero.trim() ? hero : null); } catch {}
                      try { setDiscoverHeroOpen(false); } catch {}
                      try { window.dispatchEvent(new CustomEvent("im:hero", { detail: { open: true } })); } catch {}

                      try { setDiscoverHeroZoom(false); } catch {}
                      try { setDiscoverDoorOpen(false); } catch {}
                      try { setHeroUiHide(true); } catch {}
                      try { if (geolocateElRef.current) geolocateElRef.current.style.display = "none"; } catch {}
                      try { heroPanRef.current = 0.5; } catch {}
                      try { setDiscoverHeroPan(0.5); } catch {}
                      try { tableauPrevPRef.current = 0.5; } catch {}
                      try { heroHadMoveRef.current = false; } catch {}
                      try { setHeroHintOff(false); } catch {}
                      try { setDiscoverHeroOpen(true); } catch {}
                      try { window.dispatchEvent(new CustomEvent("im:hero", { detail: { open: true } })); } catch {}

                      try { setTimeout(() => { try { setDiscoverHeroZoom(true); } catch {} }, 30); } catch {}
                      try { setTimeout(() => { try { setDiscoverDoorOpen(true); } catch {} }, 220); } catch {}
                    } catch {}
                  } catch (e) {}
                                    try { popupRef.current?.remove(); } catch (e) {}
                  try { if (selectedPinMarkerRef.current) selectedPinMarkerRef.current.remove(); } catch (e) {}
                  selectedPinMarkerRef.current = null;
                  try { document.querySelectorAll(".im-globe-dim").forEach((n) => { try { (n as any)?.classList?.remove("im-globe-dim"); } catch {} }); } catch {}
                   try {
              for (const feat of fcRef.current.features) {
                try { feat.properties.selected = false; } catch {}
              }
              const src = getSource(map);
              if (src) src.setData(fcRef.current);
            } catch {}

popupRef.current = null;
                });
              }
            } catch {}
            
            try {
                            const hb = el.querySelector("[data-hours=\"1\"]") as HTMLElement | null;
              const opening = String(((props as any)?.openingHours ?? "")).trim();
                      const setHoursActive = (on: boolean) => {
                        try {
                          if (on) {
                            (hb as any).style.boxShadow = "0 0 0 1px rgba(114,138,74,.65), 0 10px 22px rgba(0,0,0,0.26), 0 0 18px rgba(114,138,74,.50)";
                            (hb as any).style.background = "rgba(114,138,74,.20)";
                            (hb as any).style.borderColor = "rgba(114,138,74,.70)";
                          } else {
                            (hb as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)";
                            (hb as any).style.background = "rgba(0,0,0,0.14)";
                            (hb as any).style.borderColor = "rgba(255,255,255,0.30)";
                          }
                        } catch {}
                      };

              if (hb) {
                hb.addEventListener("click", (ev: any) => {
                  try { ev.preventDefault(); ev.stopPropagation(); } catch {}
                  try { const n1 = el.querySelector("[data-phone-panel=\"1\"]"); if (n1 && n1.parentNode) n1.parentNode.removeChild(n1); } catch {}
                  try { const pb0 = el.querySelector("[data-phone=\"1\"]"); if (pb0) { (pb0 as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)"; (pb0 as any).style.background = "rgba(0,0,0,0.14)"; (pb0 as any).style.borderColor = "rgba(255,255,255,0.30)"; } } catch {}
                  try { const n2 = el.querySelector("[data-addr-panel=\"1\"]"); if (n2 && n2.parentNode) n2.parentNode.removeChild(n2); } catch {}
                  try { const ab0 = el.querySelector("[data-addr=\"1\"]"); if (ab0) { (ab0 as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)"; (ab0 as any).style.background = "rgba(0,0,0,0.14)"; (ab0 as any).style.borderColor = "rgba(255,255,255,0.30)"; } } catch {}
                  try {
                    let panel = el.querySelector("[data-hours-panel=\"1\"]") as HTMLDivElement | null;
                    if (!opening) {
                              if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
                              try { setHoursActive(false); } catch {}
                              return;
                            }
                    if (panel) {
                              const cur = String((panel as HTMLElement).style.display || "");
                              const showing = (cur === "none");
                              (panel as HTMLElement).style.display = showing ? "block" : "none";
                              try { setHoursActive(showing); } catch {}
                            try { setTimeout(recenterMini, 0); } catch {}
                            try { setTimeout(recenterMini, 0); } catch {}
                              return;
                            }
                    panel = document.createElement("div");
                    panel.setAttribute("data-hours-panel","1");
                    panel.style.position = "absolute";
                    panel.style.left = "50%";
                    panel.style.top = "100%";
                    panel.style.width = "260px";
                    panel.style.maxWidth = "260px";
                    panel.style.transform = "translateX(-50%) translateY(8px)";
                    panel.style.zIndex = "3";
                    panel.style.padding = "10px 10px";
                    panel.style.background = "rgba(31,31,24,0.78)";
                    panel.style.border = "1px solid rgba(245,245,232,.14)";
                    panel.style.borderRadius = "16px 6px 16px 6px";
                    panel.style.boxShadow = "0 10px 22px rgba(0,0,0,0.26)";
                    panel.style.backdropFilter = "blur(10px)";
                    (panel.style as any).webkitBackdropFilter = "blur(10px)";
                    panel.style.color = "rgba(245,245,232,.92)";
                    panel.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
                    panel.style.fontSize = "12px";
                    panel.style.lineHeight = "18px";
                    panel.style.letterSpacing = ".02em";
                    const parts = opening.split("\n").map(x => String(x||"").trim()).filter(Boolean);
                    panel.style.display = "flex";
                    panel.style.flexDirection = "column";
                    panel.style.gap = "6px";
                    for (const l of parts) {
                      const m = String(l || "").match(/^([A-Za-zÀ-ÿ]+)\s+(.*)$/);
                      if (m && m[1] && m[2]) {
                        const row = document.createElement("div");
                        row.style.display = "flex";
                        row.style.alignItems = "baseline";
                        row.style.gap = "10px";

                        const day = document.createElement("span");
                        day.textContent = (function(){const fr=String(m[1]||"").trim();const k=fr.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();if(k.startsWith("lun")) return ui("Lundi","Monday");if(k.startsWith("mar")) return ui("Mardi","Tuesday");if(k.startsWith("mer")) return ui("Mercredi","Wednesday");if(k.startsWith("jeu")) return ui("Jeudi","Thursday");if(k.startsWith("ven")) return ui("Vendredi","Friday");if(k.startsWith("sam")) return ui("Samedi","Saturday");if(k.startsWith("dim")) return ui("Dimanche","Sunday");return fr;})();
                        day.style.fontWeight = "750";
                        day.style.color = "rgba(245,245,232,.78)";
                        day.style.whiteSpace = "nowrap";
                        day.style.flex = "0 0 92px";

                        const hours = document.createElement("span");
                        hours.textContent = (function(){const fr=String(m[2]||"").trim();const k=fr.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();if(k==="ferme"||k.startsWith("ferme")) return ui("Fermé","Closed");return fr;})();
                        hours.style.fontWeight = "650";
                        hours.style.color = "rgba(245,245,232,.92)";
                        hours.style.textAlign = "right";
                        hours.style.whiteSpace = "normal";
                                (hours.style as any).overflowWrap = "anywhere";
                                (hours.style as any).wordBreak = "break-word";
                                hours.style.maxWidth = "150px";
                                hours.style.flex = "0 1 150px";

                        const leader = document.createElement("span");
                        leader.style.flex = "1";
                                leader.style.minWidth = "24px";
                        leader.style.borderBottom = "1px dotted rgba(245,245,232,.26)";
                        leader.style.transform = "translateY(-2px)";
                        leader.style.opacity = "0.9";

                        row.appendChild(day);
                        row.appendChild(leader);
                        row.appendChild(hours);
                        panel.appendChild(row);
                      } else {
                        const d = document.createElement("div");
                        d.textContent = l;
                        panel.appendChild(d);
                      }
                    }
                    el.appendChild(panel);
                            try { setHoursActive(true); } catch {}
                            try { setTimeout(recenterMini, 0); } catch {}
                            try { setTimeout(recenterMini, 0); } catch {}
                            } catch {}
                });
              }
            } catch {}

popupRef.current = new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -48] } as any)
              .setLngLat([lng, lat])
              .addTo(map);
          } catch {}
        };

        const isTextilerie =
          String(props?.id ?? fid) === "98ce3443-2512-4285-9b47-535d2a369cb4" ||
          String(props?.name ?? props?.title ?? "").trim().toLowerCase().includes("textilerie");

        if (isTextilerie) {
          openPopup();
return;
        }


        if (z < 7.2) {
          try { setSheetOpen(false); } catch {}
          try { setSheetHtml(""); } catch {}
          try { setSheetHeightNow(25); } catch {}
          openPopup();
          return;
        }
        try {
          map.once("moveend", openPopup);
          map.easeTo({
            center: [Number(lng), Number(lat)],
            zoom: map.getZoom(),
            duration: 320,
            offset: [0, 220],
            essential: true
          });
        } catch { openPopup(); }
});
    }
  }

  function rebuildFC(nextItems: Biz[], activeId: string | null) {
    const byId = new Map<string, Biz>();
    for (const b of nextItems) {
      if (!b || !b.id) continue;
      const lat = typeof b.lat === "number" ? b.lat : null;
      const lng = typeof b.lng === "number" ? b.lng : null;
      if (lat == null || lng == null) continue;
      byId.set(String(b.id), b);
    }

    const features: any[] = [];
    for (const [id, b] of byId.entries()) {
      const kind = normalizeType(String((b as any).category ?? b.type ?? ""));
      const nameRaw = String(b.name ?? "");

      features.push({
        type: "Feature",
        id,
        geometry: { type: "Point", coordinates: [Number(b.lng), Number(b.lat)] },
        properties: {
          id,
          name: nameRaw,
          title: nameRaw,
          type: b.type ?? "",
          address: b.address ?? "",
          website: b.website ?? "",
          openingHours: b.openingHours ?? "",
          phone: (b as any).phone ?? "",
          panoramaImage: (b as any).panoramaImage ?? "",
          lat: Number(b.lat),
          lng: Number(b.lng),
          kind,
          miniText: (b as any).miniText ?? (b as any).blurb ?? (b as any).description ?? "",
          timeZone: (b as any).timeZone ?? "",
          selected: activeId != null && id === activeId,
        },
      });
    }

    fcRef.current = { type: "FeatureCollection", features };
  }

  React.useEffect(() => {
    if (!ref.current) return;

    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

    const el = ref.current as any;
    try {
      el.style.opacity = "1";
      el.style.transition = "none";
      el.style.willChange = "auto";
    } catch {}


    /* __IM_FADEIN_MAP__ */
    const map = new maplibregl.Map({
      container: el,
      style: STYLE_URL,
      center: [0, 0],
      zoom: isMobile ? 1.4 : 2.4,
      minZoom: isMobile ? 1.4 : 2.4,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
      fadeDuration: 0,
      transformRequest: (url: string, resourceType: any) => {
        try {
          const u = String(url || "");
          const t = String(resourceType || "");
          const hit = /\.webp(\?|$)/i.test(u) || /\bwebp\b/i.test(u) || /sprite|glyph|tile|tiles/i.test(t) || /sprite|glyph|tile|tiles/i.test(u);
          if (hit) console.log("[IM_ML_REQ]", t, u);
        } catch {}
        return { url };
      },
    });

    try {
      map.on("error" as any, (e: any) => {
        try {
          const msg = String(e?.error?.message ?? e?.error ?? "");
          const src = String(e?.sourceId ?? "");
          const tid = (() => { try { return String(e?.tile?.tileID ?? e?.tile?.uid ?? ""); } catch { return ""; } })();
          console.log("[IM_ML_ERR]", msg, "source=", src, "tile=", tid);
        } catch {}
      });
    } catch {}

    try { (window as any).__IM_MAP__ = map; } catch {}



    


class GeolocateControl_ML {
  _map: any;
  _container: any;
  _deviceHeading: number | null = null;
  _onDeviceOrientation: any = null;
  _lastLng: number | null = null;
  _lastLat: number | null = null;
  onAdd(map: any) {
    this._map = map;

    try {
      const updateCone = (lng: number, lat: number, bearing: number) => {
        const m = this._map;
        if (!m) return;

        const SRC = "indie-user-cone";
        const LYR = "indie-user-cone-fill";

        const dist = 0.00055;
        const spread = 30 * Math.PI / 180;
        const a = bearing * Math.PI / 180;

        const p0 = [Number(lng), Number(lat)];
        const p1 = [
          Number(lng) + Math.cos(a - spread) * dist,
          Number(lat) + Math.sin(a - spread) * dist
        ];
        const p2 = [
          Number(lng) + Math.cos(a + spread) * dist,
          Number(lat) + Math.sin(a + spread) * dist
        ];

        const geojson = {
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [[p0, p1, p2, p0]] }
          }]
        };

        try {
          if (!m.getSource(SRC)) {
            m.addSource(SRC, { type: "geojson", data: geojson } as any);
          } else {
            const src = m.getSource(SRC) as any;
            if (src && src.setData) src.setData(geojson);
          }
        } catch {}

        try {
          if (!m.getLayer(LYR)) {
            m.addLayer({
              id: LYR,
              type: "fill",
              source: SRC,
              paint: {
                "fill-color": "#F97316",
                "fill-opacity": 0.22
              }
            } as any);
          }
        } catch {}
      };

      (this as any)._updateConeFn = updateCone;

      if (!this._onDeviceOrientation) {
        this._onDeviceOrientation = (e: any) => {
          try {
            const ev: any = e || {};
            let heading: number | null = null;

            const wh = typeof ev.webkitCompassHeading === "number" ? ev.webkitCompassHeading : null;
            if (wh != null && Number.isFinite(wh)) {
              heading = wh;
            } else {
              const a0 = typeof ev.alpha === "number" ? ev.alpha : null;
              if (a0 != null && Number.isFinite(a0)) heading = (360 - a0) % 360;
            }

            if (heading == null) return;
            this._deviceHeading = heading;

            if (this._lastLng != null && this._lastLat != null) {
              try {
                const fn = (this as any)._updateConeFn;
                if (fn) fn(this._lastLng, this._lastLat, heading);
              } catch {}
            }
          } catch {}
        };

        try {
          if (typeof (DeviceOrientationEvent as any)?.requestPermission === "function") {
            (DeviceOrientationEvent as any).requestPermission()
              .then((p: any) => {
                if (p === "granted") {
                  window.addEventListener("deviceorientationabsolute", this._onDeviceOrientation, true);
                  window.addEventListener("deviceorientation", this._onDeviceOrientation, true);
                }
              })
              .catch(() => {});
          } else {
            window.addEventListener("deviceorientationabsolute", this._onDeviceOrientation, true);
            window.addEventListener("deviceorientation", this._onDeviceOrientation, true);
          }
        } catch {}
      }
    } catch {}
    const c = document.createElement("div");
    c.style.display = "block";
    c.style.pointerEvents = "none";
    c.style.marginRight = "12px";
    c.style.marginBottom = "12px";
    c.style.pointerEvents = "auto";
    c.innerHTML = `
      <button type="button" aria-label={ui("Me localiser","Locate me")}
        style="
          height:44px;width:44px;border-radius:0 0 12px 12px;
          background:#262626;border:1px solid #404040;border-top:1px solid rgba(255,255,255,0.15);
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 1px 0 rgba(0,0,0,.28),0 10px 18px rgba(0,0,0,.12);
          cursor:pointer;
        ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="transform: translate(-1px, -0.5px);"
          stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 2L11 13" />
          <path d="M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      </button>
    `;
    const btn = c.querySelector("button");
    if (btn) {
      btn.addEventListener("click", () => {
        try { if (popupRef.current) popupRef.current.remove(); } catch {}
        try { if (selectedPinMarkerRef.current) selectedPinMarkerRef.current.remove(); } catch {}
        try { document.querySelectorAll(".im-globe-dim").forEach((n) => { try { (n as any)?.classList?.remove("im-globe-dim"); } catch {} }); } catch {}
        try { for (const feat of fcRef.current.features) { try { feat.properties.selected = false; } catch {} } } catch {}
        try { const src = getSource((this as any)._map); if (src) src.setData(fcRef.current); } catch {}
        popupRef.current = null;
        selectedPinMarkerRef.current = null;
        try {
          if (!navigator.geolocation) return;

          try { (this as any).__indieConePermissionInClick = true; } catch {}

          try {
            if (!this._onDeviceOrientation) {
              this._onDeviceOrientation = (e: any) => {
                try {
                  const m = this._map;
                  if (!m) return;

                  const ev: any = e || {};
                  let heading: number | null = null;

                  const wh = typeof ev.webkitCompassHeading === "number" ? ev.webkitCompassHeading : null;
                  if (wh != null && Number.isFinite(wh)) heading = wh;
                  if (heading == null) {
                    const a0 = typeof ev.alpha === "number" ? ev.alpha : null;
                    if (a0 != null && Number.isFinite(a0)) heading = (360 - a0) % 360;
                  }
                  if (heading == null) return;

                  this._deviceHeading = heading;

                  const lng = this._lastLng;
                  const lat = this._lastLat;
                  if (lng == null || lat == null) return;

                  const SRC = "indie-user-cone";
                  const LYR = "indie-user-cone-fill";

                  const dist = 0.00055;
                  const spread = 30 * Math.PI / 180;
                  const a = heading * Math.PI / 180;

                  const p0 = [Number(lng), Number(lat)];
                  const p1 = [Number(lng) + Math.cos(a - spread) * dist, Number(lat) + Math.sin(a - spread) * dist];
                  const p2 = [Number(lng) + Math.cos(a + spread) * dist, Number(lat) + Math.sin(a + spread) * dist];

                  const geojson = {
                    type: "FeatureCollection",
                    features: [{
                      type: "Feature",
                      properties: {},
                      geometry: { type: "Polygon", coordinates: [[p0, p1, p2, p0]] }
                    }]
                  };

                  try {
                    if (!m.getSource(SRC)) {
                      m.addSource(SRC, { type: "geojson", data: geojson } as any);
                    } else {
                      const src = m.getSource(SRC) as any;
                      if (src && src.setData) src.setData(geojson);
                    }
                  } catch {}

                  try {
                    if (!m.getLayer(LYR)) {
                      m.addLayer({
                        id: LYR,
                        type: "fill",
                        source: SRC,
                        paint: { "fill-color": "#F97316", "fill-opacity": 0.22 }
                      } as any);
                    }
                  } catch {}
                } catch {}
              };

              const addListeners = () => {
                try { window.addEventListener("deviceorientationabsolute", this._onDeviceOrientation, true); } catch {}
                try { window.addEventListener("deviceorientation", this._onDeviceOrientation, true); } catch {}
              };

              try {
                if (typeof (DeviceOrientationEvent as any)?.requestPermission === "function") {
                  (DeviceOrientationEvent as any).requestPermission()
                    .then((p: any) => { if (p === "granted") addListeners(); })
                    .catch(() => {});
                } else {
                  addListeners();
                }
              } catch {}
            }
          } catch {}

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const lng = pos.coords.longitude;
              const lat = pos.coords.latitude;
              try { this._lastLng = Number(lng); this._lastLat = Number(lat); } catch {}
              let bearing: number | null = null;
              try {
                const h = (pos.coords as any).heading;
                if (typeof h === "number" && Number.isFinite(h)) bearing = h;
              } catch {}
              if (bearing == null) {
                try {
                  const dh = this._deviceHeading;
                  if (typeof dh === "number" && Number.isFinite(dh)) bearing = dh;
                } catch {}
              }
              try {
                const m = this._map;
                if (m) {
                  const SRC = "indie-user-location";
                  const HALO = "indie-user-location-halo";
                  const DOT = "indie-user-location-dot";

                  const apply = () => {
                    try {
                      if (!m.getSource(SRC)) {
                        m.addSource(SRC, {
                          type: "geojson",
                          data: {
                            type: "FeatureCollection",
                            features: [{
                              type: "Feature",
                              properties: {},
                              geometry: { type: "Point", coordinates: [Number(lng), Number(lat)] }
                            }]
                          }
                        } as any);
                      }
                    } catch {}

                    try {
                      if (!m.getLayer(HALO)) {
                        m.addLayer({
                          id: HALO,
                          type: "circle",
                          source: SRC,
                          paint: {
                            "circle-radius": 12,
                            "circle-color": "#F97316",
                            "circle-opacity": 0.25
                          }
                        } as any);
                      }
                    } catch {}

                    try {
                      if (!m.getLayer(DOT)) {
                        m.addLayer({
                          id: DOT,
                          type: "circle",
                          source: SRC,
                          paint: {
                            "circle-radius": 6,
                            "circle-color": "#F97316",
                            "circle-stroke-width": 2,
                            "circle-stroke-color": "#FFFFFF",
                            "circle-opacity": 1
                          }
                        } as any);
                      }
                    } catch {}

                    try {
                      const src = m.getSource(SRC);
                      if (src && src.setData) {
                        src.setData({
                          type: "FeatureCollection",
                          features: [{
                            type: "Feature",
                            properties: {},
                            geometry: { type: "Point", coordinates: [Number(lng), Number(lat)] }
                          }]
                        });
                      }
                    } catch {}
                  };

                  try {
                    if (typeof m.isStyleLoaded === "function" && !m.isStyleLoaded()) {
                      m.once("load", apply);
                    } else {
                      apply();
                    }
                  } catch { try { apply(); } catch {} }
                }
              } catch {}
              try { lastUserPosRef.current = { lng: Number(lng), lat: Number(lat), ts: Date.now() }; } catch {}
              try {
                const m = this._map;
                if (m) {
                  const targetCenter: [number, number] = [Number(lng), Number(lat)];
                  const targetZoom = 12.4;
                  m.jumpTo({ center: targetCenter, zoom: targetZoom });
                  window.setTimeout(() => {
                    try {
                      const m2 = this._map;
                      if (!m2) return;
                      m2.easeTo({
                        center: targetCenter,
                        zoom: targetZoom,
                        duration: 900
                      });
                    } catch {}
                  }, 450);
                }
              } catch {}
              try {
                const fn = (this as any)._updateConeFn;
                if (fn && bearing != null) fn(Number(lng), Number(lat), Number(bearing));
              } catch {}
            },
            (err: any) => {
            try {
              const code = Number((err as any)?.code);
              const name = String((err as any)?.name || "");
              const msg = String((err as any)?.message || "");
              console.log("[im:geolocate] error", { code, name, msg, raw: err });
            } catch {}
            try {
              const code = Number((err as any)?.code);
              const name = String((err as any)?.name || "");
              const msg = String((err as any)?.message || "");
              alert("GEOLOCATE ERROR code=" + String(code) + " name=" + name + " msg=" + msg);
            } catch {}
          },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
          );
        } catch {}
      });
    }
    this._container = c;
    try {
      requestAnimationFrame(() => {
        try {
          const wrap = c.parentElement as HTMLElement | null;
          if (wrap) {
            wrap.style.marginRight = "0";
            wrap.style.marginBottom = "0";
            wrap.style.marginLeft = "0";
            wrap.style.marginTop = "0";
            wrap.style.float = "none";
            wrap.style.clear = "none";
          }
        } catch {}
      });
    } catch {}
    try { geolocateElRef.current = c; } catch {}
    return c;
  }
  onRemove() {
    try {
      if (this._onDeviceOrientation) {
        try { window.removeEventListener("deviceorientationabsolute", this._onDeviceOrientation, true); } catch {}
        try { window.removeEventListener("deviceorientation", this._onDeviceOrientation, true); } catch {}
      }
    } catch {}
    try { this._container?.remove(); } catch {}
    this._map = null;
  }
}

try { map.addControl(new GeolocateControl_ML(), "bottom-right" as any); } catch {}

/* im: single geolocate button (React) */


mapRef.current = map;

    (window as any).__indieRouteTo = async (destLng: number, destLat: number) => {
      const m = mapRef.current;
      if (!m) return;

      const ROUTE_SOURCE_ID = "indie-route";
      const ROUTE_LAYER_ID = "indie-route-line";

      try {
        if (!m.getSource(ROUTE_SOURCE_ID)) {
          m.addSource(ROUTE_SOURCE_ID, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          } as any);
        }

        if (!m.getLayer(ROUTE_LAYER_ID + "-halo")) {
          m.addLayer({
            id: ROUTE_LAYER_ID + "-halo",
            type: "line",
            source: ROUTE_SOURCE_ID,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-width": 7,
              "line-opacity": 0.35,
              "line-color": "#FDE68A",
            },
          } as any);
        } else {
          m.setPaintProperty(ROUTE_LAYER_ID + "-halo", "line-width", 7);
          m.setPaintProperty(ROUTE_LAYER_ID + "-halo", "line-opacity", 0.35);
          m.setPaintProperty(ROUTE_LAYER_ID + "-halo", "line-color", "#F3EBDD");
        }

        if (!m.getLayer(ROUTE_LAYER_ID)) {
          m.addLayer({
            id: ROUTE_LAYER_ID,
            type: "line",
            source: ROUTE_SOURCE_ID,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-width": 3.5,
              "line-opacity": 1,
              "line-color": "#F59E0B",
              "line-dasharray": [1.5, 1.5],
            },
          } as any);
        } else {
          m.setPaintProperty(ROUTE_LAYER_ID, "line-width", 3.5);
          m.setPaintProperty(ROUTE_LAYER_ID, "line-opacity", 1);
          m.setPaintProperty(ROUTE_LAYER_ID, "line-color", "#728A4A");
          m.setPaintProperty(ROUTE_LAYER_ID, "line-dasharray", [1.5, 1.5]);
          m.setPaintProperty(ROUTE_LAYER_ID, "line-color", "#F59E0B");
          m.setPaintProperty(ROUTE_LAYER_ID + "-halo", "line-color", "#FDE68A");

        }
      } catch {}
      const getPos = () =>
        new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) return reject(new Error("no geolocation"));
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos),
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        });

      let pos: GeolocationPosition;
      try {
        pos = await getPos();
      } catch {
        try { alert("Localisation bloquée. Vérifie que tu utilises Indie Map en HTTPS et que la localisation est autorisée sur iPhone."); } catch {}
        return;
      }

      const fromLng = Number(pos.coords.longitude);
      const fromLat = Number(pos.coords.latitude);

      const url =
        "https://router.project-osrm.org/route/v1/driving/" +
        fromLng + "," + fromLat + ";" + destLng + "," + destLat +
        "?overview=full&geometries=geojson&steps=false";

      let data;
      try {
        const r = await fetch(url);
        if (!r.ok) return;
        data = await r.json();
      } catch {
        return;
      }

      const coords = data?.routes?.[0]?.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) return;

      const fc = {
        type: "FeatureCollection",
        features: [
          { type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} },
        ],
      };

      try {
        const src = m.getSource(ROUTE_SOURCE_ID) as any;
        if (src && src.setData) src.setData(fc);
      } catch {}

      try {
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        for (const c of coords) {
          const x = Number(c?.[0]), y = Number(c?.[1]);
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
          if (x < minLng) minLng = x;
          if (y < minLat) minLat = y;
          if (x > maxLng) maxLng = x;
          if (y > maxLat) maxLat = y;
        }
        if (Number.isFinite(minLng)) {
          m.fitBounds([[minLng, minLat], [maxLng, maxLat]] as any, { padding: 60, duration: 800 });
        }
      } catch {}
    };

    const attach = () => {
      ensureImages(map)
        .then(() => {
          ensureLayer(map);
          const s = getSource(map);
          if (s) s.setData(fcRef.current);
        })
        .catch(() => {});
    };

    map.on("load", () => {
      readyRef.current = true;
      try { setMapReadyTick((v) => v + 1); } catch {}
      try {
        let tries = 0;
        const emitMapReady = () => {
          try {
            const geoBtn = geolocateElRef.current?.querySelector("button") as HTMLButtonElement | null;
            const visible =
              !!geoBtn &&
              geoBtn.isConnected &&
              geoBtn.offsetParent !== null &&
              window.getComputedStyle(geoBtn).display !== "none" &&
              window.getComputedStyle(geoBtn).visibility !== "hidden";
            const canvas = ref.current?.querySelector(".maplibregl-canvas") as HTMLCanvasElement | null;
            const canvasReady = !!canvas;
            if ((visible && canvasReady) || tries >= 24) {
              window.dispatchEvent(new CustomEvent("im:map-ui-ready"));
              return;
            }
          } catch {
            if (tries >= 24) {
              try { window.dispatchEvent(new CustomEvent("im:map-ui-ready")); } catch {}
              return;
            }
          }
          tries += 1;
          try { window.requestAnimationFrame(emitMapReady); } catch {
            try { setTimeout(emitMapReady, 16); } catch {}
          }
        };
        emitMapReady();
      } catch {}

      map.setProjection({ type: "globe" } as any);

      try { map.dragPan.enable(); } catch {}
      try { map.dragRotate.disable(); } catch {}

      try { map.scrollZoom.enable({ around: "center" } as any); } catch {}
      try { map.doubleClickZoom.enable(); } catch {}
      try { map.boxZoom.disable(); } catch {}
      try { map.keyboard.disable(); } catch {}

      try { map.touchZoomRotate.enable({ around: "center" } as any); } catch {}

      attach();

      try {
        const pending = pendingNativeLocationRef.current ?? ((window as any).__IM_NATIVE_LOCATION__ || null);
        const lat = Number((pending as any)?.lat);
        const lng = Number((pending as any)?.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          pendingNativeLocationRef.current = null;
          window.dispatchEvent(new CustomEvent("im:native-location", { detail: { lat, lng } }));
        }
      } catch {}
    });

    map.on("style.load", attach);

    return () => {
      try { dragCleanupRef.current?.(); } catch {}
      try { map.remove(); } catch {}
      mapRef.current = null;
      readyRef.current = false;
      if (popupRef.current) {
        try { popupRef.current.remove(); } catch {}
        popupRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    rebuildFC(items ?? [], selectedId ?? null);

    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    try {
      ensureLayer(map);
      const s = getSource(map);
      if (s) s.setData(fcRef.current);
    } catch {}
  }, [items, selectedId, darkMap]);

  return (
    <div className="relative h-full w-full bg-black">
      <div ref={ref} className="h-full w-full" style={{ backgroundColor: "#000", opacity: 1, transition: "none", willChange: "auto" }} />
      <style>{`\
        .maplibregl-canvas{transition:filter 220ms ease;}\
        .im-globe-dim .maplibregl-canvas{filter:brightness(.40) saturate(.90) contrast(.98);}\
      `}</style>
      
            {discoverHeroOpen ? (
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0 pointer-events-auto"
            style={{ background: "rgba(0,0,0,0.00)", touchAction: "none", cursor: "grab" }}
            onPointerDown={heroPointerDown}
            onPointerMove={heroPointerMove}
            onPointerUp={heroPointerUp}
            onPointerCancel={heroPointerUp}
            onMouseDown={(e) => {
              try { e.preventDefault(); e.stopPropagation(); } catch {}
              try { if (heroHintTimerRef.current) clearTimeout(heroHintTimerRef.current); } catch {}
              heroHintTimerRef.current = null;
              try { if (heroHintRafRef.current != null) cancelAnimationFrame(heroHintRafRef.current); } catch {}
              heroHintRafRef.current = null;
              try { heroHadMoveRef.current = true; } catch {}
              try { setHeroHintOff(true); } catch {}
              try {
                const x0 = Number((e as any)?.clientX || 0);
                const p0 = Number(heroPanRef.current ?? 0.5);
                heroDragRef.current = { active: true, lastX: x0, pan: p0 } as any;
              } catch {}
            }}
            onMouseMove={(e) => {
              try {
                const st: any = heroDragRef.current as any;
                if (!st || !st.active) return;
                try { e.preventDefault(); e.stopPropagation(); } catch {}
                const x = Number((e as any)?.clientX || 0);
                const lastX = Number(st.lastX ?? x);
                const dx = x - lastX;
                st.lastX = x;
                if (Math.abs(dx) > 1.5) { heroHadMoveRef.current = true; try { setHeroHintOff(true); } catch {} }

                const w = Number((typeof window !== "undefined" ? window.innerWidth : 1) || 1);
                const curPan = Number(st.pan ?? heroPanRef.current ?? 0.5);
                const next = Math.max(0, Math.min(1, curPan - (dx / w)));
                st.pan = next;

                try { heroPanRef.current = next; } catch {}
                try { setDiscoverHeroPan(next); } catch {}
              } catch {}
            }}
            onMouseUp={(e) => {
              try { e.preventDefault(); e.stopPropagation(); } catch {}
              try { heroDragRef.current = null; } catch {}
            }}
            onMouseLeave={(e) => {
              try { heroDragRef.current = null; } catch {}
            }}
            onTouchStart={(e) => {
              try { e.preventDefault(); e.stopPropagation(); } catch {}
              try { if (heroHintTimerRef.current) clearTimeout(heroHintTimerRef.current); } catch {}
              heroHintTimerRef.current = null;
              try { if (heroHintRafRef.current != null) cancelAnimationFrame(heroHintRafRef.current); } catch {}
              heroHintRafRef.current = null;
              try { heroHadMoveRef.current = true; } catch {}
              try { setHeroHintOff(true); } catch {}
              try {
                const t = (e as any)?.touches?.[0];
                const x0 = Number(t?.clientX || 0);
                const p0 = Number(heroPanRef.current ?? 0.5);
                heroDragRef.current = { active: true, lastX: x0, pan: p0 } as any;
              } catch {}
            }}
            onTouchMove={(e) => {
              try {
                const st: any = heroDragRef.current as any;
                if (!st || !st.active) return;
                try { e.preventDefault(); e.stopPropagation(); } catch {}
                const t = (e as any)?.touches?.[0];
                const x = Number(t?.clientX || 0);
                const lastX = Number(st.lastX ?? x);
                const dx = x - lastX;
                st.lastX = x;
                if (Math.abs(dx) > 1.5) { heroHadMoveRef.current = true; try { setHeroHintOff(true); } catch {} }

                const w = Number((typeof window !== "undefined" ? window.innerWidth : 1) || 1);
                const curPan = Number(st.pan ?? heroPanRef.current ?? 0.5);
                const next = Math.max(0, Math.min(1, curPan - (dx / w)));
                st.pan = next;

                try { heroPanRef.current = next; } catch {}
                try { setDiscoverHeroPan(next); } catch {}
              } catch {}
            }}
            onTouchEnd={(e) => {
              try { e.preventDefault(); e.stopPropagation(); } catch {}
              try { heroDragRef.current = null; } catch {}
            }}
            onTouchCancel={(e) => {
              try { heroDragRef.current = null; } catch {}
            }}
          />
                        <button
            type="button"
            aria-label={ui("Fermer","Close")}
            className="absolute top-4 right-4 z-[80] pointer-events-auto"
            style={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              color: "#000000",
              filter: "drop-shadow(0 0 10px rgba(245,245,232,0.70)) drop-shadow(0 0 18px rgba(245,245,232,0.35))",
              fontSize: "28px",
              fontWeight: 600,
              lineHeight: "28px",
              padding: 0
            }}

            onClick={(e) => {
              try { e.preventDefault(); e.stopPropagation(); } catch {}
              let stClose = null;
              try { stClose = heroReturnPopupRef.current; } catch {}
              try { const t = (e as any)?.currentTarget as any; if (t && t.style) { t.style.opacity = "0"; t.style.pointerEvents = "none"; } } catch {}
              try { window.dispatchEvent(new CustomEvent("im:hero", { detail: { open: false } })); } catch {}
              try { setHeroUiHide(true); } catch {}
              try { setDiscoverOpen(false); } catch {}
              try { setDiscoverPanel(null); } catch {}
              try { setDiscoverDoorOpen(false); } catch {}
              try { setDiscoverHeroZoom(false); } catch {}
              try {
                const map = mapRef.current;
                const cam = heroReturnCamRef.current;
                if (map && cam) {
                  try {} catch {}
                }
              } catch {}

              try {
                setTimeout(() => {
                  try {
                    const map = mapRef.current;
                    const st = (stClose as any) || heroReturnPopupRef.current;
                    if (!map || !st) return;



                    try {
                      const sid = String((st as any)?.props?.id ?? (st as any)?.fid ?? "");
                      for (const feat of fcRef.current.features) {
                        const id = String(feat.id ?? feat?.properties?.id ?? "");
                        try { feat.properties.selected = Boolean(sid) && id === sid; } catch {}
                      }
                      const src = getSource(map);
                      if (src) src.setData(fcRef.current);
                    } catch {}

                    try { if (popupRef.current) popupRef.current.remove(); } catch {}
                    try {
                      const selEl = document.createElement("div");
                      selEl.style.pointerEvents = "none";
                      selEl.style.filter = "drop-shadow(0 0 10px rgba(245,245,232,.28)) drop-shadow(0 0 18px rgba(114,138,74,.55))";
                      const propsSel = (st as any)?.props || {};
                      const kindSel = normalizeType(String((propsSel as any)?.kind ?? (propsSel as any)?.properties?.kind ?? (propsSel as any)?.feature?.properties?.kind ?? (propsSel as any)?.category ?? (propsSel as any)?.type ?? ""));
                      const palSel = palette();
                      const selColor = String((palSel as any)[kindSel] || (palSel as any).other || "#8C5A3C");
                      selEl.innerHTML = svgPin(selColor, "rgba(245,245,232,0.92)", true);
                      try { if (selectedPinMarkerRef.current) selectedPinMarkerRef.current.remove(); } catch {}
                      selectedPinMarkerRef.current = new maplibregl.Marker({ element: selEl, anchor: "bottom" } as any)
                        .setLngLat([Number((st as any).lng), Number((st as any).lat)])
                        .addTo(map);
                    } catch {}
                    popupRef.current = null;

                    let walkMins = null;
                    try {
                      const up = lastUserPosRef.current;
                      if (up && Number.isFinite(up.lng) && Number.isFinite(up.lat)) {
                        const meters = haversineMeters(Number(up.lat), Number(up.lng), Number((st as any).lat), Number((st as any).lng));
                        if (Number.isFinite(meters)) walkMins = meters / 83.3333333333;
                      }
                    } catch {}

                    const html = buildMiniPinPopupHtml((st as any).props, Boolean(darkMapRef.current), walkMins);
                    const el = document.createElement("div");
                    el.style.pointerEvents = "auto";
                    el.innerHTML = html;

                    const recenterMini = () => {
                      try {
                        const pr = el.getBoundingClientRect();
                        const vh = Math.max(1, Number(window.innerHeight || 0));
                        const marginTop = 16;
                        const marginBottom = 16;
                        let dy = 0;
                        if (pr.top < marginTop) dy = pr.top - marginTop;
                        else if (pr.bottom > vh - marginBottom) dy = pr.bottom - (vh - marginBottom);
                        if (Math.abs(dy) < 1) return;
                        map.panBy([0, dy] as any, {
                          duration: 220,
                          essential: true
                        } as any);
                      } catch {}
                    };

                    try { bindFavButton(el); } catch {}

                    try {
                      const pb = el.querySelector("[data-phone=\"1\"]") as HTMLElement | null;
                      const setPhoneActive = (on: boolean) => {
                        try {
                          if (!pb) return;
                          if (on) {
                            (pb as any).style.boxShadow = "0 0 0 1px rgba(114,138,74,.65), 0 10px 22px rgba(0,0,0,0.26), 0 0 18px rgba(114,138,74,.50)";
                            (pb as any).style.background = "rgba(114,138,74,.20)";
                            (pb as any).style.borderColor = "rgba(114,138,74,.70)";
                          } else {
                            (pb as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)";
                            (pb as any).style.background = "rgba(0,0,0,0.14)";
                            (pb as any).style.borderColor = "rgba(255,255,255,0.30)";
                          }
                        } catch {}
                      };
                      if (pb) {
                        pb.addEventListener("click", (ev: any) => {
                          try { ev.preventDefault(); ev.stopPropagation(); } catch {}
                  try { const n1 = el.querySelector("[data-addr-panel=\"1\"]"); if (n1 && n1.parentNode) n1.parentNode.removeChild(n1); } catch {}
                  try { const ab0 = el.querySelector("[data-addr=\"1\"]"); if (ab0) { (ab0 as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)"; (ab0 as any).style.background = "rgba(0,0,0,0.14)"; (ab0 as any).style.borderColor = "rgba(255,255,255,0.30)"; } } catch {}
                  try { const n2 = el.querySelector("[data-hours-panel=\"1\"]"); if (n2 && n2.parentNode) n2.parentNode.removeChild(n2); } catch {}
                  try { const hb0 = el.querySelector("[data-hours=\"1\"]"); if (hb0) { (hb0 as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)"; (hb0 as any).style.background = "rgba(0,0,0,0.14)"; (hb0 as any).style.borderColor = "rgba(255,255,255,0.30)"; } } catch {}
                          try {
                            const dial = String((pb as any).getAttribute("data-tel") || "").trim();
                            let panel = el.querySelector("[data-phone-panel=\"1\"]") as HTMLDivElement | null;
                            if (!panel) {
                              panel = document.createElement("div");
                              panel.setAttribute("data-phone-panel","1");
                              panel.style.position = "absolute";
                              panel.style.left = "50%";
                              panel.style.top = "100%";
                              panel.style.width = "260px";
                              panel.style.maxWidth = "260px";
                              panel.style.transform = "translateX(-50%) translateY(8px)";
                              panel.style.zIndex = "3";
                              panel.style.padding = "10px 10px";
                              panel.style.background = "rgba(31,31,24,0.78)";
                              panel.style.border = "1px solid rgba(245,245,232,.14)";
                              panel.style.borderRadius = "16px 6px 16px 6px";
                              panel.style.boxShadow = "0 10px 22px rgba(0,0,0,0.26)";
                              panel.style.backdropFilter = "blur(10px)";
                              (panel.style as any).webkitBackdropFilter = "blur(10px)";
                              panel.style.color = "rgba(245,245,232,.92)";
                              panel.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
                              panel.style.fontSize = "12px";
                              panel.style.lineHeight = "18px";
                              panel.style.letterSpacing = ".02em";
                              panel.style.display = "none";
                              el.appendChild(panel);
                            }
                            const cur = String((panel as any).style.display || "");
                            const next = (cur === "none" || cur === "") ? "block" : "none";
                            (panel as any).style.display = next;
                            try { setPhoneActive(next === "block"); } catch {}
                            try { setTimeout(recenterMini, 0); } catch {}
                            if (next !== "block") return;

                            if (!dial) {
                              try { setPhoneActive(true); } catch {}
                              panel.innerHTML =
                                "<div style=\"font-weight:800;letter-spacing:.02em;\" >" + ui("Téléphone","Phone") + "</div>" +
                                "<div style=\"margin-top:6px;opacity:.90;\" >" + ui("Téléphone inconnu","Phone unknown") + "</div>";
                              try { setTimeout(recenterMini, 0); } catch {}
                              return;
                            }

                            panel.innerHTML =
                              "<div style=\"font-weight:800;letter-spacing:.02em;\" >" + ui("Téléphone","Phone") + "</div>" +
                              "<div style=\"margin-top:6px;display:flex;align-items:center;justify-content:space-between;gap:10px;\" >" +
                                "<span style=\"opacity:.92;font-weight:700;\" >" + escapeHtml(dial) + "</span>" +
                                "<button data-phone-call=\"1\" style=\"flex:0 0 auto;padding:6px 10px;border-radius:10px 4px 10px 4px;background:rgba(0,0,0,0.18);border:1px solid rgba(255,255,255,0.26);color:rgba(245,245,232,.92);font-size:12px;font-weight:750;cursor:pointer;\" onclick=\"return false;\" >" + ui("Appeler","Call") + "</button>" +
                              "</div>";
                            try { setTimeout(recenterMini, 0); } catch {}

                            const cb = panel.querySelector("[data-phone-call=\"1\"]") as HTMLElement | null;
                            if (cb) {
                              cb.addEventListener("click", (ev2: any) => {
                                try { ev2.preventDefault(); ev2.stopPropagation(); } catch {}
                                try { window.location.href = "tel:" + dial; } catch {}
                              });
                            }
                          } catch {}
                        });
                      }
                      const sb = el.querySelector("[data-site=\"1\"]") as HTMLElement | null;
                      if (sb) {
                        sb.addEventListener("click", (ev: any) => {
                          try { ev.preventDefault(); ev.stopPropagation(); } catch {}
                          try {
                            let url = String(((st as any)?.props?.website ?? "")).trim();
                            if (!url) return;
                            if (!/^https?:\/\//i.test(url)) url = "https://" + url;
                            try { window.open(url, "_blank", "noopener,noreferrer"); }
                            catch { window.location.href = url; }
                          } catch {}
                        });
                      }

                      const rb = el.querySelector("[data-route=\"1\"]") as HTMLElement | null;
                      if (rb) {
                        rb.addEventListener("click", (ev: any) => {
                          try { ev.preventDefault(); ev.stopPropagation(); } catch {}
                          try { (rb as any)?.blur?.(); } catch {}
                          try {
                            const dlat = Number((st as any).lat);
                            const dlng = Number((st as any).lng);
                            if (!Number.isFinite(dlat) || !Number.isFinite(dlng)) return;
                            const ua = String((navigator as any)?.userAgent ?? "");
                            if (/iPhone|iPad|iPod/i.test(ua)) {
                              window.location.href = "http://maps.apple.com/?daddr=" + dlat + "," + dlng;
                            } else {
                              window.location.href = "geo:" + dlat + "," + dlng + "?q=" + dlat + "," + dlng;
                            }
                          } catch {}
                        });
                      }

                      const ab = el.querySelector("[data-addr=\"1\"]") as HTMLElement | null;
                      const setAddrActive = (on: boolean) => {
                        try {
                          if (!ab) return;
                          if (on) {
                            (ab as any).style.boxShadow = "0 0 0 1px rgba(114,138,74,.65), 0 10px 22px rgba(0,0,0,0.26), 0 0 18px rgba(114,138,74,.50)";
                            (ab as any).style.background = "rgba(114,138,74,.20)";
                            (ab as any).style.borderColor = "rgba(114,138,74,.70)";
                          } else {
                            (ab as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)";
                            (ab as any).style.background = "rgba(0,0,0,0.14)";
                            (ab as any).style.borderColor = "rgba(255,255,255,0.30)";
                          }
                        } catch {}
                      };
                      if (ab) {
                        ab.addEventListener("click", (ev: any) => {
                          try { ev.preventDefault(); ev.stopPropagation(); } catch {}
                  try { const n1 = el.querySelector("[data-phone-panel=\"1\"]"); if (n1 && n1.parentNode) n1.parentNode.removeChild(n1); } catch {}
                  try { const pb0 = el.querySelector("[data-phone=\"1\"]"); if (pb0) { (pb0 as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)"; (pb0 as any).style.background = "rgba(0,0,0,0.14)"; (pb0 as any).style.borderColor = "rgba(255,255,255,0.30)"; } } catch {}
                  try { const n2 = el.querySelector("[data-hours-panel=\"1\"]"); if (n2 && n2.parentNode) n2.parentNode.removeChild(n2); } catch {}
                  try { const hb0 = el.querySelector("[data-hours=\"1\"]"); if (hb0) { (hb0 as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)"; (hb0 as any).style.background = "rgba(0,0,0,0.14)"; (hb0 as any).style.borderColor = "rgba(255,255,255,0.30)"; } } catch {}
                          try {
                            const addr = String(((st as any)?.props?.address ?? "")).trim();
                            let panel = el.querySelector("[data-addr-panel=\"1\"]") as HTMLDivElement | null;
                            if (!addr) {
                              if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
                              try { setAddrActive(false); } catch {}
                              return;
                            }
                            if (panel) {
                              const cur = String((panel as HTMLElement).style.display || "");
                              const showing = (cur === "none");
                              (panel as HTMLElement).style.display = showing ? "block" : "none";
                              try { setAddrActive(showing); } catch {}
                            try { setTimeout(recenterMini, 0); } catch {}
                              return;
                            }

                            panel = document.createElement("div");
                            panel.setAttribute("data-addr-panel","1");
                            panel.style.position = "absolute";
                    panel.style.left = "50%";
                    panel.style.top = "100%";
                    panel.style.width = "260px";
                    panel.style.maxWidth = "260px";
                    panel.style.transform = "translateX(-50%) translateY(8px)";
                    panel.style.zIndex = "3";
                            panel.style.padding = "10px 10px";
                            panel.style.background = "rgba(31,31,24,0.78)";
                            panel.style.border = "1px solid rgba(245,245,232,.14)";
                            panel.style.borderRadius = "16px 6px 16px 6px";
                            panel.style.boxShadow = "0 10px 22px rgba(0,0,0,0.26)";
                            panel.style.backdropFilter = "blur(10px)";
                            (panel.style as any).webkitBackdropFilter = "blur(10px)";
                            panel.style.color = "rgba(245,245,232,.92)";
                            panel.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
                            panel.style.fontSize = "12px";
                            panel.style.lineHeight = "18px";
                            panel.style.letterSpacing = ".02em";

                            const text = document.createElement("div");
                            text.textContent = addr;
                            text.style.whiteSpace = "pre-wrap";
                            (text.style as any).userSelect = "text";
                            (text.style as any).webkitUserSelect = "text";
                            panel.appendChild(text);

                            const row = document.createElement("div");
                            row.style.marginTop = "10px";
                            row.style.display = "flex";
                            row.style.alignItems = "center";
                            row.style.justifyContent = "space-between";
                            row.style.gap = "8px";

                            const mkBtn = (label: string) => {
                              const b = document.createElement("button");
                              b.textContent = label;
                              b.style.flex = "1";
                              b.style.padding = "7px 8px";
                              b.style.borderRadius = "12px 5px 12px 5px";
                              b.style.border = "1px solid rgba(245,245,232,.18)";
                              b.style.background = "rgba(0,0,0,0.14)";
                              b.style.color = "rgba(245,245,232,.92)";
                              b.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
                              b.style.fontSize = "12px";
                              b.style.letterSpacing = ".02em";
                              b.style.cursor = "pointer";
                              b.style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)";
                              return b;
                            };

                            const copyBtn = mkBtn(ui("Copier","Copy"));
                            copyBtn.addEventListener("click", async (e2: any) => {
                              try { e2.preventDefault(); e2.stopPropagation(); } catch {}
                              const prev = String((copyBtn as any)?.textContent ?? ui("Copier","Copy"));
                              const flash = (t: string) => {
                                try { (copyBtn as any).textContent = t; } catch {}
                                try { setTimeout(() => { try { (copyBtn as any).textContent = prev; } catch {} }, 1200); } catch {}
                              };
                              try {
                                const txt = String(addr || "");
                                if (!txt.trim()) { flash(ui("Erreur","Error")); return; }
                                const clip = (navigator as any)?.clipboard?.writeText;
                                if (clip) {
                                  try { await (navigator as any).clipboard.writeText(txt); flash(ui("Copié ✓","Copied ✓")); return; } catch {}
                                }
                                const ta = document.createElement("textarea");
                                ta.value = txt;
                                ta.setAttribute("readonly", "true");
                                ta.style.position = "fixed";
                                ta.style.left = "-9999px";
                                document.body.appendChild(ta);
                                ta.select();
                                let ok = false;
                                try { ok = !!document.execCommand("copy"); } catch {}
                                try { document.body.removeChild(ta); } catch {}
                                flash(ok ? ui("Copié ✓","Copied ✓") : ui("Erreur","Error"));
                              } catch {
                                flash(ui("Erreur","Error"));
                              }
                            });
const goBtn = mkBtn(ui("Itinéraire →","Directions →"));
                            goBtn.addEventListener("click", (e2: any) => {
                              try { e2.preventDefault(); e2.stopPropagation(); } catch {}
                              try {
                                const isIOS = /iPad|iPhone|iPod/.test(String((navigator as any)?.userAgent || ""));
                                const latN = Number((st as any).lat);
                                const lngN = Number((st as any).lng);
                                let url = "";
                                if (isIOS) {
                                  url = "http://maps.apple.com/?q=" + encodeURIComponent(addr);
                                } else if (Number.isFinite(latN) && Number.isFinite(lngN)) {
                                  const dest = encodeURIComponent(String(latN) + "," + String(lngN));
                                  url = "https://www.google.com/maps/dir/?api=1&destination=" + dest;
                                } else {
                                  url = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(addr);
                                }
                                window.location.href = url;
                              } catch {}
                            });

                            row.appendChild(copyBtn);
                            row.appendChild(goBtn);
                            panel.appendChild(row);

                            el.appendChild(panel);
                            try { setAddrActive(true); } catch {}
                            try { setTimeout(recenterMini, 0); } catch {}
                      try { setTimeout(recenterMini, 0); } catch {}
                          } catch {}
                        });
                      }
                    } catch {}

                    try {
                      const btn = el.querySelector("[data-mini-close=\"1\"]") as HTMLElement | null;
                      if (btn) {
                        btn.addEventListener("click", (ev: any) => {
                          try { ev.preventDefault(); ev.stopPropagation(); } catch {}
                          try { popupRef.current?.remove(); } catch {}
                          try { if (selectedPinMarkerRef.current) selectedPinMarkerRef.current.remove(); } catch {}
                          selectedPinMarkerRef.current = null;
                          try { document.querySelectorAll(".im-globe-dim").forEach((n) => { try { (n as any)?.classList?.remove("im-globe-dim"); } catch {} }); } catch {}
                          try {
                            for (const feat of fcRef.current.features) {
                              try { feat.properties.selected = false; } catch {}
                            }
                            const src = getSource(map);
                            if (src) src.setData(fcRef.current);
                          } catch {}
                          popupRef.current = null;
                        });
                      }
                    } catch {}

                    try {
                      const hb = el.querySelector("[data-hours=\"1\"]") as HTMLElement | null;
                      const opening = String(((st as any)?.props?.openingHours ?? "")).trim();
                      const setHoursActive = (on: boolean) => {
                        try {
                          if (on) {
                            (hb as any).style.boxShadow = "0 0 0 1px rgba(114,138,74,.65), 0 10px 22px rgba(0,0,0,0.26), 0 0 18px rgba(114,138,74,.50)";
                            (hb as any).style.background = "rgba(114,138,74,.20)";
                            (hb as any).style.borderColor = "rgba(114,138,74,.70)";
                          } else {
                            (hb as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)";
                            (hb as any).style.background = "rgba(0,0,0,0.14)";
                            (hb as any).style.borderColor = "rgba(255,255,255,0.30)";
                          }
                        } catch {}
                      };

                      if (hb) {
                        hb.addEventListener("click", (ev: any) => {
                          try { ev.preventDefault(); ev.stopPropagation(); } catch {}
                  try { const n1 = el.querySelector("[data-phone-panel=\"1\"]"); if (n1 && n1.parentNode) n1.parentNode.removeChild(n1); } catch {}
                  try { const pb0 = el.querySelector("[data-phone=\"1\"]"); if (pb0) { (pb0 as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)"; (pb0 as any).style.background = "rgba(0,0,0,0.14)"; (pb0 as any).style.borderColor = "rgba(255,255,255,0.30)"; } } catch {}
                  try { const n2 = el.querySelector("[data-addr-panel=\"1\"]"); if (n2 && n2.parentNode) n2.parentNode.removeChild(n2); } catch {}
                  try { const ab0 = el.querySelector("[data-addr=\"1\"]"); if (ab0) { (ab0 as any).style.boxShadow = "0 6px 14px rgba(0,0,0,0.18)"; (ab0 as any).style.background = "rgba(0,0,0,0.14)"; (ab0 as any).style.borderColor = "rgba(255,255,255,0.30)"; } } catch {}
                          try {
                            let panel = el.querySelector("[data-hours-panel=\"1\"]") as HTMLDivElement | null;
                            if (!opening) {
                              if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
                              try { setHoursActive(false); } catch {}
                              return;
                            }
                            if (panel) {
                              const cur = String((panel as HTMLElement).style.display || "");
                              const showing = (cur === "none");
                              (panel as HTMLElement).style.display = showing ? "block" : "none";
                              try { setHoursActive(showing); } catch {}
                              return;
                            }
                            panel = document.createElement("div");
                            panel.setAttribute("data-hours-panel","1");
                            panel.style.position = "absolute";
                    panel.style.left = "50%";
                    panel.style.top = "100%";
                    panel.style.width = "260px";
                    panel.style.maxWidth = "260px";
                    panel.style.transform = "translateX(-50%) translateY(8px)";
                    panel.style.zIndex = "3";
                            panel.style.padding = "10px 10px";
                            panel.style.background = "rgba(31,31,24,0.78)";
                            panel.style.border = "1px solid rgba(245,245,232,.14)";
                            panel.style.borderRadius = "16px 6px 16px 6px";
                            panel.style.boxShadow = "0 10px 22px rgba(0,0,0,0.26)";
                            panel.style.backdropFilter = "blur(10px)";
                            (panel.style as any).webkitBackdropFilter = "blur(10px)";
                            panel.style.color = "rgba(245,245,232,.92)";
                            panel.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
                            panel.style.fontSize = "12px";
                            panel.style.lineHeight = "18px";
                            panel.style.letterSpacing = ".02em";
                            const parts = opening.split("\n").map(x => String(x||"").trim()).filter(Boolean);
                            panel.style.display = "flex";
                            panel.style.flexDirection = "column";
                            panel.style.gap = "6px";
                            for (const l of parts) {
                              const m = String(l || "").match(/^([A-Za-zÀ-ÿ]+)\s+(.*)$/);
                              if (m && m[1] && m[2]) {
                                const row = document.createElement("div");
                                row.style.display = "flex";
                                row.style.alignItems = "baseline";
                                row.style.gap = "10px";

                                const day = document.createElement("span");
                                day.textContent = (function(){const fr=String(m[1]||"").trim();const k=fr.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();if(k.startsWith("lun")) return ui("Lundi","Monday");if(k.startsWith("mar")) return ui("Mardi","Tuesday");if(k.startsWith("mer")) return ui("Mercredi","Wednesday");if(k.startsWith("jeu")) return ui("Jeudi","Thursday");if(k.startsWith("ven")) return ui("Vendredi","Friday");if(k.startsWith("sam")) return ui("Samedi","Saturday");if(k.startsWith("dim")) return ui("Dimanche","Sunday");return fr;})();
                                day.style.fontWeight = "750";
                                day.style.color = "rgba(245,245,232,.78)";
                                day.style.whiteSpace = "nowrap";
                                day.style.flex = "0 0 92px";

                                const hours = document.createElement("span");
                                hours.textContent = (function(){const fr=String(m[2]||"").trim();const k=fr.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();if(k==="ferme"||k.startsWith("ferme")) return ui("Fermé","Closed");return fr;})();
                                hours.style.fontWeight = "650";
                                hours.style.color = "rgba(245,245,232,.92)";
                                hours.style.textAlign = "right";
                                hours.style.whiteSpace = "normal";
                                (hours.style as any).overflowWrap = "anywhere";
                                (hours.style as any).wordBreak = "break-word";
                                hours.style.maxWidth = "150px";
                                hours.style.flex = "0 1 150px";

                                const leader = document.createElement("span");
                                leader.style.flex = "1";
                                leader.style.minWidth = "24px";
                                leader.style.borderBottom = "1px dotted rgba(245,245,232,.26)";
                                leader.style.transform = "translateY(-2px)";
                                leader.style.opacity = "0.9";

                                row.appendChild(day);
                                row.appendChild(leader);
                                row.appendChild(hours);
                                panel.appendChild(row);
                              } else {
                                const d = document.createElement("div");
                                d.textContent = l;
                                panel.appendChild(d);
                              }
                            }
                            el.appendChild(panel);
                            try { setHoursActive(true); } catch {}
                            } catch {}
                        });
                      }
                    } catch {}

                    try {
                      const db = el.querySelector("[data-discover=\"1\"]") as HTMLElement | null;
                      if (db) {
                        db.addEventListener("click", (ev: any) => {
                          try { ev.preventDefault(); ev.stopPropagation(); } catch {}
                          try { setSheetOpen(false); } catch {}
                          try { setSheetHtml(""); } catch {}
                          try { popupRef.current?.remove(); } catch {}
                          try { if (selectedPinMarkerRef.current) selectedPinMarkerRef.current.remove(); } catch {}
                          selectedPinMarkerRef.current = null;
                          try { document.querySelectorAll(".im-globe-dim").forEach((n) => { try { (n as any)?.classList?.remove("im-globe-dim"); } catch {} }); } catch {}
                          try {
                            const map2 = mapRef.current;
                            const st2 = heroReturnPopupRef.current;
                            if (!map2 || !st2) return;
                            const lng2 = Number((st2 as any).lng);
                            const lat2 = Number((st2 as any).lat);
                            const props2 = (st2 as any).props || {};
                            const fid2 = (st2 as any).fid ? String((st2 as any).fid) : null;
                            try { setDiscoverMeta({ id: String(props2?.id ?? fid2 ?? ""), name: String(props2?.name ?? props2?.title ?? "") }); } catch {}
                            try { heroReturnPopupRef.current = { lng: Number(lng2), lat: Number(lat2), props: props2, fid: fid2 }; } catch {}
                            try { setDiscoverPanel(null); } catch {}
                            try { setHeroUiHide(true); } catch {}
                            try {
                              try {
                                let hero2 = null as null | string;
                                try { hero2 = String(((props2 as any)?.panoramaImage ?? (props2 as any)?.properties?.panoramaImage ?? "") || ""); } catch {}
                                try { setDiscoverHeroUrl(hero2 && hero2.trim() ? hero2 : null); } catch {}
                                try { setDiscoverHeroOpen(false); } catch {}
                                try { window.dispatchEvent(new CustomEvent("im:hero", { detail: { open: true } })); } catch {}

                                try { setDiscoverHeroZoom(false); } catch {}
                                try { setDiscoverDoorOpen(false); } catch {}
                                try { setHeroUiHide(false); } catch {}
                                try { heroPanRef.current = 0.5; } catch {}
                                try { setDiscoverHeroPan(0.5); } catch {}
                                try { tableauPrevPRef.current = 0.5; } catch {}
                                try { heroHadMoveRef.current = false; } catch {}
                                try { setHeroHintOff(false); } catch {}
                                try { setDiscoverHeroOpen(true); } catch {}
                                try { window.dispatchEvent(new CustomEvent("im:hero", { detail: { open: true } })); } catch {}
                                try { setTimeout(() => { try { setDiscoverHeroZoom(true); } catch {} }, 30); } catch {}
                                try { setTimeout(() => { try { setDiscoverDoorOpen(true); } catch {} }, 220); } catch {}
                              } catch {}

                            } catch {}
                          } catch {}
                          popupRef.current = null;
                        });
                      }
                    } catch {}

                    try {
                      popupRef.current = new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -48] } as any)
                        .setLngLat([Number((st as any).lng), Number((st as any).lat)])
                        .addTo(map);
                      try { setTimeout(recenterMini, 0); } catch {}
                      try { setTimeout(recenterMini, 80); } catch {}
                      
                    } catch {}
                  } catch {}
                }, 260);
              } catch {}

              try { setDiscoverHeroOpen(false); } catch {}
              try { setDiscoverHeroUrl(null); } catch {}
              try { setHeroUiHide(false); } catch {}
            }}
          >
            <span style={{ display: "inline-block" }}>×</span>
          </button>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: discoverHeroUrl ? ("url('" + discoverHeroUrl + "')") : "none",
              backgroundSize: "auto 100%",
              backgroundRepeat: "no-repeat",
              backgroundPosition: (discoverHeroPan * 100).toFixed(1) + "% 50%",
              filter: discoverHeroZoom ? "saturate(1.05) contrast(1.05)" : "saturate(1.05) contrast(1.05) blur(10px)",
              transform: discoverHeroZoom ? "scale(1) translateY(0px)" : "scale(1.05) translateY(10px)",
              opacity: discoverHeroUrl ? 1 : 0,
              transition: "transform 450ms cubic-bezier(0.16, 1, 0.3, 1), filter 450ms ease",
              willChange: "transform, opacity"
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.00) 0%, rgba(0,0,0,0.10) 55%, rgba(0,0,0,0.62) 100%)" }}
          />
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute inset-0 pointer-events-none im-atmo"
              style={{
                opacity: discoverHeroZoom ? 0 : 1,
                transition: "opacity 900ms ease",
                willChange: "opacity"
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(120% 90% at 50% 10%, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 34%, rgba(0,0,0,0.00) 62%)," +
                  "linear-gradient(180deg, rgba(0,0,0,0.00) 0%, rgba(0,0,0,0.16) 58%, rgba(0,0,0,0.60) 100%)",
                opacity: discoverHeroZoom ? 0.34 : 0.85,
                transition: "opacity 900ms ease",
                willChange: "opacity"
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 180px rgba(0,0,0,0.46)",
                opacity: discoverHeroZoom ? 0.40 : 1,
                transition: "opacity 900ms ease",
                willChange: "opacity"
              }}
            />
          </div>
        </div>
      ) : null}

            {null}

</div>
  );

}
