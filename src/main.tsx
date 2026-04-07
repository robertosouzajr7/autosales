import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";

// --- Global Fetch Interceptor for Tenant Isolation ---
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url.startsWith("/api/")) {
    const tenantId = localStorage.getItem("tenantId");
    const userId = localStorage.getItem("userId");
    init = init || {};
    init.headers = { ...init.headers };
    if (tenantId) init.headers["x-tenant-id"] = tenantId;
    if (userId) init.headers["x-user-id"] = userId;
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById("root")!).render(<App />);
