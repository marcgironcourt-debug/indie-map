"use client";

import React from "react";
import SiteNav from "@/components/SiteNav";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteNav />
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            À propos
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Indie Map, la carte des commerces qui comptent vraiment
          </h1>
          <p className="text-sm text-slate-600">
            Indie Map aide à trouver des cafés, épiceries, friperies et lieux
            de vie locaux, éthiques et responsables. Pas de pubs, pas
            d&apos;enchères pour être &laquo; premier &raquo; : juste des
            adresses choisies avec soin.
          </p>
        </header>

        <section className="space-y-3 text-sm leading-relaxed text-slate-700">
          <h2 className="text-base font-semibold text-slate-900">
            Pourquoi ce projet existe
          </h2>
          <p>
            La plupart des cartes classiques mélangent tout : chaînes
            internationales, fast-fashion, greenwashing, pubs déguisées. Quand
            tu cherches un lieu qui respecte vraiment les gens et la planète,
            tu dois fouiller, comparer, vérifier. C&apos;est épuisant.
          </p>
          <p>
            Indie Map part d&apos;une idée simple :{" "}
            <span className="font-medium">
              rendre visibles les lieux qui essaient vraiment de faire mieux
            </span>{" "}
            et te donner envie d&apos;y aller à pied, en vélo ou en transport,
            sans passer deux heures à chercher.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-slate-700">
          <h2 className="text-base font-semibold text-slate-900">
            Comment les lieux sont sélectionnés
          </h2>
          <p>
            Les commerces présents sur la carte ne paient pas pour être
            affichés en premier. Ils sont choisis selon des critères simples :
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>indépendants ou ancrés localement ;</li>
            <li>attention sincère aux conditions de travail ;</li>
            <li>
              effort réel sur l&apos;écologie, les circuits courts ou la
              réduction du gaspillage ;
            </li>
            <li>cohérence entre le discours et la réalité sur place.</li>
          </ul>
          <p>
            Le but n&apos;est pas d&apos;être parfait ou pur, mais{" "}
            <span className="font-medium">
              d&apos;être honnête sur l&apos;impact réel
            </span>{" "}
            de chaque lieu.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-slate-700">
          <h2 className="text-base font-semibold text-slate-900">
            Ce que tu peux faire avec Indie Map
          </h2>
          <ul className="ml-5 list-disc space-y-1">
            <li>Découvrir des adresses à Montréal qui ont du sens ;</li>
            <li>Préparer une balade à pied dans un quartier ;</li>
            <li>Partager la carte à un ami qui vient en visite ;</li>
            <li>
              Proposer un commerce ou un lieu que tu trouves important à
              ajouter.
            </li>
          </ul>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-slate-700">
          <h2 className="text-base font-semibold text-slate-900">
            Et la suite
          </h2>
          <p>
            Cette version est un début : une première ville, quelques dizaines
            de lieux, et beaucoup d&apos;idées pour la suite. À terme, Indie
            Map proposera des balades sur mesure, des informations plus
            détaillées sur l&apos;impact de chaque lieu, et plusieurs villes
            dans le monde.
          </p>
          <p>
            Si tu veux soutenir le projet, le plus simple est déjà{" "}
            <span className="font-medium">
              d&apos;y aller, d&apos;en parler autour de toi, et de proposer
              des lieux à ajouter
            </span>
            . C&apos;est comme ça qu&apos;une carte prend vie.
          </p>
        </section>
      </div>
    </main>
  );
}
