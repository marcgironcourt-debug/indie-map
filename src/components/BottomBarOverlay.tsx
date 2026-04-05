"use client";

import Link from "next/link";
import React from "react";
import ContributeForm from "@/components/ContributeForm";

type Panel = null | "pros" | "contrib" | "about" | "myPlaces";

type SavedPlace = {
  id: string;
  name: string;
  city?: string;
  address?: string;
  panoramaImage?: string;
};

type SavedPlacesGroup = {
  city: string;
  places: SavedPlace[];
};

export default function BottomBarOverlay({
  locale,
  panel,
  setPanel,
  panelScrollRef,
  switchLocale,
  savedPlacesByCity,
  savedPlaceIndexes,
  onOpenSavedPlace,
  onSavedPlacesTouchStart,
  onSavedPlacesTouchMove,
  onSavedPlacesTouchEnd,
}: {
  locale: "fr" | "en";
  panel: Panel;
  setPanel: React.Dispatch<React.SetStateAction<Panel>>;
  panelScrollRef: React.RefObject<HTMLDivElement | null>;
  switchLocale: (nextLocale: "fr" | "en") => void;
  savedPlacesByCity: SavedPlacesGroup[];
  savedPlaceIndexes: Record<string, number>;
  onOpenSavedPlace: (id: string) => void;
  onSavedPlacesTouchStart: (e: React.TouchEvent<HTMLButtonElement>) => void;
  onSavedPlacesTouchMove: (e: React.TouchEvent<HTMLButtonElement>) => void;
  onSavedPlacesTouchEnd: (city: string, length: number) => void;
}) {
  const isFr = locale === "fr";

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-[1200]">
        <div
          className="grid w-full grid-cols-4 border-t border-white/10 bg-[#2a2a25]/95 text-white shadow-[0_-10px_30px_rgba(0,0,0,0.28)] backdrop-blur-sm"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <button
            type="button"
            onClick={() => setPanel("myPlaces")}
            className="flex min-h-[64px] flex-col items-center justify-center gap-1 px-2 text-center hover:bg-white/6 active:bg-white/10"
          >
            <span className="text-[24px] leading-none">♡</span>
            <span className="whitespace-nowrap text-[10px] font-medium leading-tight">{isFr ? "Mes lieux" : "My places"}</span>
          </button>

          <button
            type="button"
            onClick={() => setPanel("contrib")}
            className="flex min-h-[64px] flex-col items-center justify-center gap-1 px-2 text-center hover:bg-white/6 active:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="whitespace-nowrap h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            <span className="whitespace-nowrap text-[10px] font-medium leading-tight">{isFr ? "Proposer un lieu" : "Suggest"}</span>
          </button>

          <button
            type="button"
            onClick={() => setPanel("about")}
            className="flex min-h-[64px] flex-col items-center justify-center gap-1 px-2 text-center hover:bg-white/6 active:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16v-5" />
              <path d="M12 8h.01" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            <span className="whitespace-nowrap text-[10px] font-medium leading-tight">{isFr ? "Infos" : "Info"}</span>
          </button>

          <button
            type="button"
            onClick={() => setPanel("pros")}
            className="flex min-h-[64px] flex-col items-center justify-center gap-1 px-2 text-center hover:bg-white/6 active:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 -translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 6h4" />
              <path d="M10 6a2 2 0 0 0-2 2v1h8V8a2 2 0 0 0-2-2" />
              <path d="M4 10h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9z" />
              <path d="M9 14h6" />
            </svg>
            <span className="whitespace-nowrap text-[10px] font-medium leading-tight">{isFr ? "Espace pro" : "Pros"}</span>
          </button>
        </div>
      </div>

      {panel ? (
        <div className="fixed inset-0 z-[2001] bg-black/45 px-0 pt-6 pb-0">
          <div className="mx-auto flex h-full w-full max-w-none flex-col overflow-hidden rounded-t-3xl rounded-b-none border border-neutral-700 bg-[#262626] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex flex-col leading-none">
                <span className="text-lg font-semibold text-white">Indie Map</span>
                <span className="text-xs tracking-widest text-[#5C6E3B] italic -rotate-2 inline-block -mt-1">Back To Local</span>
              </div>
              <button
                type="button"
                aria-label={isFr ? "Fermer" : "Close"}
                onClick={() => setPanel(null)}
                className="inline-flex h-12 w-16 items-center justify-center rounded-2xl"
              >
                <span className="text-2xl leading-none text-white">×</span>
              </button>
            </div>

            <div ref={panelScrollRef} className="px-5 pb-6 flex-1 min-h-0 overflow-auto">
              {panel === "pros" ? (
                isFr ? (
                  <>
                    <p className="mb-4 text-white/80">
                      Indie Map met en avant des lieux indépendants qui privilégient le local, la réparation, le réemploi, l’agriculture respectueuse, et plus largement une économie plus sobre et plus humaine.
                    </p>

                    <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Ce que nous faisons</h2>
                    <ul className="list-disc pl-5 space-y-1 text-white/80">
                      <li>Rendre votre lieu visible dans une carte claire, centrée sur la découverte.</li>
                      <li>Présenter l’essentiel : histoire du lieu, démarche, informations pratiques.</li>
                      <li>Améliorer le produit à partir de statistiques d’usage globales et anonymes.</li>
                    </ul>

                    <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Pour qui ?</h2>
                    <p className="text-white/80">
                      Pour les commerces et lieux qui assument une démarche cohérente : sourcing local, fabrication responsable, économie circulaire, indépendance, utilité sociale, ou contribution concrète à la vie du territoire.
                    </p>

                    <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Devenir partenaire</h2>
                    <p className="text-white/80">
                      Le partenariat vise à construire quelque chose de durable : un produit utile, éthique, et crédible sur le long terme. Si vous souhaitez rejoindre Indie Map, contactez-nous .
                    </p>

                    <a
                      href="mailto:pro@indie-map.com?subject=Partenariat%20%E2%80%94%20Indie%20Map"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-1 px-5 py-3 rounded-2xl bg-[hsl(var(--brand))] text-white font-medium no-underline hover:bg-[hsl(var(--brand-600))]"
                    >
                      Contact
                    </a>
                  </>
                ) : (
                  <>
                    <p className="mb-4 text-white/80">
                      Indie Map highlights independent places that prioritize local sourcing, repair, reuse, regenerative or respectful farming, and more broadly a simpler and more human economy.
                    </p>

                    <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">What we do</h2>
                    <ul className="list-disc pl-5 space-y-1 text-white/80">
                      <li>Make your place visible on a clear map designed for discovery.</li>
                      <li>Show the essentials: the place, the approach, and practical info.</li>
                      <li>Improve the product using aggregated and anonymous usage statistics.</li>
                    </ul>

                    <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Who is it for?</h2>
                    <p className="text-white/80">
                      For businesses and places with a consistent approach: local sourcing, responsible making, circular economy, independence, social utility, or a tangible positive impact on their territory.
                    </p>

                    <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-white/80">Become a partner</h2>
                    <p className="text-white/80">
                      Partnership is about building something durable: a useful, ethical, and long-term credible product. If you want to join Indie Map, please reach out .
                    </p>

                    <a
                      href="mailto:pro@indie-map.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-1 px-5 py-3 rounded-2xl bg-[hsl(var(--brand))] text-white font-medium no-underline hover:bg-[hsl(var(--brand-600))]"
                    >
                      Contact
                    </a>
                  </>
                )
              ) : panel === "contrib" ? (
                isFr ? (
                  <>
                    <p className="mb-4 text-white/80">
                      Indie Map grandit grâce aux contributions. L’objectif : rendre visibles des lieux indépendants qui privilégient le local, la réparation, le réemploi, l’agriculture respectueuse et des pratiques cohérentes.
                    </p>
                    <div className="mt-4">
                      <ContributeForm locale="fr" />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mb-4 text-white/80">
                      Indie Map grows through contributions. The goal: make visible independent places that prioritize local sourcing, repair, reuse, respectful agriculture, and coherent practices.
                    </p>
                    <div className="mt-4">
                      <ContributeForm locale="en" />
                    </div>
                  </>
                )
              ) : panel === "myPlaces" ? (
                savedPlacesByCity.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {savedPlacesByCity.map((group) => {
                      const currentIndex = savedPlaceIndexes[group.city] ?? 0;
                      const currentPlace = group.places[currentIndex] ?? group.places[0] ?? null;
                      if (!currentPlace) return null;

                      return (
                        <div key={group.city}>
                          <h2 className="mb-2 text-sm font-semibold tracking-wide text-white/80">{group.city}</h2>
                          <button
                            type="button"
                            onClick={() => onOpenSavedPlace(currentPlace.id)}
                            onTouchStart={onSavedPlacesTouchStart}
                            onTouchMove={onSavedPlacesTouchMove}
                            onTouchEnd={() => onSavedPlacesTouchEnd(group.city, group.places.length)}
                            className="relative w-full overflow-hidden rounded-xl bg-white/10 text-left hover:bg-white/14 active:bg-white/18 touch-pan-y"
                            style={{
                              minHeight: "148px",
                              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -6px 14px rgba(0,0,0,0.16), 0 14px 30px rgba(0,0,0,0.20), 0 40px 90px rgba(0,0,0,0.14)"
                            }}
                          >
                            {currentPlace.panoramaImage ? (
                              <img
                                src={currentPlace.panoramaImage}
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                            ) : null}
                            <div
                              className="absolute inset-0"
                              style={{
                                background: "linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.18) 40%, rgba(0,0,0,0.64) 100%)"
                              }}
                            ></div>
                            <div className="absolute inset-0 z-10 flex flex-col justify-end p-3">
                              <div>
                                <p className="font-serif text-[15px] font-medium leading-tight tracking-[0.01em] text-white">
                                  {currentPlace.name}
                                </p>
                                <p className="mt-1 text-[11px] opacity-90 truncate text-white/90">
                                  {currentPlace.address || "Indie Map"}
                                </p>
                              </div>
                            </div>
                            {group.places.length > 1 ? (
                              <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1.5">
                                {group.places.map((item, index) => (
                                  <span
                                    key={item.id}
                                    className={index === currentIndex ? "h-1.5 w-3 rounded-full bg-white/95" : "h-1.5 w-1.5 rounded-full bg-white/55"}
                                  />
                                ))}
                              </div>
                            ) : null}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-white/80">
                    {isFr ? "Aucun lieu enregistré pour le moment." : "No saved places yet."}
                  </p>
                )
              ) : isFr ? (
                <>
                  <p className="mb-4 text-white/80">
                    Indie Map est né d’une difficulté simple : trouver des lieux qui produisent ou travaillent réellement localement.
                  </p>
                  <p className="mb-4 text-white/80">
                    En voyage comme dans sa propre ville, il devient compliqué d’identifier ce qui est fabriqué, cultivé ou pensé à l’échelle d’un territoire. Les informations existent, mais elles sont dispersées.
                  </p>
                  <p className="mb-4 text-white/80">
                    L’application référence des cafés, restaurants, ateliers, fermes, marchés, librairies ou boutiques qui ont un lien concret avec leur environnement : production locale, circuits courts, fabrication sur place, agriculture respectueuse, transformation artisanale.
                  </p>
                  <p className="mb-4 text-white/80">
                    Chaque lieu est présenté avec des informations essentielles : où il se trouve, ce qu’il fait, comment il fonctionne.
                  </p>
                  <p className="text-white/80">
                    Indie Map est conçu comme un outil simple : une carte pour repérer plus facilement ce qui se fait localement, où que l’on soit.
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-4 text-white/80">
                    Indie Map was created from a simple difficulty: finding places that genuinely produce or work locally.
                  </p>
                  <p className="mb-4 text-white/80">
                    Whether traveling or in your own city, it can be hard to identify what is actually made, grown, or rooted in a specific territory. The information exists, but it is scattered.
                  </p>
                  <p className="mb-4 text-white/80">
                    Indie Map gathers these places on a clear map.
                  </p>
                  <p className="mb-4 text-white/80">
                    The app references cafés, restaurants, workshops, farms, markets, bookstores, and shops that maintain a concrete link to their environment: local production, short supply chains, on-site making, respectful farming, artisanal transformation.
                  </p>
                  <p className="mb-4 text-white/80">
                    The goal is not to judge or rank. It is to make visible. While making it easier to consume differently.
                  </p>
                  <p className="mb-4 text-white/80">
                    Each place is presented with essential information: where it is, what it does, how it operates.
                  </p>
                  <p className="text-white/80">
                    Indie Map is designed as a simple tool: a map to more easily locate what is produced locally, wherever you are. The project grows progressively, city by city, prioritizing coherence and accuracy.
                  </p>
                </>
              )}

              {panel === "about" && (
                <div className="mt-6">
                  <p className="mb-2 text-sm font-semibold tracking-wide text-white/80">
                    {isFr ? "Langue" : "Language"}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => switchLocale("fr")}
                      className={"px-4 py-2 rounded-2xl border text-sm text-white " + (isFr ? "bg-white/12 border-white/20" : "bg-white/5 border-white/10 hover:bg-white/10")}
                    >
                      Français
                    </button>
                    <button
                      type="button"
                      onClick={() => switchLocale("en")}
                      className={"px-4 py-2 rounded-2xl border text-sm text-white " + (!isFr ? "bg-white/12 border-white/20" : "bg-white/5 border-white/10 hover:bg-white/10")}
                    >
                      English
                    </button>
                  </div>
                </div>
              )}

              {panel === "about" && (
                <div className="mt-4">
                  <p className="mb-2 text-sm text-white/80">
                    {isFr ? "Pour toutes questions ou suggestions :" : "For any questions or suggestions:"}
                  </p>
                  <a
                    href="mailto:contact@indie-map.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-1 px-5 py-3 rounded-2xl bg-[hsl(var(--brand))] text-white font-medium no-underline hover:bg-[hsl(var(--brand-600))]"
                  >
                    Contact
                  </a>
                </div>
              )}

              {panel === "about" && (
                <div className="mt-4 text-[11px] text-white/60">
                  <Link href={`/${locale}/privacy`} className="opacity-70 hover:opacity-100">
                    {isFr ? "Confidentialité" : "Privacy"}
                  </Link>
                  <br />
                  <Link href={`/${locale}/support`} className="opacity-70 hover:opacity-100">
                    Support
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
