"use client";

import { useRouter } from "next/navigation";

export default function PrivacyClose({ locale }: { locale: string }) {
  const r = useRouter();
  return (
    <button
      type="button"
      aria-label={locale === "fr" ? "Fermer" : "Close"}
      onClick={() => {
        try {
          r.back();
        } catch {
          r.push(`/${locale}`);
        }
      }}
      className="fixed right-4 z-[80] text-white text-2xl" style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
    >
      ×
    </button>
  );
}
