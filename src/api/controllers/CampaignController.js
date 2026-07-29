import prisma from "../config/prisma.js";
import { MetaManager } from "../../../meta.js";
import {
  estimateCampaign,
  checkCampaignQuota,
  consumeCampaignQuota,
} from "../services/WhatsAppPricingService.js";

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

/** Destinatários elegíveis: com telefone e sem opt-out (LGPD). */
async function resolveRecipients(tenantId, { tagIds, stageId } = {}) {
  const where = {
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
  return leads.filter((l) => l.phone && l.phone.trim());
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
    const { templateId, tagIds, stageId } = req.body;
    const template = await prisma.messageTemplate.findFirst({
      where: { id: templateId, tenantId: req.tenantId },
    });
    if (!template) return res.status(404).json({ error: "Template não encontrado." });

    const recipients = await resolveRecipients(req.tenantId, { tagIds, stageId });
    const estimate = await estimateCampaign(recipients.length, template.category);
    const quota = await checkCampaignQuota(req.tenantId, recipients.length);

    res.json({
      template: { id: template.id, name: template.name, category: template.category, status: template.status },
      approved: template.status === "APPROVED",
      recipientCount: recipients.length,
      estimate,
      quota,
      // Só libera o botão quando tudo está de pé.
      canSend: template.status === "APPROVED" && recipients.length > 0 && quota.allowed,
    });
  } catch (error) {
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
    const { name, templateId, tagIds, stageId, accountId, variables, scheduledAt } = req.body;
    if (!name || !templateId) return res.status(400).json({ error: "Nome e template são obrigatórios." });

    const template = await prisma.messageTemplate.findFirst({
      where: { id: templateId, tenantId: req.tenantId },
    });
    if (!template) return res.status(404).json({ error: "Template não encontrado." });
    if (template.status !== "APPROVED") {
      return res.status(400).json({ error: "Só é possível disparar template aprovado pela Meta." });
    }

    const recipients = await resolveRecipients(req.tenantId, { tagIds, stageId });
    if (recipients.length === 0) return res.status(400).json({ error: "Nenhum destinatário elegível." });

    const quota = await checkCampaignQuota(req.tenantId, recipients.length);
    if (!quota.allowed) return res.status(403).json({ error: quota.reason, quota });

    const estimate = await estimateCampaign(recipients.length, template.category);

    const campaign = await prisma.campaign.create({
      data: {
        tenantId: req.tenantId,
        name,
        templateId,
        accountId: accountId || null,
        targetTagIds: Array.isArray(tagIds) && tagIds.length ? JSON.stringify(tagIds) : null,
        variables: variables ? JSON.stringify(variables) : null,
        recipientCount: recipients.length,
        estimatedCost: estimate.priceBrl,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: "DRAFT",
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
export const startCampaign = async (req, res) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { template: true },
    });
    if (!campaign) return res.status(404).json({ error: "Campanha não encontrada." });
    if (campaign.status === "RUNNING") return res.status(409).json({ error: "Campanha já está em andamento." });
    if (campaign.status === "COMPLETED") return res.status(409).json({ error: "Campanha já foi concluída." });
    if (campaign.template.status !== "APPROVED") {
      return res.status(400).json({ error: "O template não está aprovado pela Meta." });
    }

    const sender = await resolveSender(req.tenantId, campaign.accountId);
    if (!sender) return res.status(400).json({ error: "Nenhuma conexão oficial disponível para o disparo." });

    let tagIds = [];
    try { tagIds = campaign.targetTagIds ? JSON.parse(campaign.targetTagIds) : []; } catch { tagIds = []; }
    const recipients = await resolveRecipients(req.tenantId, { tagIds });
    if (recipients.length === 0) return res.status(400).json({ error: "Nenhum destinatário elegível." });

    // Revalida a franquia: o público pode ter crescido desde a criação.
    const quota = await checkCampaignQuota(req.tenantId, recipients.length);
    if (!quota.allowed) return res.status(403).json({ error: quota.reason, quota });

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "RUNNING", startedAt: new Date(), sentCount: 0, errorCount: 0, errorLog: null },
    });

    runCampaign(campaign, sender, recipients, req.tenantId).catch((e) =>
      console.error("[Campanha] Falha inesperada:", e.message)
    );

    res.json({ success: true, status: "RUNNING", recipientCount: recipients.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Loop de envio, em background. */
async function runCampaign(campaign, sender, recipients, tenantId) {
  let variables = [];
  try { variables = campaign.variables ? JSON.parse(campaign.variables) : []; } catch { variables = []; }

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

    // {{1}} é sempre o nome do lead quando não há valor fixo definido.
    const vars = variables.length ? variables.map((v) => (v === "{{nome}}" ? lead.name : v)) : [lead.name];

    const result = await MetaManager.sendTemplate(sender.phoneId, sender.accessToken, lead.phone, {
      name: campaign.template.name,
      language: campaign.template.language,
      variables: vars,
    });

    if (result.ok) sent++;
    else {
      failed++;
      if (errors.length < 20) errors.push(`${lead.phone}: ${result.error}`);
    }

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

  // Contabiliza só o que saiu de fato — falha não consome franquia.
  await consumeCampaignQuota(tenantId, sent);

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

/** Consumo do ciclo, para a tela mostrar quanto resta da franquia. */
export const getCampaignQuota = async (req, res) => {
  try {
    const quota = await checkCampaignQuota(req.tenantId, 0);
    res.json(quota);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
