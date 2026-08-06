import { chromium } from "playwright-core";
import fs from "fs";

// O handoff carrega React e Babel de CDN; aqui a saída externa é bloqueada,
// então servimos as mesmas versões do node_modules.
const LOCAIS = {
  "react@18.3.1/umd/react.production.min.js": "node_modules/react/umd/react.production.min.js",
  "react-dom@18.3.1/umd/react-dom.production.min.js": "node_modules/react-dom/umd/react-dom.production.min.js",
  "@babel/standalone@7.29.0/babel.min.js": "node_modules/@babel/standalone/babel.min.js",
};

const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-proxy-server"],
});
const ctx = await b.newContext({ viewport: { width: 1500, height: 1200 } });
await ctx.route("**unpkg.com/**", (rota) => {
  const url = rota.request().url();
  const chave = Object.keys(LOCAIS).find((k) => url.includes(k));
  if (!chave) return rota.abort();
  rota.fulfill({ status: 200, contentType: "application/javascript", body: fs.readFileSync(LOCAIS[chave], "utf8") });
});
await ctx.route("**fonts.googleapis.com/**", (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));

const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("[erro]", String(e).slice(0, 140)));
await p.goto("file:///home/user/autosales/App Conversas.dc.html", { waitUntil: "networkidle" });
await p.waitForTimeout(4000);
const altura = await p.evaluate(() => document.documentElement.scrollHeight);
console.log("altura:", altura);
const passo = 1150;
for (let i = 0, y = 0; y < altura && i < 14; i++, y += passo) {
  await p.evaluate((yy) => window.scrollTo(0, yy), y);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `/var/lib/postgresql/app-${String(i).padStart(2, "0")}.png` });
}
console.log("telas capturadas:", Math.min(Math.ceil(altura / passo), 14));
await b.close();
