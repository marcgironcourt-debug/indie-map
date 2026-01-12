"use client";

import React from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const MAPTILER_KEY = "TaeHpQ47CW5Dp3oU2kjl";

export default function GlobeMap() {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!ref.current) return;

    const map = new maplibregl.Map({
      container: ref.current,
      style: `https://api.maptiler.com/maps/streets-v4/style.json?key=${MAPTILER_KEY}`,
      center: [0, 20],
      zoom: 1.6,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    map.on("load", () => {
      map.setProjection({ type: "globe" } as any);

      try {
        (map as any).setFog({
          "horizon-blend": 0.35,
          "space-color": "rgb(12,12,16)",
          "star-intensity": 0.3,
        });
      } catch {}

      const style = map.getStyle();
      const layers = style?.layers || [];

      for (const layer of layers) {
        const id = (layer as any).id ? String((layer as any).id).toLowerCase() : "";
        const type = (layer as any).type ? String((layer as any).type).toLowerCase() : "";

        const isRoad =
          id.includes("road") ||
          id.includes("street") ||
          id.includes("highway") ||
          id.includes("bridge") ||
          id.includes("tunnel") ||
          id.includes("path") ||
          id.includes("rail");

        const isWater = id.includes("water") || id.includes("river") || id.includes("ocean") || id.includes("lake");
        const isLand = id.includes("land") || id.includes("background") || id.includes("landcover") || id.includes("park");
        const isBuilding = id.includes("building") || id.includes("house");
        const isLabel = id.includes("label") || id.includes("place") || id.includes("poi") || id.includes("name");

        if (type === "line" && isRoad) {
          try { map.setLayoutProperty((layer as any).id, "line-cap", "round"); } catch {}
          try { map.setLayoutProperty((layer as any).id, "line-join", "round"); } catch {}

          try {
            map.setPaintProperty((layer as any).id, "line-width", [
              "interpolate",
              ["linear"],
              ["zoom"],
              0, 0.2,
              3, 0.6,
              6, 1.8,
              9, 4.0,
              12, 7.0,
              15, 12.0
            ]);
          } catch {}

          try { map.setPaintProperty((layer as any).id, "line-opacity", 0.9); } catch {}

          try {
            map.setPaintProperty((layer as any).id, "line-color", [
              "case",
              ["==", ["get", "class"], "motorway"], "hsl(28, 90%, 60%)",
              ["==", ["get", "class"], "trunk"], "hsl(28, 85%, 58%)",
              ["==", ["get", "class"], "primary"], "hsl(28, 80%, 55%)",
              ["==", ["get", "class"], "secondary"], "hsl(35, 70%, 54%)",
              ["==", ["get", "class"], "tertiary"], "hsl(42, 65%, 52%)",
              "hsl(45, 20%, 82%)"
            ]);
          } catch {}

          try {
            map.setPaintProperty((layer as any).id, "line-blur", [
              "interpolate",
              ["linear"],
              ["zoom"],
              0, 0,
              8, 0.2,
              12, 0.6,
              16, 1.0
            ]);
          } catch {}
        }

        if (type === "fill" && isLand) {
          try { map.setPaintProperty((layer as any).id, "fill-color", "hsl(38, 25%, 92%)"); } catch {}
          try { map.setPaintProperty((layer as any).id, "fill-opacity", 1); } catch {}
        }

        if (type === "fill" && isWater) {
          try { map.setPaintProperty((layer as any).id, "fill-color", "hsl(205, 60%, 72%)"); } catch {}
          try { map.setPaintProperty((layer as any).id, "fill-opacity", 0.95); } catch {}
        }

        if (type === "line" && isWater) {
          try { map.setPaintProperty((layer as any).id, "line-color", "hsl(205, 55%, 62%)"); } catch {}
          try { map.setPaintProperty((layer as any).id, "line-width", ["interpolate", ["linear"], ["zoom"], 0, 0, 10, 0.6, 14, 1.2]); } catch {}
          try { map.setPaintProperty((layer as any).id, "line-opacity", 0.8); } catch {}
        }

        if (isBuilding && (type === "fill" || type === "fill-extrusion")) {
          try {
            map.setPaintProperty((layer as any).id, "fill-extrusion-height", [
              "interpolate",
              ["linear"],
              ["zoom"],
              12, ["coalesce", ["get", "height"], 6],
              16, ["*", ["coalesce", ["get", "height"], 10], 1.25]
            ]);
          } catch {}

          try { map.setPaintProperty((layer as any).id, "fill-extrusion-opacity", 0.75); } catch {}
          try { map.setPaintProperty((layer as any).id, "fill-extrusion-color", "hsl(30, 10%, 78%)"); } catch {}
        }

        if (type === "symbol" && isLabel) {
          try { map.setLayoutProperty((layer as any).id, "text-size", ["interpolate", ["linear"], ["zoom"], 3, 9, 10, 12, 14, 14]); } catch {}
          try { map.setPaintProperty((layer as any).id, "text-color", "hsl(20, 25%, 18%)"); } catch {}
          try { map.setPaintProperty((layer as any).id, "text-halo-color", "hsla(45, 30%, 96%, 0.95)"); } catch {}
          try { map.setPaintProperty((layer as any).id, "text-halo-width", 1.2); } catch {}
          try { map.setLayoutProperty((layer as any).id, "text-optional", true); } catch {}
          try { map.setLayoutProperty((layer as any).id, "text-allow-overlap", false); } catch {}
          if (id.includes("poi") || id.includes("transit") || id.includes("amenity")) {
            try { map.setLayoutProperty((layer as any).id, "visibility", "none"); } catch {}
          }
        }
      }
    });

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "bottom-right"
    );

    return () => {
      map.remove();
    };
  }, []);

  return <div ref={ref} className="h-full w-full" />;
}
