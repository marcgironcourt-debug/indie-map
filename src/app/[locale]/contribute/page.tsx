import { redirect } from "next/navigation";

import ContributeForm from "@/components/ContributeForm";
import { getCurrentUser } from "@/lib/auth";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const l = locale === "en" ? "en" : "fr";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect(`/${l}?panel=personalSpace&signup=1`);
  }

  return <ContributeForm locale={l} />;
}
