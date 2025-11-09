import Map from "@/components/Map";

export default function HomePage() {
  return (
    <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Indie Map</h1>
      <Map />
    </main>
  );
}
