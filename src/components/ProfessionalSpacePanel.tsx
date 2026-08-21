"use client";

import React from "react";

type ProfessionalPlaceSummary = {
  id?: string;
  placeId: string;
  name?: string;
  city?: string;
  country?: string;
  category?: string;
  role?: string;
  plan?: string | null;
  resolvedPlan?: "free" | "pro" | "premium";
  accessStatus?: string;
  address?: string | null;
  website?: string | null;
  openingHours?: string | null;
  phone?: string | null;
  panoramaImage?: string | null;
  miniText?: string | null;
};

type ProfessionalPayload = {
  ok: true;
  places?: ProfessionalPlaceSummary[];
  selected?: ProfessionalPlaceSummary | null;
};

type ProfessionalSpacePanelProps = {
  isFr: boolean;
  onOpenPersonalSpace: () => void;
  onAuthenticated?: () => void | Promise<unknown>;
  canOpenPersonalSpace?: boolean;
  onLogout?: () => boolean | Promise<boolean>;
};

type Mode = "dashboard" | "place";

type EditableProfessionalField =
  | "name"
  | "address"
  | "openingHours"
  | "phone"
  | "website";

export default function ProfessionalSpacePanel({
  isFr,
  onOpenPersonalSpace,
  onAuthenticated,
  canOpenPersonalSpace,
  onLogout,
}: ProfessionalSpacePanelProps) {
  const locale = isFr ? "fr" : "en";

  const [mode, setMode] =
    React.useState<Mode>("dashboard");

  const [loading, setLoading] =
    React.useState(true);

  const [switchingPlace, setSwitchingPlace] =
    React.useState(false);

  const [error, setError] =
    React.useState("");

  const [authRequired, setAuthRequired] =
    React.useState(false);

  const [noProfessionalPlace, setNoProfessionalPlace] =
    React.useState(false);

  const [data, setData] =
    React.useState<ProfessionalPayload | null>(null);

  const [proAuthMode, setProAuthMode] =
    React.useState<"login" | "reset">("login");

  const [proIdentifier, setProIdentifier] =
    React.useState("");

  const [proPassword, setProPassword] =
    React.useState("");

  const [proAuthSending, setProAuthSending] =
    React.useState(false);

  const [proAuthError, setProAuthError] =
    React.useState("");

  const [proResetDone, setProResetDone] =
    React.useState(false);

  const [editingField, setEditingField] =
    React.useState<EditableProfessionalField | null>(null);

  const [editingValue, setEditingValue] =
    React.useState("");

  const [changeSending, setChangeSending] =
    React.useState(false);

  const [changeError, setChangeError] =
    React.useState("");

  const [changeSuccess, setChangeSuccess] =
    React.useState("");

  const [loggingOut, setLoggingOut] =
    React.useState(false);

  const load = React.useCallback(
    async (placeId?: string) => {
      if (placeId) {
        setSwitchingPlace(true);
      } else {
        setLoading(true);
      }

      setError("");
      setAuthRequired(false);
      setNoProfessionalPlace(false);

      try {
        const params =
          new URLSearchParams();

        if (placeId) {
          params.set(
            "placeId",
            placeId,
          );
        }

        const suffix =
          params.toString();

        const res =
          await fetch(
            `/api/v1/me/professional-space${
              suffix
                ? `?${suffix}`
                : ""
            }`,
            {
              cache: "no-store",
            },
          );

        const payload =
          await res
            .json()
            .catch(() => null);

        if (res.status === 401) {
          setData(null);
          setAuthRequired(true);
          return;
        }

        if (
          res.status === 404 ||
          payload?.error ===
            "professional_place_not_found"
        ) {
          setData(null);
          setNoProfessionalPlace(true);
          return;
        }

        if (
          !res.ok ||
          !payload?.ok
        ) {
          throw new Error(
            "professional_space_load_failed",
          );
        }

        setData(
          payload as ProfessionalPayload,
        );
      } catch {
        setData(null);
        setError(
          isFr
            ? "Impossible de charger l’espace professionnel pour le moment."
            : "Unable to load the professional space right now.",
        );
      } finally {
        setLoading(false);
        setSwitchingPlace(false);
      }
    },
    [isFr],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  async function submitProfessionalLogin() {
    const identifier =
      proIdentifier.trim();

    const password =
      proPassword;

    setProAuthError("");
    setProResetDone(false);

    if (identifier.length < 3) {
      setProAuthError(
        isFr
          ? "Entre ton email ou ton pseudo."
          : "Enter your email or username.",
      );
      return;
    }

    if (password.length < 8) {
      setProAuthError(
        isFr
          ? "Le mot de passe doit contenir au moins 8 caractères."
          : "Password must be at least 8 characters.",
      );
      return;
    }

    setProAuthSending(true);

    try {
      const res =
        await fetch(
          "/api/v1/auth/login",
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body: JSON.stringify({
              identifier,
              password,
            }),
          },
        );

      const payload =
        await res
          .json()
          .catch(() => null);

      if (
        !res.ok ||
        !payload?.ok ||
        !payload?.user
      ) {
        if (
          payload?.error ===
          "invalid_credentials"
        ) {
          setProAuthError(
            isFr
              ? "Identifiant ou mot de passe incorrect."
              : "Incorrect identifier or password.",
          );
          return;
        }

        setProAuthError(
          isFr
            ? "Impossible de se connecter pour le moment."
            : "Unable to sign in right now.",
        );
        return;
      }

      setProPassword("");
      setProAuthError("");

      // Évite d'afficher brièvement l'état
      // "aucun établissement" entre la connexion
      // et le chargement de l'espace professionnel.
      setLoading(true);
      setAuthRequired(false);

      await onAuthenticated?.();
      await load();
    } catch {
      setProAuthError(
        isFr
          ? "Impossible de se connecter pour le moment."
          : "Unable to sign in right now.",
      );
    } finally {
      setProAuthSending(false);
    }
  }

  async function requestProfessionalPasswordReset() {
    const email =
      proIdentifier.trim();

    setProAuthError("");
    setProResetDone(false);

    if (
      !email ||
      !email.includes("@")
    ) {
      setProAuthError(
        isFr
          ? "Entre l’adresse email associée à ton compte."
          : "Enter the email linked to your account.",
      );
      return;
    }

    setProAuthSending(true);

    try {
      const res =
        await fetch(
          "/api/v1/auth/password-reset/request",
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body: JSON.stringify({
              email,
            }),
          },
        );

      const payload =
        await res
          .json()
          .catch(() => null);

      if (
        !res.ok ||
        !payload?.ok
      ) {
        setProAuthError(
          isFr
            ? "Impossible d’envoyer le lien pour le moment."
            : "Unable to send the link right now.",
        );
        return;
      }

      setProResetDone(true);
    } catch {
      setProAuthError(
        isFr
          ? "Impossible d’envoyer le lien pour le moment."
          : "Unable to send the link right now.",
      );
    } finally {
      setProAuthSending(false);
    }
  }

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[#F97316]" />

        <p className="mt-4 text-[13px] text-white/45">
          {isFr
            ? "Chargement de l’espace pro…"
            : "Loading professional space…"}
        </p>
      </div>
    );
  }

  if (authRequired) {
    return (
      <div className="pb-2">
        <div className="relative overflow-hidden rounded-[28px] border border-[#8D854D]/25 bg-[#202119] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
          <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#8D854D]/10 blur-[50px]" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-[#F97316]/[0.07] blur-[55px]" />

          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[#B5AA6A]">
                  Indie Map
                </p>

                <h2 className="mt-2 font-serif text-[29px] font-semibold leading-none tracking-[-0.02em] text-[#F3EBD8]">
                  {isFr
                    ? "Espace professionnel"
                    : "Professional space"}
                </h2>
              </div>

              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#8D854D]/25 bg-[#8D854D]/10 text-[#C9C08A]">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7" />
                  <path d="M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
                  <path d="M3 11h18" />
                  <path d="M10 14h4" />
                </svg>
              </span>
            </div>

            <p className="mt-4 max-w-md text-[13px] leading-relaxed text-white/48">
              {proAuthMode === "login"
                ? isFr
                  ? "Accède à l’espace dédié à ton établissement et à sa présence sur Indie Map."
                  : "Access the space dedicated to your business and its presence on Indie Map."
                : isFr
                  ? "Entre l’email associé à ton compte Indie Map pour recevoir un lien de réinitialisation."
                  : "Enter the email linked to your Indie Map account to receive a reset link."}
            </p>

            <div className="mt-6 space-y-3">
              <div>
                <label className="mb-1.5 block px-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/30">
                  {proAuthMode === "login"
                    ? isFr
                      ? "Email ou pseudo"
                      : "Email or username"
                    : "Email"}
                </label>

                <input
                  type={
                    proAuthMode === "reset"
                      ? "email"
                      : "text"
                  }
                  value={proIdentifier}
                  onChange={(event) =>
                    setProIdentifier(
                      event.target.value,
                    )
                  }
                  autoComplete={
                    proAuthMode === "login"
                      ? "username"
                      : "email"
                  }
                  placeholder={
                    proAuthMode === "login"
                      ? isFr
                        ? "Votre identifiant"
                        : "Your identifier"
                      : "email@exemple.com"
                  }
                  className="w-full rounded-2xl border border-white/[0.09] bg-black/20 px-4 py-3.5 text-[14px] text-white outline-none placeholder:text-white/22 focus:border-[#8D854D]/55 focus:bg-black/25"
                />
              </div>

              {proAuthMode === "login" ? (
                <div>
                  <label className="mb-1.5 block px-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/30">
                    {isFr
                      ? "Mot de passe"
                      : "Password"}
                  </label>

                  <input
                    type="password"
                    value={proPassword}
                    onChange={(event) =>
                      setProPassword(
                        event.target.value,
                      )
                    }
                    autoComplete="current-password"
                    placeholder="••••••••"
                    onKeyDown={(event) => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        event.preventDefault();
                        void submitProfessionalLogin();
                      }
                    }}
                    className="w-full rounded-2xl border border-white/[0.09] bg-black/20 px-4 py-3.5 text-[14px] text-white outline-none placeholder:text-white/22 focus:border-[#8D854D]/55 focus:bg-black/25"
                  />
                </div>
              ) : null}

              {proAuthError ? (
                <p className="px-1 text-[12px] leading-relaxed text-red-200/85">
                  {proAuthError}
                </p>
              ) : null}

              {proResetDone ? (
                <p className="rounded-2xl border border-[#8D854D]/20 bg-[#8D854D]/10 px-4 py-3 text-[12px] leading-relaxed text-[#D8D0A8]">
                  {isFr
                    ? "Si un compte existe avec cet email, un lien vient d’être envoyé."
                    : "If an account exists with this email, a link has been sent."}
                </p>
              ) : null}

              <button
                type="button"
                disabled={proAuthSending}
                onClick={() => {
                  if (
                    proAuthMode ===
                    "reset"
                  ) {
                    void requestProfessionalPasswordReset();
                  } else {
                    void submitProfessionalLogin();
                  }
                }}
                className="mt-1 w-full rounded-2xl bg-[#F3EBD8] px-4 py-3.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#1D1E18] shadow-[0_10px_30px_rgba(0,0,0,0.18)] disabled:opacity-55"
              >
                {proAuthSending
                  ? isFr
                    ? "Connexion…"
                    : "Signing in…"
                  : proAuthMode ===
                      "reset"
                    ? isFr
                      ? "Recevoir le lien"
                      : "Send reset link"
                    : isFr
                      ? "Accéder à mon espace"
                      : "Access my space"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setProAuthMode(
                    proAuthMode ===
                      "login"
                      ? "reset"
                      : "login",
                  );
                  setProAuthError("");
                  setProResetDone(false);
                  setProPassword("");
                }}
                className="w-full py-2 text-center text-[11px] font-medium text-white/38 underline decoration-white/20 underline-offset-4 hover:text-white/65"
              >
                {proAuthMode === "login"
                  ? isFr
                    ? "Mot de passe oublié ?"
                    : "Forgot password?"
                  : isFr
                    ? "Retour à la connexion"
                    : "Back to sign in"}
              </button>
            </div>
          </div>
        </div>

      </div>
    );
  }

  if (noProfessionalPlace) {
    return (
      <>
        <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#5C6E3B]">
            {isFr
              ? "Espace pro"
              : "Professional"}
          </p>

          <h2 className="mt-2 font-serif text-[25px] font-semibold leading-tight text-white">
            {isFr
              ? "Votre lieu sur Indie Map"
              : "Your place on Indie Map"}
          </h2>

          <p className="mt-3 text-[14px] leading-relaxed text-white/65">
            {isFr
              ? "Aucun établissement professionnel n’est encore associé à votre compte."
              : "No professional place is currently linked to your account."}
          </p>

          <p className="mt-3 text-[13px] leading-relaxed text-white/45">
            {isFr
              ? "Si votre lieu est présent sur Indie Map et que vous souhaitez accéder à son espace professionnel, contactez-nous."
              : "If your place is listed on Indie Map and you want access to its professional space, contact us."}
          </p>

          <a
            href={
              isFr
                ? "mailto:pro@indie-map.com?subject=Acc%C3%A8s%20Espace%20Pro%20%E2%80%94%20Indie%20Map"
                : "mailto:pro@indie-map.com?subject=Professional%20Space%20Access%20%E2%80%94%20Indie%20Map"
            }
            className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-black no-underline"
          >
            {isFr
              ? "Nous contacter"
              : "Contact us"}
          </a>
        </div>
      </>
    );
  }

  if (error || !data?.selected) {
    return (
      <div className="rounded-3xl border border-red-300/15 bg-red-500/8 p-5">
        <p className="text-[14px] leading-relaxed text-red-100/80">
          {error ||
            (isFr
              ? "Aucun établissement professionnel actif n’est disponible."
              : "No active professional place is available.")}
        </p>

        <button
          type="button"
          onClick={() =>
            void load()
          }
          className="mt-4 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/70"
        >
          {isFr
            ? "Réessayer"
            : "Try again"}
        </button>
      </div>
    );
  }

  const selected =
    data.selected;

  const places =
    Array.isArray(data.places)
      ? data.places
      : [];

  const listingInformation = [
    {
      key: "name",
      label: isFr ? "Nom" : "Name",
      value: selected.name,
    },
    {
      key: "address",
      label: isFr ? "Adresse" : "Address",
      value: selected.address,
    },
    {
      key: "openingHours",
      label: isFr ? "Horaires" : "Opening hours",
      value: selected.openingHours,
    },
    {
      key: "phone",
      label: isFr ? "Téléphone" : "Phone",
      value: selected.phone,
    },
    {
      key: "website",
      label: isFr ? "Site web" : "Website",
      value: selected.website,
    },
  ];

  const completedListingInformation =
    listingInformation.filter(
      (item) =>
        String(item.value || "").trim().length > 0,
    ).length;

  function getFieldValue(
    field: EditableProfessionalField,
  ) {
    if (field === "name") {
      return selected.name || "";
    }

    if (field === "address") {
      return selected.address || "";
    }

    if (field === "openingHours") {
      return selected.openingHours || "";
    }

    if (field === "phone") {
      return selected.phone || "";
    }

    return selected.website || "";
  }

  function getFieldLabel(
    field: EditableProfessionalField,
  ) {
    const labels = {
      name: isFr ? "Nom" : "Name",
      address: isFr ? "Adresse" : "Address",
      openingHours: isFr ? "Horaires" : "Opening hours",
      phone: isFr ? "Téléphone" : "Phone",
      website: isFr ? "Site web" : "Website",
    };

    return labels[field];
  }

  function startEditingField(
    field: EditableProfessionalField,
  ) {
    setEditingField(field);
    setEditingValue(
      getFieldValue(field),
    );
    setChangeError("");
    setChangeSuccess("");
  }

  async function submitProfessionalChange() {
    if (!editingField) {
      return;
    }

    const value =
      editingValue.trim();

    if (
      editingField === "name" &&
      value.length < 2
    ) {
      setChangeError(
        isFr
          ? "Le nom doit contenir au moins 2 caractères."
          : "The name must contain at least 2 characters.",
      );
      return;
    }

    setChangeSending(true);
    setChangeError("");
    setChangeSuccess("");

    try {
      const res =
        await fetch(
          "/api/v1/me/professional-change-requests",
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body: JSON.stringify({
              placeId:
                selected.placeId,
              kind:
                editingField,
              value,
            }),
          },
        );

      const payload =
        await res
          .json()
          .catch(() => null);

      if (
        !res.ok ||
        !payload?.ok
      ) {
        if (
          payload?.error ===
          "forbidden"
        ) {
          setChangeError(
            isFr
              ? "Vous n’êtes pas autorisé à modifier cet établissement."
              : "You are not authorized to modify this business.",
          );
          return;
        }

        setChangeError(
          isFr
            ? "Impossible d’envoyer la demande pour le moment."
            : "Unable to send the request right now.",
        );
        return;
      }

      setEditingField(null);
      setEditingValue("");

      setChangeSuccess(
        isFr
          ? "Demande envoyée. Indie Map vérifiera la modification avant sa publication."
          : "Request sent. Indie Map will review the change before it is published.",
      );
    } catch {
      setChangeError(
        isFr
          ? "Impossible d’envoyer la demande pour le moment."
          : "Unable to send the request right now.",
      );
    } finally {
      setChangeSending(false);
    }
  }

  function editableFieldCard(
    field: EditableProfessionalField,
  ) {
    const currentValue =
      getFieldValue(field);

    const isEditing =
      editingField === field;

    const isHours =
      field === "openingHours";

    return (
      <div className="border-b border-white/[0.07] last:border-b-0">
        <div className="px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-white/28">
                {getFieldLabel(field)}
              </p>

              {!isEditing ? (
                <p
                  className={
                    isHours
                      ? "mt-2 whitespace-pre-line text-[12px] leading-relaxed text-white/65"
                      : "mt-1.5 break-words text-[13px] leading-relaxed text-white/68"
                  }
                >
                  {currentValue ||
                    (isFr
                      ? "Non renseigné"
                      : "Not provided")}
                </p>
              ) : null}
            </div>

            {!isEditing ? (
              <button
                type="button"
                onClick={() =>
                  startEditingField(
                    field,
                  )
                }
                className="shrink-0 rounded-full border border-[#5C6E3B]/30 bg-[#5C6E3B]/10 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#AFC092]"
              >
                {isFr
                  ? "Modifier"
                  : "Edit"}
              </button>
            ) : null}
          </div>

          {isEditing ? (
            <div className="mt-3">
              {isHours ? (
                <textarea
                  value={editingValue}
                  onChange={(event) =>
                    setEditingValue(
                      event.target.value,
                    )
                  }
                  rows={8}
                  className="w-full resize-none rounded-2xl border border-white/[0.09] bg-black/20 px-4 py-3 text-[13px] leading-relaxed text-white outline-none placeholder:text-white/20 focus:border-[#5C6E3B]/60"
                />
              ) : (
                <input
                  type={
                    field === "website"
                      ? "url"
                      : field === "phone"
                        ? "tel"
                        : "text"
                  }
                  value={editingValue}
                  onChange={(event) =>
                    setEditingValue(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-2xl border border-white/[0.09] bg-black/20 px-4 py-3 text-[13px] text-white outline-none placeholder:text-white/20 focus:border-[#5C6E3B]/60"
                />
              )}

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={changeSending}
                  onClick={() => {
                    setEditingField(null);
                    setEditingValue("");
                    setChangeError("");
                  }}
                  className="flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45 disabled:opacity-50"
                >
                  {isFr
                    ? "Annuler"
                    : "Cancel"}
                </button>

                <button
                  type="button"
                  disabled={changeSending}
                  onClick={() =>
                    void submitProfessionalChange()
                  }
                  className="flex-[1.4] rounded-2xl bg-[#F3EBD8] px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#1D1E18] disabled:opacity-50"
                >
                  {changeSending
                    ? isFr
                      ? "Envoi…"
                      : "Sending…"
                    : isFr
                      ? "Envoyer la demande"
                      : "Send request"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  async function logoutProfessional() {
    if (!onLogout) {
      return;
    }

    setLoggingOut(true);
    setError("");

    try {
      const success =
        await onLogout();

      if (success === false) {
        setError(
          isFr
            ? "Impossible de se déconnecter pour le moment."
            : "Unable to sign out right now.",
        );
        return;
      }

      setData(null);
      setMode("dashboard");
      setNoProfessionalPlace(false);
      setAuthRequired(true);
    } catch {
      setError(
        isFr
          ? "Impossible de se déconnecter pour le moment."
          : "Unable to sign out right now.",
      );
    } finally {
      setLoggingOut(false);
    }
  }

  function professionalAccountActions() {
    return (
      <section className="mt-6 border-t border-white/[0.07] pt-5">
        {canOpenPersonalSpace ? (
          <button
            type="button"
            onClick={onOpenPersonalSpace}
            className="flex w-full items-center justify-between rounded-2xl border border-[#5C6E3B]/20 bg-[#5C6E3B]/[0.08] px-4 py-3.5 text-left hover:bg-[#5C6E3B]/[0.13]"
          >
            <span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-[#B4C39A]">
                {isFr
                  ? "Espace perso"
                  : "Personal space"}
              </span>

              <span className="mt-1 block text-[10px] text-white/32">
                {isFr
                  ? "Basculer vers mon espace personnel"
                  : "Switch to my personal space"}
              </span>
            </span>

            <span className="text-[17px] text-[#9AAA7D]">
              ⇄
            </span>
          </button>
        ) : null}

        <button
          type="button"
          disabled={loggingOut}
          onClick={() =>
            void logoutProfessional()
          }
          className="mt-3 w-full rounded-2xl border border-red-400/20 bg-red-500/[0.07] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-200/70 transition-colors hover:border-red-400/30 hover:bg-red-500/[0.12] hover:text-red-100 disabled:opacity-45"
        >
          {loggingOut
            ? isFr
              ? "Déconnexion…"
              : "Signing out…"
            : isFr
              ? "Déconnexion"
              : "Sign out"}
        </button>
      </section>
    );
  }

  function professionalNavigation() {
    return (
      <div className="mb-6 rounded-[24px] border border-white/[0.08] bg-black/20 p-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.15)]">
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => setMode("dashboard")}
            className={
              mode === "dashboard"
                ? "rounded-[17px] bg-[#F3EBD8] px-2 py-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#1D1E18] shadow-[0_8px_22px_rgba(0,0,0,0.18)]"
                : "rounded-[17px] px-2 py-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/38 transition-colors hover:bg-[#F3EBD8]/[0.06] hover:text-white/65"
            }
          >
            {isFr ? "Accueil" : "Home"}
          </button>

          <button
            type="button"
            onClick={() => setMode("place")}
            className={
              mode === "place"
                ? "rounded-[17px] bg-[#F3EBD8] px-2 py-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#1D1E18] shadow-[0_8px_22px_rgba(0,0,0,0.18)]"
                : "rounded-[17px] px-2 py-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/38 transition-colors hover:bg-[#5C6E3B]/10 hover:text-white/65"
            }
          >
            {isFr ? "Ma fiche" : "My listing"}
          </button>

          <div
            aria-disabled="true"
            className="relative flex items-center justify-center overflow-hidden rounded-[17px] border border-[#F97316]/[0.08] bg-[#F97316]/[0.035] px-1 py-3.5 text-center"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25">
              {isFr ? "Analyse" : "Analytics"}
            </span>

            <span className="absolute right-1.5 top-1.5 rounded-full border border-[#F97316]/20 bg-[#F97316]/10 px-1.5 py-0.5 text-[5.5px] font-bold uppercase tracking-[0.08em] text-[#F6A06C]">
              {isFr ? "À venir" : "Soon"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "place") {
    return (
      <>
        {professionalNavigation()}

        <div className="mb-5 px-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#8D854D]">
            {isFr
              ? "Ma fiche"
              : "My listing"}
          </p>

          <h2 className="mt-1 font-serif text-[26px] font-semibold leading-tight text-[#F3EBD8]">
            {selected.name}
          </h2>

          <p className="mt-2 text-[11px] leading-relaxed text-white/35">
            {isFr
              ? "Vous pouvez proposer une correction des informations pratiques ci-dessous. Chaque demande est vérifiée par Indie Map avant publication."
              : "You can suggest corrections to the practical information below. Every request is reviewed by Indie Map before publication."}
          </p>
        </div>

        {changeSuccess ? (
          <div className="mb-4 rounded-2xl border border-[#5C6E3B]/25 bg-[#5C6E3B]/10 px-4 py-3">
            <p className="text-[11px] leading-relaxed text-[#C4D0AE]">
              {changeSuccess}
            </p>
          </div>
        ) : null}

        {changeError ? (
          <div className="mb-4 rounded-2xl border border-red-300/15 bg-red-500/[0.08] px-4 py-3">
            <p className="text-[11px] leading-relaxed text-red-100/80">
              {changeError}
            </p>
          </div>
        ) : null}

        <section>
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5C6E3B]">
            {isFr
              ? "Informations publiques"
              : "Public information"}
          </p>

          <div className="overflow-hidden rounded-3xl border border-white/[0.09] bg-white/[0.045]">
            {editableFieldCard("name")}
            {editableFieldCard("address")}
            {editableFieldCard("openingHours")}
            {editableFieldCard("phone")}
            {editableFieldCard("website")}
          </div>
        </section>

        <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3">
          <p className="text-[10px] leading-relaxed text-white/30">
            {isFr
              ? "Les éléments éditoriaux de la fiche restent gérés par Indie Map pour le moment."
              : "Editorial elements of the listing remain managed by Indie Map for now."}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {professionalNavigation()}

      <div className="relative mb-5 overflow-hidden rounded-3xl border border-[#C9C08A]/15 bg-[linear-gradient(135deg,rgba(243,235,216,0.13),rgba(92,110,59,0.10))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_35px_rgba(0,0,0,0.18)]">
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-[#F3EBD8]/20 bg-[#5C6E3B]/20 shadow-[0_6px_20px_rgba(0,0,0,0.25)]">
            {selected.panoramaImage ? (
              <img
                src={selected.panoramaImage}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-serif text-[23px] font-semibold uppercase text-[#F3EBD8]">
                {String(selected.name || "?").trim().slice(0, 1)}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#5C6E3B]">
              {isFr
                ? "Espace pro"
                : "Professional"}
            </p>

            <h2 className="mt-1 truncate font-serif text-[23px] font-semibold leading-tight text-white">
              {selected.name}
            </h2>

            <p className="mt-1 truncate text-[11px] font-medium text-white/45">
              {[
                selected.category,
                selected.city,
                selected.country,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#8FA77B]" />

            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#B0C39E]">
              {isFr
                ? "Accès professionnel vérifié"
                : "Verified professional access"}
            </span>
          </div>

          <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/38">
            {isFr ? "Gratuit" : "Free"}
          </span>
        </div>
      </div>

      {places.length > 1 ? (
        <section className="mb-6">
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5C6E3B]">
            {isFr
              ? "Mes établissements"
              : "My places"}
          </p>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {places.map(
              (place) => {
                const active =
                  place.placeId ===
                  selected.placeId;

                return (
                  <button
                    key={
                      place.placeId
                    }
                    type="button"
                    disabled={
                      switchingPlace
                    }
                    onClick={() => {
                      if (active) {
                        return;
                      }

                      setMode(
                        "dashboard",
                      );

                      void load(
                        place.placeId,
                      );
                    }}
                    className={
                      active
                        ? "shrink-0 rounded-full bg-white px-4 py-2 text-[11px] font-semibold text-black"
                        : "shrink-0 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-[11px] font-semibold text-white/55"
                    }
                  >
                    {place.name ||
                      place.placeId}
                  </button>
                );
              },
            )}
          </div>
        </section>
      ) : null}

      <section>
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#AFC092]">
          {isFr
            ? "État de ma fiche"
            : "Listing status"}
        </p>

        <div className="rounded-3xl border border-[#5C6E3B]/20 bg-[linear-gradient(135deg,rgba(92,110,59,0.16),rgba(92,110,59,0.055))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-serif text-[23px] font-semibold text-[#F3EBD8]">
                {completedListingInformation} / 5
              </p>

              <p className="mt-1 text-[10px] leading-relaxed text-white/32">
                {isFr
                  ? "informations essentielles renseignées"
                  : "essential details provided"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setMode("place")}
              className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#AFC092]"
            >
              {isFr
                ? "Modifier →"
                : "Edit →"}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 border-t border-white/[0.06] pt-4">
            {listingInformation.map(
              (item) => {
                const complete =
                  String(
                    item.value || "",
                  ).trim().length > 0;

                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between"
                  >
                    <span className="text-[10px] text-white/40">
                      {item.label}
                    </span>

                    <span
                      className={
                        complete
                          ? "text-[12px] font-semibold text-[#5C6E3B]"
                          : "text-[10px] text-white/18"
                      }
                    >
                      {complete
                        ? "✓"
                        : isFr
                          ? "À compléter"
                          : "Missing"}
                    </span>
                  </div>
                );
              },
            )}
          </div>
        </div>
      </section>

      <section className="mt-5">
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F6A06C]">
          {isFr
            ? "Promouvoir un événement"
            : "Promote an event"}
        </p>

        <div
          aria-disabled="true"
          className="relative overflow-hidden rounded-3xl border border-[#F97316]/25 bg-[linear-gradient(135deg,rgba(249,115,22,0.14),rgba(249,115,22,0.035))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]"
        >
          <span className="absolute right-3 top-3 rounded-full border border-[#F97316]/20 bg-[#F97316]/10 px-2.5 py-1 text-[7px] font-semibold uppercase tracking-[0.12em] text-[#F6A06C]">
            {isFr
              ? "À venir"
              : "Coming soon"}
          </span>

          <p className="max-w-[72%] font-serif text-[20px] font-semibold leading-tight text-[#F3EBD8]">
            {isFr
              ? "Faites connaître ce qui se passe chez vous"
              : "Share what’s happening at your place"}
          </p>

          <p className="mt-2 max-w-[85%] text-[10px] leading-relaxed text-white/32">
            {isFr
              ? "Concert, brocante, vernissage, quiz, atelier ou autre rendez-vous."
              : "Concert, flea market, opening, quiz, workshop or another event."}
          </p>
        </div>
      </section>

      <section className="mt-5">
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C9C08A]">
          {isFr
            ? "Bientôt dans l’espace Pro"
            : "Coming to Professional"}
        </p>

        <div className="overflow-hidden rounded-3xl border border-[#C9C08A]/15 bg-[linear-gradient(135deg,rgba(201,192,138,0.09),rgba(243,235,216,0.025))]">
          {[
            isFr
              ? "Changement de miniText"
              : "miniText changes",
            isFr
              ? "Modification de photo"
              : "Photo changes",
            isFr
              ? "Analyse de votre visibilité"
              : "Visibility analytics",
            isFr
              ? "Promotions d’événements"
              : "Event promotions",
          ].map((label) => (
            <div
              key={label}
              className="flex items-center justify-between border-b border-white/[0.055] px-4 py-3 last:border-b-0"
            >
              <span className="flex items-center gap-2 text-[10px] text-white/48">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C9C08A]/70" />
                {label}
              </span>

              <span className="text-[7px] font-semibold uppercase tracking-[0.11em] text-[#C9C08A]/50">
                {isFr
                  ? "À venir"
                  : "Coming soon"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5">
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E2D8B9]">
          {isFr
            ? "Besoin d’aide ?"
            : "Need help?"}
        </p>

        <a
          href={
            isFr
              ? "mailto:pro@indie-map.com?subject=Espace%20Pro%20%E2%80%94%20Indie%20Map"
              : "mailto:pro@indie-map.com?subject=Professional%20Space%20%E2%80%94%20Indie%20Map"
          }
          className="flex w-full items-center justify-between rounded-3xl border border-[#F3EBD8]/10 bg-[#F3EBD8]/[0.055] px-4 py-4 text-left no-underline transition-colors hover:bg-[#F3EBD8]/[0.085]"
        >
          <span className="min-w-0">
            <span className="block text-[12px] font-semibold text-white/70">
              {isFr
                ? "Contacter Indie Map"
                : "Contact Indie Map"}
            </span>

            <span className="mt-1 block text-[10px] leading-relaxed text-white/30">
              {isFr
                ? "Une question, un problème ou une modification particulière."
                : "A question, an issue or a specific change."}
            </span>
          </span>

          <span className="ml-4 shrink-0 text-[18px] text-[#C9C08A]/70">
            →
          </span>
        </a>
      </section>

      {professionalAccountActions()}
    </>
  );
}
