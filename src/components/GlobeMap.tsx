"use client";

import React from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const TEXTILERIE_HERO_IMAGE = "/places/la-textilerie-hero.jpg";
const TEXTILERIE_PANORAMA_IMAGE = "/places/la-textilerie-panorama.png";
const STYLE_URL = "https://api.maptiler.com/maps/019bb307-227a-7b33-99f5-b835d4f4f4c9/style.json?key=AKnU2o4y6uQ0PxzEyFaU";

type Biz = {
  id: string;
  name: string;
  address?: string | null;
  website?: string | null;
  openingHours?: string | null;
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
  | "microbrasserie"
  | "other";

const BUSINESS_DESCRIPTIONS: Record<string, string> = {
  "Espace FLO": "Boutique-galerie qui réunit des créateurs locaux, loin du fast fashion, avec des pièces durables et fabriquées au Québec.",
  "Café Myriade": "Café de spécialité et lieu de rendez-vous chaleureux pour boire un bon café, bruncher et faire une pause en plein centre-ville.",
  "Automne Boulangerie": "Boulangerie de quartier qui travaille des farines de qualité pour des pains et viennoiseries faits avec soin.",
  "Sarrasin Boulangerie": "Boulangerie axée sur le sarrasin et les céréales anciennes, avec une approche artisanale et locale.",
  "Hof Kelsten": "Boulangerie emblématique de Montréal, connue pour ses pains généreux et sa cuisine d’inspiration européenne.",
};

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
    v.includes("fashion")
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
  if (v.includes("boutique locale") || v.includes("boutique")) return "boutique";
  return "other";
}


function getCategorySentence(type: string): string {
  const key = (type || "").toLowerCase();

  if (key.includes("café") || key.includes("cafe") || key.includes("brunch")) {
    return "Un endroit agréable pour s’arrêter, même quand on n’avait rien prévu.";
  }

  if (key.includes("épicerie") || key.includes("epicerie")) {
    return "Un commerce fiable, où l’on sait ce que l’on achète.";
  }

  if (key.includes("boulangerie")) {
    return "Une adresse de quartier où l’on revient sans y penser.";
  }

  if (key.includes("librairie") || key.includes("bouquinerie")) {
    return "Un lieu calme, propice à la découverte et à la curiosité.";
  }

  if (key.includes("restaurant")) {
    return "Une adresse simple, choisie pour manger tranquillement.";
  }

  if (key.includes("brasserie") || key.includes("bar") || key.includes("pub")) {
    return "Un lieu convivial, facile, où l’on peut rester plus longtemps que prévu.";
  }

  if (key.includes("vêtement") || key.includes("vetement") || key.includes("friperie")) {
    return "Un endroit pour trouver des vêtements sans se sentir pressé d’acheter.";
  }

  if (key.includes("boutique")) {
    return "Un commerce indépendant, avec une sélection qui change des grandes enseignes.";
  }

  return "Un lieu sélectionné pour sa pertinence dans le tissu local.";
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
    const ranges = [];

    for (const c of chunks) {
      const mm = c.match(/(\d{1,2}\s*(?:h|:)\s*\d{2})\s*[-–—]\s*(\d{1,2}\s*(?:h|:)\s*\d{2})/i);
      if (!mm) continue;
      const a = parseTimeToMinFR(mm[1].replace(/\s+/g,""));
      const b = parseTimeToMinFR(mm[2].replace(/\s+/g,""));
      if (a == null || b == null) continue;
      ranges.push([a, b]);
    }

    if (!byDay.has(day)) byDay.set(day, []);
    const cur = byDay.get(day);
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

  if (!known) {
    return { known: false, open: false, text: "Horaires inconnus", color: "rgba(245,245,232,.55)", dot: "rgba(245,245,232,.35)" };
  }

  return open
    ? { known: true, open: true, text: "Ouvert", color: kaki, dot: kaki }
    : { known: true, open: false, text: "Fermé", color: orange, dot: orange };
}


function buildMiniPinPopupHtml(props: any, dark: boolean, walkMins?: number | null) {
  const name = String(props?.name ?? props?.title ?? "").trim();
  const type = String(props?.type ?? "").trim();
  const id = String(props?.id ?? "").trim();
  const openingHoursRaw = String(props?.openingHours ?? "").trim();

  const lower = name.toLowerCase();
  const isTextilerie = id === "98ce3443-2512-4285-9b47-535d2a369cb4" || lower.includes("textilerie");

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
    epicerie: "#728A4A",
    friperie: cssVar("--violet", "#7c3aed"),
    librairie: "#3B82F6",
    restaurant: cssVar("--restaurant", "#ef4444"),
    boutique: "#000000",
    microbrasserie: cssVar("--micro", "#f59e0b"),
    other: "#8C5A3C",
  };

  const baseBorder = String(pal[kind] || "rgba(228,212,194,.18)").trim();
  const border = "color-mix(in srgb, " + baseBorder + " 22%, transparent)";
  const titleColor = "rgba(245,245,232,.92)";
  const textColor = "rgba(245,245,232,.78)";
  const metaColor = "rgba(245,245,232,.62)";
  const shadow = "0 10px 22px rgba(0,0,0,.20)";

  const heroUrl = "";
  const bgCss = heroUrl ? "rgba(31,31,24,0.10)" : bg;

  const badgesHtml = "";
const heroOverlay = heroUrl
    ? "<div style=\"position:absolute; inset:0; border-radius:14px; background-image:url('" + heroUrl + "'); background-size:cover; background-position:center; opacity:0.18; filter:saturate(2.0) contrast(1.05) brightness(1.18);\" ></div>" +
      "<div style=\"position:absolute; inset:0; border-radius:14px; background:rgba(0,0,0,0.04);\" ></div>"
    : "";

  const contentWrapStart = heroUrl
    ? "<div style=\"position:relative; padding:6px 8px; border-radius:10px; background:rgba(0,0,0,0.22); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);\" >"
    : "";
  const contentWrapEnd = heroUrl ? "</div>" : "";


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

      const tz =
        tzRaw ||
        (isTextilerie ? "Europe/Paris" : (/\bmontr(e|é)al\b/i.test(cityRaw) ? "America/Toronto" : /\bparis\b/i.test(cityRaw) ? "Europe/Paris" : ""));

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
    if (rest.toLowerCase().includes("fermé") || rest.toLowerCase().includes("ferme")) {
      return { label: "Fermé", color: CLOSED_COLOR };
    }

    const parts = rest.split(/\s*(?:,|\/|;)\s*/).map((x) => x.trim()).filter(Boolean);
    const parsed = parts
      .map((p) => {
        const m = p.match(/(\d{1,2})h(\d{2})\s*-\s*(\d{1,2})h(\d{2})/i);
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
            const m = p.match(/(\d{1,2})h(\d{2})\s*-\s*(\d{1,2})h(\d{2})/i);
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
      return { label: closesAt ? "Ouvert · ferme à " + closesAt : "Ouvert", color: OPEN_COLOR };
    }
    if (nextOpenAt) {
      return nextOpenOffset > 0
        ? { label: "Fermé · ouvre " + nextOpenDay + " à " + nextOpenAt, color: CLOSED_COLOR }
        : { label: "Fermé · ouvre à " + nextOpenAt, color: CLOSED_COLOR };
    }
    return { label: "Fermé", color: CLOSED_COLOR };
  })();

  const statusHtml = status
    ? "<span style=\"font-weight:800; color:" + status.color + ";\">" + status.label + "</span>"
    : "<span style=\"font-weight:700; color:" + metaColor + ";\">Horaires inconnus</span>";

  const wm = Number(walkMins);
  const walkTxt = Number.isFinite(wm) ? (String(Math.max(1, Math.round(wm))) + " min à pied") : "— min à pied";
  const walkHtml = "<span style=\"margin-left:14px; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:10.5px; letter-spacing:.02em; color:rgba(245,245,232,.88); font-weight:650;\" >" + "<span style=\"font-weight:800; margin:0 6px;\">·</span>" + walkTxt + "<span style=\"font-weight:800; margin-left:6px;\">·</span></span>";

  const closeHtml = "<button data-mini-close=\"1\" style=\"position:absolute; top:12px; right:12px; width:24px; height:24px; border-radius:999px; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.22); border:1px solid rgba(255,255,255,0.42); color:rgba(245,245,232,.92); font-size:16px; line-height:24px; cursor:pointer; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); box-shadow:0 0 0 1px rgba(255,255,255,0.22), 0 10px 22px rgba(0,0,0,.22);\" onclick=\"try{event.preventDefault();event.stopPropagation();}catch(e){} return false;\" aria-label=\"Fermer\" ><span style='display:inline-block; transform: translateY(-2px);'>×</span></button>";

  return (
    "<div style=\"position:relative; max-width:260px; min-height:190px; padding:10px 10px; background:" + bgCss + "; border:1px solid rgba(0,0,0,0); border-radius:14px; box-shadow:" + shadow + "; overflow:hidden; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);\" >" + closeHtml + "" + heroOverlay + contentWrapStart +
      "<div style=\"font-family: ui-serif, Georgia, Cambria, 'Times New Roman', serif; font-size:13.5px; font-weight:700; line-height:1.2; color:" + titleColor + "; letter-spacing:.02em; margin-bottom:12px;\" >" +
        escapeHtml(name || "Lieu") +
      "</div>" +
      (isTextilerie ? "<div style=\"margin-top:4px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;font-size:11.5px;line-height:1.4;color:" + textColor + ";opacity:.92;\" >Lieu hybride où déposer ses textiles, chiner des vêtements, acheter tissus et mercerie de réemploi, boire un café, consulter une bibliothèque textile et apprendre la couture.</div>" : "") +
       badgesHtml +
       "<div style=\"margin-top:8px; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:11.5px; line-height:1.35; color:" + textColor + ";\" >" +
         escapeHtml(sentence) +
      "</div>" +
      "<div style=\"margin-top:10px; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:10.5px; letter-spacing:.02em; color:" + metaColor + ";\" >" +
        statusHtml + walkHtml +
      "</div>" + contentWrapEnd + "<div style=\"margin-top:10px;\" >" + "<button data-discover=\"1\" style=\"display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;padding:2px 10px;border-radius:999px;background:transparent;border:1px solid rgba(255,255,255,0.30);color:rgba(245,245,232,.92);font-size:12px;letter-spacing:.02em;cursor:pointer;box-shadow:none;text-align:center;font-weight:600;\" onclick=\"try{event.preventDefault();event.stopPropagation();}catch(e){} return false;\" >Découvrir →</button>" + "</div>" + "<div style=\"position:absolute; left:50%; bottom:-10px; width:16px; height:10px; background:" + bg + "; clip-path: polygon(50% 100%, 0 0, 100% 0); transform: translateX(-50%); filter: drop-shadow(0 1px 0 " + border + ");\" ></div>" +
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
  const name = escapeHtml(nameRaw || "Lieu");
  const typeRaw = String(p?.type ?? "");
  const addressRaw = String(p?.address ?? "");
  const websiteRaw = String(p?.website ?? "");
  const openingHoursRaw = String(p?.openingHours ?? "");
  const latRaw = Number(p?.lat);
  const lngRaw = Number(p?.lng);

  const isFlo = nameRaw.trim().toLowerCase() === "espace flo";
  const isSuper = nameRaw.trim().toLowerCase() === "super condiments";
  const isRacines = nameRaw.trim().toLowerCase() === "racines boréales";
  const isPremium = isFlo || isSuper || isRacines;

  const premiumType = isFlo
    ? "mode, art, déco"
    : isSuper
    ? "épicerie, café, brunch et buvette"
    : "épicerie nordique";

  const premiumText = isFlo
    ? "La mission d’ESPACE FLO : faire rayonner le talent d’ici et valoriser l’achat local avec des produits éthiques et écoresponsables. À l’opposé du fast fashion et de la production de masse, ESPACE FLO propose une sélection de pièces durables, indémodables et fabriquées au Québec."
    : isSuper
    ? "Super Condiments, c’est une épicerie-café-buvette qui rassemble des produits locaux : fromages, farines, tartinades, pains, condiments et autres beaux produits du Québec. On y boit un café de microtorréfaction ou un jus frais, on mange des plats et sandwichs de saison, avec brunch le week-end et 5 à 7 autour de vins nature, bières de micro et autres breuvages d’ici."
    : "Racines Boréales remet le Nord au centre de l’assiette avec des produits forestiers et nordiques du Québec, transformés en condiments et ingrédients d’inspiration boréale. Qualité restaurant accessible à tout le monde, en circuit court, pour une cuisine locale, écologique et enracinée.";

  const desc = BUSINESS_DESCRIPTIONS[nameRaw] ? String(BUSINESS_DESCRIPTIONS[nameRaw]) : "";

  const websiteBtn = websiteRaw
    ? "<a href=\"" +
      escapeHtml(websiteRaw) +
      "\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"inline-flex items-center rounded-full bg-[#728A4A] px-3 py-1.5 text-[11px] font-semibold shadow-sm hover:opacity-95 transition\" style=\"color:#000000\">Site web</a>"
    : "";

  const addressBlock = addressRaw
    ? "<div class=\"mt-1\">" +
      "<a href=\"https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(addressRaw) +
      "\" data-addr=\"" +
        escapeHtml(addressRaw) +
      "\" onclick=\"(function(el){try{var raw=el.getAttribute('data-addr')||'';var q=encodeURIComponent(raw);var ua=navigator.userAgent||'';if(/iPhone|iPad|iPod/i.test(ua)){window.location.href='maps://?q='+q;}else{window.location.href='geo:0,0?q='+q;}}catch(e){} })(this);\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"text-[12px] underline font-medium\">" +
        escapeHtml(addressRaw) +
      "</a>" +
      "</div>"
    : "";

  const hoursBlock = openingHoursRaw
    ? "<details class=\"mt-2 text-[12px] leading-snug group\">" +
      "<summary class=\"cursor-pointer select-none font-semibold flex items-center gap-2\">" +
      "Horaires" +
      "<span class=\"text-red-600 inline-block transition-transform duration-200 group-open:rotate-90\">➤</span>" +
      "</summary>" +
      "<pre class=\"mt-1 whitespace-pre-wrap font-sans text-[12px]\">" +
      escapeHtml(openingHoursRaw) +
      "</pre>" +
      "</details>"
    : "<p class=\"mt-2 text-[12px]\">Horaires : voir le site</p>";

  const routeBlock = Number.isFinite(latRaw) && Number.isFinite(lngRaw)
    ? "<div class=\"mt-2\">" +
        "<a href=\"#\" data-route=\"1\" class=\"inline-flex items-center rounded-full bg-[#E4D4C2] px-3 py-[2px] text-[11px] font-semibold text-neutral-800 hover:opacity-90\">Itinéraire</a>" +
      "</div>"
    : "";

  const normalDesc = desc
    ? "<p class=\"mt-2 text-[12px] leading-snug\" style=\"color:hsl(var(--leaf))\">" + escapeHtml(desc) + "</p>"
    : "";

  const normalFooter =
    "<p class=\"mt-2 text-[12px] leading-snug\" style=\"color:hsl(var(--leaf))\">" +
    escapeHtml(getCategorySentence(typeRaw)) +
    "</p>";

  const websiteLink = websiteRaw
    ? "<div class=\"mt-2\"><a href=\"" +
      escapeHtml(websiteRaw) +
      "\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"text-[12px] underline font-semibold\" style=\"" +
      (darkMap ? "color:#ffd27a" : "color:#ffd27a") +
      "\">Site web</a></div>"
    : "";

  const premiumImages =
    (isFlo
      ? "<div class=\"mt-3\"><img src=\"/images/espace-flo-inside.jpg\" alt=\"Intérieur Espace FLO\" class=\"h-[140px] w-full rounded-2xl object-cover\" /></div>"
      : "") +
    (isRacines
      ? "<div class=\"mt-3\"><img src=\"/images/racines-boreales.jpg\" alt=\"Façade de Racines Boréales à Montréal\" class=\"h-[140px] w-full rounded-2xl object-cover\" /></div>"
      : "") +
    (isSuper
      ? "<div class=\"mt-3\"><img src=\"/images/super-condiments.jpg\" alt=\"Super Condiments à Montréal\" class=\"h-[140px] w-full rounded-2xl object-cover\" /></div>"
      : "");

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

  if (isPremium) {
    return (
      "<div class=\"space-y-2\">" +
        "<div class=\"flex items-start justify-between gap-3\">" +
          "<div class=\"min-w-0\">" +
            "<h3 class=\"font-semibold\" style=\"font-size:26px !important;line-height:1.08\">" + name + "</h3>" +
            "<div class=\"mt-1\"><span class=\"inline-flex items-center rounded-full bg-[#E4D4C2] px-3 py-[2px] text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-800\">" +
              escapeHtml(premiumType) +
            "</span></div>" +
          "</div>" +
          (websiteBtn ? "<div class=\"shrink-0\">" + websiteBtn + "</div>" : "") +
        "</div>" +
        (addressBlock ? addressBlock : "") +
        (routeBlock ? routeBlock : "") +
        hoursBlock +
        "<p class=\"mt-3 text-[13px] leading-snug\">" + escapeHtml(premiumText) + "</p>" +
        premiumImages +
      "</div>"
    );
  }

  return (
    "<div class=\"space-y-2\">" +
      "<h3 class=\"font-semibold\" style=\"font-size:26px !important;line-height:1.08\">" + name + "</h3>" +
      normalDesc +
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
}: {
  items?: Biz[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  darkMap?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<maplibregl.Map | null>(null);
  const geolocateElRef = React.useRef<HTMLDivElement | null>(null);
  const readyRef = React.useRef(false);

  const SOURCE_ID = "indie-places";
  const LAYER_ID = "indie-places-pin";
  const ROUTE_SOURCE_ID = "indie-route";
  const ROUTE_LAYER_ID = "indie-route-line";

  const fcRef = React.useRef<any>({ type: "FeatureCollection", features: [] });
  const popupRef = React.useRef<maplibregl.Popup | null>(null);
  const lastUserPosRef = React.useRef<{ lng: number; lat: number; ts: number } | null>(null);
    const [sheetOpen, setSheetOpen] = React.useState(false);
  const [sheetExpanded, setSheetExpanded] = React.useState(false);
  const [sheetHtml, setSheetHtml] = React.useState<string>("");
  const [discoverOpen, setDiscoverOpen] = React.useState(false);
  const [discoverHeroOpen, setDiscoverHeroOpen] = React.useState(false);

  React.useEffect(() => {
    try {
    } catch {}
  }, [discoverHeroOpen]);

  const [discoverHeroPan, setDiscoverHeroPan] = React.useState(0.5);
  const [discoverHeroZoom, setDiscoverHeroZoom] = React.useState(false);
  const [discoverHeroUrl, setDiscoverHeroUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    try { window.dispatchEvent(new CustomEvent("im:hero", { detail: { open: Boolean(discoverHeroOpen) } })); } catch {}
  }, [discoverHeroOpen]);
  const heroPanRef = React.useRef<number>(0.5);
  const heroDragRef = React.useRef<any>(null);
  const heroHadMoveRef = React.useRef(false);
  const heroHintRafRef = React.useRef<number | null>(null);
  const heroHintTimerRef = React.useRef<any>(null);
  const [heroHintOff, setHeroHintOff] = React.useState(false);

  const heroImgSizeRef = React.useRef<{ w: number; h: number } | null>(null);
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
  const isImmersiveSheet = React.useMemo(() => sheetHtml.includes(TEXTILERIE_HERO_IMAGE), [sheetHtml]);
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
        geolocateElRef.current.style.display = (sheetOpen || !!discoverHeroUrl) ? "none" : "block";
      }
    } catch {}
  }, [sheetOpen, discoverHeroUrl]);

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
      epicerie: "#728A4A",
      friperie: cssHslVar("--violet", "#7c3aed"),
      librairie: "#3B82F6",
      restaurant: cssHslVar("--restaurant", "#ef4444"),
      boutique: "#000000",
      microbrasserie: cssHslVar("--micro", "#f59e0b"),
      other: "#8C5A3C",
    } as Record<Kind, string>;
  }

  async function ensureImages(map: maplibregl.Map) {
    const stroke = "#FDF7F2";
    const pal = palette();
    const kinds: Kind[] = ["cafe","epicerie","friperie","librairie","restaurant","boutique","microbrasserie","other"];

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

    if (!map.getLayer(LAYER_ID)) {
      map.addLayer({
        id: LAYER_ID,
        type: "symbol",
        source: SOURCE_ID,
        layout: {
          "icon-image": [
            "case",
            ["boolean", ["get", "selected"], false],
            ["concat", "pin-", ["get", "kind"], "-sel"],
            ["concat", "pin-", ["get", "kind"]],
          ],
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

        if (isGlobe || z < 7.2) {
          try { heroReturnCamRef.current = { center: [lng, lat], zoom: 9.9, bearing: map.getBearing(), pitch: map.getPitch() }; } catch {}
          map.flyTo({ center: [lng, lat], zoom: 9.9, speed: 1.45, curve: 1.05, easing: (t) => t, essential: true });
          return;
        }

        if (fid && onSelectRef.current) onSelectRef.current(fid);

        try {
          for (const feat of fcRef.current.features) {
            const id = String(feat.id ?? feat?.properties?.id ?? "");
            feat.properties.selected = fid && id === fid;
          }
          const src = getSource(map);
          if (src) src.setData(fcRef.current);
        } catch {}
        const props = f?.properties || {};

        const openPopup = () => {
           try { (ref.current as any)?.classList?.add("im-globe-dim"); } catch {}
          try { setSheetOpen(false); } catch {}
          try { setSheetHtml(""); } catch {}
          try { if (popupRef.current) popupRef.current.remove(); } catch {}
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
            try {
              const btn = el.querySelector("[data-mini-close=\"1\"]");
              if (btn) {
                btn.addEventListener("click", (ev) => {
                  try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
                  try { popupRef.current?.remove(); } catch (e) {}
                  try { (ref.current as any)?.classList?.remove("im-globe-dim"); } catch (e) {}
                  popupRef.current = null;
                });
              }
            } catch {}
            try {
              const db = el.querySelector("[data-discover=\"1\"]");
              if (db) {
                db.addEventListener("click", (ev) => {
                  try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
                  try { setSheetOpen(false); } catch (e) {}
                  try { setSheetHtml(""); } catch (e) {}
                  try { setDiscoverMeta({ id: String(props?.id ?? fid ?? ""), name: String(props?.name ?? props?.title ?? "") }); } catch (e) {}
                  try { heroReturnPopupRef.current = { lng: Number(lng), lat: Number(lat), props, fid: fid ? String(fid) : null }; } catch (e) {}
                  try { setDiscoverPanel(null); } catch (e) {}
                  try {
                    const maxZ = (typeof window !== "undefined" && window.innerWidth < 768) ? 18 : 17;
                    map.flyTo({
                      center: [lng, lat],
                      zoom: maxZ,
                      speed: 0.62,
                      curve: 2.35,
                      easing: (t) => t * t * (3 - 2 * t),
                      essential: true
                    });
                    try {
                      const pid = String(props?.id ?? fid ?? "");
                      const pname = String(props?.name ?? props?.title ?? "");
                      let hero = null as null | string;
                      try {
                        if (
                          pid === "98ce3443-2512-4285-9b47-535d2a369cb4" ||
                          String(pname).trim().toLowerCase().includes("textilerie")
                        ) hero = String(TEXTILERIE_PANORAMA_IMAGE || "");
                      } catch {}
                      try { setDiscoverHeroUrl(hero && hero.trim() ? hero : null); } catch {}
                      try { setDiscoverHeroOpen(false); } catch {}
                   try { window.dispatchEvent(new CustomEvent("im:hero", { detail: { open: true } })); } catch {}

                      const onEnd = () => {
                         try { setDiscoverHeroZoom(false); } catch {}
                         try { setDiscoverDoorOpen(false); } catch {}
                         try { setDiscoverHeroOpen(true); } catch {}
                      try { window.dispatchEvent(new CustomEvent("im:hero", { detail: { open: true } })); } catch {}

                         try { setTimeout(() => { try { setDiscoverHeroZoom(true); } catch {} }, 80); } catch {}
                         try { setTimeout(() => { try { setDiscoverDoorOpen(true); } catch {} }, 520); } catch {}
                       };
                       try { map.once("moveend", onEnd); } catch {}
                    } catch {}
                  } catch (e) {}
                  try { popupRef.current?.remove(); } catch (e) {}
                  try { (ref.current as any)?.classList?.remove("im-globe-dim"); } catch (e) {}
                  popupRef.current = null;
                });
              }
            } catch {}
            popupRef.current = new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -32] } as any)
              .setLngLat([lng, lat])
              .addTo(map);
          } catch {}
        };

        const isTextilerie =
          String(props?.id ?? fid) === "98ce3443-2512-4285-9b47-535d2a369cb4" ||
          String(props?.name ?? props?.title ?? "").trim().toLowerCase().includes("textilerie");

        if (isTextilerie) {
          openPopup();
          try { map.easeTo({ center: [lng, lat], zoom: map.getZoom(), duration: 450, offset: [0, 160], essential: true }); } catch {}
return;
        }


        if (z < 7.2) {
          try { setSheetOpen(false); } catch {}
          try { setSheetHtml(""); } catch {}
          try { setSheetHeightNow(25); } catch {}
          try { onSelectRef.current?.(String((props as any).id)); } catch {}
          try { heroReturnCamRef.current = { center: [lng, lat], zoom: 8.8, bearing: map.getBearing(), pitch: map.getPitch() }; } catch {}
          map.flyTo({ center: [lng, lat], zoom: 8.8, speed: 0.9, curve: 1.2, essential: true });
          return;
        }
        openPopup();
        try { map.easeTo({ center: [lng, lat], zoom: map.getZoom(), duration: 450, offset: [0, 160], essential: true }); } catch {}
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
      const kind = normalizeType(b.type ?? null);

      const nameRaw = String(b.name ?? "");
      const lower = nameRaw.trim().toLowerCase();
      const isFlo = lower === "espace flo";
      const isSuper = lower === "super condiments";
      const isRacines = lower === "racines boréales";
      const isPremium = isFlo || isSuper || isRacines;

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
          lat: Number(b.lat),
          lng: Number(b.lng),
          kind,
          isPremium,
          selected: activeId != null && id === activeId,
        },
      });
    }

    fcRef.current = { type: "FeatureCollection", features };
  }

  React.useEffect(() => {
    if (!ref.current) return;

    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;


    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLE_URL,
      center: [0, 0],
      zoom: isMobile ? 1.4 : 2.4,
      minZoom: isMobile ? 1.4 : 2.4,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    


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
    c.style.marginRight = "12px";
    c.style.marginBottom = "92px";
    c.style.pointerEvents = "auto";
    c.innerHTML = `
      <button type="button" aria-label="Me localiser"
        style="
          height:33px;width:33px;border-radius:9999px;
          background:#5C6E3B;border:0;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 8px 20px rgba(0,0,0,.25);
            filter: drop-shadow(0 0 4px rgba(114,138,74,.45)) drop-shadow(0 0 1px rgba(114,138,74,.55));
            cursor:pointer;
        ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="transform: translate(-1px, -0.5px);"
          stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 2L11 13" />
          <path d="M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      </button>
    `;
    const btn = c.querySelector("button");
    if (btn) {
      btn.addEventListener("click", () => {
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
              try { this._map.flyTo({ center: [lng, lat], zoom: Math.max(this._map.getZoom(), 14), essential: true }); } catch {}
              try {
                const fn = (this as any)._updateConeFn;
                if (fn && bearing != null) fn(Number(lng), Number(lat), Number(bearing));
              } catch {}
            },
            () => {},
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
          );
        } catch {}
      });
    }
    this._container = c;
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

try { map.addControl(new GeolocateControl_ML(), "bottom-right"); } catch {}


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
        new Promise((resolve, reject) => {
          if (!navigator.geolocation) return reject(new Error("no geolocation"));
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos),
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        });

      let pos;
      try {
        pos = await getPos();
      } catch {
        try { alert("Localisation bloquée. Sur iPhone, ouvre Indie Map en HTTPS (pas http://192.168...). Autorise aussi la localisation dans Safari."); } catch {}
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

      map.setProjection({ type: "globe" } as any);

      try { map.dragPan.enable(); } catch {}
      try { map.dragRotate.disable(); } catch {}

      try { map.scrollZoom.enable({ around: "center" } as any); } catch {}
      try { map.doubleClickZoom.enable(); } catch {}
      try { map.boxZoom.disable(); } catch {}
      try { map.keyboard.disable(); } catch {}

      try { map.touchZoomRotate.enable({ around: "center" } as any); } catch {}

      attach();
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
    <div className="relative h-full w-full">
      <div ref={ref} className="h-full w-full" />
      <style>{`\
        .maplibregl-canvas{transition:filter 220ms ease;}\
        .im-globe-dim .maplibregl-canvas{filter: brightness(.48) saturate(.92) contrast(.98);}\
      `}</style>\
      
            {discoverHeroOpen ? (
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0 pointer-events-auto"
            style={{ background: "rgba(0,0,0,0.00)", touchAction: "none", cursor: "grab" }}
            onMouseDown={(e) => {
              try { e.preventDefault(); e.stopPropagation(); } catch {}
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
            aria-label="Fermer"
            className="absolute top-4 right-4 z-[80] pointer-events-auto"
            onClick={(e) => {
              try { e.preventDefault(); e.stopPropagation(); } catch {}
              try { window.dispatchEvent(new CustomEvent("im:hero", { detail: { open: false } })); } catch {}
              try { setDiscoverOpen(false); } catch {}
              try { setDiscoverPanel(null); } catch {}
              try { setDiscoverDoorOpen(false); } catch {}
              try { setDiscoverHeroZoom(false); } catch {}
              try {
                const map = mapRef.current;
                const cam = heroReturnCamRef.current;
                if (map && cam) {
                  map.easeTo({ center: cam.center as any, zoom: cam.zoom, bearing: cam.bearing, pitch: cam.pitch, duration: 1250, essential: true } as any);
                }
              } catch {}
              try {
                setTimeout(() => {
                  try {
                    const map = mapRef.current;
                    const st = heroReturnPopupRef.current;
                    if (!map || !st) return;
                    try { if (popupRef.current) popupRef.current.remove(); } catch {}
                    popupRef.current = null;
                    let walkMins = null;
                    try {
                      const up = lastUserPosRef.current;
                      if (up && Number.isFinite(up.lng) && Number.isFinite(up.lat)) {
                        const meters = haversineMeters(Number(up.lat), Number(up.lng), Number(st.lat), Number(st.lng));
                        if (Number.isFinite(meters)) walkMins = meters / 83.3333333333;
                      }
                    } catch {}
                    const html = buildMiniPinPopupHtml(st.props, Boolean(darkMapRef.current), walkMins);
                    const el = document.createElement("div");
                    el.style.pointerEvents = "auto";
                    el.innerHTML = html;
                    try {
                      const btn = el.querySelector("[data-mini-close=\"1\"]");
                      if (btn) {
                        btn.addEventListener("click", (ev) => {
                          try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
                          try { popupRef.current?.remove(); } catch (e) {}
                  try { (ref.current as any)?.classList?.remove("im-globe-dim"); } catch (e) {}
                          popupRef.current = null;
                        });
                      }
                    } catch {}
                    try {
                      const db = el.querySelector("[data-discover=\"1\"]");
                      if (db) {
                        db.addEventListener("click", (ev) => {
                          try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
                        });
                      }
                    } catch {}
                    popupRef.current = new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -32] } as any)
                      .setLngLat([Number(st.lng), Number(st.lat)])
                      .addTo(map);
                  } catch {}
                }, 260);
              } catch {}
              try {
                setTimeout(() => {
                  try { setDiscoverHeroOpen(false); } catch {}
                  try { setDiscoverHeroUrl(null); } catch {}
                }, 920);
              } catch {}
            }}
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.30)",
              border: "1px solid rgba(255,255,255,0.26)",
              color: "rgba(245,245,232,0.92)",
              boxShadow: "0 10px 22px rgba(0,0,0,0.28)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              cursor: "pointer"
            }}
          >
            <span style={{ display: "inline-block", transform: "translateY(-1px)", fontSize: 18, lineHeight: "18px" }}>×</span>
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
              opacity: discoverHeroUrl ? (discoverHeroZoom ? 1 : 0) : 0,
              transition: "opacity 900ms ease, transform 900ms cubic-bezier(0.16, 1, 0.3, 1), filter 900ms ease",
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
