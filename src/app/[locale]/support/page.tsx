export default function SupportPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Support</h1>
      <p className="mt-4 text-neutral-700 dark:text-neutral-200">
        Pour toute question, bug, ou demande liée à Indie Map :
      </p>
      <ul className="mt-4 list-disc pl-6 text-neutral-700 dark:text-neutral-200">
        <li>Email : support@indie-map.com</li>
      </ul>
      <p className="mt-6 text-neutral-700 dark:text-neutral-200">
        Merci d’indiquer votre appareil (iPhone/Android), la version iOS/Android, et une capture d’écran si possible.
      </p>
    </main>
  );
}
