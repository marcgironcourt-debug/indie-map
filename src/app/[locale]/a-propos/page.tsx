import PrivacyClose from "../../../components/PrivacyClose";

type Props = { params: Promise<{ locale: string }> };

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  const isFr = locale === "fr";

  return (
    <>
      <PrivacyClose locale={locale} />
      <main className="min-h-screen bg-[#1f1f1f] text-white/90">
      <div className="mx-auto max-w-[820px] px-4 py-6 leading-relaxed">
        <h1 className="text-2xl font-semibold tracking-tight mb-4">
          {isFr ? "À propos" : "About"}
        </h1>

        {isFr ? (
          <>
            <p className="mb-4 text-white/80">
              Indie Map est né d’une difficulté simple : trouver des lieux qui produisent ou travaillent réellement localement.
            </p>

            <p className="mb-4 text-white/80">
              En voyage comme dans sa propre ville, il devient compliqué d’identifier ce qui est fabriqué, cultivé ou pensé à l’échelle d’un territoire.
              Les informations existent, mais elles sont dispersées.
            </p>

            <p className="mb-4 text-white/80">
              Indie Map rassemble ces lieux sur une carte claire.
            </p>

            <p className="mb-4 text-white/80">
              L’application référence des cafés, restaurants, ateliers, fermes, marchés, librairies ou boutiques qui ont un lien concret avec leur environnement :
              production locale, circuits courts, fabrication sur place, agriculture respectueuse, transformation artisanale.
            </p>

            <p className="mb-4 text-white/80">
              L’objectif n’est pas de juger ni de classer. Il s’agit de rendre visible. Tout en permettant de consommer différemment.
            </p>

            <p className="mb-4 text-white/80">
              Chaque lieu est présenté avec des informations essentielles : où il se trouve, ce qu’il fait, comment il fonctionne.
            </p>

            <p>
              Indie Map est conçu comme un outil simple : une carte pour repérer plus facilement ce qui se fait localement, où que l’on soit.
              Le projet évolue progressivement, ville après ville, en privilégiant la cohérence et la qualité des informations.
            </p>
          </>
        ) : (
          <>
            <p className="mb-4 text-white/80">
              Indie Map was created from a simple difficulty: finding places that genuinely produce or work locally.
            </p>

            <p className="mb-4 text-white/80">
              Whether traveling or in your own city, it can be hard to identify what is actually made, grown, or rooted in a specific territory.
              The information exists, but it is scattered.
            </p>

            <p className="mb-4 text-white/80">
              Indie Map gathers these places on a clear map.
            </p>

            <p className="mb-4 text-white/80">
              The app references cafés, restaurants, workshops, farms, markets, bookstores, and shops that maintain a concrete link to their environment:
              local production, short supply chains, on-site making, respectful farming, artisanal transformation.
            </p>

            <p className="mb-4 text-white/80">
              The goal is not to judge or rank. It is to make visible. While making it easier to consume differently.
            </p>

            <p className="mb-4 text-white/80">
              Each place is presented with essential information: where it is, what it does, how it operates.
            </p>

            <p>
              Indie Map is designed as a simple tool: a map to more easily locate what is produced locally, wherever you are.
              The project grows progressively, city by city, prioritizing coherence and accuracy.
            </p>
          </>
        )}
            </div>
      </main>
    </>
  );
}
