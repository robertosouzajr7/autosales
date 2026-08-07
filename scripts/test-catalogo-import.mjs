/**
 * Teste da importação de catálogo em massa.
 *
 *   API=http://127.0.0.1:3000 DATABASE_URL=... node scripts/test-catalogo-import.mjs
 *
 * A parte difícil não é gravar: é ler o que as pessoas realmente mandam —
 * ponto-e-vírgula, tabulação, "R$ 1.400,00", cabeçalho em inglês, lista solta
 * copiada de um bloco de notas.
 */
import prisma from "../src/api/config/prisma.js";
import { analisar, lerPreco, MODELO_CSV } from "../src/api/services/CatalogImport.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const API = process.env.API || "http://127.0.0.1:3000";
let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

const marca = Date.now();

async function main() {
  console.log("\n1. Preço como as pessoas escrevem");
  {
    ok(lerPreco("R$ 1.400,00") === 1400, '"R$ 1.400,00" → 1400');
    ok(lerPreco("1.400,50") === 1400.5, '"1.400,50" → 1400,50');
    ok(lerPreco("1,400.50") === 1400.5, '"1,400.50" → 1400,50 (formato inglês)');
    ok(lerPreco("1400") === 1400, '"1400" → 1400');
    ok(lerPreco("89,90") === 89.9, '"89,90" → 89,90');
    ok(lerPreco("") === null, "vazio → nulo");
    ok(lerPreco("combinar") === null, '"combinar" → nulo, não zero');
    ok(lerPreco("-50") === null, "negativo é recusado");
  }

  console.log("\n2. Tabela com ponto-e-vírgula");
  {
    const r = analisar(MODELO_CSV);
    ok(r.formato === "tabela", "reconhece como tabela");
    ok(r.separador === ";", "descobre o ponto-e-vírgula");
    ok(r.itens.length === 3, "lê as três linhas do modelo");
    ok(r.itens.every((i) => !i.erros.length), "e nenhuma dá erro");
    const primeiro = r.itens[0].dados;
    ok(primeiro.name === "Clareamento a Laser", "nome");
    ok(primeiro.price === 1400, "preço com milhar e centavo");
    ok(primeiro.type === "SERVICE", '"servico" vira SERVICE');
    ok(primeiro.isActive === true, '"sim" vira ativo');
  }

  console.log("\n3. Tabela com vírgula e cabeçalho em inglês");
  {
    const csv = [
      "name,price,category,active",
      '"Consulta, primeira vez",250.00,Clínica,yes',
      "Retorno,0,Clínica,no",
    ].join("\n");
    const r = analisar(csv);
    ok(r.separador === ",", "descobre a vírgula");
    ok(r.itens[0].dados.name === "Consulta, primeira vez", "aspas protegem a vírgula do nome");
    ok(r.itens[0].dados.price === 250, "preço em formato inglês");
    ok(r.itens[1].dados.price === 0, "zero é zero, não nulo");
    ok(r.itens[1].dados.isActive === false, '"no" vira inativo');
  }

  console.log("\n4. Tabulação");
  {
    const r = analisar("nome\tpreco\nCorte\t80,00\nBarba\t40,00");
    ok(r.separador === "\t", "descobre a tabulação");
    ok(r.itens.length === 2 && r.itens[1].dados.price === 40, "lê os dois itens");
  }

  console.log("\n5. Lista solta, sem cabeçalho");
  {
    const txt = [
      "Clareamento a Laser - R$ 1.400",
      "Limpeza de Pele — 180,00",
      "Avaliação inicial",
      "Kit Pós-Procedimento | 89,90",
    ].join("\n");
    const r = analisar(txt);
    ok(r.formato === "lista", "reconhece a lista solta");
    ok(r.itens.length === 4, "nenhuma linha vira cabeçalho por engano");
    ok(r.itens[0].dados.name === "Clareamento a Laser" && r.itens[0].dados.price === 1400, "separa nome e preço");
    ok(r.itens[1].dados.name === "Limpeza de Pele", "travessão também separa");
    ok(r.itens[2].dados.name === "Avaliação inicial" && r.itens[2].dados.price === null, "item sem preço é válido");
    ok(r.itens[3].dados.price === 89.9, "barra vertical também separa");
  }

  console.log("\n6. Linhas que precisam ser recusadas");
  {
    const csv = ["nome;preco;link", ";100", "Item bom;100;https://ok.com", "Item ruim;abc;", "Link torto;50;www.sem-protocolo.com"].join("\n");
    const r = analisar(csv);
    ok(r.itens[0].erros.includes("sem nome"), "linha sem nome é recusada");
    ok(!r.itens[1].erros.length, "a linha boa passa");
    ok(r.itens[2].erros.some((e) => e.includes("preço não reconhecido")), 'preço "abc" é apontado');
    ok(r.itens[3].erros.some((e) => e.includes("http")), "link sem protocolo é apontado");
    ok(r.itens[3].dados.buyUrl === null, "e o link torto não é gravado");
  }

  console.log("\n7. Colunas desconhecidas são ignoradas, não quebram");
  {
    const r = analisar("nome;preco;estoque;fornecedor\nItem;10;5;ACME");
    ok(r.itens[0].dados.name === "Item" && r.itens[0].dados.price === 10, "o que dá para ler é lido");
    ok(r.naoReconhecidas.includes("estoque") && r.naoReconhecidas.includes("fornecedor"), "e o resto é reportado");
  }

  console.log("\n8. Ponta a ponta pela API");
  {
    const plan = await prisma.plan.create({ data: { name: `Cat ${marca}`, priceMonthly: 0, priceYearly: 0 } });
    const tenant = await prisma.tenant.create({
      data: { name: "Catálogo Teste", email: `cat-${marca}@teste.local`, businessType: "CLINICA", planId: plan.id },
    });
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id, name: "Dona", email: `dona-${marca}@teste.local`,
        password: await bcrypt.hash("x", 4), role: "ADMIN", emailVerified: true,
      },
    });
    const token = jwt.sign({ userId: user.id, tenantId: tenant.id, role: "ADMIN" }, process.env.JWT_SECRET);
    const auth = { Authorization: `Bearer ${token}` };

    const modelo = await fetch(`${API}/api/products/import/modelo`, { headers: auth });
    ok(modelo.ok, "o modelo pode ser baixado");
    ok((await modelo.text()).includes("nome;tipo;categoria"), "e vem com o cabeçalho certo");

    const csv = ["nome;preco;categoria", "Clareamento;1.400,00;Estética", "Limpeza;180,00;Estética", ";0"].join("\n");
    const arquivo = (nome = "catalogo.csv") => {
      const fd = new FormData();
      fd.append("file", new Blob([csv], { type: "text/csv" }), nome);
      return fd;
    };

    const prev = await fetch(`${API}/api/products/import?preview=1`, { method: "POST", headers: auth, body: arquivo() });
    const p = await prev.json();
    ok(prev.ok && p.preview === true, "a prévia responde sem gravar");
    ok(p.validos === 2 && p.invalidosTotal === 1, "conta 2 válidos e 1 recusado");
    ok((await prisma.product.count({ where: { tenantId: tenant.id } })) === 0, "e nada foi gravado ainda");

    const grav = await fetch(`${API}/api/products/import`, { method: "POST", headers: auth, body: arquivo() });
    const g = await grav.json();
    ok(grav.ok && g.criados === 2, "a gravação cria os dois");
    const itens = await prisma.product.findMany({ where: { tenantId: tenant.id }, orderBy: { name: "asc" } });
    ok(itens.length === 2, "o catálogo tem dois itens");
    ok(itens[0].price === 1400 && itens[0].category === "Estética", "com preço e categoria certos");

    // Reenviar a planilha corrigida não pode duplicar o catálogo.
    const corrigido = ["nome;preco;categoria", "Clareamento;1.500,00;Estética", "Limpeza;180,00;Estética"].join("\n");
    const fd = new FormData();
    fd.append("file", new Blob([corrigido], { type: "text/csv" }), "catalogo.csv");
    const rev = await fetch(`${API}/api/products/import`, { method: "POST", headers: auth, body: fd });
    const rr = await rev.json();
    ok(rr.atualizados === 2 && rr.criados === 0, "reenviar atualiza em vez de duplicar");
    ok((await prisma.product.count({ where: { tenantId: tenant.id } })) === 2, "o catálogo continua com dois");
    const atualizado = await prisma.product.findFirst({ where: { tenantId: tenant.id, name: "Clareamento" } });
    ok(atualizado.price === 1500, "e o preço novo entrou");

    // TXT com lista solta pelo mesmo endpoint.
    const fd2 = new FormData();
    fd2.append("file", new Blob(["Massagem relaxante - R$ 220"], { type: "text/plain" }), "lista.txt");
    const t = await fetch(`${API}/api/products/import`, { method: "POST", headers: auth, body: fd2 });
    const tr = await t.json();
    ok(t.ok && tr.criados === 1 && tr.formato === "lista", "TXT com lista solta também importa");
  }

  console.log(falhas ? `\n❌ ${falhas} verificação(ões) falharam.` : "\n✅ Tudo certo.");
  await prisma.$disconnect();
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
