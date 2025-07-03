"use client";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import CobrancaModule from "@/components/modules/CobrancaCompleto";

export default function CobrancaPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div>Carregando...</div>;
  }

  if (!session) {
    redirect("/auth/signin");
  }

  return <CobrancaModule />;
}
