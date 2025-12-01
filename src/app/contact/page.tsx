"use client";

import React from "react";
import SiteNav from "@/components/SiteNav";

export default function ContactPage() {
  const email = "changer-cette-adresse@example.com";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteNav />
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Contact
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Contacter Indie Map et proposer un lieu
          </h1>
          <p className="text-sm text-slate-600">
            Cette page sert à deux choses : parler du projet, et proposer des
            commerces ou lieux à ajouter sur la carte.
          </p>
        </header>

        <section className="space-y-3 text-sm leading-relaxed text-slate-700">
          <h2 className="text-base font-semibold text-slate-900">
            Écrire au projet
          </h2>
          <p>
            Pour toute question, remarque ou retour sur Indie Map, vous pouvez
            envoyer un courriel à l&apos;adresse ci-dessous.
          </p>
          <p>
            <a
              href={`mailto:${email}`}
              className="inline-flex items-center text-sm font-medium underline underline-offset-4"
            >
              {email}
            </a>
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-slate-700">
          <h2 className="text-base font-semibold text-slate-900">
            Proposer un commerce ou un lieu
          </h2>
          <p>
            Pour proposer un lieu, merci d&apos;inclure dans votre message les
            informations suivantes :
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>nom du commerce ou du lieu ;</li>
            <li>adresse complète et ville ;</li>
            <li>site web ou page principale (si elle existe) ;</li>
            <li>horaires d&apos;ouverture habituels ;</li>
            <li>
              quelques lignes sur ce qui rend ce lieu particulier
              (écologie, social, ancrage local, etc.).
            </li>
          </ul>
          <p>
            Cela permet de vérifier rapidement si le lieu est cohérent avec
            l&apos;esprit d&apos;Indie Map avant de l&apos;ajouter dans une
            prochaine mise à jour.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-slate-700">
          <h2 className="text-base font-semibold text-slate-900">
            Ce qui se passe après
          </h2>
          <p>
            Indie Map est une sélection éditoriale : proposer un lieu ne
            garantit pas son ajout automatique. Chaque adresse est vérifiée,
            progressivement, en fonction du temps disponible et de la cohérence
            avec le projet.
          </p>
          <p>
            L&apos;objectif n&apos;est pas de recenser tous les commerces
            d&apos;une ville, mais de mettre en avant ceux qui essaient
            sincèrement de faire mieux. C&apos;est cette exigence qui donne du
            sens à la carte.
          </p>
        </section>
      </div>
    </main>
  );
}
