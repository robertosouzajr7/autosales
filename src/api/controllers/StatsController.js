import prisma from "../config/prisma.js";

export const getDashboardStats = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true }
    });

    // 1. Basic counts
    const totalLeads = await prisma.lead.count({ where: { tenantId } });
    const totalAppointments = await prisma.appointment.count({ where: { tenantId } });
    const completedAppointments = await prisma.appointment.count({ 
      where: { tenantId, status: "COMPLETED" } 
    });
    
    const activeSdrs = await prisma.sdrBot.count({ where: { tenantId, active: true } });

    // 2. Qualified Leads Calculation (leads in stages that suggest qualification)
    const qualifiedLeads = await prisma.lead.count({
      where: {
        tenantId,
        stage: {
          name: {
            contains: "Qualificad",
            // Note: contains is case-sensitive in some DBs, but Prisma with SQLite/PG handles this differently.
            // We'll use a more robust way if possible, or just assume standard naming.
          }
        }
      }
    });

    // Alternatively, also count those already with appointments as qualified
    const leadsWithAppointments = await prisma.lead.count({
      where: {
        tenantId,
        appointments: { some: {} }
      }
    });

    const finalQualifiedCount = Math.max(qualifiedLeads, leadsWithAppointments, tenant.qualifiedLeadsCount || 0);

    // 3. Funnel data logic
    const stages = await prisma.pipelineStage.findMany({
      where: { tenantId },
      include: { _count: { select: { leads: true } } },
      orderBy: { order: 'asc' }
    });

    const funnelData = stages.map(s => ({
      name: s.name,
      value: s._count.leads
    }));

    // 4. Performance Metrics
    const showRate = totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0;
    const conversionRate = totalLeads > 0 ? ((finalQualifiedCount / totalLeads) * 100) : 0;

    // 5. Message counts
    const emailsSent = await prisma.message.count({ 
      where: { tenantId, messageType: "EMAIL" } 
    });
    const whatsappFollowups = await prisma.message.count({ 
      where: { tenantId, role: "assistant", messageType: "TEXT" } 
    });

    res.json({
      stats: {
        totalLeads,
        appointments: totalAppointments,
        completedAppointments,
        showRate,
        activeSdrs,
        usedTokens: tenant.usedTokens || 0,
        maxTokens: tenant.plan?.maxTokens || 1000,
        maxSdrs: tenant.plan?.maxSdrs || 1,
        usedMessages: tenant.usedMessages || 0,
        planName: tenant.plan?.name || "Básico",
        qualifiedLeadsCount: finalQualifiedCount,
        conversionRate,
        emailsSent,
        whatsappFollowups,
        trends: {
          leads: 0, 
          qualified: 0,
          appointments: 0,
          conversion: 0
        }
      },
      funnelData
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * Painel de resultados da clínica — a prova de ROI que sustenta a renovação.
 * Métricas do período: consultas agendadas, conversas atendidas e tempo médio
 * de primeira resposta do agente. Aceita ?days=N (default 30).
 */
export const getResults = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [appointmentsScheduled, appointmentsCompleted, conversationsHandled, optOuts] = await Promise.all([
      prisma.appointment.count({ where: { tenantId, createdAt: { gte: since } } }),
      prisma.appointment.count({ where: { tenantId, status: "COMPLETED", createdAt: { gte: since } } }),
      prisma.conversation.count({ where: { tenantId, messages: { some: { createdAt: { gte: since } } } } }),
      prisma.lead.count({ where: { tenantId, optedOut: true } })
    ]);

    // Tempo médio de 1ª resposta: para cada conversa recente, diferença entre
    // a 1ª mensagem do lead (USER) e a 1ª resposta do agente (ASSISTANT).
    const conversations = await prisma.conversation.findMany({
      where: { tenantId, messages: { some: { createdAt: { gte: since } } } },
      select: {
        messages: {
          where: { createdAt: { gte: since } },
          orderBy: { createdAt: "asc" },
          select: { role: true, createdAt: true }
        }
      },
      take: 500
    });

    // Coleta o tempo (s) da 1ª resposta em cada conversa. Usamos a MEDIANA (e
    // ignoramos intervalos > 6h, que são atendimento humano/handoff, não a
    // resposta automática) para não distorcer com outliers.
    const MAX_REASONABLE_S = 6 * 60 * 60;
    const diffs = [];
    for (const conv of conversations) {
      const firstUser = conv.messages.find(m => m.role === "USER");
      if (!firstUser) continue;
      const firstReply = conv.messages.find(m => m.role === "ASSISTANT" && m.createdAt > firstUser.createdAt);
      if (!firstReply) continue;
      const sec = (new Date(firstReply.createdAt) - new Date(firstUser.createdAt)) / 1000;
      if (sec >= 0 && sec <= MAX_REASONABLE_S) diffs.push(sec);
    }
    let avgResponseSeconds = null;
    if (diffs.length) {
      diffs.sort((a, b) => a - b);
      const mid = Math.floor(diffs.length / 2);
      const median = diffs.length % 2 ? diffs[mid] : (diffs[mid - 1] + diffs[mid]) / 2;
      avgResponseSeconds = Math.round(median);
    }

    res.json({
      periodDays: days,
      appointmentsScheduled,
      appointmentsCompleted,
      conversationsHandled,
      avgResponseSeconds,
      optOuts
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * Tudo o que a home do painel mostra, numa chamada só.
 *
 * Existe separado de `getResults` porque a home precisa de coisas que o
 * relatório não pede — série diária para o gráfico, variação contra o período
 * anterior, divisão IA/equipe e os valores do funil — e porque mudar o formato
 * de `getResults` quebraria a tela de Relatórios.
 *
 * As definições ficam explícitas aqui de propósito: são números que o dono do
 * negócio usa para decidir, e um número sem definição é pior que nenhum.
 */
export const getHomeStats = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const DIA = 24 * 60 * 60 * 1000;
    const agora = Date.now();
    const inicio = new Date(agora - days * DIA);
    const inicioAnterior = new Date(agora - 2 * days * DIA);

    /** Variação percentual contra o período anterior de mesmo tamanho. */
    const variacao = (atual, anterior) => {
      // Sem base de comparação não existe variação: devolver 100% ou 0% aqui
      // inventaria um crescimento que ninguém mediu.
      if (!anterior) return null;
      return Math.round(((atual - anterior) / anterior) * 1000) / 10;
    };

    const conversasDoPeriodo = (de, ate) => ({
      tenantId,
      messages: { some: { createdAt: { gte: de, ...(ate ? { lt: ate } : {}) } } },
    });

    const agendamentosDoPeriodo = (de, ate) => ({
      tenantId,
      createdAt: { gte: de, ...(ate ? { lt: ate } : {}) },
    });

    // Conversa que passou por gente em algum momento. Não há histórico de
    // fases, então o rastro é o que ficou gravado: dono, motivo do handoff ou
    // a fase atual. Uma conversa que a IA resolveu inteira não tem nenhum.
    const passouPorHumano = {
      OR: [
        { assignedToId: { not: null } },
        { handoffReason: { not: null } },
        { phase: { in: ["QUEUE", "HUMAN"] } },
      ],
    };

    const [
      conversas, conversasAnterior, conversasEquipe,
      agendamentos, agendamentosAnterior,
      concluidos, faltas, concluidosAnterior, faltasAnterior,
      serie,
    ] = await Promise.all([
      prisma.conversation.count({ where: conversasDoPeriodo(inicio) }),
      prisma.conversation.count({ where: conversasDoPeriodo(inicioAnterior, inicio) }),
      prisma.conversation.count({ where: { ...conversasDoPeriodo(inicio), ...passouPorHumano } }),
      prisma.appointment.count({ where: agendamentosDoPeriodo(inicio) }),
      prisma.appointment.count({ where: agendamentosDoPeriodo(inicioAnterior, inicio) }),
      // Comparecimento olha a DATA do compromisso, não a de criação: o que
      // interessa é quem apareceu, e só compromisso já vencido responde isso.
      prisma.appointment.count({ where: { tenantId, status: "COMPLETED", date: { gte: inicio, lt: new Date(agora) } } }),
      prisma.appointment.count({ where: { tenantId, status: "NOSHOW", date: { gte: inicio, lt: new Date(agora) } } }),
      prisma.appointment.count({ where: { tenantId, status: "COMPLETED", date: { gte: inicioAnterior, lt: inicio } } }),
      prisma.appointment.count({ where: { tenantId, status: "NOSHOW", date: { gte: inicioAnterior, lt: inicio } } }),
      // Série diária do gráfico: conversas distintas com mensagem naquele dia.
      // Em SQL porque a alternativa seria uma consulta por dia do período.
      prisma.$queryRaw`
        SELECT date_trunc('day', m."createdAt")::date AS dia,
               COUNT(DISTINCT m."conversationId")::int AS total
        FROM "Message" m
        WHERE m."tenantId" = ${tenantId} AND m."createdAt" >= ${inicio}
        GROUP BY 1 ORDER BY 1
      `,
    ]);

    const taxa = (ok, falta) => (ok + falta > 0 ? Math.round((ok / (ok + falta)) * 100) : null);

    // Dias sem conversa nenhuma não aparecem no GROUP BY. Preencher com zero
    // importa: sem isso o gráfico ligaria segunda direto em quinta e desenharia
    // uma linha contínua sobre dois dias parados.
    const porDia = new Map(
      (serie || []).map((l) => [new Date(l.dia).toISOString().slice(0, 10), Number(l.total)])
    );
    const serieCheia = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(agora - i * DIA).toISOString().slice(0, 10);
      serieCheia.push({ dia: d, total: porDia.get(d) || 0 });
    }

    // Tempo de primeira resposta: mesma mediana usada no relatório.
    const responderEm = async (de, ate) => {
      const convs = await prisma.conversation.findMany({
        where: conversasDoPeriodo(de, ate),
        select: {
          messages: {
            where: { createdAt: { gte: de, ...(ate ? { lt: ate } : {}) } },
            orderBy: { createdAt: "asc" },
            select: { role: true, createdAt: true },
          },
        },
        take: 500,
      });
      const MAX = 6 * 60 * 60;
      const tempos = [];
      for (const c of convs) {
        const doCliente = c.messages.find((m) => m.role === "USER");
        if (!doCliente) continue;
        const resposta = c.messages.find((m) => m.role === "ASSISTANT" && m.createdAt > doCliente.createdAt);
        if (!resposta) continue;
        const s = (new Date(resposta.createdAt) - new Date(doCliente.createdAt)) / 1000;
        if (s >= 0 && s <= MAX) tempos.push(s);
      }
      if (!tempos.length) return null;
      tempos.sort((a, b) => a - b);
      const meio = Math.floor(tempos.length / 2);
      return Math.round(tempos.length % 2 ? tempos[meio] : (tempos[meio - 1] + tempos[meio]) / 2);
    };
    const [resposta, respostaAnterior] = await Promise.all([
      responderEm(inicio, null),
      responderEm(inicioAnterior, inicio),
    ]);

    // ── Funil, com valores ──────────────────────────────────────
    // A última etapa (maior `order`) é a de fechamento. É a convenção do
    // board — quem arrasta para a direita está avançando a venda.
    const etapas = await prisma.pipelineStage.findMany({
      where: { tenantId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true, order: true },
    });
    const porEtapa = await prisma.lead.groupBy({
      by: ["stageId"],
      where: { tenantId, stageId: { not: null } },
      _count: { _all: true },
      _sum: { value: true },
    });
    const dadosEtapa = new Map(porEtapa.map((l) => [l.stageId, l]));
    const funil = etapas.map((e) => ({
      id: e.id, nome: e.name, cor: e.color,
      total: dadosEtapa.get(e.id)?._count?._all || 0,
      valor: dadosEtapa.get(e.id)?._sum?.value || 0,
    }));
    const ultima = funil[funil.length - 1] || null;
    const fechado = ultima?.valor || 0;
    const fechadoQtd = ultima?.total || 0;
    const emNegociacao = funil.slice(0, -1).reduce((s, e) => s + e.valor, 0);

    res.json({
      periodDays: days,
      conversas: {
        total: conversas,
        delta: variacao(conversas, conversasAnterior),
        equipe: conversasEquipe,
        ia: Math.max(conversas - conversasEquipe, 0),
        serie: serieCheia,
      },
      agendamentos: { total: agendamentos, delta: variacao(agendamentos, agendamentosAnterior) },
      comparecimento: {
        taxa: taxa(concluidos, faltas),
        // A variação aqui é em pontos percentuais, não em porcentagem de
        // porcentagem: "subiu 3 p.p." é o que um dono de negócio entende.
        delta: (() => {
          const a = taxa(concluidos, faltas);
          const b = taxa(concluidosAnterior, faltasAnterior);
          return a === null || b === null ? null : a - b;
        })(),
        concluidos, faltas,
      },
      resposta: {
        segundos: resposta,
        // Responder mais rápido é melhor, então o sinal é invertido na tela.
        delta: resposta === null || !respostaAnterior ? null
          : Math.round(((resposta - respostaAnterior) / respostaAnterior) * 1000) / 10,
      },
      funil: { etapas: funil, emNegociacao, fechado, ticketMedio: fechadoQtd ? fechado / fechadoQtd : 0 },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
