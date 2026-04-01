const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function formatFileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType
    },
  };
}

async function run() {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  const files = [
    "c:\\pessoal Roberto\\projetos\\VendAi\\autosales\\audio\\WhatsApp Ptt 2026-03-30 at 21.35.45.ogg",
    "c:\\pessoal Roberto\\projetos\\VendAi\\autosales\\audio\\WhatsApp Ptt 2026-03-30 at 21.37.08.ogg",
    "c:\\pessoal Roberto\\projetos\\VendAi\\autosales\\audio\\WhatsApp Ptt 2026-03-30 at 21.38.41.ogg"
  ];
  
  let parts = [
    { text: "Por favor, forneça a transcrição exata e completa de cada um destes 3 áudios em formato de diálogo. Ao final, faça uma lista com as dores principais que a cliente está relatando para que um engenheiro de software possa resolver. Seja extremamente detalhista na identificação dos problemas do fluxo atual dela:" }
  ];
  
  for(let file of files) {
      if(fs.existsSync(file)) {
          parts.push(await formatFileToGenerativePart(file, "audio/ogg"));
      } else {
          console.log("File not found: " + file);
      }
  }

  try {
    const result = await model.generateContent(parts);
    console.log(result.response.text());
  } catch(e) { console.error(e); }
}

run();
