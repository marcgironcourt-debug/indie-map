"use client";

type BottomNavBarProfile = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  avatarColor: string | null;
};

type BottomNavBarProps = {
  isFr: boolean;
  authProfile: BottomNavBarProfile | null;
  hasPersonalNotification?: boolean;
  onOpenPersonal: () => void;
  onOpenContrib: () => void;
  onOpenPros: () => void;
  minHeightClassName?: string;
};

export default function BottomNavBar({
  isFr,
  authProfile,
  hasPersonalNotification = false,
  onOpenPersonal,
  onOpenContrib,
  onOpenPros,
  minHeightClassName = "min-h-[50px]",
}: BottomNavBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[1200]">
      <div
        className="grid w-full grid-cols-3 border-t border-white/10 bg-[#262626]/95 text-white shadow-[0_-10px_30px_rgba(0,0,0,0.28)] backdrop-blur-sm"
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
            {hasPersonalNotification ? (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-[#262626] bg-[#5C6E3B]" />
            ) : null}
          </span>
          <span className="whitespace-nowrap text-[9px] font-medium leading-tight">{isFr ? "Espace perso" : "Personal"}</span>
        </button>

        <button
          type="button"
          onClick={onOpenContrib}
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
            <svg viewBox="0 0 24 24" className="h-5.5 w-5.5 -translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 6h4" />
              <path d="M10 6a2 2 0 0 0-2 2v1h8V8a2 2 0 0 0-2-2" />
              <path d="M4 10h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9z" />
              <path d="M9 14h6" />
            </svg>
          </span>
          <span className="whitespace-nowrap text-[9px] font-medium leading-tight">{isFr ? "Espace pro" : "Pros"}</span>
        </button>
      </div>
    </div>
  );
}
