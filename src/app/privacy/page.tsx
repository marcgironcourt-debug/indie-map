export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "24px 16px", lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 28, margin: "0 0 16px" }}>Privacy Policy / Politique de confidentialité</h1>

      <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>1. Data Collected / Données collectées</h2>
      <p>
        Indie Map records minimal and anonymous usage events to understand how the application is used
        and to improve the product.
      </p>
      <ul>
        <li>Event type (e.g. view_place, click_phone, click_website, click_itinerary, click_copy_address)</li>
        <li>Place identifier</li>
        <li>City</li>
        <li>Category</li>
        <li>Date and time of the event</li>
      </ul>
      <p>
        Indie Map enregistre des événements d’usage anonymes et minimaux afin de comprendre l’utilisation
        globale de l’application et d’améliorer le service.
      </p>

      <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>2. Data Not Collected / Données non collectées</h2>
      <ul>
        <li>No user accounts</li>
        <li>No email addresses</li>
        <li>No user phone numbers</li>
        <li>No payment information</li>
        <li>No advertising identifiers</li>
        <li>No personal device tracking</li>
      </ul>
      <p>
        Indie Map ne collecte aucune donnée permettant d’identifier personnellement un utilisateur.
      </p>

      <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>3. Advertising & Partnerships / Publicité et partenariats</h2>
      <p>
        Indie Map does not currently display advertising.
        In the future, local partnerships or cultural/associative event highlights may appear.
        Any major change in data practices will be clearly disclosed on this page.
      </p>

      <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>4. Data Monetization / Monétisation des données</h2>
      <p>
        Indie Map does not sell personally identifiable information.
        Aggregated and anonymized statistics may be used to provide territorial insights
        to partner businesses.
      </p>

      <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>5. Contact</h2>
      <p>
        For any privacy-related questions, please contact us via the official Indie Map website.
      </p>
    </main>
  );
}
