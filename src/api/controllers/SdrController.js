import prisma from "../config/prisma.js";
import { knowledgeBaseHeadroom } from "../middlewares/planLimits.js";
import PromptBuilder, { QUESTIONARIO, SECOES } from "../services/PromptBuilder.js";
import KnowledgeExtractor from "../services/KnowledgeExtractor.js";

export const getSdrs = async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  try {
    const sdrs = await prisma.sdrBot.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" }
    });
    res.json(sdrs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createSdr = async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  const {
    name, role, agentFunction, skills, prompt, knowledgeBase, trainingUrls,
    responseDelay, voiceTone, escalationKeywords,
    followUpInterval, preConfirmationHours, noShowGraceMinutes,
    postServiceCheckHours, enableWaitlist, active,
    voiceId, responseMode, accountIds
  } = req.body;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true }
    });

    if (tenant && tenant.plan) {
      if (!tenant.plan.enableSdr) {
        return res.status(403).json({ error: "O recurso de SDRs não está habilitado no seu plano." });
      }

      const sdrCount = await prisma.sdrBot.count({
        where: { tenantId, active: true }
      });

      if (sdrCount >= tenant.plan.maxSdrs && active !== false) {
        return res.status(403).json({ error: `Você atingiu o limite máximo de SDRs ativos do seu plano (${tenant.plan.maxSdrs}).` });
      }
    }

    const sdr = await prisma.sdrBot.create({
      data: {
        name,
        role: role || "SDR",
        agentFunction: agentFunction || "SCHEDULER",
        skills: skills ? (typeof skills === "string" ? skills : JSON.stringify(skills)) : null,
        // Conexões atendidas; vazio = todas.
        accountIds: Array.isArray(accountIds) && accountIds.length ? JSON.stringify(accountIds) : null,
        prompt,
        knowledgeBase,
        trainingUrls,
        responseDelay: responseDelay ? parseInt(responseDelay) : 2000,
        voiceTone: voiceTone || "PROFESSIONAL",
        escalationKeywords,
        followUpInterval: followUpInterval ? parseInt(followUpInterval) : 120,
        preConfirmationHours: preConfirmationHours ? parseInt(preConfirmationHours) : 12,
        noShowGraceMinutes: noShowGraceMinutes ? parseInt(noShowGraceMinutes) : 15,
        postServiceCheckHours: postServiceCheckHours ? parseInt(postServiceCheckHours) : 24,
        enableWaitlist: enableWaitlist !== undefined ? enableWaitlist : true,
        active: active !== undefined ? active : true,
        voiceId: voiceId || "21m00Tcm4TlvDq8ikWAM",
        responseMode: responseMode || "TEXT",
        tenantId
      }
    });
    res.json(sdr);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateSdr = async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  const { id } = req.params;
  const {
    name, role, agentFunction, skills, prompt, knowledgeBase, trainingUrls,
    responseDelay, voiceTone, escalationKeywords,
    followUpInterval, preConfirmationHours, noShowGraceMinutes,
    postServiceCheckHours, enableWaitlist, active,
    voiceId, responseMode, accountIds
  } = req.body;

  try {
    if (active === true) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { plan: true }
      });

      if (tenant && tenant.plan) {
        if (!tenant.plan.enableSdr) {
          return res.status(403).json({ error: "O recurso de SDRs não está habilitado no seu plano." });
        }
        
        const sdrCount = await prisma.sdrBot.count({
          where: { tenantId, active: true, id: { not: id } }
        });

        if (sdrCount >= tenant.plan.maxSdrs) {
          return res.status(403).json({ error: `Você atingiu o limite máximo de SDRs ativos do seu plano (${tenant.plan.maxSdrs}).` });
        }
      }
    }

    const sdr = await prisma.sdrBot.update({
      where: { id, tenantId },
      data: {
        name,
        role,
        agentFunction: agentFunction || undefined,
        skills: skills !== undefined ? (typeof skills === "string" ? skills : JSON.stringify(skills)) : undefined,
        accountIds: accountIds !== undefined
          ? (Array.isArray(accountIds) && accountIds.length ? JSON.stringify(accountIds) : null)
          : undefined,
        prompt,
        knowledgeBase,
        trainingUrls,
        responseDelay: responseDelay ? parseInt(responseDelay) : undefined,
        voiceTone,
        escalationKeywords,
        followUpInterval: followUpInterval ? parseInt(followUpInterval) : undefined,
        preConfirmationHours: preConfirmationHours ? parseInt(preConfirmationHours) : undefined,
        noShowGraceMinutes: noShowGraceMinutes ? parseInt(noShowGraceMinutes) : undefined,
        postServiceCheckHours: postServiceCheckHours ? parseInt(postServiceCheckHours) : undefined,
        enableWaitlist,
        active,
        voiceId,
        responseMode
      }
    });
    res.json(sdr);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteSdr = async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  const { id } = req.params;

  try {
    await prisma.sdrBot.delete({
      where: { id, tenantId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const trainSdr = async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  const { id } = req.params;
  
  if (!req.file) {
    return res.status(400).json({ error: "Nenhum arquivo enviado" });
  }

  const file = req.file;

  try {
    const sdr = await prisma.sdrBot.findFirst({ where: { id, tenantId } });
    if (!sdr) return res.status(404).json({ error: "SDR not found" });

    // Extração REAL do conteúdo do documento (PDF/DOCX/XLSX/CSV/TXT)
    const { extractText } = await import("../services/DocumentExtractor.js");
    let extractedText;
    try {
      extractedText = await extractText(file.buffer, file.originalname, file.mimetype);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    if (!extractedText || extractedText.length < 10) {
      return res.status(400).json({ error: "Não consegui extrair texto legível deste arquivo. Ele pode ser um PDF só de imagem (escaneado)." });
    }

    const header = `\n\n===== ${file.originalname || "documento"} =====\n`;
    const chunkToAppend = header + extractedText;

    // Gate: tamanho total da base de conhecimento do tenant (soma de todos os SDRs).
    const headroom = await knowledgeBaseHeadroom(tenantId, chunkToAppend.length);
    if (!headroom.ok) {
      return res.status(403).json({
        error: `Limite de treino do seu plano atingido: ${headroom.max.toLocaleString("pt-BR")} caracteres. Já em uso: ${headroom.used.toLocaleString("pt-BR")}. Este arquivo tem ${chunkToAppend.length.toLocaleString("pt-BR")} caracteres — faça upgrade do plano ou remova outros treinos.`,
      });
    }

    const newKb = sdr.knowledgeBase ? sdr.knowledgeBase + chunkToAppend : extractedText;

    const updated = await prisma.sdrBot.update({
      where: { id, tenantId },
      data: { knowledgeBase: newKb }
    });

    res.json({ success: true, sdr: updated, extractedChars: extractedText.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Simulador do agente: conversa de teste sem tocar nos dados da conta.
 *
 * O caminho normal (`submitChat`) cria contato, cria conversa e grava cada
 * mensagem — o que é certo para um visitante do site e errado para o dono
 * testando o próprio agente: em cinco testes ele teria cinco contatos falsos
 * no funil e cinco conversas no inbox.
 *
 * Aqui o histórico vem do navegador e é entregue pronto ao motor via
 * `preloaded`, que é justamente o atalho para quem já tem o contexto em mãos.
 * Nada é gravado, nada é enviado por WhatsApp.
 *
 * Os tokens SÃO cobrados: a chamada ao modelo acontece de verdade, e não
 * cobrar faria o painel mostrar um consumo menor que o real.
 */
export const simulateSdr = async (req, res) => {
  const tenantId = req.tenantId;
  const { message, history = [] } = req.body || {};
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });
  if (!message?.trim()) return res.status(400).json({ error: "Escreva uma mensagem para testar." });

  try {
    const sdr = await prisma.sdrBot.findFirst({ where: { id: req.params.id, tenantId } });
    if (!sdr) return res.status(404).json({ error: "Agente não encontrado." });

    const anteriores = (Array.isArray(history) ? history : [])
      .slice(-14)
      .map((m) => `${m.role === "user" ? "LEAD" : "SDR"}: ${m.content}`);
    const conversa = [...anteriores, `LEAD: ${message}`].join("\n");

    const { default: AutomationEngine } = await import("../../../automation_engine.js");
    const resposta = await AutomationEngine.callAI(
      null,
      // Contato de mentira: o motor só lê nome, telefone e tenantId daqui.
      { id: "simulacao", name: "Cliente de teste", phone: "—", tenantId },
      {
        tenantId,
        preloaded: {
          sdr,
          history: conversa,
          kb: sdr.knowledgeBase || "",
          appointments: "",
          // Sem fluxo em execução: o simulador testa o agente, não a régua.
          fluxos: "",
        },
      }
    );

    res.json({ response: resposta || "O agente não respondeu. Verifique se há créditos de IA no plano." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Montagem guiada do prompt ─────────────────────────────────────

/** As perguntas que o dono responde sobre o negócio dele — não sobre IA. */
export const getPromptQuestionario = async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { name: true, businessType: true },
    });
    res.json({
      questionario: QUESTIONARIO,
      secoes: SECOES,
      negocio: tenant?.name || null,
      tipo: tenant?.businessType || null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * Gera o prompt a partir das respostas.
 *
 * Não grava: devolve para o dono ler, editar e só então salvar no agente.
 * Prompt é a voz do negócio — trocar isso sem ele ver seria trocar o
 * atendimento sem avisar.
 */
export const gerarPrompt = async (req, res) => {
  try {
    const { respostas = {}, agentFunction = null, skills = [] } = req.body || {};

    const faltando = QUESTIONARIO.filter((q) => q.obrigatoria && !String(respostas[q.id] || "").trim());
    if (faltando.length) {
      return res.status(400).json({
        error: `Responda antes: ${faltando.map((q) => q.pergunta).join(" / ")}`,
        faltando: faltando.map((q) => q.id),
      });
    }

    const r = await PromptBuilder.gerar(req.tenantId, respostas, { agentFunction, skills });
    res.json(r);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ── Treinamento com revisão do dono ───────────────────────────────

/**
 * Lê o material e propõe o conhecimento — sem gravar na base.
 *
 * Aceita documento, planilha, gravação de voz ou texto colado. O que sai
 * daqui é uma lista de itens PENDENTES para o dono revisar. Extração
 * automática que se auto-aprova é como um preço errado vira política da casa.
 */
export const extrairConhecimento = async (req, res) => {
  try {
    const { id } = req.params;
    const sdr = await prisma.sdrBot.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!sdr) return res.status(404).json({ error: "Agente não encontrado." });

    const texto = String(req.body?.texto || "").trim();
    if (!req.file && !texto) {
      return res.status(400).json({ error: "Envie um arquivo, uma gravação ou cole o texto." });
    }

    const r = await KnowledgeExtractor.extrair(req.tenantId, sdr.id, {
      buffer: req.file?.buffer,
      nome: req.file?.originalname,
      mimetype: req.file?.mimetype,
      texto: req.file ? null : texto,
    });

    const itens = await prisma.knowledgeDraft.findMany({
      where: { lote: r.lote },
      orderBy: { createdAt: "asc" },
    });

    res.json({ ...r, itens });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

/** O que ainda está esperando decisão, para a tela poder retomar. */
export const listarConhecimentoPendente = async (req, res) => {
  try {
    const itens = await prisma.knowledgeDraft.findMany({
      where: { tenantId: req.tenantId, sdrId: req.params.id, status: "PENDENTE" },
      orderBy: { createdAt: "asc" },
    });
    res.json({ total: itens.length, itens });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * O dono decidiu: o que ele manteve entra na base, com as edições dele.
 * O recusado fica registrado — não some, para dar para auditar depois.
 */
export const consolidarConhecimento = async (req, res) => {
  try {
    const { decisoes = [] } = req.body || {};
    if (!Array.isArray(decisoes) || !decisoes.length) {
      return res.status(400).json({ error: "Nenhuma decisão recebida." });
    }
    const r = await KnowledgeExtractor.consolidar(req.tenantId, req.params.id, decisoes);
    const sdr = await prisma.sdrBot.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    res.json({ success: true, ...r, knowledgeBase: sdr?.knowledgeBase || "" });
  } catch (e) {
    res.status(e.codigo === "LIMITE_DE_PLANO" ? 403 : 500).json({ error: e.message });
  }
};
