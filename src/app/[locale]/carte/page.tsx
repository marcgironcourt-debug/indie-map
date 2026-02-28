"use client";

import Link from "next/link";

export default function Page() {
  return (
    <main className="min-h-[100dvh] w-full px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold">Indie Map</h1>
        <p className="mt-4 text-neutral-700 dark:text-neutral-200">
          Carte des lieux locaux et indépendants. Sans pub. Données d’usage non liées à l’utilisateur.
        </p>

        <div className="mt-8">
          <Link
            href="./carte"
            className="inline-flex items-center justify-center rounded-2xl bg-[hsl(var(--brand))] px-6 py-3 font-medium text-white no-underline hover:bg-[hsl(var(--brand-600))]"
          >
            Accéder à la carte
          </Link>
        </div>

        <div className="mt-10 space-y-3 text-neutral-700 dark:text-neutral-200">
          <Link className="underline" href="./a-propos">À propos</Link>
          <br />
          <Link className="underline" href="./support">Support</Link>
          <br />
          <Link className="underline" href="./privacy">Confidentialité</Link>
        </div>
      </div>
    </main>
  );
}
