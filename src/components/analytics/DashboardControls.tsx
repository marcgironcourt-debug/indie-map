"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FILTER_COOKIE, type Filters } from "@/lib/analytics/filters";

const tabs = [["summary", "Synthèse"], ["audience", "Utilisateurs & acquisition"], ["usage", "Usage"], ["places", "Lieux & professionnels"], ["quality", "Qualité des données"]];
const periods = [["today", "Aujourd’hui"], ["yesterday", "Hier"], ["7d", "7 jours"], ["30d", "30 jours"], ["all", "Depuis le début"], ["custom", "Dates personnalisées"]];

export default function DashboardControls({filters, label, basePath = "/indie-analytics-modern"}: {filters: Filters; label: string; basePath?: string}) {
  const router = useRouter();
  const preferenceString = JSON.stringify({view: filters.view, period: filters.period, from: filters.from, to: filters.to, traffic: filters.traffic, platform: filters.platform});
  useEffect(() => {
    // Save only navigation preferences. Never persist the private access token.
    document.cookie = `${FILTER_COOKIE}=${encodeURIComponent(preferenceString)}; Path=/; Max-Age=31536000; SameSite=Strict${location.protocol === "https:" ? "; Secure" : ""}`;
  }, [preferenceString]);
  useEffect(() => {
    let day = new Date().toISOString().slice(0, 10);
    const check = () => { const next = new Date().toISOString().slice(0, 10); if (next !== day) { day = next; router.refresh(); } };
    const timer = window.setInterval(check, 30_000);
    window.addEventListener("focus", check);
    return () => { clearInterval(timer); window.removeEventListener("focus", check); };
  }, [router]);
  function navigate(patch: Partial<Filters>) {
    const next = {...filters, ...patch};
    const query = new URLSearchParams(location.search);
    ["tab", "date", "scope", "section", "month", "year", "legacy", "userId", "sessionId"].forEach(k => query.delete(k));
    Object.entries(next).forEach(([key, value]) => value ? query.set(key, value) : query.delete(key));
    router.push(`${basePath}?${query}`);
  }
  const button = (active: boolean) => `rounded-xl px-3 py-2 text-sm font-medium transition ${active ? "bg-[#243d35] text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`;
  return <div className="space-y-4 print:hidden">
    <section aria-label="Filtres communs" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-2">{periods.map(([key, name]) => <button key={key} aria-pressed={filters.period === key} className={button(filters.period === key)} onClick={() => navigate({period: key})}>{name}</button>)}</div>
      {filters.period === "custom" && <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={e => {e.preventDefault(); const data = new FormData(e.currentTarget); navigate({from: String(data.get("from")), to: String(data.get("to"))});}}>
        <label className="text-sm">Du <input required aria-label="Début de période" className="ml-2 rounded-lg border p-2" type="date" name="from" key={`from-${filters.from}`} defaultValue={filters.from}/></label>
        <label className="text-sm">au <input required aria-label="Fin de période" className="ml-2 rounded-lg border p-2" type="date" name="to" key={`to-${filters.to}`} defaultValue={filters.to}/></label>
        <button className={button(true)}>Appliquer</button>
      </form>}
      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4">
        <p className="mr-auto text-sm font-semibold">{label} <span className="font-normal text-slate-500">· UTC</span></p>
        <label className="text-sm text-slate-600">Trafic <select aria-label="Trafic" className="ml-2 rounded-lg border p-2" value={filters.traffic} onChange={e => navigate({traffic: e.target.value})}><option value="external">Hors tests identifiés</option><option value="test">Tests identifiés</option><option value="all">Tout le trafic</option></select></label>
        <label className="text-sm text-slate-600">Appareil <select aria-label="Appareil" className="ml-2 rounded-lg border p-2" value={filters.platform} onChange={e => navigate({platform: e.target.value})}><option value="all">Tous</option><option value="ios">iOS</option><option value="android">Android</option><option value="web">Web / autres</option></select></label>
        <button onClick={() => router.refresh()} className="text-sm underline">Actualiser</button>
      </div>
      <p className="mt-2 text-xs text-slate-500">Choix mémorisés sur ce navigateur. « Aujourd’hui » avance automatiquement chaque jour. Le type d’appareil ne distingue pas encore navigateur mobile et application native.</p>
    </section>
    <nav aria-label="Rubriques" className="flex flex-wrap gap-2">{tabs.map(([key, name]) => <button aria-current={filters.view === key ? "page" : undefined} key={key} className={button(filters.view === key)} onClick={() => navigate({view: key, place: ""})}>{name}</button>)}</nav>
  </div>;
}

export function PrintReport() { return <button className="rounded-xl border px-4 py-2 text-sm print:hidden" onClick={() => window.print()}>Imprimer / enregistrer en PDF</button>; }
