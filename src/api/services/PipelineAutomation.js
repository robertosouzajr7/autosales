import prisma from "../config/prisma.js";

/**
 * Movimentação automática do lead no funil.
 *
 * Cada evento validado do atendimento (agendou, confirmou, compareceu,
 * faltou, cancelou) empurra o lead para a etapa correspondente. Antes isso
 * só acontecia no agendamento pelo link público, com um `contains: "Agendado"`
 * solto — em qualquer outro caminho o card ficava parado na etapa antiga.
 *
 * O tenant pode mapear evento → nome da etapa em AutomationConfig.stageMap.
 * Sem mapa, casamos pelo nome da etapa com os apelidos mais comuns.
 */

// Apelidos por evento, na ordem de preferência. Comparação sem acento e em
// minúsculo, por "contém" — funil de cliente raramente usa nome exato.
const APELIDOS = {
  APPOINTMENT_CREATED: ["agendado", "agendamento", "reuniao marcada", "scheduled"],
  APPOINTMENT_CONFIRMED: ["confirmado", "confirmacao", "agendado"],
  APPOINTMENT_COMPLETED: ["atendido", "concluido", "realizado", "ganho", "cliente"],
  APPOINTMENT_NOSHOW: ["no show", "noshow", "falta", "faltou", "perdido"],
  APPOINTMENT_CANCELLED: ["cancelado", "remarcar", "contato", "qualificando"],
  LEAD_QUALIFIED: ["qualificado", "qualificando", "oportunidade"],
  LEAD_WON: ["ganho", "cliente", "fechado"],
  LEAD_LOST: ["perdido", "descartado"],
};

const STATUS_POR_EVENTO = {
  APPOINTMENT_CREATED: "SCHEDULED",
  APPOINTMENT_CONFIRMED: "SCHEDULED",
  APPOINTMENT_COMPLETED: "WON",
  APPOINTMENT_NOSHOW: "NOSHOW",
  APPOINTMENT_CANCELLED: "CONTACTED",
  LEAD_WON: "WON",
  LEAD_LOST: "LOST",
};

/**
 * Compara nomes de etapa ignorando acento, caixa e pontua\u00e7\u00e3o: "No-show",
 * "no show" e "NOSHOW" precisam casar com o mesmo apelido.
 */
function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

class PipelineAutomation {
  /**
   * Move o lead para a etapa do evento. Devolve a etapa aplicada, ou null
   * quando o funil do tenant não tem nenhuma etapa compatível — nesse caso
   * não inventamos nada, só registramos.
   */
  async onEvent(tenantId, leadId, evento) {
    try {
      if (!tenantId || !leadId || !evento) return null;

      const config = await prisma.automationConfig.findUnique({ where: { tenantId } }).catch(() => null);
      if (config && config.pipelineAutoEnabled === false) return null;

      const stages = await prisma.pipelineStage.findMany({ where: { tenantId }, orderBy: { order: "asc" } });
      if (!stages.length) return null;

      const stage = this.resolveStage(stages, evento, config?.stageMap);
      const data = {};
      if (stage) data.stageId = stage.id;
      if (STATUS_POR_EVENTO[evento]) data.status = STATUS_POR_EVENTO[evento];
      if (!Object.keys(data).length) return null;

      const atual = await prisma.lead.findUnique({ where: { id: leadId }, select: { stageId: true, status: true } });
      // Nada mudou: evita poluir o updatedAt e reordenar o inbox à toa.
      if (atual && atual.stageId === (data.stageId ?? atual.stageId) && atual.status === (data.status ?? atual.status)) {
        return stage || null;
      }

      await prisma.lead.update({ where: { id: leadId }, data });
      if (stage) console.log(`[Funil] Lead ${leadId} movido para "${stage.name}" por ${evento}.`);

      // Os mesmos eventos alimentam os fluxos do builder (agendou, confirmou,
      // faltou, concluiu). Import tardio para não criar ciclo com o motor.
      const lead = await prisma.lead.findUnique({ where: { id: leadId } });
      if (lead) {
        const { default: engine } = await import("../../../automation_engine.js");
        await engine
          .dispatchTrigger(evento, { lead, tenantId, channel: lead.channel, stageName: stage?.name || null })
          .catch(() => {});
        // Mudar de etapa também é "mudou de etapa no funil".
        if (stage) {
          await engine
            .dispatchTrigger("PIPELINE_MOVE", { lead, tenantId, channel: lead.channel, stageName: stage.name })
            .catch(() => {});
        }
      }
      return stage || null;
    } catch (e) {
      console.error("[Funil] Falha ao mover o lead:", e.message);
      return null;
    }
  }

  /** Etapa configurada pelo tenant tem prioridade sobre os apelidos. */
  resolveStage(stages, evento, stageMapJson) {
    let mapa = {};
    try {
      mapa = stageMapJson ? JSON.parse(stageMapJson) : {};
    } catch {
      mapa = {};
    }

    const escolhidoId = mapa[evento];
    if (escolhidoId) {
      const porId = stages.find((s) => s.id === escolhidoId || normalizar(s.name) === normalizar(escolhidoId));
      if (porId) return porId;
    }

    for (const apelido of APELIDOS[evento] || []) {
      const achado = stages.find((s) => normalizar(s.name).includes(apelido));
      if (achado) return achado;
    }
    return null;
  }
}

export default new PipelineAutomation();
