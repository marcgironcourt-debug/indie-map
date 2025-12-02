"use client";

import Link from "next/link";

export default function ContributionPage() {
  return (
    <main className="min-h-[100dvh] bg-neutral-950 text-neutral-50 flex flex-col">
      <header className="border-b border-neutral-800 px-5 py-4">
        <h1 className="text-xl font-semibold">Contribution</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Indie Map se construit petit à petit, avec l’aide de celles et ceux qui l’utilisent.
        </p>
      </header>

      <section className="flex-1 px-5 py-5 max-w-3xl w-full mx-auto text-sm leading-relaxed space-y-4">
        <p>
          Tu peux contribuer à Indie Map de plusieurs façons&nbsp;:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <span className="font-medium">Proposer un lieu</span>&nbsp;: un café,
            une épicerie, une friperie, une librairie, un restaurant, une
            boulangerie ou un lieu d’intérêt qui correspond à l’esprit de la
            carte.
          </li>
          <li>
            <span className="font-medium">Signaler une erreur</span>&nbsp;:
            horaires incorrects, fermeture définitive, déménagement, changement
            de concept, etc.
          </li>
          <li>
            <span className="font-medium">Donner ton retour</span>&nbsp;:
            ce qui fonctionne bien, ce qui manque, ce qui pourrait être plus
            clair ou plus utile sur la carte.
          </li>
        </ul>
        <p>
          Pour l’instant, tout se fait encore de manière simple&nbsp;:
          envoi de message, échange direct, prises de notes. L’objectif est
          d’automatiser une partie du processus plus tard, tout en gardant une
          validation humaine pour chaque lieu.
        </p>
        <p>
          Plus il y aura de contributions, plus Indie Map pourra devenir
          une vraie alternative cohérente aux grandes plateformes de cartes.
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
