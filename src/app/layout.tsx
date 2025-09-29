export const metadata = {
  title: 'Atlas des marques indépendantes',
  description: 'Carte interactive — alternatives hors réseaux sociaux',
}

import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
