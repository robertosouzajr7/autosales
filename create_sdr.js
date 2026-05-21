import { PrismaClient } from "@prisma/client";
import readline from "readline";

const prisma = new PrismaClient();

// Helper for command line arguments
function getArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, val] = arg.split('=');
      const name = key.slice(2);
      args[name] = val || true;
    }
  });
  return args;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  const args = getArgs();

  // If parameters are passed, use them directly (CLI Mode)
  if (args.name && args.tenantId) {
    const name = args.name;
    const tenantId = args.tenantId;
    const role = args.role || "INBOUND";
    const prompt = args.prompt || "Você é um SDR focado em qualificar leads.";

    console.log(`🚀 Criando SDR em modo CLI:`);
    console.log(`- Nome: ${name}`);
    console.log(`- Tenant ID: ${tenantId}`);
    console.log(`- Role: ${role}`);
    console.log(`- Prompt: ${prompt}`);

    // Verify tenant exists
    const tenantExists = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenantExists) {
      console.error(`❌ Erro: Tenant com ID ${tenantId} não encontrado no banco.`);
      process.exit(1);
    }

    const sdr = await prisma.sdrBot.create({
      data: {
        name,
        tenantId,
        role,
        prompt
      }
    });

    console.log(`\n✅ SDR criado com sucesso! ID: ${sdr.id}`);
    return;
  }

  // Interactive Mode
  console.log("=== CRIADOR DE SDR DIRECTO ===");
  console.log("Buscando empresas/tenants registradas no banco de dados...");
  
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, email: true }
  });

  if (tenants.length === 0) {
    console.log("❌ Nenhuma empresa cadastrada no banco. Crie uma empresa/tenant primeiro.");
    process.exit(0);
  }

  console.log("\nSelecione a Empresa (digite o número correspondente):");
  tenants.forEach((t, i) => {
    console.log(`[${i + 1}] ${t.name} (E-mail: ${t.email}) - ID: ${t.id}`);
  });

  const selectedIdxStr = await askQuestion("\nOpção: ");
  const selectedIdx = parseInt(selectedIdxStr) - 1;

  if (isNaN(selectedIdx) || selectedIdx < 0 || selectedIdx >= tenants.length) {
    console.log("❌ Opção inválida.");
    process.exit(0);
  }

  const tenant = tenants[selectedIdx];
  console.log(`\nSelecionado: ${tenant.name}`);

  const name = await askQuestion("Nome do SDR (ex: Clara): ");
  if (!name.trim()) {
    console.log("❌ O nome é obrigatório.");
    process.exit(0);
  }

  console.log("\nEscolha a função (Role):");
  console.log("[1] INBOUND (Atendimento a leads que chegam)");
  console.log("[2] OUTBOUND (Prospecção ativa e contatos frios)");
  const roleIdx = await askQuestion("Opção (Padrão: 1): ");
  const role = roleIdx === "2" ? "OUTBOUND" : "INBOUND";

  const prompt = await askQuestion("\nPrompt / Instruções de comportamento do SDR (Pressione ENTER para usar o padrão):\n> ");
  const finalPrompt = prompt.trim() || "Você é um SDR focado em qualificar leads.";

  console.log("\nSalvando no banco de dados...");
  const newSdr = await prisma.sdrBot.create({
    data: {
      name: name.trim(),
      tenantId: tenant.id,
      role,
      prompt: finalPrompt
    }
  });

  console.log(`\n🚀 SDR criado com sucesso!`);
  console.log(`- Nome: ${newSdr.name}`);
  console.log(`- ID: ${newSdr.id}`);
  console.log(`- Role: ${newSdr.role}`);
  console.log(`- Empresa: ${tenant.name}`);
  console.log(`- Prompt: ${newSdr.prompt}`);
}

main()
  .catch((e) => {
    console.error("❌ Erro ao criar SDR:", e);
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
