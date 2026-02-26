import ContributeForm from "@/components/ContributeForm";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = locale === "en" ? "en" : "fr";
  return <ContributeForm locale={l} />;
}
