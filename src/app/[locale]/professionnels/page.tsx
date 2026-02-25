import PrivacyClose from "../../../components/PrivacyClose";

type Props = { params: Promise<{ locale: string }> };

export default async function ProsPage({ params }: Props) {
  const { locale } = await params;
  const isFr = locale === "fr";

  return (
    <>
      <PrivacyClose locale={locale} />
      <main className="min-h-screen bg-[#1f1f1f] text-white/90">
      <div className="mx-auto max-w-[820px] px-4 py-6 leading-relaxed">
        <h1 className="text-2xl font-semibold tracking-tight mb-4">
          {isFr ? "Professionnels" : "For Professionals"}
        </h1>

        {isFr ? (
          <>
            <p className="mb-4 text-white/80">
              Indie Map met en avant des lieux indépendants qui privilégient le local, la réparation, le réemploi, l’agriculture
              respectueuse, et plus largement une économie plus sobre et plus humaine.
            </p>

            <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Ce que nous faisons</h2>
            <ul className="list-disc pl-5 space-y-1 text-white/80">
              <li>Rendre votre lieu visible dans une carte claire, centrée sur la découverte.</li>
              <li>Présenter l’essentiel : histoire du lieu, démarche, informations pratiques.</li>
              <li>Améliorer le produit à partir de statistiques d’usage globales et anonymes.</li>
            </ul>
            <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Pour qui ?</h2>
            <p>
              Pour les commerces et lieux qui assument une démarche cohérente : sourcing local, fabrication responsable,
              économie circulaire, indépendance, utilité sociale, ou contribution concrète à la vie du territoire.
            </p>

            <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Devenir partenaire</h2>
            <p>
              Le partenariat vise à construire quelque chose de durable : un produit utile, éthique, et crédible sur le long terme.
              Si vous souhaitez rejoindre Indie Map, contactez-nous via le site officiel.
            </p>

            <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Contact</h2>
            <a href="https://indie-map.com" target="_blank" rel="noopener noreferrer" className="inline-block mt-2 px-5 py-3 rounded-2xl bg-[hsl(var(--brand))] text-white font-medium no-underline hover:bg-[hsl(var(--brand-600))]">
              Visiter indie-map.com
            </a>
          </>
        ) : (
          <>
            <p className="mb-4 text-white/80">
              Indie Map highlights independent places that prioritize local sourcing, repair, reuse, regenerative or respectful
              farming, and more broadly a simpler and more human economy.
            </p>

            <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">What we do</h2>
            <ul className="list-disc pl-5 space-y-1 text-white/80">
              <li>Make your place visible on a clear map designed for discovery.</li>
              <li>Show the essentials: the place, the approach, and practical info.</li>
              <li>Improve the product using aggregated and anonymous usage statistics.</li>
            </ul>
            <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Who is it for?</h2>
            <p>
              For businesses and places with a consistent approach: local sourcing, responsible making, circular economy,
              independence, social utility, or a tangible positive impact on their territory.
            </p>

            <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Become a partner</h2>
            <p>
              Partnership is about building something durable: a useful, ethical, and long-term credible product.
              If you want to join Indie Map, please reach out via the official website.
            </p>

            <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Contact</h2>
            <a href="https://indie-map.com" target="_blank" rel="noopener noreferrer" className="inline-block mt-2 px-5 py-3 rounded-2xl bg-[hsl(var(--brand))] text-white font-medium no-underline hover:bg-[hsl(var(--brand-600))]">
              Visit indie-map.com
            </a>
          </>
        )}
            </div>
      </main>
    </>
  );
}
