"use client";

import React from "react";

export type PersonalSpacePanelMode = "dashboard" | "profile";

export type PersonalSpaceAuthMode = "signup" | "login" | "resetRequest" | "resetConfirm";

export type PersonalSpaceAuthProfile = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  avatarColor: string | null;
  profileCompleted: boolean;
};

type PersonalSpacePanelProps = {
  isFr: boolean;
  mode: PersonalSpacePanelMode;
  authLoading: boolean;
  authProfile: PersonalSpaceAuthProfile | null;
  authMode: PersonalSpaceAuthMode;
  authEmail: string;
  authUsername: string;
  authPassword: string;
  authSending: boolean;
  authResetDone: boolean;
  authError: string;
  profileUsername: string;
  profileDisplayName: string;
  profileAvatarColor: string;
  profileHomeCity: string;
  profileAgeRange: string;
  commentsVisibleToFriends: boolean;
  visitedPlacesVisibleToFriends: boolean;
  profileSaving: boolean;
  profileSuccess: string;
  profileError: string;
  visitedPlacesCount: number;
  visitedCitiesCount: number;
  visitedThisMonthCount: number;
  onModeChange: (mode: PersonalSpacePanelMode) => void;
  onOpenSavedPlaces: () => void;
  onSetAuthMode: (mode: PersonalSpaceAuthMode) => void;
  onSetAuthEmail: (value: string) => void;
  onSetAuthUsername: (value: string) => void;
  onSetAuthPassword: (value: string) => void;
  onSetAuthError: (value: string) => void;
  onSetAuthResetDone: (value: boolean) => void;
  onSetAuthForceForm: (value: boolean) => void;
  onSetAuthResetToken: (value: string) => void;
  onSetProfileUsername: (value: string) => void;
  onSetProfileDisplayName: (value: string) => void;
  onSetProfileAvatarColor: (value: string) => void;
  onSetProfileHomeCity: (value: string) => void;
  onSetProfileAgeRange: (value: string) => void;
  onSetCommentsVisibleToFriends: (value: boolean) => void;
  onSetVisitedPlacesVisibleToFriends: (value: boolean) => void;
  onSubmitAuth: () => void;
  onRequestPasswordReset: () => void;
  onConfirmPasswordReset: () => void;
  onSaveProfile: () => void;
  onLogout: () => void;
};

const AVATAR_COLORS = ["#F97316", "#84A98C", "#2563EB", "#A855F7", "#EAB308", "#EC4899"];

export default function PersonalSpacePanel({
  isFr,
  mode,
  authLoading,
  authProfile,
  authMode,
  authEmail,
  authUsername,
  authPassword,
  authSending,
  authResetDone,
  authError,
  profileUsername,
  profileDisplayName,
  profileAvatarColor,
  profileHomeCity,
  profileAgeRange,
  commentsVisibleToFriends,
  visitedPlacesVisibleToFriends,
  profileSaving,
  profileSuccess,
  profileError,
  visitedPlacesCount,
  visitedCitiesCount,
  visitedThisMonthCount,
  onModeChange,
  onOpenSavedPlaces,
  onSetAuthMode,
  onSetAuthEmail,
  onSetAuthUsername,
  onSetAuthPassword,
  onSetAuthError,
  onSetAuthResetDone,
  onSetAuthForceForm,
  onSetAuthResetToken,
  onSetProfileUsername,
  onSetProfileDisplayName,
  onSetProfileAvatarColor,
  onSetProfileHomeCity,
  onSetProfileAgeRange,
  onSetCommentsVisibleToFriends,
  onSetVisitedPlacesVisibleToFriends,
  onSubmitAuth,
  onRequestPasswordReset,
  onConfirmPasswordReset,
  onSaveProfile,
  onLogout,
}: PersonalSpacePanelProps) {
  const locale = isFr ? "fr" : "en";
  const legalLinks = (
    <section className="mt-6 px-1">
      <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/30">
        {isFr ? "Aide et sécurité" : "Help and safety"}
      </p>
      <div className="space-y-1">
        <a
          href={`/${locale}/privacy`}
          onClick={(event) => {
            event.preventDefault();
            window.location.href = `/${locale}/privacy`;
          }}
          className="block py-0 text-[11px] font-medium text-white/60 no-underline hover:text-white/85"
        >
          {isFr ? "Confidentialité" : "Privacy"}
        </a>
        <a
          href={`/${locale}/support`}
          onClick={(event) => {
            event.preventDefault();
            window.location.href = `/${locale}/support`;
          }}
          className="block py-0 text-[11px] font-medium text-white/60 no-underline hover:text-white/85"
        >
          Support
        </a>
        <a
          href="mailto:contact@indie-map.com"
          className="block py-0 text-[11px] font-medium text-white/60 no-underline hover:text-white/85"
        >
          Contact
        </a>
      </div>
    </section>
  );

  if (authLoading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40">
          {isFr ? "Espace perso" : "Personal space"}
        </p>
        <h2 className="mt-2 font-serif text-[24px] font-semibold leading-tight text-white">
          {isFr ? "Chargement..." : "Loading..."}
        </h2>
      </div>
    );
  }

  if (!authProfile || authMode === "resetConfirm") {
    return (
      <>
        <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40">
          {isFr ? "Espace perso" : "Personal space"}
        </p>
        <h2 className="mt-2 font-serif text-[25px] font-semibold leading-tight text-white">
          {authMode === "signup"
            ? (isFr ? "Créer un compte" : "Create an account")
            : authMode === "login"
              ? (isFr ? "Se connecter" : "Sign in")
              : authMode === "resetRequest"
                ? (isFr ? "Mot de passe oublié" : "Forgot password")
                : (isFr ? "Nouveau mot de passe" : "New password")}
        </h2>

        {authMode === "resetRequest" || authMode === "resetConfirm" ? null : (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                onSetAuthMode("signup");
                onSetAuthError("");
                onSetAuthResetDone(false);
              }}
              className={`rounded-2xl border px-3 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] ${authMode === "signup" ? "border-white/25 bg-white text-black" : "border-white/10 bg-white/8 text-white/65"}`}
            >
              {isFr ? "Créer un compte" : "Create account"}
            </button>
            <button
              type="button"
              onClick={() => {
                onSetAuthMode("login");
                onSetAuthError("");
                onSetAuthResetDone(false);
              }}
              className={`rounded-2xl border px-3 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] ${authMode === "login" ? "border-white/25 bg-white text-black" : "border-white/10 bg-white/8 text-white/65"}`}
            >
              {isFr ? "Se connecter" : "Sign in"}
            </button>
          </div>
        )}

        <p className="mt-3 text-[14px] leading-relaxed text-white/65">
          {authMode === "signup"
            ? (isFr ? "Crée ton espace personnel avec un email, un pseudo et un mot de passe." : "Create your personal space with an email, a username, and a password.")
            : authMode === "login"
              ? (isFr ? "Connecte-toi avec ton email ou ton pseudo, puis ton mot de passe." : "Sign in with your email or username, then your password.")
              : authMode === "resetRequest"
                ? (isFr ? "Entre ton email. Indie Map t’enverra un lien sécurisé et te rappellera ton pseudo." : "Enter your email. Indie Map will send you a secure link and remind you of your username.")
                : (isFr ? "Choisis un nouveau mot de passe pour ton compte Indie Map." : "Choose a new password for your Indie Map account.")}
        </p>

        <div className="mt-5 space-y-3">
          {authMode === "signup" || authMode === "resetRequest" ? (
            <input
              type="email"
              value={authEmail}
              onChange={(e) => onSetAuthEmail(e.target.value)}
              placeholder={isFr ? "Email" : "Email"}
              className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-white/25"
            />
          ) : null}

          {authMode === "signup" || authMode === "login" ? (
            <input
              type="text"
              value={authUsername}
              onChange={(e) => onSetAuthUsername(e.target.value)}
              placeholder={authMode === "signup" ? (isFr ? "Pseudo" : "Username") : (isFr ? "Email ou pseudo" : "Email or username")}
              className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-white/25"
            />
          ) : null}

          {authMode === "signup" || authMode === "login" || authMode === "resetConfirm" ? (
            <input
              type="password"
              value={authPassword}
              onChange={(e) => onSetAuthPassword(e.target.value)}
              placeholder={authMode === "resetConfirm" ? (isFr ? "Nouveau mot de passe" : "New password") : (isFr ? "Mot de passe" : "Password")}
              className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-white/25"
            />
          ) : null}

          <button
            type="button"
            onClick={authMode === "resetRequest" ? onRequestPasswordReset : authMode === "resetConfirm" ? onConfirmPasswordReset : onSubmitAuth}
            disabled={authSending}
            className="w-full rounded-2xl bg-white px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-60"
          >
            {authSending
              ? (isFr ? "Patiente..." : "Please wait...")
              : authMode === "signup"
                ? (isFr ? "Créer mon compte" : "Create my account")
                : authMode === "login"
                  ? (isFr ? "Me connecter" : "Sign in")
                  : authMode === "resetRequest"
                    ? (isFr ? "Recevoir le lien" : "Send link")
                    : (isFr ? "Changer mon mot de passe" : "Change my password")}
          </button>

          {authMode === "signup" || authMode === "login" ? (
            <button
              type="button"
              onClick={() => {
                onSetAuthMode("resetRequest");
                onSetAuthError("");
                onSetAuthResetDone(false);
                onSetAuthForceForm(true);
                onSetAuthPassword("");
              }}
              className="w-full text-center text-[13px] font-medium text-white/55 underline underline-offset-4 hover:text-white/80"
            >
              {isFr ? "Mot de passe / pseudo oublié ?" : "Forgot password / username?"}
            </button>
          ) : null}

          {authMode === "resetRequest" || authMode === "resetConfirm" ? (
            <button
              type="button"
              onClick={() => {
                onSetAuthMode("login");
                onSetAuthError("");
                onSetAuthResetDone(false);
                onSetAuthForceForm(true);
                onSetAuthPassword("");
                onSetAuthResetToken("");

                if (typeof window !== "undefined") {
                  const url = new URL(window.location.href);
                  url.searchParams.delete("resetPasswordToken");
                  window.history.replaceState({}, "", url.toString());
                }
              }}
              className="w-full text-center text-[13px] font-medium text-white/55 underline underline-offset-4 hover:text-white/80"
            >
              {isFr ? "Retour à la connexion" : "Back to sign in"}
            </button>
          ) : null}

          {authResetDone ? (
            <p className="text-[13px] leading-relaxed text-emerald-200">
              {authMode === "login"
                ? (isFr ? "Mot de passe modifié. Ton pseudo est prérempli si le compte en avait un." : "Password updated. Your username is prefilled if the account had one.")
                : (isFr ? "Si un compte existe avec cet email, un lien vient d’être envoyé." : "If an account exists with that email, a link has been sent.")}
            </p>
          ) : null}

          {authError ? (
            <p className="text-[13px] leading-relaxed text-red-200">{authError}</p>
          ) : null}
        </div>
        </div>
        {legalLinks}
      </>
    );
  }

  if (!authProfile.profileCompleted) {
    return (
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
            onChange={(e) => onSetProfileUsername(e.target.value)}
            placeholder={isFr ? "Pseudo obligatoire" : "Required username"}
            className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-white/25"
          />
          <input
            type="text"
            value={profileDisplayName}
            onChange={(e) => onSetProfileDisplayName(e.target.value)}
            placeholder={isFr ? "Nom affiché optionnel" : "Optional display name"}
            className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-white/25"
          />
          <input
            type="text"
            value={profileHomeCity}
            onChange={(e) => onSetProfileHomeCity(e.target.value)}
            placeholder={isFr ? "Ville de résidence optionnelle" : "Optional home city"}
            className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-white/25"
          />
          <select
            value={profileAgeRange}
            onChange={(e) => onSetProfileAgeRange(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-[15px] text-white outline-none focus:border-white/25"
          >
            <option value="">{isFr ? "Tranche d’âge optionnelle" : "Optional age range"}</option>
            <option value="18_24">18–24</option>
            <option value="25_34">25–34</option>
            <option value="35_44">35–44</option>
            <option value="45_54">45–54</option>
            <option value="55_64">55–64</option>
            <option value="65_plus">65+</option>
            <option value="prefer_not_to_say">{isFr ? "Préfère ne pas répondre" : "Prefer not to say"}</option>
          </select>
          {legalLinks}

          <button
            type="button"
            onClick={onSaveProfile}
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
    );
  }

  if (mode === "profile") {
    return (
      <>
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onModeChange("dashboard")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/8 text-[18px] text-white/75 hover:bg-white/12 active:bg-white/16"
            aria-label={isFr ? "Retour" : "Back"}
          >
            ←
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
              {isFr ? "Réglages" : "Settings"}
            </p>
            <h2 className="mt-0.5 font-serif text-[23px] font-semibold leading-tight text-white">
              {isFr ? "Mon profil" : "My profile"}
            </h2>
          </div>
          <div className="h-10 w-10" />
        </div>

        <div className="space-y-6">
          <section>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              {isFr ? "Profil" : "Profile"}
            </p>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/8">
              <div className="flex items-center justify-between gap-4 px-4 py-4">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-white/90">
                    {isFr ? "Avatar" : "Avatar"}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-white/45">
                    {isFr ? "Couleur affichée sur ton profil." : "Color shown on your profile."}
                  </p>
                </div>
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[16px] font-semibold uppercase text-white shadow-[0_10px_24px_rgba(0,0,0,0.25)]"
                  style={{ backgroundColor: profileAvatarColor }}
                >
                  {(profileDisplayName || profileUsername || "?").slice(0, 1)}
                </span>
              </div>

              <div className="border-t border-white/10 px-4 py-3">
                <div className="flex flex-wrap justify-end gap-2">
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => onSetProfileAvatarColor(color)}
                      aria-label={color}
                      className={profileAvatarColor === color ? "h-8 w-8 rounded-full border-2 border-white shadow-[0_0_0_3px_rgba(255,255,255,0.18)]" : "h-8 w-8 rounded-full border border-white/15"}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between gap-4 border-t border-white/10 px-4 py-3">
                <span className="shrink-0 text-[14px] font-medium text-white/85">
                  {isFr ? "Nom affiché" : "Display name"}
                </span>
                <input
                  value={profileDisplayName}
                  onChange={(event) => onSetProfileDisplayName(event.target.value)}
                  placeholder={isFr ? "Optionnel" : "Optional"}
                  className="min-w-0 flex-1 bg-transparent text-right text-[14px] text-white outline-none placeholder:text-white/30"
                />
              </label>

              <label className="flex items-center justify-between gap-4 border-t border-white/10 px-4 py-3">
                <span className="shrink-0 text-[14px] font-medium text-white/85">
                  {isFr ? "Ville" : "City"}
                </span>
                <input
                  value={profileHomeCity}
                  onChange={(event) => onSetProfileHomeCity(event.target.value)}
                  placeholder={isFr ? "Optionnel" : "Optional"}
                  className="min-w-0 flex-1 bg-transparent text-right text-[14px] text-white outline-none placeholder:text-white/30"
                />
              </label>

              <label className="flex items-center justify-between gap-4 border-t border-white/10 px-4 py-3">
                <span className="shrink-0 text-[14px] font-medium text-white/85">
                  {isFr ? "Tranche d’âge" : "Age range"}
                </span>
                <select
                  value={profileAgeRange}
                  onChange={(event) => onSetProfileAgeRange(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-right text-[14px] text-white outline-none"
                >
                  <option value="">{isFr ? "Optionnel" : "Optional"}</option>
                  <option value="18_24">18–24</option>
                  <option value="25_34">25–34</option>
                  <option value="35_44">35–44</option>
                  <option value="45_54">45–54</option>
                  <option value="55_64">55–64</option>
                  <option value="65_plus">65+</option>
                  <option value="prefer_not_to_say">{isFr ? "Préfère ne pas répondre" : "Prefer not to say"}</option>
                </select>
              </label>
            </div>
          </section>

          <section>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              {isFr ? "Confidentialité" : "Privacy"}
            </p>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/8">
              <button
                type="button"
                onClick={() => onSetCommentsVisibleToFriends(!commentsVisibleToFriends)}
                className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-white/90">
                    {isFr ? "Commentaires visibles par mes amis" : "Comments visible to friends"}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-white/45">
                    {isFr ? "Tes amis verront seulement les commentaires que tu choisis de partager." : "Friends will only see comments you choose to share."}
                  </p>
                </div>
                <span className={commentsVisibleToFriends ? "flex h-7 w-12 shrink-0 items-center rounded-full bg-[#84A98C] p-1" : "flex h-7 w-12 shrink-0 items-center rounded-full bg-white/15 p-1"}>
                  <span className={commentsVisibleToFriends ? "h-5 w-5 translate-x-5 rounded-full bg-white transition-transform" : "h-5 w-5 rounded-full bg-white transition-transform"} />
                </span>
              </button>

              <button
                type="button"
                onClick={() => onSetVisitedPlacesVisibleToFriends(!visitedPlacesVisibleToFriends)}
                className="flex w-full items-center justify-between gap-4 border-t border-white/10 px-4 py-4 text-left"
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-white/90">
                    {isFr ? "Lieux visités visibles par mes amis" : "Visited places visible to friends"}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-white/45">
                    {isFr ? "Tes amis verront les lieux que tu marques comme visités." : "Friends will see places you mark as visited."}
                  </p>
                </div>
                <span className={visitedPlacesVisibleToFriends ? "flex h-7 w-12 shrink-0 items-center rounded-full bg-[#84A98C] p-1" : "flex h-7 w-12 shrink-0 items-center rounded-full bg-white/15 p-1"}>
                  <span className={visitedPlacesVisibleToFriends ? "h-5 w-5 translate-x-5 rounded-full bg-white transition-transform" : "h-5 w-5 rounded-full bg-white transition-transform"} />
                </span>
              </button>
            </div>
          </section>

          <button
            type="button"
            onClick={onSaveProfile}
            disabled={profileSaving}
            className="w-full rounded-2xl bg-white px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-60"
          >
            {profileSaving ? (isFr ? "Enregistrement..." : "Saving...") : (isFr ? "Enregistrer" : "Save")}
          </button>

          {profileSuccess ? (
            <p className="text-[13px] leading-relaxed text-emerald-200">{profileSuccess}</p>
          ) : null}
          {profileError ? (
            <p className="text-[13px] leading-relaxed text-red-200">{profileError}</p>
          ) : null}

          {legalLinks}
        </div>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onModeChange("profile")}
        className="mb-5 flex w-full items-center gap-4 rounded-3xl border border-white/10 bg-white/10 px-4 py-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_35px_rgba(0,0,0,0.18)] hover:bg-white/13 active:bg-white/16"
      >
        {authProfile.avatarUrl ? (
          <img src={authProfile.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[18px] font-semibold uppercase text-white"
            style={{ backgroundColor: authProfile.avatarColor || "#F97316" }}
          >
            {(authProfile.displayName || authProfile.username || "?").slice(0, 1)}
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block font-serif text-[25px] font-semibold leading-tight text-white">
            {authProfile.displayName || authProfile.username}
          </span>
          <span className="mt-1 block text-[12px] font-medium text-white/45">
            {isFr ? "Voir et modifier mon profil" : "View and edit my profile"}
          </span>
        </span>
      </button>

      <div className="mb-6 grid grid-cols-4 gap-2">
        <div className="grid h-[88px] grid-rows-[34px_34px] items-center justify-items-center rounded-2xl border border-white/10 bg-black/35 px-1 py-3 text-center">
          <p className="flex h-[34px] items-center justify-center text-[21px] font-semibold leading-none text-[#F97316]">{visitedPlacesCount}</p>
          <p className="flex h-[34px] max-w-full items-start justify-center text-center text-[7.4px] font-semibold uppercase leading-[1.15] tracking-[0.035em] text-white/35">
            {isFr ? "Lieux visités" : "Visited"}
          </p>
        </div>
        <div className="grid h-[88px] grid-rows-[34px_34px] items-center justify-items-center rounded-2xl border border-white/10 bg-black/35 px-1 py-3 text-center">
          <p className="flex h-[34px] items-center justify-center text-[21px] font-semibold leading-none text-[#F97316]">{visitedCitiesCount}</p>
          <p className="flex h-[34px] max-w-full items-start justify-center text-center text-[7.4px] font-semibold uppercase leading-[1.15] tracking-[0.035em] text-white/35">
            {isFr ? "Villes explorées" : "Cities"}
          </p>
        </div>
        <div className="grid h-[88px] grid-rows-[34px_34px] items-center justify-items-center rounded-2xl border border-white/10 bg-black/35 px-1 py-3 text-center">
          <p className="flex h-[34px] items-center justify-center text-[21px] font-semibold leading-none text-[#F97316]">{visitedThisMonthCount}</p>
          <p className="flex h-[34px] max-w-full items-start justify-center text-center text-[7.4px] font-semibold uppercase leading-[1.15] tracking-[0.035em] text-white/35">
            {isFr ? "Total visité par mois" : "Total visited per month"}
          </p>
        </div>
        <div className="grid h-[88px] grid-rows-[34px_34px] items-center justify-items-center rounded-2xl border border-white/10 bg-black/35 px-1 py-3 text-center">
          <p className="flex h-[34px] items-center justify-center text-[21px] font-semibold leading-none text-[#F97316]">0</p>
          <p className="flex h-[34px] max-w-full items-start justify-center text-center text-[7.4px] font-semibold uppercase leading-[1.15] tracking-[0.035em] text-white/35">
            {isFr ? "Contributions" : "Contributions"}
          </p>
        </div>
      </div>

      <section>
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5C6E3B]">
          {isFr ? "Mon espace" : "My space"}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onOpenSavedPlaces}
            className="flex min-h-[112px] flex-col justify-between rounded-2xl border border-white/8 bg-white/5 p-4 text-left hover:bg-[#5C6E3B]/12 active:bg-[#5C6E3B]/16"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#5C6E3B]/25 bg-[#5C6E3B]/15 text-[#5C6E3B]">
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20.2s-6.8-4.1-8.4-8.2C2.5 9.1 4.1 6.5 6.8 6.2c1.6-.2 3.1.6 4.2 2c1.1-1.4 2.6-2.2 4.2-2c2.7.3 4.3 2.9 3.2 5.8C18.8 16.1 12 20.2 12 20.2z" />
              </svg>
            </span>
            <span>
              <span className="block text-[12px] font-semibold uppercase tracking-[0.16em] text-white/55">
                {isFr ? "Mes lieux" : "My places"}
              </span>
              <span className="mt-1 block text-[11px] leading-snug text-white/35">
                {isFr ? "Lieux gardés de côté." : "Saved places."}
              </span>
            </span>
          </button>

          <button type="button" disabled className="flex min-h-[112px] flex-col justify-between rounded-2xl border border-white/8 bg-white/5 p-4 text-left opacity-70">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#5C6E3B]/25 bg-[#5C6E3B]/15 text-[#5C6E3B]">
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8.5 11.2a3 3 0 1 0 0-6a3 3 0 0 0 0 6z" />
                <path d="M15.8 10.6a2.6 2.6 0 1 0 0-5.2" />
                <path d="M3.8 19c.8-3.1 2.6-4.8 4.7-4.8s3.9 1.7 4.7 4.8" />
                <path d="M14.2 14.4c2 .3 3.5 1.8 4.1 4.6" />
              </svg>
            </span>
            <span>
              <span className="block text-[12px] font-semibold uppercase tracking-[0.16em] text-white/55">
                {isFr ? "Mes amis" : "Friends"}
              </span>
              <span className="mt-1 block text-[11px] leading-snug text-white/30">
                {isFr ? "Bientôt." : "Soon."}
              </span>
            </span>
          </button>

          <button type="button" disabled className="flex min-h-[112px] flex-col justify-between rounded-2xl border border-white/8 bg-white/5 p-4 text-left opacity-70">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#5C6E3B]/25 bg-[#5C6E3B]/15 text-[#5C6E3B]">
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3.8l1.8 5.2h5.5l-4.4 3.2l1.7 5.3L12 14.2l-4.6 3.3l1.7-5.3L4.7 9h5.5L12 3.8z" />
              </svg>
            </span>
            <span>
              <span className="block text-[12px] font-semibold uppercase tracking-[0.16em] text-white/55">
                {isFr ? "Impact local" : "Local impact"}
              </span>
              <span className="mt-1 block text-[11px] leading-snug text-white/30">
                {isFr ? "Bientôt." : "Soon."}
              </span>
            </span>
          </button>

          <button type="button" disabled className="flex min-h-[112px] flex-col justify-between rounded-2xl border border-white/8 bg-white/5 p-4 text-left opacity-70">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#5C6E3B]/25 bg-[#5C6E3B]/15 text-[#5C6E3B]">
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 5.5h14v9H8.5L5 18.2V5.5z" />
                <path d="M8.5 9h7" />
                <path d="M8.5 12h4.5" />
              </svg>
            </span>
            <span>
              <span className="block text-[12px] font-semibold uppercase tracking-[0.16em] text-white/55">
                {isFr ? "Commentaires" : "Comments"}
              </span>
              <span className="mt-1 block text-[11px] leading-snug text-white/30">
                {isFr ? "Bientôt." : "Soon."}
              </span>
            </span>
          </button>
        </div>
      </section>

      <button
        type="button"
        onClick={onLogout}
        disabled={authSending}
        className="mt-5 w-full rounded-2xl border border-red-300/20 bg-red-500/12 px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-red-100/85 hover:bg-red-500/18 active:bg-red-500/24 disabled:opacity-60"
      >
        {authSending ? (isFr ? "Déconnexion..." : "Signing out...") : (isFr ? "Déconnexion" : "Sign out")}
      </button>
    </>
  );

}
