"use client";

import React from "react";
import SiteNav from "@/components/SiteNav";

export default function BusinessesPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteNav />
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Pour les commerces
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Mettre votre lieu sur Indie Map
          </h1>
          <p className="text-sm text-slate-600">
            Indie Map met en avant des cafés, épiceries, friperies, boutiques
            et lieux de vie locaux qui font un effort réel sur l&apos;écologie,
            l&apos;éthique et les conditions de travail.
          </p>
        </header>

        <section className="space-y-3 text-sm leading-relaxed text-slate-700">
          <h2 className="text-base font-semibold text-slate-900">
            Ce que vous obtenez aujourd&apos;hui
          </h2>
          <p>
            Cette première version est volontairement simple. Être présent sur
            Indie Map signifie :
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>votre lieu affiché directement sur la carte ;</li>
            <li>
              une fiche claire avec le nom, l&apos;adresse, les horaires et le
              site web ;
            </li>
            <li>
              une sélection éditoriale : vous êtes aux côtés d&apos;autres lieux
              choisis pour leur cohérence, pas parce qu&apos;ils ont payé plus
              cher.
            </li>
          </ul>
          <p>
            L&apos;idée est de créer une carte de confiance pour les personnes
            qui veulent consommer moins mais mieux, sans passer par la
            publicité ou les enchères.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-slate-700">
          <h2 className="text-base font-semibold text-slate-900">
            Comment les lieux sont sélectionnés
          </h2>
          <p>
            Indie Map n&apos;est pas un annuaire exhaustif. Les lieux sont
            sélectionnés selon quelques critères simples :
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>ancrage local ou indépendance réelle ;</li>
            <li>attention aux équipes et aux conditions de travail ;</li>
            <li>
              effort concret sur les produits, les matières, le gaspillage ou la
              logistique ;
            </li>
            <li>
              cohérence entre ce qui est affiché publiquement et ce qui se
              passe réellement sur place.
            </li>
          </ul>
          <p>
            L&apos;objectif n&apos;est pas de juger, mais de rendre visible les
            lieux qui essaient sincèrement d&apos;aller dans le bon sens.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-slate-700">
          <h2 className="text-base font-semibold text-slate-900">
            Et demain : visibilité et impact
          </h2>
          <p>
            À terme, Indie Map proposera des outils pour mieux montrer
            l&apos;impact réel de votre lieu : balades thématiques, indicateurs
            simples sur l&apos;écologie et le social, et une meilleure mise en
            avant des lieux qui prennent ces sujets au sérieux.
          </p>
          <p>
            L&apos;ambition n&apos;est pas d&apos;avoir le plus de lieux
            possibles, mais de créer une carte qui donne envie de vous
            découvrir, de venir à pied, en vélo ou en transport, et de revenir.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-slate-700">
          <h2 className="text-base font-semibold text-slate-900">
            Proposer votre commerce
          </h2>
          <p>
            Si vous pensez que votre lieu a sa place sur Indie Map, vous pouvez
            proposer son ajout via la page contact. Quelques informations seront
            nécessaires : description, site web, horaires, et ce qui fait la
            différence dans votre manière de travailler.
          </p>
          <p>
            Pour l&apos;instant, la présence sur la carte est en construction :
            le projet se concentre d&apos;abord sur une poignée de lieux par
            ville, sélectionnés avec soin, avant d&apos;ouvrir plus largement.
          </p>
        </section>
      </div>
    </main>
  );
}
