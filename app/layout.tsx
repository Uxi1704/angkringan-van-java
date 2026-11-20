import './globals.css'

export const metadata = {
  title: 'VANJAVA65 & ARJUNA85',
  description: 'Kasir dan pantauan Angkringan VANJAVA65 dan ARJUNA85',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <div className="no-print h-1 bg-gradient-to-r from-primary via-sogan to-primary" />
        {children}
      </body>
    </html>
  )
}
