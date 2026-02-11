import Link from "next/link";

export default function ChooseLanguagePage() {
  return (
    <main className="min-h-[100dvh] w-full flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white/70 p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Indie Map</h1>
        <p className="mt-2 text-sm opacity-80">Choisir la langue / Choose language</p>

        <div className="mt-6 grid grid-cols-1 gap-3">
          <Link
            href="/fr"
            className="rounded-xl border border-black/10 bg-black text-white px-4 py-3 text-center font-semibold"
          >
            Français
          </Link>
          <Link
            href="/en"
            className="rounded-xl border border-black/10 bg-white px-4 py-3 text-center font-semibold"
          >
            English
          </Link>
        </div>

        <p className="mt-6 text-xs opacity-70">
          Tu pourras changer plus tard via un bouton dans l’interface.
        </p>
      </div>
    </main>
  );
}
