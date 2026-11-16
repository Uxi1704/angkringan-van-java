import './globals.css'

export const metadata = {
  title: 'Angkringan Van Java',
  description: 'Kasir dan pantauan penjualan dua lapak',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
