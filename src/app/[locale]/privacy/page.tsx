import PrivacyClose from "../../../components/PrivacyClose";

type Props = { params: Promise<{ locale: string }> };

const sectionStyle = { fontSize: 18, margin: "24px 0 8px" };

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  const isFr = locale === "fr";

  return (
    <>
      <PrivacyClose locale={locale} />
      <main
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding:
            "calc(24px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom))",
          lineHeight: 1.6,
          height: "100vh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>
          {isFr ? "Politique de confidentialité" : "Privacy Policy"}
        </h1>
        <p style={{ margin: "0 0 18px", fontSize: 13, opacity: 0.75 }}>
          {isFr ? "Dernière mise à jour : 17 mai 2026" : "Last updated: May 17, 2026"}
        </p>

        {isFr ? (
          <>
            <h2 style={sectionStyle}>1. Responsable du traitement</h2>
            <p>
              <strong>Indie Map</strong>
              <br />
              Siège social : Montréal, Québec, Canada
              <br />
              Contact : contact@indie-map.com
            </p>

            <h2 style={sectionStyle}>2. Portée et cadre juridique</h2>
            <p>
              Cette politique s’applique aux utilisateurs situés au Canada, au Québec
              (Loi 25), dans l’Union européenne (RGPD) et dans toute juridiction où
              l’application est accessible.
            </p>

            <h2 style={sectionStyle}>3. Données collectées</h2>
            <p>
              Indie Map collecte uniquement les données nécessaires au fonctionnement de
              l’application, à la sécurité du service, aux notifications demandées et à
              l’amélioration du produit.
            </p>
            <ul>
              <li>
                Données de compte : adresse email, pseudo, nom affiché, langue préférée,
                photo de profil optionnelle, ville de résidence optionnelle et tranche
                d’âge optionnelle.
              </li>
              <li>
                Données d’authentification : informations techniques nécessaires à la
                connexion et, lorsque pertinent, mot de passe stocké sous forme chiffrée
                ou hachée.
              </li>
              <li>
                Données sociales : demandes d’amis, statuts d’amitié, listes partagées,
                participants aux listes et lieux ajoutés à ces listes.
              </li>
              <li>
                Contributions : lieux proposés, informations transmises avec une
                proposition, statut de validation et lien avec le compte utilisateur si
                l’utilisateur est connecté.
              </li>
              <li>
                Données d’usage : type d’événement, identifiant du lieu, ville, pays,
                catégorie, langue, plateforme, identifiant de session anonyme, source de
                l’action, date et heure.
              </li>
              <li>
                Données de notification : token de notification de l’appareil, plateforme
                utilisée, notifications envoyées, type de notification et date d’envoi.
              </li>
              <li>
                Localisation précise sur mobile uniquement si l’utilisateur l’autorise,
                afin d’afficher les lieux proches et, lorsque c’est pertinent, d’envoyer
                des suggestions contextuelles.
              </li>
              <li>
                Localisation approximative ou informations techniques de connexion
                lorsque cela est nécessaire au fonctionnement, à la sécurité ou à la
                mesure agrégée du service.
              </li>
            </ul>

            <h2 style={sectionStyle}>4. Données non collectées ou non utilisées</h2>
            <ul>
              <li>Aucune donnée bancaire n’est collectée par Indie Map à ce stade.</li>
              <li>Aucun identifiant publicitaire n’est utilisé.</li>
              <li>Aucun suivi inter-applications n’est effectué.</li>
              <li>Aucune donnée personnelle n’est vendue.</li>
              <li>
                Aucune donnée individuelle identifiable n’est transmise aux commerces ou
                partenaires.
              </li>
              <li>
                Indie Map ne vend pas de données brutes et ne propose pas de ciblage
                publicitaire individuel.
              </li>
            </ul>

            <h2 style={sectionStyle}>5. Finalités du traitement</h2>
            <p>Les données sont utilisées pour :</p>
            <ul>
              <li>permettre la création et l’utilisation d’un compte ;</li>
              <li>gérer les amis, listes partagées, lieux enregistrés et contributions ;</li>
              <li>envoyer des notifications liées au service ;</li>
              <li>afficher des lieux proches lorsque la localisation est autorisée ;</li>
              <li>améliorer l’application et comprendre les usages réels ;</li>
              <li>protéger le service contre les abus et erreurs techniques ;</li>
              <li>produire des statistiques agrégées et anonymisées.</li>
            </ul>
            <p>
              Selon les cas, les bases légales peuvent être l’exécution du service demandé
              par l’utilisateur, le consentement, l’intérêt légitime d’Indie Map ou le
              respect d’obligations légales.
            </p>

            <h2 style={sectionStyle}>6. Statistiques agrégées</h2>
            <p>
              Indie Map peut produire des statistiques agrégées sur l’usage de
              l’application : vues de lieux, clics vers un site web, itinéraires, ajouts à
              des listes, recherches, villes consultées ou catégories consultées. Ces
              statistiques servent à améliorer Indie Map et peuvent, à terme, aider les
              commerces à mieux comprendre leur impact local.
            </p>
            <p>
              Les statistiques partagées avec des tiers, si elles existent, doivent rester
              agrégées, anonymisées et non exportables sous une forme permettant
              d’identifier une personne.
            </p>

            <h2 style={sectionStyle}>7. Notifications</h2>
            <p>
              Si l’utilisateur autorise les notifications, Indie Map peut enregistrer un
              token de notification lié à l’appareil afin d’envoyer des notifications de
              service : demande d’ami, invitation à une liste partagée, suggestion
              contextuelle, réactivation ou information importante sur l’application.
              L’utilisateur peut désactiver les notifications dans les réglages de son
              appareil.
            </p>

            <h2 style={sectionStyle}>8. Localisation</h2>
            <p>
              La localisation précise n’est utilisée que si l’utilisateur l’autorise. Elle
              sert à centrer la carte, afficher des lieux proches et proposer des
              suggestions contextuelles. Indie Map ne suit pas les déplacements en continu
              dans un but publicitaire.
            </p>

            <h2 style={sectionStyle}>9. Conservation</h2>
            <p>
              Les données sont conservées pendant une durée proportionnée aux finalités
              décrites. Les événements d’usage peuvent être conservés pour analyser et
              améliorer le service, puis supprimés ou agrégés. Les données liées au compte
              sont conservées tant que le compte existe, sauf demande de suppression ou
              obligation légale contraire.
            </p>

            <h2 style={sectionStyle}>10. Sécurité</h2>
            <p>
              Indie Map met en œuvre des mesures techniques raisonnables pour protéger les
              données contre l’accès non autorisé, la perte, l’altération ou la
              divulgation.
            </p>

            <h2 style={sectionStyle}>11. Droits des utilisateurs</h2>
            <p>
              Conformément aux lois applicables, vous pouvez demander l’accès, la
              rectification, la suppression ou la limitation du traitement de vos données
              en écrivant à contact@indie-map.com.
            </p>

            <h2 style={sectionStyle}>12. Mineurs</h2>
            <p>
              Indie Map ne cherche pas à collecter intentionnellement des données
              personnelles concernant des mineurs. Si une telle situation est portée à
              notre connaissance, nous prendrons les mesures appropriées.
            </p>

            <h2 style={sectionStyle}>13. Modifications</h2>
            <p>
              Cette politique peut être mise à jour afin de refléter l’évolution du
              service ou des obligations légales. La date de modification est indiquée en
              haut de la page.
            </p>
          </>
        ) : (
          <>
            <h2 style={sectionStyle}>1. Data Controller</h2>
            <p>
              <strong>Indie Map</strong>
              <br />
              Head office: Montreal, Quebec, Canada
              <br />
              Contact: contact@indie-map.com
            </p>

            <h2 style={sectionStyle}>2. Scope and Legal Framework</h2>
            <p>
              This policy applies to users located in Canada, including Quebec under Law
              25, in the European Union under the GDPR, and in any jurisdiction where the
              application is accessible.
            </p>

            <h2 style={sectionStyle}>3. Data Collected</h2>
            <p>
              Indie Map collects only the data necessary to operate the application,
              secure the service, send requested notifications and improve the product.
            </p>
            <ul>
              <li>
                Account data: email address, username, display name, preferred language,
                optional profile picture, optional home city and optional age range.
              </li>
              <li>
                Authentication data: technical information required for sign-in and, when
                relevant, a password stored in encrypted or hashed form.
              </li>
              <li>
                Social data: friend requests, friendship status, shared lists, list
                members and places added to those lists.
              </li>
              <li>
                Contributions: submitted places, information included in a submission,
                review status and link to the user account if the user is signed in.
              </li>
              <li>
                Usage data: event type, place identifier, city, country, category,
                language, platform, anonymous session identifier, action source, date and
                time.
              </li>
              <li>
                Notification data: device push token, platform, sent notifications,
                notification type and sending date.
              </li>
              <li>
                Precise mobile location only if the user allows it, in order to show
                nearby places and, when relevant, send contextual suggestions.
              </li>
              <li>
                Approximate location or technical connection information when necessary
                for operation, security or aggregated service measurement.
              </li>
            </ul>

            <h2 style={sectionStyle}>4. Data Not Collected or Not Used</h2>
            <ul>
              <li>Indie Map does not currently collect payment information.</li>
              <li>No advertising identifiers are used.</li>
              <li>No cross-app tracking is performed.</li>
              <li>Personal data is not sold.</li>
              <li>
                Individually identifiable data is not shared with businesses or partners.
              </li>
              <li>
                Indie Map does not sell raw data and does not provide individual
                advertising targeting.
              </li>
            </ul>

            <h2 style={sectionStyle}>5. Purpose of Processing</h2>
            <p>Data is used to:</p>
            <ul>
              <li>allow users to create and use an account;</li>
              <li>manage friends, shared lists, saved places and contributions;</li>
              <li>send service-related notifications;</li>
              <li>show nearby places when location access is allowed;</li>
              <li>improve the application and understand real usage;</li>
              <li>protect the service against abuse and technical errors;</li>
              <li>produce aggregated and anonymized statistics.</li>
            </ul>
            <p>
              Depending on the situation, the legal basis may be performance of the
              service requested by the user, consent, Indie Map’s legitimate interest or
              compliance with legal obligations.
            </p>

            <h2 style={sectionStyle}>6. Aggregated Statistics</h2>
            <p>
              Indie Map may produce aggregated statistics about app usage: place views,
              website clicks, itinerary actions, list additions, searches, viewed cities
              or viewed categories. These statistics are used to improve Indie Map and
              may, in the future, help businesses understand their local impact.
            </p>
            <p>
              Any statistics shared with third parties, if any, must remain aggregated,
              anonymized and not exportable in a form that could identify a person.
            </p>

            <h2 style={sectionStyle}>7. Notifications</h2>
            <p>
              If the user allows notifications, Indie Map may store a device push token
              in order to send service notifications: friend request, shared list invite,
              contextual suggestion, reactivation or important app information. Users can
              disable notifications in their device settings.
            </p>

            <h2 style={sectionStyle}>8. Location</h2>
            <p>
              Precise location is used only if the user allows it. It is used to center
              the map, show nearby places and provide contextual suggestions. Indie Map
              does not track user movement continuously for advertising purposes.
            </p>

            <h2 style={sectionStyle}>9. Data Retention</h2>
            <p>
              Data is retained only for a period proportionate to the purposes described
              above. Usage events may be kept to analyze and improve the service, then
              deleted or aggregated. Account-related data is kept while the account
              exists, unless deletion is requested or a legal obligation requires
              otherwise.
            </p>

            <h2 style={sectionStyle}>10. Security</h2>
            <p>
              Indie Map implements reasonable technical measures to protect data against
              unauthorized access, loss, alteration or disclosure.
            </p>

            <h2 style={sectionStyle}>11. User Rights</h2>
            <p>
              Depending on applicable law, you may request access, rectification,
              deletion or restriction of processing by contacting contact@indie-map.com.
            </p>

            <h2 style={sectionStyle}>12. Minors</h2>
            <p>
              Indie Map does not seek to intentionally collect personal data from minors.
              If such a situation is brought to our attention, we will take appropriate
              action.
            </p>

            <h2 style={sectionStyle}>13. Changes</h2>
            <p>
              This Privacy Policy may be updated to reflect changes to the service or
              legal obligations. The update date appears at the top of this page.
            </p>
          </>
        )}
      </main>
    </>
  );
}
