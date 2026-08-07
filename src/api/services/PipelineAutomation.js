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
//
// Os apelidos passam pelo mesmo `normalizar()` das etapas na hora de comparar.
// Sem isso, "reuniao marcada" e "no show" nunca casavam com nada: a etapa
// "Reunião marcada" vira "reuniaomarcada" e o apelido com espaço não existe
// em lugar nenhum. Eram dois apelidos mortos.
const APELIDOS = {
  APPOINTMENT_CREATED: ["agendado", "agendamento", "reuniao marcada", "scheduled"],
  APPOINTMENT_CONFIRMED: ["confirmado", "confirmacao", "agendado"],
  APPOINTMENT_COMPLETED: ["atendido", "concluido", "realizado", "ganho", "cliente"],
  APPOINTMENT_NOSHOW: ["no show", "noshow", "falta", "faltou", "perdido"],
  APPOINTMENT_CANCELLED: ["cancelado", "remarcar", "contato", "qualificando"],
  LEAD_QUALIFIED: ["qualificado", "qualificando", "oportunidade"],
  LEAD_WON: ["ganho", "cliente", "fechado"],
  LEAD_LOST: ["perdido", "descartado"],
  // Venda é evento do atendimento como o agendamento: fechar e pagar movem o
  // card. Sem isso o funil mostra "em negociação" com o dinheiro já na conta.
  SALE_CREATED: ["negociacao", "proposta", "fechamento", "aguardando pagamento"],
  SALE_PAID: ["ganho", "pago", "cliente", "fechado"],
};

/**
 * Etapa a criar quando o funil do tenant não tem nenhuma compatível.
 *
 * Antes, nesse caso, a função devolvia null e o lead ficava parado — em
 * silêncio. Um funil com uma etapa só ("Novos") nunca ia mover ninguém, e do
 * lado de fora parecia que a automação não funcionava. Agendar é um fato: se
 * não existe onde colocar, a etapa passa a existir. O dono pode renomear ou
 * apagar; o que não pode é o agendamento acontecer e o quadro não mostrar.
 */
const ETAPA_PADRAO = {
  APPOINTMENT_CREATED: { name: "Agendado", color: "#2563EB" },
  APPOINTMENT_CONFIRMED: { name: "Confirmado", color: "#0EA5E9" },
  APPOINTMENT_COMPLETED: { name: "Atendido", color: "#22A06B" },
  APPOINTMENT_NOSHOW: { name: "No-show", color: "#EF4444" },
  LEAD_WON: { name: "Ganho", color: "#15803D" },
  LEAD_LOST: { name: "Perdido", color: "#94A3B8" },
  SALE_CREATED: { name: "Aguardando pagamento", color: "#F59E0B" },
  SALE_PAID: { name: "Ganho", color: "#15803D" },
};

const STATUS_POR_EVENTO = {
  APPOINTMENT_CREATED: "SCHEDULED",
  APPOINTMENT_CONFIRMED: "SCHEDULED",
  APPOINTMENT_COMPLETED: "WON",
  APPOINTMENT_NOSHOW: "NOSHOW",
  APPOINTMENT_CANCELLED: "CONTACTED",
  LEAD_WON: "WON",
  LEAD_LOST: "LOST",
  // SALE_CREATED só move a etapa: não existe status de lead para "vendeu mas
  // ainda não pagou", e inventar um faria os filtros do CRM mentirem.
  SALE_PAID: "WON",
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
   * Move o lead para a etapa do evento, criando a etapa se ela não existir.
   * Devolve a etapa aplicada, ou null quando o evento não tem etapa prevista
   * (aí só o status do lead muda).
   */
  async onEvent(tenantId, leadId, evento) {
    try {
      if (!tenantId || !leadId || !evento) return null;

      const config = await prisma.automationConfig.findUnique({ where: { tenantId } }).catch(() => null);
      if (config && config.pipelineAutoEnabled === false) return null;

      // Funil vazio não é motivo para desistir: era justamente aí que o lead
      // ficava parado sem ninguém saber por quê.
      const stages = await prisma.pipelineStage.findMany({ where: { tenantId }, orderBy: { order: "asc" } });

      let stage = this.resolveStage(stages, evento, config?.stageMap);
      if (!stage) stage = await this.criarEtapa(tenantId, evento, stages).catch(() => null);
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
      const alvo = normalizar(apelido);
      const achado = stages.find((s) => normalizar(s.name).includes(alvo));
      if (achado) return achado;
    }
    return null;
  }

  /** Cria a etapa que faltava, no fim do funil. */
  async criarEtapa(tenantId, evento, stages) {
    const modelo = ETAPA_PADRAO[evento];
    if (!modelo) return null;
    const ordem = stages.reduce((maior, s) => Math.max(maior, s.order ?? 0), 0) + 1;
    const etapa = await prisma.pipelineStage.create({
      data: { tenantId, name: modelo.name, color: modelo.color, order: ordem },
    });
    console.log(`[Funil] Etapa "${modelo.name}" criada: o funil não tinha onde colocar ${evento}.`);
    await prisma
      .auditLog.create({
        data: {
          tenantId,
          action: "PIPELINE_STAGE_AUTOCREATED",
          entity: "PipelineStage",
          entityId: etapa.id,
          metadata: JSON.stringify({ evento, nome: modelo.name }),
        },
      })
      .catch(() => {});
    return etapa;
  }
}

export default new PipelineAutomation();
