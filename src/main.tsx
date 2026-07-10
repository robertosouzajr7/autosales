import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";

// --- Global Fetch Interceptor: injeta o JWT em toda chamada /api/ ---
// O tenant é derivado exclusivamente do token no backend; nenhum header
// de tenant/usuário é enviado pelo cliente.
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url.startsWith("/api/")) {
    const token = localStorage.getItem("token");
    init = init || {};
    init.headers = { ...init.headers };
    if (token) init.headers["Authorization"] = `Bearer ${token}`;
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById("root")!).render(<App />);
