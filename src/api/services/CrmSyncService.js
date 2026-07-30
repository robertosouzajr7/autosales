import prisma from "../config/prisma.js";
import { getProvider } from "./CrmProviders.js";
import { resolveContact } from "./ContactIdentity.js";

/**
 * Sincronização com os CRMs do cliente.
 *
 * Duas direções, e as duas passam pelo CDP:
 *
 *   ENTRADA  — contato criado/alterado no CRM vira contato aqui, resolvido
 *              por e-mail/telefone/id do CRM. Nunca duplica.
 *   SAÍDA    — contato criado ou alterado aqui é empurrado para o CRM, que
 *              guarda o id externo como mais uma identidade do contato.
 *
 * O envio nunca bloqueia a operação do usuário: falha de CRM vira log, não
 * erro na tela — o cliente não pode ficar sem cadastrar contato porque o
 * token do HubSpot expirou.
 */

const JANELA_PADRAO_MS = 24 * 60 * 60 * 1000;

async function logar(connectionId, dados) {
  await prisma.crmSyncLog.create({ data: { connectionId, ...dados } }).catch(() => {});
}

/** Contato no formato que os adaptadores esperam. */
function paraCrm(lead) {
  let extra = {};
  try { extra = lead.extractedData ? JSON.parse(lead.extractedData) : {}; } catch { extra = {}; }
  return {
    name: lead.name,
    email: lead.email,
    // Telefone canônico vai com "+" para o CRM não achar que é ramal.
    phone: lead.phone ? `+${lead.phone}` : null,
    company: extra.company || extra.empresa || null,
    jobTitle: extra.jobTitle || extra.cargo || null,
    tags: (lead.tags || []).map((t) => t.name).filter(Boolean),
  };
}

/**
 * Empurra um contato para todos os CRMs conectados da conta.
 * Chamado depois de criar/atualizar contato. Não lança.
 */
export async function pushContact(tenantId, leadId, motivo = "UPDATE") {
  try {
    const conexoes = await prisma.crmConnection.findMany({
      where: { tenantId, active: true, direction: { in: ["OUT", "BOTH"] } },
    });
    if (!conexoes.length) return { enviados: 0 };

    const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { tags: true } });
    if (!lead) return { enviados: 0 };
    // Quem pediu para sair não é empurrado para lugar nenhum.
    if (lead.optedOut) return { enviados: 0 };

    const contato = paraCrm(lead);
    let enviados = 0;

    for (const conn of conexoes) {
      const provider = getProvider(conn.provider);
      if (!provider) continue;
      try {
        const { externalId } = await provider.enviar(conn, contato);
        enviados++;
        if (externalId) {
          await prisma.contactIdentity
            .upsert({
              where: { tenantId_type_value: { tenantId, type: "CRM", value: `${conn.provider}:${externalId}` } },
              update: {},
              create: { tenantId, leadId: lead.id, type: "CRM", value: `${conn.provider}:${externalId}`, source: conn.provider },
            })
            .catch(() => {});
        }
        await prisma.crmConnection.update({
          where: { id: conn.id },
          data: { lastStatus: "OK", lastError: null, syncedCount: { increment: 1 }, lastSyncAt: new Date() },
        });
        await logar(conn.id, { direction: "OUT", status: "OK", leadId: lead.id, externalId: externalId || null, message: motivo });
      } catch (e) {
        await prisma.crmConnection
          .update({ where: { id: conn.id }, data: { lastStatus: "ERROR", lastError: e.message } })
          .catch(() => {});
        await logar(conn.id, { direction: "OUT", status: "ERROR", leadId: lead.id, message: e.message });
      }
    }
    return { enviados };
  } catch (e) {
    console.error("[CRM] Falha ao enviar contato:", e.message);
    return { enviados: 0, erro: e.message };
  }
}

/** Versão que não faz o chamador esperar. */
export function pushContactAsync(tenantId, leadId, motivo) {
  pushContact(tenantId, leadId, motivo).catch(() => {});
}

/** Traz um lote de contatos do CRM para dentro, resolvendo pelo CDP. */
export async function pullConnection(conn) {
  const provider = getProvider(conn.provider);
  if (!provider) return { importados: 0, erro: "Provedor desconhecido." };

  const desde = conn.lastSyncAt || new Date(Date.now() - JANELA_PADRAO_MS);
  let contatos = [];
  try {
    contatos = await provider.listarAtualizados(conn, desde);
  } catch (e) {
    await prisma.crmConnection
      .update({ where: { id: conn.id }, data: { lastStatus: "ERROR", lastError: e.message } })
      .catch(() => {});
    await logar(conn.id, { direction: "IN", status: "ERROR", message: e.message });
    return { importados: 0, erro: e.message };
  }

  const resumo = await importarContatos(conn, contatos);
  await prisma.crmConnection.update({
    where: { id: conn.id },
    data: { lastSyncAt: new Date(), lastStatus: "OK", lastError: null, syncedCount: { increment: resumo.importados } },
  });
  return resumo;
}

/** Grava a lista normalizada vinda de um CRM (polling ou webhook). */
export async function importarContatos(conn, contatos) {
  let importados = 0;
  let criados = 0;
  let mesclados = 0;

  for (const c of contatos || []) {
    if (!c.email && !c.phone && !c.externalId) continue;
    try {
      const { lead, criado, mesclados: m } = await resolveContact(conn.tenantId, {
        name: c.name,
        email: c.email,
        phone: c.phone,
        crmProvider: conn.provider,
        crmId: c.externalId,
        source: `CRM_${conn.provider}`,
      });
      importados++;
      if (criado) criados++;
      mesclados += m;
      await logar(conn.id, { direction: "IN", status: "OK", leadId: lead.id, externalId: c.externalId || null });
    } catch (e) {
      await logar(conn.id, { direction: "IN", status: "ERROR", externalId: c.externalId || null, message: e.message });
    }
  }
  return { importados, criados, mesclados };
}

/** Roda a entrada de todas as conexões que puxam dados. */
export async function pullAll() {
  const conexoes = await prisma.crmConnection.findMany({
    where: { active: true, direction: { in: ["IN", "BOTH"] } },
  });
  let total = 0;
  for (const conn of conexoes) {
    const r = await pullConnection(conn).catch(() => ({ importados: 0 }));
    total += r.importados || 0;
  }
  if (total) console.log(`[CRM] ${total} contato(s) sincronizado(s) dos CRMs conectados.`);
  return total;
}

/**
 * Agenda a entrada periódica. O RD Station entra por webhook; os outros
 * três não avisam quando algo muda, então é preciso perguntar.
 */
export function iniciarSincronizacao(intervaloMin = 15) {
  const ms = Math.max(5, intervaloMin) * 60 * 1000;
  setInterval(() => { pullAll().catch(() => {}); }, ms);
  console.log(`[CRM] Sincronização de contatos a cada ${intervaloMin} min.`);
}

export default { pushContact, pushContactAsync, pullConnection, pullAll, importarContatos, iniciarSincronizacao };
