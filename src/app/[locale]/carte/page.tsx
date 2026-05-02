import IndieMapSplitView from "../../../components/IndieMapSplitView";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ discover?: string; entry?: string; searchIds?: string }>;
};

export default async function Page({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const l = locale === "en" ? "en" : "fr";
  const discoverId =
    typeof sp?.discover === "string" && sp.discover.trim()
      ? sp.discover.trim()
      : null;
  const entry =
    typeof sp?.entry === "string" && sp.entry.trim()
      ? sp.entry.trim()
      : null;
  const searchIds =
    typeof sp?.searchIds === "string" && sp.searchIds.trim()
      ? sp.searchIds.trim()
      : null;

  return (
    <main className="h-[100dvh] w-full overflow-hidden">
      <IndieMapSplitView locale={l} discoverId={discoverId} entry={entry} searchIds={searchIds} />
    </main>
  );
}
