"use client";

import Link from "next/link";

export default function MerchantPage() {
  return (
    <main className="min-h-[100dvh] bg-neutral-950 text-neutral-50 flex flex-col">
      <header className="border-b border-neutral-800 px-5 py-4">
        <h1 className="text-xl font-semibold">Espace commerçant</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Indie Map est là pour mettre en lumière les lieux qui choisissent la qualité, l&apos;humain et le local.
        </p>
      </header>

      <section className="flex-1 px-5 py-5 max-w-3xl w-full mx-auto text-sm leading-relaxed space-y-4">
        <p>
          Si tu es ici, c&apos;est probablement que ton commerce ne ressemble pas à une chaîne anonyme. Tu fais des
          choix chaque jour sur tes produits, tes fournisseurs, tes prix, ton équipe. Et souvent, tout ça reste
          invisible pour la plupart des gens qui passent devant ta vitrine.
        </p>

        <p>
          Indie Map a été pensé comme un espace pour des lieux comme le tien&nbsp;: cafés, épiceries, friperies,
          boulangeries, librairies, ateliers, lieux d&apos;intérêt locaux. Des endroits qui essaient de faire mieux
          que le minimum, même quand ce n&apos;est pas le chemin le plus simple.
        </p>

        <p>
          Être présent sur Indie Map, ce n&apos;est pas juste apparaître sur une carte. C&apos;est rejoindre une
          sélection volontairement limitée de lieux qui partagent une manière de travailler&nbsp;: attention aux
          personnes, transparence, cohérence entre le discours et la réalité, ancrage local et démarche
          écoresponsable.
        </p>

        <p>
          L&apos;objectif est double&nbsp;: t&apos;apporter des clients qui te ressemblent davantage, et rendre
          plus facile pour eux le fait de te trouver, te comprendre et te choisir. Pas en criant plus fort que les
          autres, mais en racontant clairement qui tu es et ce que tu proposes.
        </p>

        <p>
          Si tu as l&apos;impression que ton commerce a sa place sur Indie Map, ou si tu veux simplement en savoir
          plus sur la manière dont on sélectionne les lieux, parlons-en.
        </p>

        <div className="pt-2">
          <button
            type="button"
            className="inline-flex items-center rounded-full bg-neutral-50 px-4 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-200 transition"
          >
            Contacte-nous
          </button>
          <p className="mt-2 text-xs text-neutral-400">
            Ce bouton est pour l&apos;instant symbolique. Un espace dédié aux commerçants sera mis en place dans une
            prochaine version d&apos;Indie Map.
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
