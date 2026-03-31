import IndieMapSplitView from "../../../components/IndieMapSplitView";

type Props = { params: Promise<{ locale: string }> };

export default async function Page({ params }: Props) {
  const { locale } = await params;
  const l = locale === "en" ? "en" : "fr";

  return (
    <main className="h-[100dvh] w-full overflow-hidden">
      <IndieMapSplitView locale={l} />
    </main>
  );
}
