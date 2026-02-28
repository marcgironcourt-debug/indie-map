import PrivacyClose from "../../../components/PrivacyClose";

type Props = { params: Promise<{ locale: string }> };

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  const isFr = locale === "fr";

  return (
    <>
      <PrivacyClose locale={locale} />
      <main style={{ maxWidth: 820, margin: "0 auto", padding: "24px 16px", lineHeight: 1.6 }}>
      <div style={{ position: "relative" }}>
  <a href="/" style={{ position: "absolute", top: 0, right: 0, fontSize: 24, textDecoration: "none" }} aria-label="Close">×</a>
  <h1 style={{ fontSize: 28, margin: "0 0 16px" }}>
        {isFr ? "Politique de confidentialité" : "Privacy Policy"}
      </h1>
</div>

      {isFr ? (
        <>
          <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>1. Données collectées</h2>
          <p>
            Indie Map enregistre des événements d’usage minimaux et anonymes afin de comprendre
            l’utilisation globale de l’application et d’améliorer le service.
          </p>
          <ul>
            <li>Type d’événement (ex. view_place, click_phone, click_website...)</li>
            <li>Identifiant du lieu</li>
            <li>Ville</li>
            <li>Catégorie</li>
            <li>Date et heure</li>
          </ul>

          <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>2. Données non collectées</h2>
          <ul>
            <li>Aucun compte utilisateur</li>
            <li>Aucune adresse email</li>
            <li>Aucun numéro de téléphone</li>
            <li>Aucune information de paiement</li>
            <li>Aucun identifiant publicitaire</li>
            <li>Aucun suivi inter-applications</li>
          </ul>
          <p>Indie Map ne collecte aucune donnée permettant d’identifier personnellement un utilisateur.</p>

          <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>3. Publicité et partenariats</h2>
          <p>
            Indie Map n’affiche actuellement aucune publicité tierce. À l’avenir, des événements culturels
            ou associatifs locaux pourront être mis en avant.
          </p>
          <p>
            Ces mises en avant ne reposent sur aucun profilage individuel. Toute évolution majeure sera
            clairement indiquée dans cette page.
          </p>

          <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>4. Monétisation des données</h2>
          <p>Indie Map ne vend aucune donnée personnelle.</p>
          <p>
            Des statistiques agrégées et anonymisées (ex. interactions par ville ou catégorie) peuvent être
            utilisées pour fournir des analyses territoriales aux commerces partenaires. Ces statistiques ne
            permettent pas d’identifier un utilisateur.
          </p>

          <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>5. Conservation des données</h2>
          <p>
            Les événements d’usage sont conservés pour une durée limitée afin de produire des statistiques agrégées et d’améliorer l’application. La durée de conservation peut évoluer, mais restera raisonnable et proportionnée à ces finalités.
          </p>

          <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>6. Contact</h2>
          <p>Pour toute question relative à la confidentialité, contactez-nous via le site officiel Indie Map.</p>
        </>
      ) : (
        <>
          <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>1. Data Collected</h2>
          <p>
            Indie Map records minimal and anonymous usage events in order to understand how the
            application is used and to improve the product.
          </p>
          <ul>
            <li>Event type (e.g. view_place, click_phone, click_website...)</li>
            <li>Place identifier</li>
            <li>City</li>
            <li>Category</li>
            <li>Date and time</li>
          </ul>

          <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>2. Data Not Collected</h2>
          <ul>
            <li>No user accounts</li>
            <li>No email addresses</li>
            <li>No phone numbers</li>
            <li>No payment information</li>
            <li>No advertising identifiers</li>
            <li>No cross-app tracking</li>
          </ul>

          <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>3. Advertising & Partnerships</h2>
          <p>
            Indie Map does not currently display third-party advertising. In the future, local cultural or
            associative events may be highlighted.
          </p>
          <p>
            These highlights will not rely on personal profiling. Any major change in data practices will be
            disclosed in this policy.
          </p>

          <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>4. Data Monetization</h2>
          <p>Indie Map does not sell personally identifiable information.</p>
          <p>
            Aggregated and anonymized statistics may be used to provide territorial insights to partner
            businesses. These statistics do not allow identification of individuals.
          </p>

          <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>5. Data Retention</h2>
          <p>
            Usage events are retained for a limited period to produce aggregated statistics and improve the product. Retention may evolve, but will remain reasonable and proportionate to these purposes.
          </p>

          <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>6. Contact</h2>
          <p>For any privacy-related questions, please contact us via the official Indie Map website.</p>
        </>
      )}
    </main>
    </>
  );
}
