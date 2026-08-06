import prisma from "../config/prisma.js";
import { MetaManager } from "../../../meta.js";
import { normalizePhone } from "../services/ContactIdentity.js";
import { countVariables } from "./TemplateController.js";
import { estimateCampaign } from "../services/WhatsAppPricingService.js";
import {
  podeDisparar, custoEstimado, debitar as debitarCredito, saldoDisparo,
} from "../services/CampaignCreditService.js";

/**
 * Disparo em massa pela API oficial.
 *
 * Fora da janela de 24h o WhatsApp só aceita template aprovado, então toda
 * campanha aponta para um MessageTemplate com status APPROVED. O envio
 * respeita um intervalo entre mensagens: a Meta limita a taxa e derruba
 * rajadas, além de contas novas terem limite diário menor.
 */

// Intervalo entre envios. Conservador de propósito — estourar o rate limit da
// Meta custa mais caro (mensagens perdidas) do que demorar um pouco mais.
const SEND_INTERVAL_MS = Number(process.env.CAMPAIGN_SEND_INTERVAL_MS || 250);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Destinatários elegíveis: telefone VÁLIDO e sem opt-out (LGPD).
 * `leadIds` tem prioridade — é a seleção explícita feita na tela.
 */
async function resolveRecipients(tenantId, { tagIds, stageId, leadIds } = {}) {
  const where = Array.isArray(leadIds) && leadIds.length
    ? { tenantId, optedOut: false, id: { in: leadIds } }
    : {
        tenantId,
        optedOut: false,
        phone: { not: null },
        ...(stageId ? { stageId } : {}),
        ...(Array.isArray(tagIds) && tagIds.length ? { tags: { some: { id: { in: tagIds } } } } : {}),
      };

  const leads = await prisma.lead.findMany({
    where,
    select: { id: true, name: true, phone: true },
  });
  // normalizePhone é a mesma regra do resto do sistema: telefone que não passa
  // aqui seria recusado pela Meta de qualquer forma.
  return leads
    .map((l) => ({ ...l, phone: normalizePhone(l.phone) }))
    .filter((l) => !!l.phone);
}

/**
 * Por que o público ficou vazio. Sem isso a tela só diz "nenhum contato
 * elegível", e o usuário não tem como saber se é filtro, telefone ou opt-out.
 */
async function diagnosticarPublico(tenantId, { stageId } = {}) {
  const [total, semTelefone, optOut, naEtapa] = await Promise.all([
    prisma.lead.count({ where: { tenantId } }),
    prisma.lead.count({ where: { tenantId, OR: [{ phone: null }, { phone: "" }] } }),
    prisma.lead.count({ where: { tenantId, optedOut: true } }),
    stageId ? prisma.lead.count({ where: { tenantId, stageId } }) : Promise.resolve(null),
  ]);
  return { total, semTelefone, optOut, naEtapa };
}

// Token que a tela oferece para preencher a variável com o nome do contato.
const TOKEN_NOME = /^\{\{\s*(nome|name)\s*\}\}$/i;

/**
 * Monta os parâmetros do template para UM destinatário.
 *
 * A Meta exige EXATAMENTE o número de parâmetros que o template declara —
 * mandar um a mais (ou a menos) derruba o envio com #132000, que é o erro que
 * aparecia em todo destinatário quando a campanha mandava sempre `[nome]`,
 * mesmo em template sem nenhuma variável.
 */
function montarVariaveis(esperados, definidas, lead) {
  return Array.from({ length: esperados }, (_, i) => {
    const bruto = definidas[i];
    const valor = bruto === undefined || bruto === null ? "" : String(bruto).trim();
    // {{1}} sem valor assume o nome do contato — é o uso mais comum.
    const escolhido = TOKEN_NOME.test(valor) || (!valor && i === 0)
      ? (lead.name || "").trim() || "Cliente"
      : valor;
    // A Meta recusa parâmetro com quebra de linha ou tabulação.
    return escolhido.replace(/\s+/g, " ");
  });
}

/**
 * Recusa a campanha antes do disparo quando falta variável. Sem isso o erro
 * só aparece por destinatário, no log da Meta, depois de a campanha começar.
 */
function validarVariaveis(template, definidas) {
  const esperados = countVariables(template.content);
  if (!esperados) return null;
  const lista = Array.isArray(definidas) ? definidas : [];
  for (let i = 0; i < esperados; i++) {
    const v = lista[i];
    const valor = v === undefined || v === null ? "" : String(v).trim();
    // {{1}} pode ficar em branco: cai no nome do contato.
    if (!valor && i > 0) {
      return `Este template usa ${esperados} variável(is). Informe o valor de {{${i + 1}}}.`;
    }
  }
  return null;
}

async function resolveSender(tenantId, accountId = null) {
  const accounts = await prisma.whatsAppAccount.findMany({
    where: { tenantId, channel: { not: "INSTAGRAM" } },
    orderBy: { createdAt: "asc" },
  });
  const usable = accounts.filter((a) => a.phoneId && a.accessToken);
  if (accountId) return usable.find((a) => a.id === accountId) || null;
  return usable[0] || null;
}

/**
 * Projeção antes do disparo: quantos vão receber, quanto custa e se a
 * franquia do plano cobre. É o que a tela mostra antes de confirmar.
 */
export const previewCampaign = async (req, res) => {
  try {
    const { templateId, tagIds, stageId, leadIds } = req.body;
    const template = await prisma.messageTemplate.findFirst({
      where: { id: templateId, tenantId: req.tenantId },
    });
    if (!template) return res.status(404).json({ error: "Template não encontrado." });

    const recipients = await resolveRecipients(req.tenantId, { tagIds, stageId, leadIds });
    // A prévia usa a categoria DO TEMPLATE: é ela que define a tarifa, e é
    // isso que o cliente precisa ver antes de confirmar.
    const quota = await podeDisparar(req.tenantId, recipients.length, template.category);
    const estimate = await estimateCampaign(recipients.length, template.category, {
      cobraPorMensagem: quota.cobraPorMensagem,
    });
    // Só investiga quando deu zero — evita 4 counts a cada digitação.
    const publico = recipients.length === 0
      ? await diagnosticarPublico(req.tenantId, { stageId })
      : null;

    res.json({
      template: {
        id: template.id,
        name: template.name,
        category: template.category,
        status: template.status,
        content: template.content,
        headerType: template.headerType || "TEXT",
      },
      // A tela usa isso para pedir os valores dos {{n}} antes de criar.
      variableCount: countVariables(template.content),
      // Primeiro destinatário: a prévia mostra o nome de quem vai receber de
      // verdade, não um "Maria" genérico.
      amostra: recipients[0] ? { name: recipients[0].name } : null,
      approved: template.status === "APPROVED",
      recipientCount: recipients.length,
      estimate,
      quota,
      publico,
      // Só libera o botão quando tudo está de pé.
      canSend: template.status === "APPROVED" && recipients.length > 0 && quota.allowed,
    });
  } catch (error) {
    console.error("[Campanha] Falha na projeção:", error);
    res.status(500).json({ error: error.message });
  }
};

export const listCampaigns = async (req, res) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { tenantId: req.tenantId },
      include: { template: { select: { name: true, category: true, status: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Cria a campanha já com a projeção congelada. */
export const createCampaign = async (req, res) => {
  try {
    const { name, templateId, tagIds, stageId, accountId, variables, scheduledAt, leadIds } = req.body;
    // Agendar para o passado é engano de digitação; disparar na hora, sem a
    // pessoa ter pedido, é pior que recusar.
    const quando = scheduledAt ? new Date(scheduledAt) : null;
    if (quando && (isNaN(quando) || quando <= new Date())) {
      return res.status(400).json({ error: "Escolha uma data e hora futuras para o agendamento." });
    }
    if (!name || !templateId) return res.status(400).json({ error: "Nome e template são obrigatórios." });

    const template = await prisma.messageTemplate.findFirst({
      where: { id: templateId, tenantId: req.tenantId },
    });
    if (!template) return res.status(404).json({ error: "Template não encontrado." });
    if (template.status !== "APPROVED") {
      return res.status(400).json({ error: "Só é possível disparar template aprovado pela Meta." });
    }

    const faltaVariavel = validarVariaveis(template, variables);
    if (faltaVariavel) {
      return res.status(400).json({ error: faltaVariavel, variableCount: countVariables(template.content) });
    }

    const recipients = await resolveRecipients(req.tenantId, { tagIds, stageId, leadIds });
    if (recipients.length === 0) return res.status(400).json({ error: "Nenhum destinatário elegível." });

    const quota = await podeDisparar(req.tenantId, recipients.length, template.category);
    if (!quota.allowed) return res.status(403).json({ error: quota.reason, quota });

    const estimate = await estimateCampaign(recipients.length, template.category, {
      cobraPorMensagem: quota.cobraPorMensagem,
    });

    const campaign = await prisma.campaign.create({
      data: {
        tenantId: req.tenantId,
        name,
        templateId,
        accountId: accountId || null,
        targetTagIds: Array.isArray(tagIds) && tagIds.length ? JSON.stringify(tagIds) : null,
        targetLeadIds: Array.isArray(leadIds) && leadIds.length ? JSON.stringify(leadIds) : null,
        variables: variables ? JSON.stringify(variables) : null,
        recipientCount: recipients.length,
        estimatedCost: estimate.priceBrl,
        // O custo real vai junto com o preço: sem os dois, o relatório do
        // SaaS não consegue dizer qual foi a margem do disparo.
        realCost: estimate.costBrl,
        scheduledAt: quando,
        // Com hora marcada a campanha nasce agendada. Antes nascia como
        // rascunho mesmo com data preenchida, então o horário era só um
        // enfeite: alguém tinha de clicar em "Disparar" na hora combinada.
        status: quando ? "SCHEDULED" : "DRAFT",
      },
    });
    res.json({ campaign, estimate, quota });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Dispara. Responde na hora e envia em background: uma campanha de milhares
 * de mensagens levaria muito mais que o timeout de uma requisição HTTP.
 */
/**
 * Coloca a campanha no ar.
 *
 * Separado do handler HTTP porque agora existem dois caminhos até aqui: o
 * botão "Disparar" e o agendamento, que roda sem requisição nenhuma. Devolve
 * `{ ok, status, erro }` em vez de escrever na resposta.
 */
export async function dispararCampanha(campaignId, tenantId) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, tenantId },
    include: { template: true },
  });
  if (!campaign) return { ok: false, status: 404, erro: "Campanha não encontrada." };
  if (campaign.status === "RUNNING") return { ok: false, status: 409, erro: "Campanha já está em andamento." };
  if (campaign.status === "COMPLETED") return { ok: false, status: 409, erro: "Campanha já foi concluída." };
  if (campaign.template.status !== "APPROVED") {
    return { ok: false, status: 400, erro: "O template não está aprovado pela Meta." };
  }

  // O template pode ter mudado depois da criação da campanha.
  let variaveisSalvas = [];
  try { variaveisSalvas = campaign.variables ? JSON.parse(campaign.variables) : []; } catch { variaveisSalvas = []; }
  const faltaVariavel = validarVariaveis(campaign.template, variaveisSalvas);
  if (faltaVariavel) return { ok: false, status: 400, erro: faltaVariavel };

  const sender = await resolveSender(tenantId, campaign.accountId);
  if (!sender) return { ok: false, status: 400, erro: "Nenhuma conexão oficial disponível para o disparo." };

  let tagIds = [];
  let leadIds = [];
  try { tagIds = campaign.targetTagIds ? JSON.parse(campaign.targetTagIds) : []; } catch { tagIds = []; }
  try { leadIds = campaign.targetLeadIds ? JSON.parse(campaign.targetLeadIds) : []; } catch { leadIds = []; }
  const recipients = await resolveRecipients(tenantId, { tagIds, leadIds });
  if (recipients.length === 0) return { ok: false, status: 400, erro: "Nenhum destinatário elegível." };

  // Revalida o saldo: o público pode ter crescido desde a criação, e outro
  // disparo pode ter consumido crédito nesse meio-tempo.
  const quota = await podeDisparar(tenantId, recipients.length, campaign.template.category);
  if (!quota.allowed) return { ok: false, status: 403, erro: quota.reason, quota };

  // Recria a lista de destinatários: é a base do relatório final e permite
  // dizer QUEM recebeu, não só quantos.
  await prisma.campaignRecipient.deleteMany({ where: { campaignId: campaign.id } });
  await prisma.campaignRecipient.createMany({
    data: recipients.map((l) => ({
      campaignId: campaign.id,
      leadId: l.id,
      name: l.name || null,
      phone: l.phone,
      status: "PENDING",
    })),
  });

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      status: "RUNNING", startedAt: new Date(), sentCount: 0, errorCount: 0,
      errorLog: null, finishedAt: null, recipientCount: recipients.length,
    },
  });

  runCampaign(campaign, sender, recipients, tenantId).catch((e) =>
    console.error("[Campanha] Falha inesperada:", e.message)
  );

  return { ok: true, status: 200, recipientCount: recipients.length };
}

export const startCampaign = async (req, res) => {
  try {
    const r = await dispararCampanha(req.params.id, req.tenantId);
    if (!r.ok) return res.status(r.status).json({ error: r.erro, ...(r.quota ? { quota: r.quota } : {}) });
    res.json({ success: true, status: "RUNNING", recipientCount: r.recipientCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Loop de envio, em background. */
async function runCampaign(campaign, sender, recipients, tenantId) {
  let variables = [];
  try { variables = campaign.variables ? JSON.parse(campaign.variables) : []; } catch { variables = []; }
  if (!Array.isArray(variables)) variables = [];

  // Quantos {{n}} o template declara. Template sem variável recebe lista vazia.
  const esperados = countVariables(campaign.template.content);
  // Cabeçalho de mídia precisa do arquivo no envio: o handle usado na
  // aprovação não serve aqui, por isso guardamos a cópia em mediaUrl.
  const headerMediaUrl =
    campaign.template.headerType && campaign.template.headerType !== "TEXT"
      ? campaign.template.mediaUrl
      : null;

  let sent = 0;
  let failed = 0;
  const errors = [];

  console.log(`[Campanha] ▶️ "${campaign.name}": ${recipients.length} destinatário(s) via ${sender.name}.`);

  for (const lead of recipients) {
    // Pausar/cancelar pelo painel interrompe no próximo destinatário.
    const current = await prisma.campaign.findUnique({
      where: { id: campaign.id },
      select: { status: true },
    });
    if (current?.status !== "RUNNING") {
      console.log(`[Campanha] ⏸️ "${campaign.name}" interrompida (${current?.status}).`);
      break;
    }

    const vars = montarVariaveis(esperados, variables, lead);

    const result = await MetaManager.sendTemplate(sender.phoneId, sender.accessToken, lead.phone, {
      name: campaign.template.name,
      language: campaign.template.language,
      variables: vars,
      headerMediaUrl,
      headerType: campaign.template.headerType || "IMAGE",
    });

    if (result.ok) sent++;
    else {
      failed++;
      if (errors.length < 20) errors.push(`${lead.phone}: ${result.error}`);
    }

    // Resultado individual, para o relatório.
    await prisma.campaignRecipient.updateMany({
      where: { campaignId: campaign.id, leadId: lead.id },
      data: {
        status: result.ok ? "SENT" : "FAILED",
        error: result.ok ? null : String(result.error || "").slice(0, 500),
        messageId: result.messageId || null,
        sentAt: new Date(),
      },
    }).catch(() => {});

    if (sent % 25 === 0 || failed % 25 === 0) {
      await prisma.campaign
        .update({ where: { id: campaign.id }, data: { sentCount: sent, errorCount: failed } })
        .catch(() => {});
    }

    await sleep(SEND_INTERVAL_MS);
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      status: "COMPLETED",
      sentCount: sent,
      errorCount: failed,
      errorLog: errors.length ? errors.join("\n") : null,
      finishedAt: new Date(),
    },
  }).catch(() => {});

  // Debita só o que saiu de fato — falha de envio não consome crédito. O que
  // a Meta depois marcar como não entregue volta pelo webhook de status.
  const gasto = await custoEstimado(sent, campaign.template.category);
  await debitarCredito(tenantId, gasto.total);
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { usedCampaignMessages: { increment: sent } },
  }).catch(() => {});

  // Lança no razão de consumo com custo e preço do que realmente saiu, para
  // o relatório fechar com a fatura da Meta em vez de com a projeção.
  try {
    const { registrarEvento, USAGE_TYPES } = await import("../services/UsageService.js");
    const { cobraPorMensagem } = await saldoDisparo(tenantId);
    const real = await estimateCampaign(sent, campaign.template.category, { cobraPorMensagem });
    await registrarEvento(tenantId, {
      type: USAGE_TYPES.CAMPAIGN,
      category: real.category,
      quantity: sent,
      costBrl: real.costBrl,
      priceBrl: real.priceBrl,
      campaignId: campaign.id,
      note: `${campaign.name} · ${sent} enviada(s), ${failed} falha(s)`,
    });
  } catch (e) {
    console.warn("[Campanha] Não foi possível lançar o consumo:", e.message);
  }

  console.log(`[Campanha] ✅ "${campaign.name}" concluída: ${sent} enviada(s), ${failed} falha(s).`);
}

/** Interrompe no próximo destinatário; o que já saiu não volta. */
export const pauseCampaign = async (req, res) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!campaign) return res.status(404).json({ error: "Campanha não encontrada." });
    if (campaign.status !== "RUNNING") return res.status(400).json({ error: "A campanha não está em andamento." });

    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "PAUSED" } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteCampaign = async (req, res) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!campaign) return res.status(404).json({ error: "Campanha não encontrada." });
    if (campaign.status === "RUNNING") return res.status(409).json({ error: "Pause a campanha antes de removê-la." });

    await prisma.campaign.delete({ where: { id: campaign.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Saldo de disparo do ciclo, para a tela mostrar quanto ainda dá. */
export const getCampaignQuota = async (req, res) => {
  try {
    res.json(await saldoDisparo(req.tenantId));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Relatório do disparo: quem recebeu, quem falhou e por quê.
 * `?formato=csv` devolve o arquivo para download.
 */
export const campaignReport = async (req, res) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { template: { select: { name: true, category: true } } },
    });
    if (!campaign) return res.status(404).json({ error: "Campanha não encontrada." });

    const destinatarios = await prisma.campaignRecipient.findMany({
      where: { campaignId: campaign.id },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    });

    if (req.query.formato === "csv") {
      const escapa = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const linhas = [
        ["Nome", "Telefone", "Status", "Erro", "Enviado em"].join(","),
        ...destinatarios.map((d) => [
          escapa(d.name),
          escapa(d.phone),
          escapa(d.status === "SENT" ? "Enviado" : d.status === "FAILED" ? "Falhou" : "Pendente"),
          escapa(d.error),
          escapa(d.sentAt ? new Date(d.sentAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : ""),
        ].join(",")),
      ];
      const nomeArquivo = `disparo-${campaign.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${nomeArquivo}"`);
      // BOM para o Excel abrir com acentuação correta.
      return res.send("﻿" + linhas.join("\n"));
    }

    const enviados = destinatarios.filter((d) => d.status === "SENT").length;
    const falhas = destinatarios.filter((d) => d.status === "FAILED").length;
    const pendentes = destinatarios.filter((d) => d.status === "PENDING").length;

    // Agrupa os erros: 200 falhas do mesmo motivo cabem em uma linha.
    const porErro = {};
    for (const d of destinatarios) {
      if (d.status !== "FAILED") continue;
      const chave = (d.error || "Erro não informado").slice(0, 160);
      porErro[chave] = (porErro[chave] || 0) + 1;
    }

    res.json({
      campanha: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        template: campaign.template?.name,
        categoria: campaign.template?.category,
        custoEstimado: campaign.estimatedCost,
        iniciadoEm: campaign.startedAt,
        concluidoEm: campaign.finishedAt,
      },
      resumo: {
        total: destinatarios.length,
        enviados,
        falhas,
        pendentes,
        taxaSucesso: destinatarios.length ? Math.round((enviados / destinatarios.length) * 100) : 0,
      },
      errosAgrupados: Object.entries(porErro)
        .map(([motivo, qtd]) => ({ motivo, qtd }))
        .sort((a, b) => b.qtd - a.qtd),
      destinatarios: destinatarios.map((d) => ({
        id: d.id, name: d.name, phone: d.phone, status: d.status,
        error: d.error, sentAt: d.sentAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Campanhas com hora marcada.
 *
 * `scheduledAt` já era gravado na criação, mas nada o lia: a campanha ficava
 * parada esperando alguém clicar em "Disparar" na hora combinada. Este laço
 * é quem cumpre o agendamento.
 */
export async function dispararAgendadas(limite = 20) {
  const agora = new Date();
  const pendentes = await prisma.campaign.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: agora } },
    orderBy: { scheduledAt: "asc" },
    take: limite,
    select: { id: true, tenantId: true, name: true, scheduledAt: true },
  });

  for (const c of pendentes) {
    // Marca antes de disparar: se o processo cair no meio, a campanha não
    // volta para a fila e sai duas vezes para o mesmo público.
    const reservada = await prisma.campaign.updateMany({
      where: { id: c.id, status: "SCHEDULED" },
      data: { status: "STARTING" },
    });
    if (reservada.count === 0) continue;

    try {
      const r = await dispararCampanha(c.id, c.tenantId);
      if (!r.ok) {
        // Falhou por saldo, template ou público: volta a rascunho com o
        // motivo à vista, em vez de sumir de todas as listas.
        await prisma.campaign.update({
          where: { id: c.id },
          data: { status: "DRAFT", errorLog: `Agendamento não disparou: ${r.erro}` },
        });
        console.warn(`[Campanha] "${c.name}" não disparou no horário: ${r.erro}`);
      } else {
        console.log(`[Campanha] "${c.name}" disparada no horário agendado.`);
      }
    } catch (e) {
      await prisma.campaign
        .update({ where: { id: c.id }, data: { status: "DRAFT", errorLog: `Erro ao disparar: ${e.message}` } })
        .catch(() => {});
      console.error(`[Campanha] Erro ao disparar "${c.name}":`, e.message);
    }
  }
  return pendentes.length;
}

/**
 * Marca, remarca ou desmarca a hora do disparo.
 *
 * Vale só antes de sair: uma campanha em andamento ou concluída não tem mais
 * agendamento a mudar.
 */
export const scheduleCampaign = async (req, res) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!campaign) return res.status(404).json({ error: "Campanha não encontrada." });
    if (!["DRAFT", "SCHEDULED"].includes(campaign.status)) {
      return res.status(409).json({ error: "Só dá para agendar campanha que ainda não foi disparada." });
    }

    const { scheduledAt } = req.body;
    if (!scheduledAt) {
      const atualizada = await prisma.campaign.update({
        where: { id: campaign.id },
        data: { scheduledAt: null, status: "DRAFT" },
      });
      return res.json({ campaign: atualizada, agendada: false });
    }

    const quando = new Date(scheduledAt);
    if (isNaN(quando) || quando <= new Date()) {
      return res.status(400).json({ error: "Escolha uma data e hora futuras para o agendamento." });
    }
    const atualizada = await prisma.campaign.update({
      where: { id: campaign.id },
      data: { scheduledAt: quando, status: "SCHEDULED", errorLog: null },
    });
    res.json({ campaign: atualizada, agendada: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
