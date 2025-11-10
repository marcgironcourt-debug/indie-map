import React from "react";

export const metadata = {
  title: "Indie Map",
  description: "Carte + liste des commerces indépendants",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
