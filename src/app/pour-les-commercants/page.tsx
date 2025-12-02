"use client";

import Link from "next/link";

export default function MerchantsPage() {
  return (
    <main className="min-h-[100dvh] bg-neutral-950 text-neutral-50 flex flex-col">
      <header className="border-b border-neutral-800 px-5 py-4">
        <h1 className="text-xl font-semibold">Pour les commerçants</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Une vitrine pensée pour les lieux locaux, éthiques et indépendants.
        </p>
      </header>

      <section className="flex-1 px-5 py-5 max-w-3xl w-full mx-auto text-sm leading-relaxed space-y-4">
        <p>
          Indie Map n’est pas un annuaire massif mais une sélection de lieux
          cohérents avec certaines valeurs&nbsp;: ancrage local, attention aux
          conditions de travail, transparence, qualité des produits, démarche
          durable ou circulaire.
        </p>
        <p>
          Être présent sur la carte, c’est apparaître dans un contexte où chaque
          lieu est choisi à la main et mis en avant de façon claire&nbsp;: type
          de lieu, adresse, horaires, site web, et plus tard des parcours à
          thème et des indicateurs d’impact.
        </p>
        <p>
          Les formules d’abonnement et les options payantes (photos,
          mise en avant, itinéraires «&nbsp;Indie Walk&nbsp;», etc.) seront
          précisées plus tard. Pour l’instant, l’inscription se fait au cas par
          cas, en échangeant directement avec les commerces intéressés.
        </p>
        <p>
          Si tu gères un lieu qui correspond à cet état d’esprit et que tu
          souhaites apparaître sur Indie Map, tu peux entrer en contact pour
          discuter de ton projet, de ta démarche et de ce que la carte peut
          t’apporter en visibilité réelle.
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
