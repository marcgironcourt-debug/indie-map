"use client";

import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="min-h-[100dvh] bg-neutral-950 text-neutral-50 flex flex-col">
      <header className="border-b border-neutral-800 px-5 py-4">
        <h1 className="text-xl font-semibold">À propos d’Indie Map</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Une carte pour mettre en avant les lieux locaux, éthiques et indépendants.
        </p>
      </header>

      <section className="flex-1 px-5 py-5 max-w-3xl w-full mx-auto text-sm leading-relaxed space-y-4">
        <p>
          Indie Map est une carte sélective qui met en avant des cafés, épiceries,
          friperies, librairies, restaurants, boulangeries et lieux d’intérêt
          qui ont un vrai engagement local et écoresponsable.
        </p>
        <p>
          L’idée est simple&nbsp;: aider les gens à soutenir concrètement les
          commerces et lieux qui font attention à leurs employés, à leurs
          matières premières et à leur impact, plutôt que d’alimenter encore
          plus les grandes chaînes et la consommation jetable.
        </p>
        <p>
          La sélection est volontairement limitée. Chaque lieu est choisi à la
          main, en fonction de critères de cohérence avec ces valeurs
          (qualité, transparence, démarche locale ou circulaire, respect des
          personnes, etc.).
        </p>
        <p>
          Le but final est double&nbsp;: rendre la vie quotidienne plus simple
          pour celles et ceux qui veulent consommer autrement, et apporter plus
          de clients réguliers aux entreprises qui vont dans ce sens.
        </p>
      </section>

      <footer className="border-t border-neutral-800 px-5 py-3">
        <Link href="/" className="text-sm text-neutral-200 underline">
          ← Retour à la carte
        </Link>
      </footer>
    </main>
  );
}
