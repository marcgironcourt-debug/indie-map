import type { Metadata } from "next";
import { Geist, Geist_Mono, Kalam } from "next/font/google";
import { cookies } from "next/headers";
import { locales, defaultLocale } from "../../i18n";
import "./globals.css";

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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
