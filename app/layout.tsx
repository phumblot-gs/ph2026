import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import EnvironmentBanner from "@/components/EnvironmentBanner"
import { Toaster } from "sonner"

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
  const showBanner = process.env.NEXT_PUBLIC_ENV !== 'production'
  
  return (
    <html lang="fr">
      <body className={inter.className} suppressHydrationWarning>
        <EnvironmentBanner />
        <div className={showBanner ? 'pt-7' : ''}>
          {children}
        </div>
        <Toaster 
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#fff',
              color: '#363636',
              border: '1px solid #e5e7eb',
            },
          }}
        />
      </body>
    </html>
  )
}