import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Kalam } from "next/font/google";
import { cookies } from "next/headers";
import { locales, defaultLocale } from "../../i18n";
import "./globals.css";
import { Sora } from "next/font/google";

const sora = Sora({ subsets: ["latin"] });
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const kalam = Kalam({ subsets: ["latin"], weight: ["300", "400", "700"] });

export const metadata: Metadata = {
  title: "Indie Map",
  description: "Carte + liste des commerces indépendants",
};


export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const c = await cookies();
  const candidate = c.get("NEXT_LOCALE")?.value ?? defaultLocale;
  const finalLocale = (locales as readonly string[]).includes(candidate)
    ? candidate
    : defaultLocale;

  return (
    <html lang={finalLocale} className={kalam.className}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen w-screen overflow-hidden fixed inset-0 bg-[hsl(var(--bg))]`}>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
