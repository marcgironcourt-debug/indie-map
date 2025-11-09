'use client';

import dynamic from "next/dynamic";

const ClientMap = dynamic(() => import("@/components/ClientMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[70vh] w-full animate-pulse rounded-2xl bg-neutral-200/50 dark:bg-neutral-800/50" />
  ),
});

export default function MapPanel() {
  return (
    <section className="h-full w-full overflow-hidden rounded-2xl border border-neutral-200/60 bg-white shadow-sm dark:border-neutral-700/60 dark:bg-neutral-900">
      <ClientMap />
    </section>
  );
}
