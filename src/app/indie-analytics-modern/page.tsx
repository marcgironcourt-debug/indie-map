import fs from "node:fs";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import DashboardControls, {PrintReport} from "@/components/analytics/DashboardControls";
import { FILTER_COOKIE, resolveFilters, periodRange, type Query, type Filters } from "@/lib/analytics/filters";
import { loadDashboard, EVENT_NAMES } from "@/lib/analytics/dashboard";

export const dynamic = "force-dynamic";
const number = (n: number) => n.toLocaleString("fr-FR");
function Panel({title, children}: {title: string; children: ReactNode}) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-semibold">{title}</h2>{children}</section>;
}
function Card({title, value, hint, before}: {title: string; value: number; hint: string; before?: number}) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-600">{title}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{number(value)}</p><p className="mt-2 text-xs leading-relaxed text-slate-500">{hint}</p>{before !== undefined && <p className="mt-2 text-xs text-slate-600">Précédemment : {number(before)} · écart {value - before > 0 ? "+" : ""}{number(value - before)}</p>}</div>;
}
const empty = <p className="py-6 text-sm text-slate-500">Aucune donnée enregistrée pour cette sélection.</p>;

export default async function DashboardPage({searchParams}: {searchParams?: Promise<Query> | Query}) {
  const query = await searchParams ?? {};
  const token = typeof query.token === "string" ? query.token : "";
  const secret = process.env.INDIE_ANALYTICS_TOKEN ?? "";
  const authorized = secret.length > 0 && Buffer.byteLength(token) === Buffer.byteLength(secret) && timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  if (!authorized) return <main className="grid min-h-screen place-items-center bg-[#f4f5f1] p-8"><div><h1 className="text-2xl font-semibold">Dashboard privé · accès refusé</h1><p>Utilise ton lien d’accès autorisé.</p></div></main>;
  let saved: Partial<Filters> = {};
  try { const value = (await cookies()).get(FILTER_COOKIE)?.value; if (value) saved = JSON.parse(decodeURIComponent(value)); } catch { /* Invalid preferences fall back to defaults. */ }
  const now = new Date();
  const filters = resolveFilters(query, saved && typeof saved === "object" ? saved : {}, now);
  const href = (patch: Partial<Filters>) => `/indie-analytics-modern?${new URLSearchParams({...filters, ...patch, token})}`;
  let data: Awaited<ReturnType<typeof loadDashboard>> | null = null;
  try { data = await loadDashboard(filters, now); } catch { console.error("Indie analytics: dashboard query failed"); }
  const names = new Map<string, {name: string; city?: string}>();
  let catalogueAvailable = true;
  try { const rows: {id: string; name: string; city?: string}[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/places.json"), "utf8")); for (const row of rows) names.set(row.id, row); } catch { catalogueAvailable = false; }
  const range = data?.range ?? periodRange(filters, now);
  const selectedPlace = data?.places.find(p => p.placeId === filters.place);
  const sourceNames: Record<string,string> = {recent_additions: "Ajouts récents", recent_additions_all: "Tous les ajouts récents", mini_window: "Mini-fenêtre carte", discovery_of_day: "Découverte du jour", search_result: "Recherche", shared_list: "Liste partagée", unknown: "Origine non renseignée"};
  return <main className="h-screen overflow-y-auto bg-[#f4f5f1] p-4 text-slate-900 md:p-8 print:h-auto print:overflow-visible print:bg-white">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-[#426252]">Indie Map · pilotage privé</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Comprendre, puis améliorer.</h1><p className="mt-2 text-sm text-slate-500">Un seul périmètre pour lire l’activité, les usages et les résultats des lieux.</p></div><p className="text-xs text-slate-500">Lecture du {now.toLocaleString("fr-FR", {timeZone:"UTC"})} UTC</p></header>
      <DashboardControls filters={filters} label={range.label} basePath="/indie-analytics-modern"/>
      {!data ? <Panel title="Les données n’ont pas pu être chargées"><p>Les compteurs sont indisponibles, pas à zéro. Réessaie avec le bouton Actualiser.</p></Panel> : <>
        {filters.view === "summary" && <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card title="Visiteurs suivis ayant interagi" value={data.current.actors} before={data.previous?.actors} hint="Comptes distincts + identifiants anonymes ; estimation, pas un nombre certain de personnes."/>
            <Card title="Fiches consultées" value={data.current.views} before={data.previous?.views} hint="Nombre d’ouvertures de fiches, répétitions comprises."/>
            <Card title="Recherches IA" value={data.current.searches} before={data.previous?.searches} hint="Actions de recherche enregistrées."/>
            <Card title="Intentions de contact ou de visite" value={data.current.intent} before={data.previous?.intent} hint="Clics site, téléphone et itinéraire. Aucune visite physique prouvée."/>
          </div>
          <p className="text-xs text-slate-500">Comparaison avec la fenêtre précédente de même durée, à heure égale pour une période en cours. Aucun pourcentage extrapolé à partir de petits volumes.</p>
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Ce qui est utilisé">{data.types.length ? <ul className="space-y-3">{data.types.slice(0,6).map(row => <li className="flex justify-between gap-4 text-sm" key={row.eventType}><span>{EVENT_NAMES[row.eventType] ?? row.eventType}</span><strong>{number(row.count)}</strong></li>)}</ul> : empty}<a className="mt-4 inline-block text-sm underline" href={href({view:"usage"})}>Voir tous les usages →</a></Panel>
            <Panel title="À interpréter avec attention"><ul className="space-y-3 text-sm leading-relaxed text-slate-600"><li>Les téléchargements Apple et Google ne sont pas encore importés. Ils ne sont pas remplacés par les identifiants du navigateur.</li><li>Le filtre hors tests exclut uniquement les tests identifiés. Il ne garantit pas l’absence de robots ou de tests personnels.</li><li>Les comptes et appareils peuvent se recouper. Une connexion en cours de navigation peut produire deux identités de suivi.</li></ul><a className="mt-4 inline-block text-sm underline" href={href({view:"quality"})}>Vérifier les définitions →</a></Panel>
          </div>
          <Panel title="Lieux les plus consultés">{data.places.length ? <div className="space-y-3">{data.places.slice(0,5).map(row => <a key={row.placeId} className="flex justify-between gap-4 rounded-xl bg-slate-50 p-3 text-sm" href={href({view:"places",place:row.placeId})}><span>{names.get(row.placeId)?.name ?? row.placeId}</span><strong>{row.views} consultations →</strong></a>)}</div> : empty}</Panel>
        </>}
        {filters.view === "audience" && <>
          <div className="grid gap-4 md:grid-cols-2"><Card title="Comptes ayant interagi" value={data.trackedAccounts} hint="Comptes connectés avec au moins une action dans la période ; ce ne sont pas de nouvelles inscriptions."/><Card title="Visiteurs suivis ayant interagi" value={data.current.actors} hint="Identités dédupliquées dans la période, avec les limites du suivi anonyme."/></div>
          <div className="grid gap-6 lg:grid-cols-2"><Panel title="Activité par jour · UTC"><p className="mb-3 text-xs text-slate-500">Jours avec activité, 90 derniers jours renseignés au maximum. Ne pas additionner les visiteurs pour obtenir un total unique.</p>{data.trend.length ? <div className="max-h-96 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Date</th><th>Visiteurs suivis</th><th>Actions</th></tr></thead><tbody>{data.trend.map(row => <tr className="border-t" key={row.day}><td className="p-2">{row.day}</td><td>{row.actors}</td><td>{row.actions}</td></tr>)}</tbody></table></div> : empty}</Panel><Panel title="Appareils et données manquantes"><ul className="space-y-3 text-sm">{data.devices.map(row => <li className="flex justify-between" key={row.platform}><span>{row.platform}</span><strong>{row.actors} identités suivies</strong></li>)}</ul><p className="mt-5 text-sm text-slate-500">Acquisition par campagne, premiers téléchargements et rétention à 7/30 jours : non calculés dans cette version. Aucun taux n’est inventé. iOS et Android incluent potentiellement leurs navigateurs web.</p></Panel></div>
        </>}
        {filters.view === "usage" && <div className="grid gap-6 lg:grid-cols-2"><Panel title="Actions et visiteurs distincts">{data.types.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Fonction</th><th className="p-2">Actions</th><th className="p-2">Visiteurs suivis</th></tr></thead><tbody>{data.types.map(row => <tr key={row.eventType} className="border-t"><td className="p-2">{EVENT_NAMES[row.eventType] ?? row.eventType}</td><td className="p-2">{row.count}</td><td className="p-2">{row.actors}</td></tr>)}</tbody></table></div> : empty}</Panel><Panel title="Ce qui conduit à une fiche">{data.sources.length ? <ul className="space-y-3 text-sm">{data.sources.map(row => <li className="flex justify-between gap-3" key={row.source}><span>{sourceNames[row.source] ?? row.source}</span><strong>{row.count}</strong></li>)}</ul> : empty}<p className="mt-5 text-xs text-slate-500">Origine dans l’application, pas canal publicitaire. Les abandons et recherches sans résultat restent à instrumenter de manière fiable.</p></Panel></div>}
        {filters.view === "places" && <>
          {filters.place ? <Panel title={`Journal de bord · ${names.get(filters.place)?.name ?? filters.place}`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><a className="text-sm underline print:hidden" href={href({place:""})}>← Tous les lieux</a><PrintReport/></div><p className="mb-4 text-sm text-slate-500">{range.label} · UTC · {filters.traffic === "all" ? "Tous trafics" : filters.traffic === "test" ? "Tests identifiés" : "Hors tests identifiés"} · appareil : {filters.platform}</p>
            {selectedPlace ? <div className="grid gap-3 sm:grid-cols-3"><Card title="Consultations" value={selectedPlace.views} hint="Ouvertures de fiche."/><Card title="Favoris ajoutés" value={selectedPlace.saves} hint="Actions d’ajout pendant la période."/><Card title="Intentions" value={selectedPlace.websites + selectedPlace.routes + selectedPlace.phones} hint="Site, téléphone et itinéraire ; pas des visites physiques."/></div> : empty}
            <p className="my-4 text-sm text-slate-500">Journal agrégé sans identité ni position individuelle. 200 lignes quotidiennes au maximum, les plus récentes d’abord. Les opérations commerciales ne sont pas encore intégrées à ce journal.</p>
            <table className="w-full text-left text-sm"><thead><tr><th className="p-2">Date UTC</th><th>Activité</th><th>Nombre</th></tr></thead><tbody>{data.journal.map(row => <tr className="border-t" key={`${row.day}-${row.eventType}`}><td className="p-2">{row.day}</td><td>{EVENT_NAMES[row.eventType] ?? row.eventType}</td><td>{row.count}</td></tr>)}</tbody></table>
          </Panel> : <Panel title="Résultats par lieu"><p className="mb-4 text-sm text-slate-500">Clique sur un lieu pour ouvrir son bilan et son journal. Les impressions mesurées sont celles des résultats de recherche, pas toutes les apparitions sur la carte.</p>{!catalogueAvailable && <p>Catalogue indisponible : les identifiants remplacent temporairement les noms.</p>}{data.places.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Lieu", "Fiches", "Favoris", "Listes", "Site", "Itinéraire", "Téléphone", "Impressions recherche"].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{data.places.map(row => <tr className="border-t" key={row.placeId}><td className="p-3"><a className="font-medium underline" href={href({place:row.placeId})}>{names.get(row.placeId)?.name ?? row.placeId}</a><p className="text-xs text-slate-500">{names.get(row.placeId)?.city}</p></td>{[row.views,row.saves,row.lists,row.websites,row.routes,row.phones,row.impressions].map((n,i) => <td className="p-3" key={i}>{n}</td>)}</tr>)}</tbody></table></div> : empty}</Panel>}
          <Panel title="Espace professionnel · état actuel, hors filtres de période et d’appareil"><p className="mb-4 text-sm text-slate-500">Plans enregistrés dans la base : ils ne prouvent ni facturation ni paiement. Revenus et statut payé/gratuit : indisponibles sans rapprochement avec les paiements.</p>{data.professionalPlans.length ? <ul className="space-y-2 text-sm">{data.professionalPlans.map(row => <li key={`${row.plan}-${row.accessStatus}`}>{row.plan || "Plan non renseigné"} · accès {row.accessStatus} : <strong>{row._count._all} établissement(s)</strong></li>)}</ul> : <p className="text-sm">Aucun espace professionnel enregistré.</p>}</Panel>
        </>}
        {filters.view === "quality" && <>
          <Panel title="Lire correctement les chiffres"><dl className="space-y-4 text-sm leading-relaxed">{[
            ["Visiteur suivi", "Une identité de compte si elle est connue lors de l’action, sinon un identifiant de navigateur. Pas une personne certifiée unique."],
            ["Période", "Toutes les actions de ces vues sont filtrées sur leur horodatage en UTC. Les anciens détails utilisent parfois la date locale du visiteur ; leurs résultats peuvent donc différer."],
            ["Hors tests identifiés", "Exclut uniquement les identifiants classés test. Les événements sans installation associée sont classés external par compatibilité avec l’ancien suivi."],
            ["Appareil", "Classification iOS, Android ou web : le suivi actuel ne prouve pas que l’application native a été utilisée."],
            ["Intention de visite", "Un clic vers le site, le téléphone ou l’itinéraire. Aucun de ces signaux ne prouve une visite ou une vente."],
            ["Données commerciales", "Un plan ou une demande de promotion ne constitue pas une preuve de paiement. Pas de chiffre d’affaires déduit de ces champs."],
          ].map(([term, text]) => <div key={term}><dt className="font-semibold">{term}</dt><dd className="mt-1 text-slate-600">{text}</dd></div>)}</dl></Panel>
          <Card title="Actions sans identité exploitable" value={data.current.unknown} hint="Incluses dans les actions, exclues du nombre de visiteurs suivis."/>
          <Panel title="À compléter avant un prévisionnel fiable"><p className="text-sm leading-relaxed text-slate-600">Import des stores, distinction native/web, exclusion des tests personnels, qualification du trafic suspect, rétention par cohortes, attribution des campagnes, erreurs de recherche et paiements réconciliés. Ces données sont manquantes, pas nulles.</p></Panel>
        </>}
      </>}
      <footer className="border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500 print:hidden">Tableau de bord privé. Aucun partage professionnel automatique. <a className="underline" href={`/indie-analytics?${new URLSearchParams({token,tab:"daily",date:now.toISOString().slice(0,10),traffic:filters.traffic,scope:"day"})}`}>Ouvrir les anciens détails techniques</a> · Les anciens détails ont leurs propres filtres ; tes préférences principales sont conservées.</footer>
    </div>
  </main>;
}
