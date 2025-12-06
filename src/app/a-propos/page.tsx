"use client";

import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="min-h-[100dvh] bg-[#FDF7F2] text-neutral-900 flex flex-col">
      <header className="border-b border-[#E4D4C2] px-5 py-4 bg-[#4C5F34] text-white">
        <h1 className="text-xl font-semibold">Pourquoi Indie Map ?</h1>
        <p className="text-xs text-white/80 mt-1">
          Parce qu’à chaque café, chaque pain, chaque livre acheté, on choisit à qui on donne de la force.
        </p>
      </header>

      <section className="flex-1 px-5 py-5 max-w-3xl w-full mx-auto text-sm leading-relaxed space-y-4">
        <p>
          On a tous déjà eu cette sensation de marcher en ville sans vraiment la voir. Enchaîner les mêmes
          enseignes, les mêmes rues, les mêmes réflexes. On consomme, on passe, on oublie. Mais derrière
          chaque rue, il y a d’autres histoires&nbsp;: celles de personnes qui essaient de faire mieux,
          à leur échelle.
        </p>

        <p>
          Indie Map est né de cette envie&nbsp;: rendre visible les lieux qui prennent soin des gens et du monde
          qu&apos;on partage. Des cafés qui paient correctement leurs équipes, des épiceries qui limitent le
          gaspillage, des friperies qui prolongent la vie des vêtements, des librairies qui tiennent encore
          debout au milieu des algorithmes.
        </p>

        <p>
          Ici, chaque lieu est choisi à la main. Pas parce qu&apos;il est &quot;cool&quot; ou à la mode, mais
          parce qu&apos;il incarne une manière plus juste de faire les choses&nbsp;: respect des personnes,
          attention aux matières, ancrage local, démarche écoresponsable. La sélection est volontairement
          limitée, pour garder du sens plutôt que faire du volume.
        </p>

        <p>
          Indie Map n&apos;est pas une carte parfaite. C&apos;est un outil simple pour celles et ceux qui
          veulent aligner un peu plus leur quotidien avec leurs valeurs, sans tout changer d&apos;un coup.
          Un café indépendant plutôt qu&apos;une grande chaîne. Une boulangerie de quartier plutôt qu&apos;un
          rayon industriel. Une librairie vivante plutôt qu&apos;un panier oublié en ligne.
        </p>

        <p>
          À terme, l&apos;idée est double&nbsp;: rendre la vie plus facile à celles et ceux qui veulent
          consommer autrement, et donner un vrai coup de pouce aux commerces qui essaient de tenir ce cap
          dans un système qui ne les aide pas toujours.
        </p>

        <p className="text-neutral-700">
          Si tu utilises Indie Map, même ponctuellement, tu fais déjà partie de ces petits déplacements
          qui, mis bout à bout, peuvent changer la manière dont une ville respire.
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
