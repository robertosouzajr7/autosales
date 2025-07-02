import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SessionProvider } from "./providers/SessionProvider";
import "./globals.css";

export const metadata = {
  title: "AutoSales - Automação de Vendas",
  description: "Automatize suas vendas e cobrança via WhatsApp",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  );
}
