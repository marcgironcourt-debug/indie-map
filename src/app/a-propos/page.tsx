"use client";

import Link from "next/link";

export default function AProposPage() {
  return (
    <main className="min-h-[100dvh] bg-[#FDF7F2] text-neutral-900 flex flex-col">
      <header className="border-b border-[#E4D4C2] px-5 py-4 bg-[#4C5F34] text-white">
        <h1 className="text-xl font-semibold">Pourquoi Indie Map ?</h1>
        <p className="text-xs text-white/80 mt-1">
          Une carte pour remettre le local au centre de nos quotidiens.
        </p>
      </header>

      <section className="flex-1 px-5 py-5 max-w-3xl w-full mx-auto text-sm leading-relaxed space-y-4">
        <p>
          Parce que consommer local, ce n&apos;est pas seulement soutenir un commerce. C&apos;est prendre soin de soi, des autres, et de la planète qui nous porte.
        </p>

        <p>
          Chaque fois qu&apos;on choisit un lieu proche de nous, on renforce un écosystème vivant : des personnes qui cuisinent, qui cultivent, qui fabriquent avec respect. On réduit les distances parcourues, on limite le gaspillage, on reconnecte nos villes à leur propre vitalité.
        </p>

        <p>
          Indie Map est né de cette conviction simple : le local répare. Il répare la qualité de ce qu&apos;on met dans notre corps, la santé des sols, et la dignité des métiers qui disparaissent trop vite. Il redonne du poids à ce qui est proche, concret, humain.
        </p>

        <p>
          Ici, chaque lieu est choisi à la main, parce qu&apos;il incarne une manière plus juste de vivre et de consommer : ancrée, responsable, authentique.
        </p>

        <p>
          Choisir un café indépendant, une épicerie locale, une boulangerie de quartier, ce n&apos;est pas un petit geste. C&apos;est une manière douce de dire :
        </p>

        <p className="font-medium italic text-[16px]">
          &quot;Je sais ce que je consomme, d&apos;où ça vient, et qui je soutiens en le faisant.&quot;
        </p>

        <p>
          Si tu utilises Indie Map, même ponctuellement, tu participes déjà à ce mouvement qui reconnecte les villes à leurs racines.
        </p>
      </section>

      <footer className="border-t border-[#E4D4C2] px-5 py-3 bg-[#FDF7F2]">
        <Link href="/" className="text-sm text-neutral-700 underline">
          ← Retour à la carte
        </Link>
      </footer>
    </main>
  );
}
