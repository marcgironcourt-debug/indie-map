"use client";

import { useEffect, useState } from "react";
import type { Business } from "../lib/types";

export function useBusinesses() {
  const [data, setData] = useState<Business[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/businesses", { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const json = (await res.json()) as Business[];
        if (alive) setData(json);
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Erreur inconnue");
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, []);

  return { data, loading, error };
}
