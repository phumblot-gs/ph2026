import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: `${process.env.NEXT_PUBLIC_PARTY_NAME || 'PH2026'} - ${process.env.NEXT_PUBLIC_CANDIDATE_NAME || 'Paul Hatte'} - Pour un Paris qui nous ressemble`,
  description: `Rejoignez le mouvement de ${process.env.NEXT_PUBLIC_CANDIDATE_NAME || 'Paul Hatte'} pour les élections municipales de Paris 2026`,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr">
      <body className={inter.className}>{children}</body>
    </html>
  )
}