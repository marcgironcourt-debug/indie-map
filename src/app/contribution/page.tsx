"use client";

import Link from "next/link";

export default function ContributionPage() {
  return (
    <main className="min-h-[100dvh] bg-neutral-950 text-neutral-50 flex flex-col">
      <header className="border-b border-neutral-800 px-5 py-4">
        <h1 className="text-xl font-semibold">Contribution</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Indie Map avance grâce aux personnes qui partagent leurs lieux, leurs idées et leurs retours.
        </p>
      </header>

      <section className="flex-1 px-5 py-5 max-w-3xl w-full mx-auto text-sm leading-relaxed space-y-4">
        <p>
          Indie Map n&apos;est pas une carte figée. Elle évolue avec les villes, avec les commerces qui ouvrent,
          ceux qui ferment, ceux qui se transforment, et avec les personnes qui la consultent au quotidien.
        </p>

        <p>
          Tu peux contribuer de plusieurs façons&nbsp;: en proposant un lieu qui a du sens pour toi, en signalant
          une information à jour, en partageant une découverte, ou simplement en expliquant pourquoi un commerce
          mérite d&apos;être mieux connu. Chaque retour aide à garder la carte vivante, honnête et utile.
        </p>

        <p>
          L&apos;idée n&apos;est pas d&apos;avoir tous les lieux possibles, mais les bons lieux. Ceux qui respectent
          leurs équipes, leurs clients et leur environnement. Tes suggestions sont précieuses pour repérer ces endroits.
        </p>

        <p>
          À terme, un espace dédié permettra de proposer des commerces, de suivre l&apos;état des demandes et de voir
          comment ta contribution fait évoluer la carte. Pour l&apos;instant, ce bouton est symbolique&nbsp;: il rappelle
          que le projet se construit avec toi, pas seulement pour toi.
        </p>

        <div className="pt-2">
          <button
            type="button"
            className="inline-flex items-center rounded-full bg-neutral-50 px-4 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-200 transition"
          >
            Contribuer
          </button>
          <p className="mt-2 text-xs text-neutral-400">
            Ce bouton sera bientôt actif. L&apos;espace contribution arrive dans une prochaine version d&apos;Indie Map.
          </p>
        </div>
      </section>

      <footer className="border-t border-neutral-800 px-5 py-3">
        <Link href="/" className="text-sm text-neutral-200 underline">
          ← Retour à la carte
        </Link>
      </footer>
    </main>
  );
}
