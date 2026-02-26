"use client";

import { useRouter } from "next/navigation";

export default function PrivacyClose({ locale }: { locale: string }) {
  const r = useRouter();
  return (
    <button
      type="button"
      aria-label="Fermer"
      onClick={() => {
        try {
          r.back();
        } catch {
          r.push(`/${locale}`);
        }
      }}
      className="fixed right-4 top-4 z-[80] text-white text-2xl"
    >
      ×
    </button>
  );
}
