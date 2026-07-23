import { chromium } from "playwright-core";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../docs/agente-vendas/planos-img/fluxo-instagram.png");
const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const steps = [
  { n: "1", t: "Conta Profissional", d: "Instagram Comercial/Criador vinculado a uma Página do Facebook", tag: "Instagram + Facebook" },
  { n: "2", t: "Criar app na Meta", d: "developers.facebook.com/apps/create → tipo Empresa", tag: "Meta for Developers" },
  { n: "3", t: "Adicionar Instagram", d: "Produto Instagram → API com mensagens", tag: "Painel do app" },
  { n: "4", t: "Gerar Token + IDs", d: "Graph API Explorer: permissões, me/accounts e instagram_business_account", tag: "Graph API Explorer" },
  { n: "5", t: "Configurar Webhook", d: "URL {SUA_API}/api/webhook/meta · Verify Token = META_VERIFY_TOKEN · assinar 'messages'", tag: "Webhooks" },
  { n: "6", t: "Colar no painel", d: "Conexões → Instagram: Nome, IG Account ID, Page ID, Page Access Token", tag: "Agentes Virtuais" },
];

const collect = [
  { k: "Page ID", src: "me/accounts → id" },
  { k: "Page Access Token", src: "me/accounts → access_token" },
  { k: "Instagram Account ID", src: "PAGE_ID?fields=instagram_business_account" },
];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
* { margin:0; padding:0; box-sizing:border-box; }
html,body { width:1240px; }
body {
  font-family:-apple-system,"Segoe UI","Helvetica Neue",Arial,"Liberation Sans",sans-serif;
  background:
    radial-gradient(55% 40% at 12% 6%, rgba(37,99,235,.10), transparent 60%),
    radial-gradient(50% 40% at 92% 4%, rgba(219,39,119,.10), transparent 62%),
    #f6f8fc;
  padding:64px; color:#0f172a;
}
.head { display:flex; align-items:center; gap:16px; margin-bottom:8px; }
.logo { width:44px; height:44px; border-radius:14px;
  background:linear-gradient(135deg,#2563EB,#7c5cff,#22d3ee); position:relative; }
.logo:after { content:""; position:absolute; inset:0; margin:auto;
  width:0; height:0; border-left:11px solid transparent; border-right:11px solid transparent;
  border-bottom:19px solid #fff; transform:translateY(-2px); }
h1 { font-size:34px; font-weight:800; letter-spacing:-.02em; }
h1 em { font-style:italic; font-family:Georgia,serif; font-weight:600;
  background:linear-gradient(90deg,#db2777,#7c5cff,#2563EB); -webkit-background-clip:text; background-clip:text; color:transparent; }
.sub { color:#64748b; font-size:18px; margin:2px 0 34px 60px; }
.grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.card { background:#fff; border:1px solid rgba(15,23,42,.07); border-radius:22px; padding:24px 26px;
  box-shadow:0 20px 50px -34px rgba(20,30,70,.35); display:flex; gap:20px; align-items:flex-start; position:relative; }
.num { width:46px; height:46px; flex:0 0 46px; border-radius:14px; color:#fff; font-weight:800; font-size:22px;
  display:grid; place-items:center; background:linear-gradient(135deg,#2563EB,#7c5cff); box-shadow:0 10px 22px -8px rgba(37,99,235,.55); }
.tt { font-size:22px; font-weight:700; letter-spacing:-.01em; }
.dd { font-size:16px; color:#475569; line-height:1.45; margin-top:6px; }
.tag { display:inline-block; margin-top:12px; font-size:13px; font-weight:700; color:#7c3aed;
  background:rgba(124,92,255,.10); border:1px solid rgba(124,92,255,.22); padding:5px 12px; border-radius:999px; }
.collect { margin-top:26px; background:linear-gradient(180deg,#0e1730,#0a1122); border-radius:22px; padding:28px 30px; color:#e6ecff; }
.collect h2 { font-size:20px; font-weight:800; margin-bottom:4px; }
.collect p { color:rgba(230,236,255,.6); font-size:15px; margin-bottom:18px; }
.rows { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; }
.row { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.10); border-radius:14px; padding:16px; }
.row .k { font-size:16px; font-weight:700; color:#8ab4ff; }
.row .s { font-size:13px; color:rgba(230,236,255,.7); font-family:"Liberation Mono",monospace; margin-top:6px; word-break:break-all; }
.note { margin-top:22px; font-size:14px; color:#64748b; font-style:italic; }
</style></head><body>
  <div class="head"><div class="logo"></div><h1>Conectar o <em>Instagram</em> — mapa do fluxo</h1></div>
  <div class="sub">Configuração única na Meta. Ao final, 3 valores vão para o painel.</div>
  <div class="grid">
    ${steps.map((s) => `<div class="card">
      <div class="num">${s.n}</div>
      <div><div class="tt">${s.t}</div><div class="dd">${s.d}</div><span class="tag">${s.tag}</span></div>
    </div>`).join("")}
  </div>
  <div class="collect">
    <h2>Os 3 valores que você vai colar no painel</h2>
    <p>Todos saem do Graph API Explorer (Passo 4).</p>
    <div class="rows">
      ${collect.map((c) => `<div class="row"><div class="k">${c.k}</div><div class="s">${c.src}</div></div>`).join("")}
    </div>
  </div>
  <div class="note">Ilustração do fluxo — não é uma captura das telas reais da Meta. Os nomes dos botões podem variar conforme a versão do painel da Meta.</div>
</body></html>`;

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1240, height: 1000 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
console.log("✓", OUT);
