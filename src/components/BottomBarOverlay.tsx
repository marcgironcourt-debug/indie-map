"use client";

import Link from "next/link";
import React from "react";
import ContributeForm from "@/components/ContributeForm";

type Panel = null | "pros" | "contrib" | "about" | "myPlaces" | "myPlacesList";

type AuthProfile = {
  id: string;
  email: string | null;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  homeCity: string | null;
  ageRange: string | null;
  profileCompleted: boolean;
};

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
  const [authProfile, setAuthProfile] = React.useState<AuthProfile | null>(null);
  const [authLoading, setAuthLoading] = React.useState(false);
  const [authEmail, setAuthEmail] = React.useState("");
  const [authSending, setAuthSending] = React.useState(false);
  const [authSent, setAuthSent] = React.useState(false);
  const [authError, setAuthError] = React.useState("");
  const [profileUsername, setProfileUsername] = React.useState("");
  const [profileDisplayName, setProfileDisplayName] = React.useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = React.useState("");
  const [profileHomeCity, setProfileHomeCity] = React.useState("");
  const [profileAgeRange, setProfileAgeRange] = React.useState("");
  const [profileSaving, setProfileSaving] = React.useState(false);
  const [profileError, setProfileError] = React.useState("");

  const refreshAuthProfile = React.useCallback(async () => {
    setAuthLoading(true);
    try {
      const res = await fetch("/api/v1/me/profile", { cache: "no-store" });
      if (res.status === 401) {
        setAuthProfile(null);
        return null;
      }
      const data = await res.json().catch(() => null);
      const user = data?.user ?? null;
      if (data?.ok && user) {
        setAuthProfile(user);
        setProfileUsername(user.username || "");
        setProfileDisplayName(user.displayName || "");
        setProfileAvatarUrl(user.avatarUrl || "");
        setProfileHomeCity(user.homeCity || "");
        setProfileAgeRange(user.ageRange || "");
        return user as AuthProfile;
      }
      setAuthProfile(null);
      return null;
    } catch {
      setAuthProfile(null);
      return null;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (panel === "myPlaces") {
      refreshAuthProfile();
    }
  }, [panel, refreshAuthProfile]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "ok") {
      setPanel("myPlaces");
      refreshAuthProfile();
    }
  }, [setPanel, refreshAuthProfile]);

  async function requestAuthLink() {
    const email = authEmail.trim();
    setAuthError("");
    setAuthSent(false);
    if (!email || !email.includes("@")) {
      setAuthError(isFr ? "Entre une adresse email valide." : "Enter a valid email address.");
      return;
    }
    setAuthSending(true);
    try {
      const res = await fetch("/api/v1/auth/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        setAuthError(isFr ? "Impossible d’envoyer le lien pour le moment." : "Unable to send the link right now.");
        return;
      }
      setAuthSent(true);
    } catch {
      setAuthError(isFr ? "Impossible d’envoyer le lien pour le moment." : "Unable to send the link right now.");
    } finally {
      setAuthSending(false);
    }
  }

  async function saveProfile() {
    setProfileError("");
    const username = profileUsername.trim();
    if (username.length < 3) {
      setProfileError(isFr ? "Le pseudo doit contenir au moins 3 caractères." : "Username must be at least 3 characters.");
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetch("/api/v1/me/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username,
          displayName: profileDisplayName.trim() || username,
          avatarUrl: profileAvatarUrl.trim() || null,
          homeCity: profileHomeCity.trim() || null,
          ageRange: profileAgeRange || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.user) {
        setProfileError(data?.error === "username_taken" ? (isFr ? "Ce pseudo est déjà pris." : "This username is already taken.") : (isFr ? "Impossible d’enregistrer le profil." : "Unable to save profile."));
        return;
      }
      setAuthProfile(data.user);
    } catch {
      setProfileError(isFr ? "Impossible d’enregistrer le profil." : "Unable to save profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-[1200]">
        <div
          className="grid w-full grid-cols-4 border-t border-white/10 bg-[#262626]/95 text-white shadow-[0_-10px_30px_rgba(0,0,0,0.28)] backdrop-blur-sm"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <button
            type="button"
            onClick={() => setPanel("myPlaces")}
            className="flex min-h-[64px] flex-col items-center justify-center gap-1 px-2 text-center hover:bg-white/6 active:bg-white/10"
          >
            {authProfile?.avatarUrl ? (
              <img src={authProfile.avatarUrl} alt="" className="h-5.5 w-5.5 rounded-full object-cover" />
            ) : authProfile ? (
              <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[10px] font-semibold uppercase text-white">
                {(authProfile.displayName || authProfile.username || "?").slice(0, 1)}
              </span>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5.5 w-5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="3.2" />
                <path d="M5.5 19c1.2-3.4 3.6-5.2 6.5-5.2s5.3 1.8 6.5 5.2" />
              </svg>
            )}
            <span className="whitespace-nowrap text-[9px] font-medium leading-tight">{isFr ? "Espace perso" : "Personal"}</span>
          </button>

          <button
            type="button"
            onClick={() => setPanel("contrib")}
            className="flex min-h-[64px] flex-col items-center justify-center gap-1 px-2 text-center hover:bg-white/6 active:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="whitespace-nowrap h-5.5 w-5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            <span className="whitespace-nowrap text-[9px] font-medium leading-tight">{isFr ? "Proposer un lieu" : "Suggest"}</span>
          </button>

          <button
            type="button"
            onClick={() => setPanel("about")}
            className="flex min-h-[64px] flex-col items-center justify-center gap-1 px-2 text-center hover:bg-white/6 active:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-5.5 w-5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16v-5" />
              <path d="M12 8h.01" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            <span className="whitespace-nowrap text-[9px] font-medium leading-tight">{isFr ? "Infos" : "Info"}</span>
          </button>

          <button
            type="button"
            onClick={() => setPanel("pros")}
            className="flex min-h-[64px] flex-col items-center justify-center gap-1 px-2 text-center hover:bg-white/6 active:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-5.5 w-5.5 -translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 6h4" />
              <path d="M10 6a2 2 0 0 0-2 2v1h8V8a2 2 0 0 0-2-2" />
              <path d="M4 10h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9z" />
              <path d="M9 14h6" />
            </svg>
            <span className="whitespace-nowrap text-[9px] font-medium leading-tight">{isFr ? "Espace pro" : "Pros"}</span>
          </button>
        </div>
      </div>

      {panel ? (
        <div className="fixed inset-0 z-[2001] bg-black/45 px-0 pt-[30vh] pb-0">
          <div className="mx-auto flex h-[70vh] w-full max-w-none flex-col overflow-hidden rounded-t-3xl rounded-b-none border border-neutral-700 bg-[#262626] shadow-2xl">
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
                <>
                  {authLoading ? (
                    <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40">
                        {isFr ? "Espace perso" : "Personal space"}
                      </p>
                      <h2 className="mt-2 font-serif text-[24px] font-semibold leading-tight text-white">
                        {isFr ? "Chargement..." : "Loading..."}
                      </h2>
                    </div>
                  ) : !authProfile ? (
                    <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40">
                        {isFr ? "Espace perso" : "Personal space"}
                      </p>
                      <h2 className="mt-2 font-serif text-[25px] font-semibold leading-tight text-white">
                        {isFr ? "Créer un compte ou s’identifier" : "Create an account or sign in"}
                      </h2>
                      <p className="mt-3 text-[14px] leading-relaxed text-white/65">
                        {isFr ? "Entre ton email. Indie Map t’enverra un lien magique pour accéder à ton espace personnel." : "Enter your email. Indie Map will send you a magic link to access your personal space."}
                      </p>
                      <div className="mt-5 space-y-3">
                        <input
                          type="email"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder={isFr ? "ton@email.com" : "you@email.com"}
                          className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-white/25"
                        />
                        <button
                          type="button"
                          onClick={requestAuthLink}
                          disabled={authSending}
                          className="w-full rounded-2xl bg-white px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-60"
                        >
                          {authSending ? (isFr ? "Envoi..." : "Sending...") : (isFr ? "Recevoir mon lien" : "Get my link")}
                        </button>
                        {authSent ? (
                          <p className="text-[13px] leading-relaxed text-emerald-200">
                            {isFr ? "Lien envoyé. Vérifie ta boîte mail." : "Link sent. Check your inbox."}
                          </p>
                        ) : null}
                        {authError ? (
                          <p className="text-[13px] leading-relaxed text-red-200">{authError}</p>
                        ) : null}
                      </div>
                    </div>
                  ) : !authProfile.profileCompleted ? (
                    <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40">
                        {isFr ? "Profil" : "Profile"}
                      </p>
                      <h2 className="mt-2 font-serif text-[25px] font-semibold leading-tight text-white">
                        {isFr ? "Finalise ton profil" : "Complete your profile"}
                      </h2>
                      <p className="mt-3 text-[14px] leading-relaxed text-white/65">
                        {isFr ? "Seul le pseudo est obligatoire. Les autres informations pourront être modifiées plus tard." : "Only the username is required. The other details can be changed later."}
                      </p>
                      <div className="mt-5 space-y-3">
                        <input
                          type="text"
                          value={profileUsername}
                          onChange={(e) => setProfileUsername(e.target.value)}
                          placeholder={isFr ? "Pseudo obligatoire" : "Required username"}
                          className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-white/25"
                        />
                        <input
                          type="text"
                          value={profileDisplayName}
                          onChange={(e) => setProfileDisplayName(e.target.value)}
                          placeholder={isFr ? "Nom affiché optionnel" : "Optional display name"}
                          className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-white/25"
                        />
                        <input
                          type="url"
                          value={profileAvatarUrl}
                          onChange={(e) => setProfileAvatarUrl(e.target.value)}
                          placeholder={isFr ? "Lien photo de profil optionnel" : "Optional profile photo link"}
                          className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-white/25"
                        />
                        <input
                          type="text"
                          value={profileHomeCity}
                          onChange={(e) => setProfileHomeCity(e.target.value)}
                          placeholder={isFr ? "Ville de résidence optionnelle" : "Optional home city"}
                          className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-white/25"
                        />
                        <select
                          value={profileAgeRange}
                          onChange={(e) => setProfileAgeRange(e.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-[15px] text-white outline-none focus:border-white/25"
                        >
                          <option value="">{isFr ? "Tranche d’âge optionnelle" : "Optional age range"}</option>
                          <option value="under_18">{isFr ? "Moins de 18 ans" : "Under 18"}</option>
                          <option value="18_24">18–24</option>
                          <option value="25_34">25–34</option>
                          <option value="35_44">35–44</option>
                          <option value="45_54">45–54</option>
                          <option value="55_64">55–64</option>
                          <option value="65_plus">65+</option>
                          <option value="prefer_not_to_say">{isFr ? "Préfère ne pas répondre" : "Prefer not to say"}</option>
                        </select>
                        <button
                          type="button"
                          onClick={saveProfile}
                          disabled={profileSaving}
                          className="w-full rounded-2xl bg-white px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-60"
                        >
                          {profileSaving ? (isFr ? "Enregistrement..." : "Saving...") : (isFr ? "Entrer dans mon espace" : "Enter my space")}
                        </button>
                        {profileError ? (
                          <p className="text-[13px] leading-relaxed text-red-200">{profileError}</p>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <>
                  <div className="mb-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40">
                      {isFr ? "Espace perso" : "Personal space"}
                    </p>
                    <h2 className="mt-1 font-serif text-[24px] font-semibold leading-tight text-white">
                      {isFr ? "Ton tableau de bord" : "Your dashboard"}
                    </h2>
                  </div>

                  <div className="mb-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_28px_rgba(0,0,0,0.18)]">
                      <p className="text-[26px] font-semibold leading-none text-white">
                        0
                      </p>
                      <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">
                        {isFr ? "Lieux testés" : "Tested places"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_28px_rgba(0,0,0,0.18)]">
                      <p className="text-[26px] font-semibold leading-none text-white">0</p>
                      <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">
                        {isFr ? "Villes visitées" : "Visited cities"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_28px_rgba(0,0,0,0.18)]">
                      <p className="text-[26px] font-semibold leading-none text-white">0</p>
                      <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">
                        {isFr ? "Contributions" : "Contributions"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPanel("myPlacesList")}
                      className="flex min-h-[112px] flex-col justify-between rounded-2xl border border-white/10 bg-white/8 p-4 text-left hover:bg-white/12 active:bg-white/16"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white/75">
                        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20.2s-6.8-4.1-8.4-8.2C2.5 9.1 4.1 6.5 6.8 6.2c1.6-.2 3.1.6 4.2 2c1.1-1.4 2.6-2.2 4.2-2c2.7.3 4.3 2.9 3.2 5.8C18.8 16.1 12 20.2 12 20.2z" />
                        </svg>
                      </span>
                      <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/70">
                        {isFr ? "Mes lieux" : "My places"}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled
                      className="flex min-h-[112px] flex-col justify-between rounded-2xl border border-white/8 bg-white/5 p-4 text-left opacity-70"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white/60">
                        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8.5 11.2a3 3 0 1 0 0-6a3 3 0 0 0 0 6z" />
                          <path d="M15.8 10.6a2.6 2.6 0 1 0 0-5.2" />
                          <path d="M3.8 19c.8-3.1 2.6-4.8 4.7-4.8s3.9 1.7 4.7 4.8" />
                          <path d="M14.2 14.4c2 .3 3.5 1.8 4.1 4.6" />
                        </svg>
                      </span>
                      <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/55">
                        {isFr ? "Mes amis" : "Friends"}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled
                      className="flex min-h-[112px] flex-col justify-between rounded-2xl border border-white/8 bg-white/5 p-4 text-left opacity-70"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white/60">
                        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3.8l1.8 5.2h5.5l-4.4 3.2l1.7 5.3L12 14.2l-4.6 3.3l1.7-5.3L4.7 9h5.5L12 3.8z" />
                        </svg>
                      </span>
                      <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/55">
                        {isFr ? "Impact local" : "Local impact"}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled
                      className="flex min-h-[112px] flex-col justify-between rounded-2xl border border-white/8 bg-white/5 p-4 text-left opacity-70"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white/60">
                        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 5.5h14v9H8.5L5 18.2V5.5z" />
                          <path d="M8.5 9h7" />
                          <path d="M8.5 12h4.5" />
                        </svg>
                      </span>
                      <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/55">
                        {isFr ? "Commentaires" : "Comments"}
                      </span>
                    </button>
                  </div>
                    </>
                  )}
                </>
              ) : panel === "myPlacesList" ? (
                <>
                  <button
                    type="button"
                    onClick={() => setPanel("myPlaces")}
                    className="mb-4 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-[13px] font-semibold text-white/75 hover:bg-white/12 active:bg-white/16"
                  >
                    ← {isFr ? "Retour" : "Back"}
                  </button>

                  {savedPlacesByCity.length > 0 ? (
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
                              onClick={() => { setPanel(null); onOpenSavedPlace(currentPlace.id); }}
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
                  )}
                </>
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
