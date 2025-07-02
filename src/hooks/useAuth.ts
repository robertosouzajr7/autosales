"use client";

import { useSession } from "next-auth/react";

export function useAuth() {
  const { data: session, status } = useSession();

  return {
    session,
    user: session?.user || null,
    loading: status === "loading",
    authenticated: !!session,
  };
}
