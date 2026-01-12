"use client";

import React from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const STYLE_URL = "https://api.maptiler.com/maps/019bb307-227a-7b33-99f5-b835d4f4f4c9/style.json?key=AKnU2o4y6uQ0PxzEyFaU";

export default function GlobeMap() {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!ref.current) return;

    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLE_URL,
      center: [0, 0],
      zoom: 1.6,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    map.on("load", () => {
      map.setProjection({ type: "globe" } as any);

      try { map.dragPan.enable(); } catch {}
      try { map.dragRotate.disable(); } catch {}

      try { map.scrollZoom.enable({ around: "center" } as any); } catch {}
      try { map.doubleClickZoom.enable(); } catch {}
      try { map.boxZoom.disable(); } catch {}
      try { map.keyboard.disable(); } catch {}

      try { map.touchZoomRotate.enable({ around: "center" } as any); } catch {}
    });

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "bottom-right"
    );

    return () => map.remove();
  }, []);

  return <div ref={ref} className="h-full w-full" />;
}
