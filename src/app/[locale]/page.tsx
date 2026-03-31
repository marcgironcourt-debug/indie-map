import HomeScreen from "../../components/home/HomeScreen";

type Props = { params: Promise<{ locale: string }> };

export default async function Page({ params }: Props) {
  const { locale } = await params;
  const l = locale === "en" ? "en" : "fr";
  return <HomeScreen locale={l} />;
}
