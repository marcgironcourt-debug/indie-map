import PrivacyClose from "../../../components/PrivacyClose";

type Props = { params: Promise<{ locale: string }> };

export default async function SupportPage({ params }: Props) {
  const { locale } = await params;
  const isFr = locale === "fr";

  return (
    <>
      <PrivacyClose locale={locale} />
      <main style={{ maxWidth: 820, margin: "0 auto", padding: "calc(24px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom))", lineHeight: 1.6, height: "100vh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>Support</h1>

        {isFr ? (
          <>
            <p>Pour toute question, bug, ou demande liée à Indie Map :</p>
            <ul>
              <li>Email : support@indie-map.com</li>
            </ul>
            <p>
              Merci d’indiquer votre appareil (iPhone/Android), la version iOS/Android,
              et une capture d’écran si possible.
            </p>
          </>
        ) : (
          <>
            <p>For any question, bug report, or request related to Indie Map:</p>
            <ul>
              <li>Email : support@indie-map.com</li>
            </ul>
            <p>
              Please include your device (iPhone/Android), your iOS/Android version,
              and a screenshot if possible.
            </p>
          </>
        )}
      </main>
    </>
  );
}
