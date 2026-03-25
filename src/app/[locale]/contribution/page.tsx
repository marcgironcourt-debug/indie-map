import PrivacyClose from "../../../components/PrivacyClose";

type Props = { params: Promise<{ locale: string }> };

export default async function ContributionPage({ params }: Props) {
  const { locale } = await params;
  const isFr = locale === "fr";

  return (
    <>
      <PrivacyClose locale={locale} />
      <main className="min-h-screen bg-[#1f1f1f] text-white/90">
      <div className="mx-auto max-w-[820px] px-4 py-6 leading-relaxed">
        <h1 className="text-2xl font-semibold tracking-tight mb-4">
          {isFr ? "Contribution" : "Contribute"}
        </h1>

        {isFr ? (
          <>
            <p className="mb-4 text-white/80">
              Indie Map grandit grâce aux contributions. L’objectif : rendre visibles des lieux indépendants qui
              privilégient le local, la réparation, le réemploi, l’agriculture respectueuse et des pratiques cohérentes.
            </p>

            <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Ce que vous pouvez faire</h2>
            <ul className="list-disc pl-5 space-y-1 text-white/80">
              <li>Proposer un lieu à ajouter (commerce, ferme, marché, atelier, coopérative, etc.).</li>
              <li>Signaler une erreur (adresse, horaires, site web, téléphone, catégorie).</li>
              <li>Partager une photo/panorama propre et utile (sans personnes identifiables, si possible).</li>
              <li>Suggérer une amélioration produit (UX, lisibilité, performance, accessibilité).</li>
            </ul>

            

            <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Envoyer une contribution</h2>
            <div className="mt-2 flex flex-wrap gap-3">
              <a
                href="https://indie-map.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-5 py-3 rounded-2xl bg-[hsl(var(--brand))] text-white font-medium no-underline hover:bg-[hsl(var(--brand-600))]"
              >
                Ouvrir indie-map.com
              </a>
            </div>
          </>
        ) : (
          <>
            <p className="mb-4 text-white/80">
              Indie Map grows through contributions. The goal: make visible independent places that prioritize local
              sourcing, repair, reuse, respectful agriculture, and coherent practices.
            </p>

            <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">How you can help</h2>
            <ul className="list-disc pl-5 space-y-1 text-white/80">
              <li>Suggest a place to add (shop, farm, market, workshop, cooperative, etc.).</li>
              <li>Report an error (address, opening hours, website, phone, category).</li>
              <li>Share a clean, useful photo/panorama (no identifiable people if possible).</li>
              <li>Suggest a product improvement (UX, clarity, performance, accessibility).</li>
            </ul>

            

            <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Send a contribution</h2>
            <div className="mt-2 flex flex-wrap gap-3">
              <a
                href="https://indie-map.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-5 py-3 rounded-2xl bg-[hsl(var(--brand))] text-white font-medium no-underline hover:bg-[hsl(var(--brand-600))]"
              >
                Open indie-map.com
              </a>
            </div>
          </>
        )}
            </div>
      </main>
    </>
  );
}
