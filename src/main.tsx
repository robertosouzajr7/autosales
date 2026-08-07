import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { baseDaApi } from "./mobile/plataforma";

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
    // Dentro do app o bundle é servido do próprio aparelho, então "/api/..."
    // bateria no empacotamento e não na API. `baseDaApi()` devolve string
    // vazia em qualquer navegador: aqui a web segue byte a byte igual.
    const base = baseDaApi();
    if (base && typeof input === "string") input = base + url;
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById("root")!).render(<App />);
