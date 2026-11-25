import type { Metadata, Viewport } from 'next'
import { Fraunces, Source_Sans_3 } from 'next/font/google'
import './globals.css'

const sans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-sans',
})

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
})

export const metadata: Metadata = {
  title: 'VANJAVA65 & ARJUNA85',
  description: 'Kasir dan pantauan Angkringan VANJAVA65 dan ARJUNA85',
}

export const viewport: Viewport = {
  themeColor: '#f3efe7',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${sans.variable} ${display.variable}`}>
      <body className="font-sans text-ink antialiased">
        <div className="no-print h-1.5 bg-gradient-to-r from-primary via-[#c4a574] to-sogan" />
        {children}
      </body>
    </html>
  )
}
