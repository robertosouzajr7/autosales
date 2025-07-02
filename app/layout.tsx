import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AutoSales - Automação de Vendas',
  description: 'Plataforma de automação de vendas e cobrança via WhatsApp',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
