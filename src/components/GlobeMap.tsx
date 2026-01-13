"use client";

import React from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

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

function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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


function buildPopupHtml(p: any, darkMap: boolean) {
  const _popupProps = p;
  const _lowerName = String((_popupProps as any)?.name ?? (_popupProps as any)?.title ?? "").trim().toLowerCase();
  const _textilerieImg = _lowerName.includes("textilerie") ? "<img src=\"/images/textilerie.webp\" alt=\"Textilerie\" class=\"mt-2 w-full rounded-xl object-cover\" />" : "";
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

  const wrapPremium =
    "space-y-2 max-w-xs rounded-[18px] px-3 pt-2 pb-4 shadow-md border " +
    (darkMap
      ? "bg-neutral-900 border-neutral-700 text-white"
      : "bg-white border-[#E4D4C2] text-neutral-900");

  const wrapNormal =
    "space-y-1 max-w-xs rounded-[14px] px-3 py-2 shadow-sm border " +
    (darkMap
      ? "bg-neutral-900 border-neutral-700 text-white"
      : "bg-white border-[#E4D4C2] text-neutral-900");

  const websitePremium = websiteRaw
    ? "<a href=\"" +
      escapeHtml(websiteRaw) +
      "\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"inline-flex items-center rounded-full bg-[#728A4A] px-2 py-1 text-[10px] font-semibold shadow-sm hover:bg-[#5C6E3B] transition\" style=\"color:#000000\">Site web</a>"
    : "";

  const addressBlock = addressRaw
    ? "<div class=\"mt-1\">" +
      "<a href=\"https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(addressRaw) +
      "\" data-addr=\"" +
        escapeHtml(addressRaw) +
      "\" onclick=\"(function(el){try{var raw=el.getAttribute('data-addr')||'';var q=encodeURIComponent(raw);var ua=navigator.userAgent||'';if(/iPhone|iPad|iPod/i.test(ua)){window.location.href='maps://?q='+q;}else{window.location.href='geo:0,0?q='+q;}}catch(e){} })(this);\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"" +
        (isPremium ? "text-[11px] underline font-medium" : "text-xs underline font-medium") +
      "\">" +
        escapeHtml(addressRaw) +
      "</a>" +
    "</div>"
    : "";

  const hoursBlock = openingHoursRaw
    ? "<details class=\"mt-1 text-[11px] leading-snug group\">" +
      "<summary class=\"cursor-pointer select-none font-medium flex items-center gap-1\">" +
      "Horaires" +
      "<span class=\"text-red-600 inline-block transition-transform duration-200 group-open:rotate-90\">➤</span>" +
      "</summary>" +
      "<pre class=\"mt-1 whitespace-pre-wrap font-sans\">" +
      escapeHtml(openingHoursRaw) +
      "</pre>" +
      "</details>"
    : "<p class=\"" + (isPremium ? "text-[10px]" : "text-xs") + "\">Horaires : voir le site</p>";

  const premiumImages =
    (isFlo
      ? "<div class=\"mt-2\"><div class=\"h-[120px] w-full rounded-md overflow-hidden border border-neutral-300 bg-neutral-200\"><img src=\"/images/espace-flo-inside.jpg\" alt=\"Intérieur Espace FLO\" class=\"h-full w-full object-cover\" /></div></div>"
      : "") +
    (isRacines
      ? "<div class=\"mt-2\"><div class=\"h-[120px] w-full rounded-md overflow-hidden border border-neutral-300 bg-neutral-200\"><img src=\"/images/racines-boreales.jpg\" alt=\"Façade de Racines Boréales à Montréal\" class=\"h-full w-full object-cover\" /></div></div>"
      : "") +
    (isSuper
      ? "<div class=\"mt-2\"><div class=\"h-[120px] w-full rounded-md overflow-hidden border border-neutral-300 bg-neutral-200\"><img src=\"/images/super-condiments.jpg\" alt=\"Super Condiments à Montréal\" class=\"h-full w-full object-cover\" /></div></div>"
      : "");

  const websiteNormal = websiteRaw
    ? "<a href=\"" +
      escapeHtml(websiteRaw) +
      "\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"" +
      ("inline-block text-xs underline " + (darkMap ? "text-amber-300" : "text-amber-700")) +
      "\">Site web</a>"
    : "";

  const routeBlock = Number.isFinite(latRaw) && Number.isFinite(lngRaw)
    ? "<div class=\"mt-1\">" +
        "<a href=\"#\" data-route=\"1\" class=\"inline-flex items-center rounded-full bg-[#E4D4C2] px-2 py-0.5 text-[10px] font-semibold text-neutral-800 hover:opacity-90\">Itinéraire</a>" +
      "</div>"
    : "";



  const normalDesc =
    desc
      ? "<p class=\"mt-0.5 text-[11px] leading-snug text-[hsl(var(--leaf))]\">" + escapeHtml(desc) + "</p>"
      : "";

  const normalFooter =
    "<p class=\"mt-1 text-[11px] leading-snug text-[hsl(var(--leaf))]\">" +
    escapeHtml(getCategorySentence(typeRaw)) +
    "</p>";

  if (isPremium) {
    return (
      "<div class=\"" + wrapPremium + "\">" +
        "<div class=\"flex flex-col gap-1.5\">" +
          "<div class=\"flex items-start justify-between gap-2\">" +
            "<div class=\"flex flex-col gap-1\">" +
              "<h3 class=\"text-[15px] font-semibold\">" + name + "</h3>" +
              "<div><span class=\"inline-flex items-center rounded-full bg-[#E4D4C2] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-800\">" +
                escapeHtml(premiumType) +
              "</span></div>" +
            "</div>" +
            websitePremium +
          "</div>" +
          (addressBlock ? addressBlock : "") +
          (routeBlock ? routeBlock : "") +
          hoursBlock +
        "</div>" +
        "<p class=\"mt-2 text-[11px] leading-snug\">" + escapeHtml(premiumText) + "</p>" +
        premiumImages +
      "</div>"
    );
  }

  return (
    "<div class=\"" + wrapNormal + "\">" +
      "<h3 class=\"font-semibold text-sm\">" + name + "</h3>" + _textilerieImg +
      normalDesc +
      (addressBlock ? addressBlock : "") +
      (routeBlock ? routeBlock : "") +
          hoursBlock +
      normalFooter +
      websiteNormal +
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
  const readyRef = React.useRef(false);

  const SOURCE_ID = "indie-places";
  const LAYER_ID = "indie-places-pin";
  const ROUTE_SOURCE_ID = "indie-route";
  const ROUTE_LAYER_ID = "indie-route-line";

  const fcRef = React.useRef<any>({ type: "FeatureCollection", features: [] });
  const popupRef = React.useRef<maplibregl.Popup | null>(null);

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
        if (fid && onSelectRef.current) onSelectRef.current(fid);

        const lng = coords[0];
        const lat = coords[1];

        try {
          for (const feat of fcRef.current.features) {
            const id = String(feat.id ?? feat?.properties?.id ?? "");
            feat.properties.selected = fid && id === fid;
          }
          const s = getSource(map);
          if (s) s.setData(fcRef.current);
        } catch {}

        
        const openPopup = () => {
          const props = f?.properties || {};

          if (popupRef.current) {
            try { popupRef.current.remove(); } catch {}
            popupRef.current = null;
          }

          popupRef.current = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: "320px" })
            .setLngLat([lng, lat])
            .setHTML(buildPopupHtml(props, Boolean(darkMap)))
            .addTo(map);

          try {
            const el = popupRef.current?.getElement();
            const btn = el?.querySelector('[data-route="1"]');
            if (btn) {
              const run = (ev: any) => {
                try { ev.preventDefault(); ev.stopPropagation(); } catch {}
                try {
                  const fn = (window as any).__indieRouteTo;
                  if (fn) fn(lng, lat);
                } catch {}
              };
              btn.addEventListener("click", run);
              btn.addEventListener("pointerup", run);
              btn.addEventListener("touchstart", run, { passive: false });
              btn.addEventListener("touchend", run, { passive: false });
            }
          } catch {}
        };

        const z = map.getZoom();
        if (z <= 3.2) {
          map.flyTo({ center: [lng, lat], zoom: 11, speed: 0.9, curve: 1.2, essential: true });
          map.once("moveend", () => {
            openPopup();
          });
        } else {
          openPopup();
        }

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

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "bottom-right"
    );

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

  return <div ref={ref} className="h-full w-full" />;
}
