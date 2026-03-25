import PrivacyClose from "../../../components/PrivacyClose";

type Props = { params: Promise<{ locale: string }> };

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  const isFr = locale === "fr";

  return (
    <>
      <PrivacyClose locale={locale} />
      <main style={{ maxWidth: 820, margin: "0 auto", padding: "calc(24px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom))", lineHeight: 1.6, height: "100vh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>{isFr ? "Politique de confidentialité" : "Privacy Policy"}</h1>
<p style={{ margin: "0 0 18px", fontSize: 13, opacity: 0.75 }}>{isFr ? "Dernière mise à jour : 25 mars 2026" : "Last updated: March 25, 2026"}</p>
{isFr ? (<>
<h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>1. Responsable du traitement</h2>
<p><strong>Indie Map</strong><br/>Siège social : Montréal, Québec, Canada<br/>Contact : contact@indie-map.com</p>

<h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>2. Portée et cadre juridique</h2>
<p>Cette politique s’applique aux utilisateurs situés au Canada, au Québec (Loi 25), dans l’Union européenne (RGPD) et dans toute juridiction où l’application est accessible.</p>

<h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>3. Données collectées</h2>
<p>Indie Map collecte uniquement des données d’usage minimales et non identifiantes :</p>
<ul>
<li>Type d’événement (ex. view_place, click_phone, click_website...)</li>
<li>Identifiant du lieu</li>
<li>Ville</li>
<li>Catégorie</li>
<li>Date et heure</li>
<li>Localisation approximative (ville, pays) déduite de l’adresse IP sur le web</li>
<li>Localisation précise sur mobile uniquement si l’utilisateur l’autorise, afin d’afficher les lieux proches</li>
</ul>

<h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>4. Données non collectées</h2>
<ul>
<li>Aucun compte utilisateur</li>
<li>Aucune adresse email</li>
<li>Aucune donnée bancaire</li>
<li>Aucun identifiant publicitaire</li>
<li>Aucun suivi inter-applications</li>
<li>Aucun profilage individuel</li>
</ul>

<h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>5. Finalité du traitement</h2>
<p>Les données sont collectées afin d’améliorer l’application et produire des statistiques agrégées. Base légale : intérêt légitime.</p>

<h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>6. Statistiques agrégées</h2>
<p>Indie Map ne vend aucune donnée personnelle. Seules des statistiques strictement anonymisées peuvent être utilisées à des fins d’analyse territoriale.</p>

<h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>7. Conservation</h2>
<p>Les événements sont conservés pour une durée proportionnée aux finalités décrites puis supprimés ou agrégés de manière irréversible.</p>

<h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>8. Sécurité</h2>
<p>Indie Map met en œuvre des mesures techniques raisonnables pour protéger les données contre l’accès non autorisé, la perte ou l’altération.</p>

<h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>9. Droits des utilisateurs</h2>
<p>Conformément aux lois applicables, vous pouvez demander l’accès, la rectification ou la suppression de données via contact@indie-map.com.</p>

<h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>10. Mineurs</h2>
<p>Indie Map ne collecte pas intentionnellement de données personnelles concernant des mineurs.</p>

<h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>11. Modifications</h2>
<p>Cette politique peut être mise à jour. La date de modification sera indiquée en haut de la page.</p>
</>) : (<>
<h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>1. Data Controller</h2>
<p><strong>Indie Map</strong><br/>Head office: Montreal, Quebec, Canada<br/>Contact: contact@indie-map.com</p>

<h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>2. Scope and Legal Framework</h2>
<p>This policy applies to users located in Canada (including Quebec – Law 25), in the European Union (GDPR), and in any jurisdiction where the application is accessible. Indie Map follows internationally recognized standards for data protection.</p>

<h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>3. Data Collected</h2>
<p>Indie Map collects only minimal, non-identifiable usage data:</p>
<ul>
<li>Event type (e.g., view_place, click_phone, click_website, click_itinerary...)</li>
<li>Place identifier</li>
<li>City</li>
<li>Category</li>
<li>Date and time</li>
<li>Approximate location (city, country) inferred from the IP address on the web</li>
<li>Precise location on mobile only if the user allows it, in order to show nearby places</li>
</ul>

<h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>4. Data Not Collected</h2>
<ul>
<li>No user accounts</li>
<li>No email addresses</li>
<li>No payment information</li>
<li>No advertising identifiers</li>
<li>No cross-app tracking</li>
<li>No behavioral profiling</li>
</ul>

<h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>5. Purpose of Processing</h2>
<p>Usage data is collected solely to improve the application and generate aggregated statistics. Legal basis: legitimate interest.</p>

<h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>6. Aggregated Statistics and Monetization</h2>
<p>Indie Map does not sell personal data. Only strictly anonymized aggregated statistics may be used for territorial analysis.</p>

<h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>7. Data Retention</h2>
<p>Usage events are retained only for a period proportionate to the purposes described above, then deleted or irreversibly aggregated.</p>

<h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>8. Security</h2>
<p>Indie Map implements reasonable technical measures to protect data against unauthorized access, disclosure, alteration, or loss.</p>

<h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>9. User Rights</h2>
<p>Depending on your jurisdiction, you may request access, rectification, or deletion of data via contact@indie-map.com.</p>

<h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>10. Minors</h2>
<p>Indie Map does not intentionally collect personal data from minors.</p>

<h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>11. Changes</h2>
<p>This Privacy Policy may be updated to reflect service or legal changes. The update date will appear at the top of this page.</p>
</>)}
    </main>
    </>
  );
}
