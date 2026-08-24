"use client";

import React from "react";

type BottomNavBarProfile = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  avatarColor: string | null;
  contributionRank?: number | null;
};

type BottomNavBarProfessionalPlace = {
  name?: string;
  panoramaImage?: string | null;
};

type BottomNavBarProps = {
  isFr: boolean;
  authProfile: BottomNavBarProfile | null;
  professionalPlace?: BottomNavBarProfessionalPlace | null;
  hasPersonalNotification?: boolean;
  onOpenPersonal: () => void;
  onOpenContrib: () => void;
  onCreateAccount: () => void;
  onOpenPros: () => void;
  minHeightClassName?: string;
};

export default function BottomNavBar({
  isFr,
  authProfile,
  professionalPlace = null,
  hasPersonalNotification = false,
  onOpenPersonal,
  onOpenContrib,
  onCreateAccount,
  onOpenPros,
  minHeightClassName = "min-h-[50px]",
}: BottomNavBarProps) {
  const [showContributionAuthRequired, setShowContributionAuthRequired] =
    React.useState(false);

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-[1200]">
      <div
        className="grid w-full grid-cols-3 border-t border-white/10 bg-black/95 text-white shadow-[0_-10px_30px_rgba(0,0,0,0.28)] backdrop-blur-sm"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <button
          type="button"
          onClick={onOpenPersonal}
          className={`flex ${minHeightClassName} flex-col items-center justify-center gap-0.5 px-2 text-center hover:bg-white/6 active:bg-white/10`}
        >
          <span className="relative flex h-6 w-6 items-center justify-center">
            {authProfile?.avatarUrl ? (
              <img src={authProfile.avatarUrl} alt="" className="h-5.5 w-5.5 rounded-full object-cover" />
            ) : authProfile ? (
              <span
                className="flex h-5.5 w-5.5 items-center justify-center rounded-full border border-white/20 text-[10px] font-semibold uppercase text-white"
                style={{ backgroundColor: authProfile.avatarColor || "#F97316" }}
              >
                {(authProfile.displayName || authProfile.username || "?").slice(0, 1)}
              </span>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5.5 w-5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="3.2" />
                <path d="M5.5 19c1.2-3.4 3.6-5.2 6.5-5.2s5.3 1.8 6.5 5.2" />
              </svg>
            )}
            {authProfile ? (() => {
              const contributionRank =
                authProfile.contributionRank;

              if (!contributionRank || contributionRank < 1) {
                return null;
              }

              return (
                <span
                  className={`absolute -right-1 -top-1 z-20 grid h-3.5 place-items-center rounded-full border border-white/20 bg-[#202020] shadow-[0_3px_8px_rgba(0,0,0,0.45)] ${
                    contributionRank === 1
                      ? "w-3.5 p-0"
                      : "min-w-3.5 px-0.5"
                  }`}
                  aria-label={`Contribution rank ${contributionRank}`}
                  title={`#${contributionRank}`}
                >
                  {contributionRank === 1 ? (
                    <svg
                      viewBox="0 0 24 24"
                      className="block h-2.5 w-2.5 -translate-y-[0.5px] text-[#EAB308]"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M3.2 7.2 7.4 11l4.6-7 4.6 7 4.2-3.8-2 10.8H5.2L3.2 7.2Zm2.6 12.1h12.4v1.8H5.8v-1.8Z" />
                    </svg>
                  ) : (
                    <span className="text-[7px] font-bold leading-none text-white">
                      #{contributionRank}
                    </span>
                  )}
                </span>
              );
            })() : null}

            {hasPersonalNotification ? (
              <span className="absolute -left-0.5 -top-0.5 z-20 h-2.5 w-2.5 rounded-full border border-[#262626] bg-[#F97316]" />
            ) : null}
          </span>
          <span className="whitespace-nowrap text-[9px] font-medium leading-tight">{isFr ? "Espace perso" : "Personal"}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (authProfile) {
              onOpenContrib();
              return;
            }

            setShowContributionAuthRequired(true);
          }}
          className={`flex ${minHeightClassName} flex-col items-center justify-center gap-0.5 px-2 text-center hover:bg-white/6 active:bg-white/10`}
        >
          <span className="flex h-6 w-6 items-center justify-center">
            <svg viewBox="0 0 24 24" className="h-5.5 w-5.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </span>
          <span className="whitespace-nowrap text-[9px] font-medium leading-tight">{isFr ? "Participer" : "Participate"}</span>
        </button>

        <button
          type="button"
          onClick={onOpenPros}
          className={`flex ${minHeightClassName} flex-col items-center justify-center gap-0.5 px-2 text-center hover:bg-white/6 active:bg-white/10`}
        >
          <span className="flex h-6 w-6 items-center justify-center">
            {professionalPlace?.panoramaImage ? (
              <img
                src={professionalPlace.panoramaImage}
                alt=""
                className="h-5.5 w-5.5 rounded-full border border-white/20 object-cover"
              />
            ) : professionalPlace ? (
              <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full border border-white/20 bg-[#5C6E3B] text-[10px] font-semibold uppercase text-white">
                {String(professionalPlace.name || "?").trim().slice(0, 1)}
              </span>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5.5 w-5.5 -translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 6h4" />
                <path d="M10 6a2 2 0 0 0-2 2v1h8V8a2 2 0 0 0-2-2" />
                <path d="M4 10h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9z" />
                <path d="M9 14h6" />
              </svg>
            )}
          </span>
          <span className="whitespace-nowrap text-[9px] font-medium leading-tight">{isFr ? "Espace pro" : "Pros"}</span>
        </button>
      </div>
    </div>

      {showContributionAuthRequired ? (
        <div
          className="fixed inset-0 z-[3000] flex items-end justify-center bg-black/60 px-4 pb-[calc(76px+env(safe-area-inset-bottom))] sm:items-center sm:pb-4"
          onClick={() => setShowContributionAuthRequired(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="contribution-auth-title"
            className="w-full max-w-md rounded-3xl border border-white/10 bg-black p-5 text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="contribution-auth-title"
              className="text-lg font-semibold"
            >
              {isFr
                ? "Un compte Indie Map est nécessaire"
                : "An Indie Map account is required"}
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-white/75">
              {isFr
                ? "Crée un compte pour contribuer et proposer des lieux à Indie Map."
                : "Create an account to contribute and suggest places to Indie Map."}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowContributionAuthRequired(false)}
                className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-semibold text-white/80 active:bg-white/10"
              >
                {isFr ? "Plus tard" : "Not now"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowContributionAuthRequired(false);
                  onCreateAccount();
                }}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black active:opacity-80"
              >
                {isFr ? "Créer un compte" : "Create account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
