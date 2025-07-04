// app/(dashboard)/contatos/page.tsx
"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { Loading } from "@/components/ui/Loading";
import { ContactsList } from "@/components/contacts/ContactsList";

// Importação dinâmica para evitar erros de SSR
const ContatosModule = dynamic(
  () => import("@/components/contacts/ContatosModule"),
  {
    loading: () => (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loading size="lg" />
      </div>
    ),
    ssr: false, // Desabilita SSR para este componente
  }
);

export default function ContactsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-[400px]">
          <Loading size="lg" />
        </div>
      }
    >
      <ContactsList />
    </Suspense>
  );
}
