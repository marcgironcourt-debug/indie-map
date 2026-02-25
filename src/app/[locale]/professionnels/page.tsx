import PrivacyClose from "../../../components/PrivacyClose";

type Props = { params: Promise<{ locale: string }> };

export default async function ProsPage({ params }: Props) {
  const { locale } = await params;
  const isFr = locale === "fr";

  return (
    <>
      <PrivacyClose locale={locale} />
      <main style={{ maxWidth: 820, margin: "0 auto", padding: "24px 16px", lineHeight: 1.6 }}>
        <h1 style={{ fontSize: 28, margin: "0 0 16px" }}>
          {isFr ? "Professionnels" : "For Professionals"}
        </h1>

        {isFr ? (
          <>
            <p style={{ margin: "0 0 16px" }}>
              Indie Map met en avant des lieux indépendants qui privilégient le local, la réparation, le réemploi, l’agriculture
              respectueuse, et plus largement une économie plus sobre et plus humaine.
            </p>

            <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>Ce que nous faisons</h2>
            <ul>
              <li>Rendre votre lieu visible dans une carte claire, centrée sur la découverte.</li>
              <li>Présenter l’essentiel : histoire du lieu, démarche, informations pratiques.</li>
              <li>Améliorer le produit à partir de statistiques d’usage globales et anonymes.</li>
            </ul>

            <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>Ce que nous ne faisons pas</h2>
            <ul>
              <li>Aucune publicité tierce.</li>
              <li>Aucun “boost” algorithmique opaque.</li>
              <li>Aucune revente de données personnelles.</li>
              <li>Aucun profilage individuel.</li>
            </ul>

            <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>Pour qui ?</h2>
            <p>
              Pour les commerces et lieux qui assument une démarche cohérente : sourcing local, fabrication responsable,
              économie circulaire, indépendance, utilité sociale, ou contribution concrète à la vie du territoire.
            </p>

            <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>Devenir partenaire</h2>
            <p>
              Le partenariat vise à construire quelque chose de durable : un produit utile, éthique, et crédible sur le long terme.
              Si vous souhaitez rejoindre Indie Map, contactez-nous via le site officiel.
            </p>

            <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>Contact</h2>
            <a href="https://indie-map.com" target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 8, padding: "10px 18px", borderRadius: 16, backgroundColor: "hsl(var(--brand))", color: "#fff", textDecoration: "none", fontWeight: 500 }}>
              Visiter indie-map.com
            </a>
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 16px" }}>
              Indie Map highlights independent places that prioritize local sourcing, repair, reuse, regenerative or respectful
              farming, and more broadly a simpler and more human economy.
            </p>

            <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>What we do</h2>
            <ul>
              <li>Make your place visible on a clear map designed for discovery.</li>
              <li>Show the essentials: the place, the approach, and practical info.</li>
              <li>Improve the product using aggregated and anonymous usage statistics.</li>
            </ul>

            <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>What we do not do</h2>
            <ul>
              <li>No third-party advertising.</li>
              <li>No opaque algorithmic boosting.</li>
              <li>No sale of personal data.</li>
              <li>No individual profiling.</li>
            </ul>

            <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>Who is it for?</h2>
            <p>
              For businesses and places with a consistent approach: local sourcing, responsible making, circular economy,
              independence, social utility, or a tangible positive impact on their territory.
            </p>

            <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>Become a partner</h2>
            <p>
              Partnership is about building something durable: a useful, ethical, and long-term credible product.
              If you want to join Indie Map, please reach out via the official website.
            </p>

            <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>Contact</h2>
            <a href="https://indie-map.com" target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 8, padding: "10px 18px", borderRadius: 16, backgroundColor: "hsl(var(--brand))", color: "#fff", textDecoration: "none", fontWeight: 500 }}>
              Visit indie-map.com
            </a>
          </>
        )}
      </main>
    </>
  );
}
