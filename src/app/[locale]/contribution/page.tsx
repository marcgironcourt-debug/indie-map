import PrivacyClose from "../../../components/PrivacyClose";

type Props = { params: Promise<{ locale: string }> };

export default async function ContributionPage({ params }: Props) {
  const { locale } = await params;
  const isFr = locale === "fr";

  return (
    <>
      <PrivacyClose locale={locale} />
      <main style={{ maxWidth: 820, margin: "0 auto", padding: "24px 16px", lineHeight: 1.6 }}>
        <h1 style={{ fontSize: 28, margin: "0 0 16px" }}>
          {isFr ? "Contribution" : "Contribute"}
        </h1>

        {isFr ? (
          <>
            <p style={{ margin: "0 0 16px" }}>
              Indie Map grandit grâce aux contributions. L’objectif : rendre visibles des lieux indépendants qui
              privilégient le local, la réparation, le réemploi, l’agriculture respectueuse et des pratiques cohérentes.
            </p>

            <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>Ce que vous pouvez faire</h2>
            <ul>
              <li>Proposer un lieu à ajouter (commerce, ferme, marché, atelier, coopérative, etc.).</li>
              <li>Signaler une erreur (adresse, horaires, site web, téléphone, catégorie).</li>
              <li>Partager une photo/panorama propre et utile (sans personnes identifiables, si possible).</li>
              <li>Suggérer une amélioration produit (UX, lisibilité, performance, accessibilité).</li>
            </ul>

            

            <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>Envoyer une contribution</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
              <a
                href="https://indie-map.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  padding: "10px 18px",
                  borderRadius: 16,
                  backgroundColor: "hsl(var(--brand))",
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                Ouvrir indie-map.com
              </a>
</div>
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 16px" }}>
              Indie Map grows through contributions. The goal: highlight independent places that prioritize local
              sourcing, repair, reuse, respectful farming, and consistent real-world practices.
            </p>

            <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>How you can help</h2>
            <ul>
              <li>Suggest a place to add (shop, farm, market, workshop, cooperative, etc.).</li>
              <li>Report an error (address, opening hours, website, phone, category).</li>
              <li>Share a clean, useful photo/panorama (no identifiable people if possible).</li>
              <li>Suggest a product improvement (UX, clarity, performance, accessibility).</li>
            </ul>

            

            <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>Send a contribution</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
              <a
                href="https://indie-map.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  padding: "10px 18px",
                  borderRadius: 16,
                  backgroundColor: "hsl(var(--brand))",
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                Open indie-map.com
              </a>
</div>
          </>
        )}
      </main>
    </>
  );
}
