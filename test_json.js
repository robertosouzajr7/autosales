import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function check() {
  const auts = await prisma.automation.findMany();
  console.log(`Encontradas ${auts.length} automações.`);
  for (const auto of auts) {
    try {
      JSON.parse(auto.nodes || "[]");
      JSON.parse(auto.edges || "[]");
      console.log(`✅ ${auto.name} - JSON OK`);
    } catch (e) {
      console.log(`❌ ${auto.name} - JSON INVÁLIDO: ${e.message}`);
    }
  }
  process.exit(0);
}

check();
