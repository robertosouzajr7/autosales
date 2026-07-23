import { chromium } from "playwright-core";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../docs/agente-vendas/planos-img");
const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const LOGO = `<svg width="46" height="46" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="lg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
    <stop stop-color="#2563EB"/><stop offset="0.5" stop-color="#7c5cff"/><stop offset="1" stop-color="#22d3ee"/>
  </linearGradient></defs>
  <rect width="64" height="64" rx="16" fill="url(#lg)"/>
  <path d="M32 12 L54 52 L10 52 Z M32 32 L43 52 L21 52 Z" fill="#ffffff" fill-rule="evenodd"/>
</svg>`;

const CHECK = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="chk">
  <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const plans = [
  {
    id: "essencial", name: "Essencial", price: "97", year: "970",
    tagline: "Para o pequeno negócio começar a vender no automático",
    accent: "≈ R$ 3 por dia",
    features: [
      "1 agente de IA",
      "1 número de WhatsApp",
      "CRM com até 300 contatos",
      "1.000 mensagens por mês",
      "50 mil tokens de IA (~25-30 conversas)",
      "Agenda + lembretes automáticos",
    ],
    highlight: false,
  },
  {
    id: "starter", name: "Starter", price: "197", year: "1.970",
    tagline: "Para quem já tem movimento constante de clientes",
    accent: "O passo natural depois do Essencial",
    features: [
      "1 agente de IA",
      "1 número de WhatsApp · 2 usuários",
      "CRM com até 1.000 contatos",
      "3.000 mensagens por mês",
      "150 mil tokens de IA (~75-90 conversas)",
      "Agenda + automações incluídas",
    ],
    highlight: false,
  },
  {
    id: "pro", name: "Pro", price: "497", year: "4.970",
    tagline: "Alto volume de conversas ou mais de um canal",
    accent: "3 agentes pelo preço que a concorrência cobra por 1",
    features: [
      "3 agentes de IA (vendas, suporte e agenda)",
      "2 números de WhatsApp · 5 usuários",
      "CRM com até 3.000 contatos",
      "10.000 mensagens por mês",
      "600 mil tokens de IA",
      "API e webhooks · suporte prioritário",
    ],
    highlight: true,
  },
  {
    id: "escala", name: "Escala", price: "997", year: "9.970",
    tagline: "Operações grandes, com equipe e vários canais",
    accent: "Implantação assistida — configuramos junto",
    features: [
      "10 agentes de IA",
      "5 números de WhatsApp · 15 usuários",
      "CRM com até 10.000 contatos",
      "30.000 mensagens por mês",
      "2 milhões de tokens de IA",
      "API e webhooks · implantação assistida",
    ],
    highlight: false,
  },
];

function card(p) {
  const dark = p.highlight;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1080px; height:1350px; }
  body {
    font-family: -apple-system, "Segoe UI", "Helvetica Neue", Arial, "Liberation Sans", sans-serif;
    background:
      radial-gradient(60% 40% at 15% 8%, rgba(37,99,235,.16), transparent 60%),
      radial-gradient(55% 45% at 90% 12%, rgba(124,92,255,.14), transparent 62%),
      radial-gradient(50% 40% at 80% 95%, rgba(34,211,238,.12), transparent 60%),
      ${dark ? "#0a0f1e" : "#f6f8fc"};
    position:relative; overflow:hidden;
  }
  .frame { position:absolute; inset:56px; border-radius:44px;
    background:${dark
      ? "linear-gradient(180deg, #0e1730 0%, #0a1122 100%)"
      : "rgba(255,255,255,.86)"};
    ${dark ? "" : "border:1px solid rgba(15,23,42,.06);"}
    box-shadow: 0 40px 120px -30px rgba(20,30,70,${dark ? ".85" : ".28"});
    backdrop-filter: blur(24px);
    padding:72px 76px; display:flex; flex-direction:column;
    ${dark ? "outline:1px solid rgba(255,255,255,.08); outline-offset:-1px;" : ""}
  }
  .ink { color:${dark ? "#f1f5ff" : "#0f172a"}; }
  .mut { color:${dark ? "rgba(226,232,255,.62)" : "#64748b"}; }
  .top { display:flex; align-items:center; justify-content:space-between; }
  .brand { display:flex; align-items:center; gap:16px; }
  .wm { font-size:29px; font-weight:700; letter-spacing:-.02em; color:${dark ? "#fff" : "#0f172a"}; white-space:nowrap; }
  .badge { font-size:22px; font-weight:700; letter-spacing:.02em; color:#fff;
    background:linear-gradient(90deg,#2563EB,#7c5cff); padding:12px 22px; border-radius:999px;
    box-shadow:0 12px 30px -8px rgba(37,99,235,.6); }
  .name { margin-top:54px; font-size:76px; font-weight:800; letter-spacing:-.03em; line-height:1; }
  .name em { font-style:italic; font-family:Georgia,"Times New Roman",serif; font-weight:600;
    background:linear-gradient(90deg,#2563EB,#7c5cff,#22d3ee); -webkit-background-clip:text; background-clip:text; color:transparent; }
  .tag { margin-top:20px; font-size:29px; line-height:1.35; max-width:80%; }
  .priceRow { margin-top:44px; display:flex; align-items:flex-end; gap:14px; }
  .cur { font-size:40px; font-weight:700; margin-bottom:14px; }
  .price { font-size:132px; font-weight:800; line-height:.86; letter-spacing:-.04em;
    background:linear-gradient(92deg,${dark ? "#8ab4ff,#b9a5ff,#7ef0ff" : "#2563EB,#7c5cff,#22d3ee"});
    -webkit-background-clip:text; background-clip:text; color:transparent; }
  .per { font-size:40px; font-weight:600; margin-bottom:18px; }
  .sub { margin-top:12px; font-size:26px; }
  .pill { margin-top:26px; display:inline-flex; align-items:center; gap:12px; align-self:flex-start;
    font-size:25px; font-weight:700; padding:14px 26px; border-radius:999px;
    color:${dark ? "#bff3d6" : "#047857"};
    background:${dark ? "rgba(16,185,129,.14)" : "rgba(16,185,129,.10)"};
    border:1px solid ${dark ? "rgba(16,185,129,.35)" : "rgba(16,185,129,.28)"}; }
  .pill .dot { width:14px; height:14px; border-radius:50%; background:#10b981; box-shadow:0 0 0 5px rgba(16,185,129,.22); }
  .rule { margin:40px 0 8px; height:1px; background:${dark ? "rgba(255,255,255,.10)" : "rgba(15,23,42,.08)"}; }
  ul { list-style:none; display:flex; flex-direction:column; gap:26px; margin-top:34px; }
  li { display:flex; align-items:center; gap:20px; font-size:31px; font-weight:500; }
  .chk { width:34px; height:34px; flex:0 0 34px; padding:7px; border-radius:11px; color:#fff;
    background:linear-gradient(135deg,#2563EB,#7c5cff); box-shadow:0 8px 18px -6px rgba(37,99,235,.55); }
  .foot { margin-top:auto; display:flex; align-items:center; justify-content:space-between; padding-top:34px; }
  .cta { font-size:30px; font-weight:800; letter-spacing:-.01em;
    background:linear-gradient(90deg,${dark ? "#8ab4ff,#b9a5ff" : "#2563EB,#7c5cff"});
    -webkit-background-clip:text; background-clip:text; color:transparent; }
  .accent { font-size:24px; font-style:italic; font-family:Georgia,serif; }
  </style></head><body>
    <div class="frame">
      <div class="top">
        <div class="brand">${LOGO}<span class="wm">Agentes Virtuais</span></div>
        ${p.highlight ? `<span class="badge">★ Mais escolhido</span>` : `<span class="accent mut">atende · vende · agenda</span>`}
      </div>

      <div class="name ink">Plano <em>${p.name}</em></div>
      <div class="tag mut">${p.tagline}</div>

      <div class="priceRow">
        <span class="cur mut">R$</span>
        <span class="price">${p.price}</span>
        <span class="per mut">/mês</span>
      </div>
      <div class="sub mut">ou R$ ${p.year}/ano · 2 meses grátis</div>

      <div class="pill"><span class="dot"></span>7 dias grátis · sem cartão de crédito</div>

      <div class="rule"></div>
      <ul>${p.features.map((f) => `<li class="ink">${CHECK}<span>${f}</span></li>`).join("")}</ul>

      <div class="foot">
        <span class="cta">Comece agora →</span>
        <span class="accent mut">${p.accent}</span>
      </div>
    </div>
  </body></html>`;
}

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
fs.mkdirSync(OUT, { recursive: true });

for (const p of plans) {
  await page.setContent(card(p), { waitUntil: "networkidle" });
  const file = path.join(OUT, `plano-${p.id}.png`);
  await page.screenshot({ path: file });
  console.log("✓", file);
}

await browser.close();
console.log("Pronto.");
