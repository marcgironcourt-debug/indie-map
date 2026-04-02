"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";

import ContributeForm from "@/components/ContributeForm";

type Panel = null | "pros" | "contrib" | "about" | "myPlaces";

type DiscoverPlace = {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  panoramaImage?: string;
  city?: string;
  address?: string;
  createdAt?: string;
  updatedAt?: string;
};

type NewPlace = DiscoverPlace;

const homeMemoryCache: Record<string, { discoverPlace: DiscoverPlace | null; newPlaces: NewPlace[] } | undefined> = {};

const explorerPulseCss = `
@keyframes explorerPulse {
  0% { transform: scale(1.00); }
  50% { transform: scale(1.03); }
  100% { transform: scale(1.00); }
}
`;

function readHomeCache(locale: "fr" | "en") {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem("im-home-cache:" + locale);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const discover = parsed?.discover && typeof parsed.discover === "object" ? parsed.discover : null;
    const newest = Array.isArray(parsed?.newPlaces) ? parsed.newPlaces : [];
    return {
      discoverPlace: discover as DiscoverPlace | null,
      newPlaces: newest as NewPlace[]
    };
  } catch {
    return null;
  }
}

function writeHomeCache(locale: "fr" | "en", discoverPlace: DiscoverPlace | null, newPlaces: NewPlace[]) {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      "im-home-cache:" + locale,
      JSON.stringify({
        discover: discoverPlace ?? null,
        newPlaces: Array.isArray(newPlaces) ? newPlaces : []
      })
    );
  } catch {}
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

function pickDailyPlace(list: DiscoverPlace[], dayKey: string) {
  const sorted = [...list].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  let hash = 0;
  const seed = dayKey + "|" + sorted.length;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return sorted[hash % sorted.length] ?? null;
}

export default function HomeScreen({ locale }: { locale: "fr" | "en" }) {
  const router = useRouter();
  const isFr = locale === "fr";
  const [panel, setPanel] = React.useState<Panel>(null);
  const panelScrollRef = React.useRef<HTMLDivElement | null>(null);
  const [discoverPlace, setDiscoverPlace] = React.useState<DiscoverPlace | null>(() => homeMemoryCache[locale]?.discoverPlace ?? null);

  React.useEffect(() => {
    try { router.prefetch(`/${locale}/carte`); } catch {}
  }, [router, locale]);
  const [discoverReady, setDiscoverReady] = React.useState(() => {
    const cached = homeMemoryCache[locale];
    return Boolean(cached?.discoverPlace || (cached?.newPlaces?.length ?? 0) > 0);
  });
  const [newPlaces, setNewPlaces] = React.useState<NewPlace[]>(() => homeMemoryCache[locale]?.newPlaces ?? []);
  const [newPlaceIndex, setNewPlaceIndex] = React.useState(0);
  const newPlacesTouchStartXRef = React.useRef<number | null>(null);
  const newPlacesTouchDeltaXRef = React.useRef(0);

  React.useEffect(() => {
    if (!panel) return;
    window.requestAnimationFrame(() => {
      panelScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
  }, [panel]);

  React.useEffect(() => {
    const cached = readHomeCache(locale);
    if (!cached) return;
    if (cached.discoverPlace) setDiscoverPlace(cached.discoverPlace);
    if (Array.isArray(cached.newPlaces) && cached.newPlaces.length > 0) {
      setNewPlaces(cached.newPlaces);
      setNewPlaceIndex(0);
    }
    if (cached.discoverPlace || (cached.newPlaces?.length ?? 0) > 0) {
      setDiscoverReady(true);
    }
  }, [locale]);

  React.useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  React.useEffect(() => {
    if (newPlaces.length <= 1) return;
    const id = window.setInterval(() => {
      setNewPlaceIndex((prev) => (prev + 1) % newPlaces.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, [newPlaces]);

  const currentNewPlace = newPlaces[newPlaceIndex] ?? null;

  function goToNewPlace(delta: number) {
    setNewPlaceIndex((prev) => {
      if (newPlaces.length === 0) return 0;
      return (prev + delta + newPlaces.length) % newPlaces.length;
    });
  }

  function onNewPlacesTouchStart(e: React.TouchEvent<HTMLButtonElement>) {
    newPlacesTouchStartXRef.current = e.touches[0]?.clientX ?? null;
    newPlacesTouchDeltaXRef.current = 0;
  }

  function onNewPlacesTouchMove(e: React.TouchEvent<HTMLButtonElement>) {
    const startX = newPlacesTouchStartXRef.current;
    if (startX == null) return;
    const currentX = e.touches[0]?.clientX ?? startX;
    newPlacesTouchDeltaXRef.current = currentX - startX;
  }

  function onNewPlacesTouchEnd() {
    const dx = newPlacesTouchDeltaXRef.current;
    newPlacesTouchStartXRef.current = null;
    newPlacesTouchDeltaXRef.current = 0;
    if (Math.abs(dx) < 35) return;
    if (dx < 0) {
      goToNewPlace(1);
      return;
    }
    goToNewPlace(-1);
  }

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const r = await fetch("/api/v1/places?locale=" + encodeURIComponent(locale), { cache: "no-store" });
        if (!r.ok) throw new Error("load failed");
        const j = await r.json();
        const arr = Array.isArray(j) ? j : j?.data || [];
        const all: DiscoverPlace[] = arr
          .map((item: any) => ({
            id: String(item?.id ?? ""),
            name: String(item?.name ?? "").trim(),
            lat: typeof item?.lat === "number" ? item.lat : undefined,
            lng: typeof item?.lng === "number" ? item.lng : undefined,
            panoramaImage: String(item?.panoramaImage ?? "").trim() || undefined,
            city: String(item?.city ?? "").trim() || undefined,
            address: String(item?.address ?? "").trim() || undefined,
            createdAt: String(item?.createdAt ?? "").trim() || undefined,
            updatedAt: String(item?.updatedAt ?? "").trim() || undefined
          }))
          .filter((item: DiscoverPlace) =>
            !!item.id &&
            !!item.name &&
            Number.isFinite(item.lat) &&
            Number.isFinite(item.lng)
          );

        const dayKey = new Date().toISOString().slice(0, 10);

        const finish = (pool: DiscoverPlace[]) => {
          if (cancelled) return;
          const latest = [...all]
            .sort((a, b) => {
              const aTime = Date.parse(a.updatedAt || a.createdAt || "") || 0;
              const bTime = Date.parse(b.updatedAt || b.createdAt || "") || 0;
              return bTime - aTime;
            })
            .slice(0, 5);
          const nextDiscover = pool.length > 0 ? pickDailyPlace(pool, dayKey) : null;
          homeMemoryCache[locale] = { discoverPlace: nextDiscover, newPlaces: latest };
          setNewPlaces(latest);
          setNewPlaceIndex(0);
          setDiscoverPlace(nextDiscover);
          setDiscoverReady(true);
          writeHomeCache(locale, nextDiscover, latest);
        };

        if (all.length === 0) {
          finish([]);
          return;
        }

        const pos = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
          try {
            if (!navigator.geolocation) {
              resolve(null);
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (position) => {
                resolve({
                  lat: Number(position.coords.latitude),
                  lng: Number(position.coords.longitude)
                });
              },
              () => resolve(null),
              {
                enableHighAccuracy: false,
                timeout: 4500,
                maximumAge: 21600000
              }
            );
          } catch {
            resolve(null);
          }
        });

        if (pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lng)) {
          const nearby = all.filter((item) => {
            const lat = Number(item.lat);
            const lng = Number(item.lng);
            return Number.isFinite(lat) && Number.isFinite(lng) && haversineKm(pos.lat, pos.lng, lat, lng) <= 50;
          });
          finish(nearby.length > 0 ? nearby : all);
          return;
        }

        finish(all);
      } catch {
        if (cancelled) return;
        setDiscoverReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locale]);

  function switchLocale(nextLocale: "fr" | "en") {
    if (nextLocale === locale) return;
    document.cookie = `NEXT_LOCALE=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.location.href = `/${nextLocale}`;
  }

  return (
    <>
      <style jsx global>{explorerPulseCss}</style>
      <div className="flex h-[100dvh] w-full flex-col bg-black text-white">
        <div className="mx-auto flex w-full max-w-md flex-col items-center px-6 pt-5">
          <div className="mb-2 flex w-full justify-center pt-2 pb-1">
            <div className="inline-flex flex-col items-start justify-center gap-1">
              <h1 className="text-[22px] font-semibold tracking-tight text-white">
                Indie Map
              </h1>

              <span className="-mt-3 inline-block -rotate-2 text-[13px] italic tracking-[0.13em] text-[#5C6E3B]">
                Back To Local
              </span>
            </div>
          </div>

        </div>

        <div className="flex flex-1 flex-col w-full pb-[78px]">
          

          <button
            onClick={() => router.push(`/${locale}/carte?entry=explore`)}
            className="relative w-full min-h-[220px] flex-[1.2] overflow-hidden rounded-b-xl mb-2"
              style={{
                background: "#181914"
              }}
            >
              <img
                src="/explorer-bg.png?v=3"
                alt=""
                className="absolute inset-0 h-full w-full object-cover" style={{ animation: "explorerPulse 5s ease-in-out infinite", transformOrigin: "center center" }}
              />
              <div className="relative z-10 flex h-full flex-col justify-end items-start px-6 pb-6 text-white">
                <p className="font-serif text-[24px] font-medium tracking-[0.01em]">
                  {isFr ? "Explorer le monde" : "Explore the world"}
                </p>
              </div>
            </button>

          

          <div className="grid w-full flex-1 grid-cols-2 gap-2 mb-2">
            <button
                type="button"
                onClick={() => {
                  if (discoverPlace?.id) {
                    router.push(`/${locale}/carte?discover=${encodeURIComponent(discoverPlace.id)}`);
                    return;
                  }
                  router.push(`/${locale}/carte`);
                }}
                className="relative h-full overflow-hidden rounded-xl bg-white/10 text-left hover:bg-white/14 active:bg-white/18"
                style={{
                  boxShadow: "inset 0 1.5px 0 rgba(255,255,255,0.22), inset 0 -6px 14px rgba(0,0,0,0.16), 0 14px 30px rgba(0,0,0,0.20), 0 40px 90px rgba(0,0,0,0.14)"
                }}
              >
                {discoverPlace?.panoramaImage ? (
                  <img
                    src={discoverPlace.panoramaImage}
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
                <div className="absolute inset-0 z-10 flex flex-col justify-between">
                  <div>
                    <div className="w-full px-3 py-1">
                      <p className="font-serif text-[15px] font-medium whitespace-nowrap tracking-[0.01em]">
                        {isFr ? "Découverte du jour" : "Discovery of the day"}
                      </p>
                    </div>
                  </div>
                  <div className="pr-7">
                    <div className="w-full px-3 py-1">
                      <p className="font-serif text-[15px] font-medium leading-tight tracking-[0.01em]">
                        {discoverPlace?.name || (isFr ? "Lieu surprise" : "Surprise place")}
                      </p>
                      <p className="text-[11px] opacity-90 truncate">
                        {discoverPlace?.city || discoverPlace?.address || "Indie Map"}
                      </p>
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (currentNewPlace?.id) {
                    router.push(`/${locale}/carte?discover=${encodeURIComponent(currentNewPlace.id)}`);
                    return;
                  }
                  router.push(`/${locale}/carte`);
                }}
                onTouchStart={onNewPlacesTouchStart}
                onTouchMove={onNewPlacesTouchMove}
                onTouchEnd={onNewPlacesTouchEnd}
                className="relative h-full overflow-hidden rounded-xl bg-white/10 text-left hover:bg-white/14 active:bg-white/18 touch-pan-y"
                style={{
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -6px 14px rgba(0,0,0,0.16), 0 14px 30px rgba(0,0,0,0.20), 0 40px 90px rgba(0,0,0,0.14)"
                }}
              >
                {currentNewPlace?.panoramaImage ? (
                  <img
                    src={currentNewPlace.panoramaImage}
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
                <div className="absolute inset-0 z-10 flex flex-col justify-between">
                  <div>
                    <div className="w-full px-3 py-1">
                      <p className="font-serif text-[15px] font-medium whitespace-nowrap tracking-[0.01em]">
                        {isFr ? "Ajouts récents" : "Recent additions"}
                      </p>
                    </div>
                  </div>
                  <div className="pr-7">
                    <div className="w-full px-3 py-1">
                      <p className="font-serif text-[15px] font-medium leading-tight tracking-[0.01em]">
                        {currentNewPlace?.name || (isFr ? "Ajoutés récemment" : "Recently added")}
                      </p>
                      <p className="text-[11px] opacity-90 truncate">
                        {currentNewPlace?.city || currentNewPlace?.address || "Indie Map"}
                      </p>
                    </div>
                  </div>
                </div>
                {newPlaces.length > 1 ? (
                  <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1.5">
                    {newPlaces.map((item, index) => (
                      <span
                        key={item.id}
                        className={index === newPlaceIndex ? "h-1.5 w-3 rounded-full bg-white/95" : "h-1.5 w-1.5 rounded-full bg-white/55"}
                      />
                    ))}
                  </div>
                ) : null}
            </button>

          </div>
        </div>
      </div>

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
                <></>
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




