export default function Page() {
  return (
    <main className="h-[100dvh] w-full flex items-center justify-center">
      <div className="text-center text-sm text-neutral-700">
        <p>Interface principale déplacée sur la page d’accueil.</p>
        <p>
          Rendez-vous sur{" "}
          <a href="/" className="underline">
            /
          </a>{" "}
          pour voir la carte Indie Map.
        </p>
      </div>
    </main>
  );
}
