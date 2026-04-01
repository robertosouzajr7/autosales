import fs from 'fs';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function formatFileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType
    },
  };
}

async function run() {
  const company = await prisma.company.findFirst();
  if (!company || !company.openAiKey) {
     console.error("Nenhuma chave (GEMINI_API_KEY) foi encontrada na empresa em banco.");
     return;
  }
  
  const genAI = new GoogleGenerativeAI(company.openAiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  const files = [
    "c:\\pessoal Roberto\\projetos\\VendAi\\autosales\\audio\\WhatsApp Ptt 2026-03-30 at 21.35.45.ogg",
    "c:\\pessoal Roberto\\projetos\\VendAi\\autosales\\audio\\WhatsApp Ptt 2026-03-30 at 21.37.08.ogg",
    "c:\\pessoal Roberto\\projetos\\VendAi\\autosales\\audio\\WhatsApp Ptt 2026-03-30 at 21.38.41.ogg"
  ];
  
  let parts = [
    { text: "Você é um analista de requisitos. Aqui estão as transcrições de áudios de uma cliente. Forneça o diálogo transcrito EXATAMENTE e depois identifique uma lista extremamente detalhada de dores que a cliente apontou, como eu (engenheiro) posso resolver isso no AutoSales SaaS:" }
  ];
  
  for(let file of files) {
      if(fs.existsSync(file)) {
          parts.push(await formatFileToGenerativePart(file, "audio/ogg"));
      }
  }

  try {
    const result = await model.generateContent(parts);
    console.log(result.response.text());
  } catch(e) { console.error(e); }
  
  await prisma.$disconnect();
}

run();
