/**
 * Widget de chat web para embedar no site do cliente.
 *
 * Fluxo:
 *  - Cliente cola no site dele:
 *      <script src="https://SEU_DOMINIO/widget.js" data-tenant="TENANT_ID"></script>
 *  - O widget.js injeta um botão flutuante e um iframe apontando pra
 *    /chat/:tenantId (página React pública que já existe).
 *  - O visitante conversa com o agente exatamente como no WhatsApp.
 *
 * Não requer autenticação. É rota pública.
 */

export const serveWidget = (req, res) => {
  const origin =
    process.env.PUBLIC_URL ||
    `${req.protocol}://${req.get("host") || "localhost"}`;

  // Cores do widget seguem a paleta do produto (azul + neutros).
  const js = `
(function () {
  var currentScript = document.currentScript;
  var tenantId = currentScript && currentScript.getAttribute("data-tenant");
  if (!tenantId) {
    console.warn("[Agentes Virtuais widget] Faltou data-tenant no <script>.");
    return;
  }
  var origin = ${JSON.stringify(origin)};
  var chatUrl = origin + "/chat/" + encodeURIComponent(tenantId);

  var openState = false;
  var iframe = document.createElement("iframe");
  iframe.src = chatUrl;
  iframe.setAttribute("title", "Chat com atendente");
  iframe.setAttribute("allow", "microphone");
  iframe.style.cssText = [
    "position:fixed",
    "bottom:96px",
    "right:24px",
    "width:380px",
    "max-width:calc(100vw - 32px)",
    "height:600px",
    "max-height:calc(100vh - 128px)",
    "border:none",
    "border-radius:16px",
    "box-shadow:0 20px 40px -8px rgba(15,23,42,0.25)",
    "background:#fff",
    "z-index:2147483646",
    "display:none",
  ].join(";");
  document.body.appendChild(iframe);

  var btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("aria-label", "Abrir chat de atendimento");
  btn.style.cssText = [
    "position:fixed",
    "bottom:24px",
    "right:24px",
    "width:60px",
    "height:60px",
    "border-radius:9999px",
    "border:none",
    "cursor:pointer",
    "background:#2563EB",
    "color:#fff",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "box-shadow:0 12px 24px -4px rgba(37,99,235,0.5)",
    "z-index:2147483647",
    "transition:transform .15s ease",
  ].join(";");
  btn.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  btn.addEventListener("mouseenter", function () {
    btn.style.transform = "scale(1.05)";
  });
  btn.addEventListener("mouseleave", function () {
    btn.style.transform = "scale(1)";
  });
  btn.addEventListener("click", function () {
    openState = !openState;
    iframe.style.display = openState ? "block" : "none";
    btn.innerHTML = openState
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  });
  document.body.appendChild(btn);
})();
`.trim();

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300"); // 5 min
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.send(js);
};
