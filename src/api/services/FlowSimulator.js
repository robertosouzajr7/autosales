import prisma from "../config/prisma.js";
import AutomationEngine from "../../../automation_engine.js";

/**
 * Simulador de fluxos com trilha de depuração.
 *
 * Roda o fluxo do builder como se um lead estivesse conversando, mas sem
 * mandar nada para o WhatsApp e sem gravar tag, etapa ou agendamento. Cada
 * passo vira uma linha na trilha: qual bloco entrou, com que configuração,
 * o que saiu, quais variáveis mudaram e por que a condição escolheu um ramo.
 *
 * Antes só dava para testar publicando o fluxo e conversando de verdade —
 * qualquer erro de ligação só aparecia com um cliente do outro lado.
 *
 * A sessão vive em memória: é uma ferramenta de edição, não um dado do
 * negócio. Sessões paradas são recolhidas depois de 30 minutos.
 */

const SESSOES = new Map();
const TTL_MS = 30 * 60 * 1000;
const MAX_PASSOS = 100;

// Blocos que mexem no mundo real. Na simulação eles são registrados como
// "ação simulada" — a trilha mostra o que aconteceria, sem acontecer.
const EFEITOS_COLATERAIS = {
  ADD_TAG: (c) => `Adicionaria a tag "${c.tag || "(sem tag)"}" ao contato.`,
  MOVE_STAGE: (c) => `Moveria o contato para a etapa "${c.stageName || "(sem etapa)"}".`,
  UPDATE_LEAD: (c) => `Atualizaria o campo "${c.field || "?"}" para "${c.value ?? ""}".`,
  TRANSFER_HUMAN: () => "Colocaria a conversa na fila de atendimento humano.",
  SCHEDULE_APPOINTMENT: (c) => `Criaria um agendamento (${c.title || "sem título"}).`,
  SEND_MEDIA: (c) => `Enviaria a mídia ${c.mediaType || "arquivo"}: ${c.mediaUrl || "(sem URL)"}.`,
};

function agora() {
  return new Date().toISOString();
}

/** Limpa sessões esquecidas — o simulador não pode virar vazamento de memória. */
function recolher() {
  const limite = Date.now() - TTL_MS;
  for (const [id, s] of SESSOES) {
    if (s.updatedAt < limite) SESSOES.delete(id);
  }
}

function novoId() {
  return `sim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Contexto inicial: um lead fictício, editável pela tela. */
function contextoInicial(lead = {}, tenant = {}) {
  const d = new Date();
  const dias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  return {
    variables: {
      lead: {
        id: "lead_simulado",
        name: lead.name || "Maria Silva",
        phone: lead.phone || "5571999990000",
        email: lead.email || "maria@exemplo.com",
        status: lead.status || "NEW",
        source: lead.source || "SIMULADOR",
      },
      tenant: { name: tenant.name || "Seu negócio" },
      conversation: { last_message: "" },
      input: {},
      ai: {},
      current: {
        date: d.toLocaleDateString("pt-BR"),
        time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        day_of_week: dias[d.getDay()],
      },
    },
  };
}

class FlowSimulator {
  /** Inicia uma sessão a partir do fluxo salvo (ou do rascunho da tela). */
  async start(tenantId, automationId, { nodes, edges, lead } = {}) {
    recolher();

    const automation = await prisma.automation.findFirst({ where: { id: automationId, tenantId } });
    if (!automation) throw new Error("Fluxo não encontrado.");
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });

    // O rascunho da tela tem prioridade: dá para testar antes de salvar.
    const listaNodes = nodes || JSON.parse(automation.nodes || "[]");
    const listaEdges = edges || JSON.parse(automation.edges || "[]");

    if (!Array.isArray(listaNodes) || listaNodes.length === 0) {
      throw new Error("O fluxo não tem nenhum bloco para executar.");
    }

    const sessao = {
      id: novoId(),
      tenantId,
      automationId,
      nome: automation.name,
      nodes: listaNodes,
      edges: Array.isArray(listaEdges) ? listaEdges : [],
      contexto: contextoInicial(lead, tenant || {}),
      trilha: [],
      mensagens: [],
      esperando: null, // { nodeId, variable, tipo }
      status: "RUNNING",
      passos: 0,
      updatedAt: Date.now(),
    };
    SESSOES.set(sessao.id, sessao);

    const inicio = this.acharInicio(sessao);
    if (!inicio) {
      this.log(sessao, {
        nivel: "erro",
        titulo: "Nenhum bloco inicial",
        detalhe:
          "Todo bloco do fluxo é destino de alguma ligação, então não há por onde começar. Deixe um bloco sem ligação de entrada.",
      });
      sessao.status = "ERROR";
      return this.resumo(sessao);
    }

    this.log(sessao, {
      nivel: "info",
      titulo: `Fluxo "${automation.name}" iniciado`,
      detalhe: `Gatilho: ${automation.trigger}. ${listaNodes.length} bloco(s), ${sessao.edges.length} ligação(ões).`,
    });

    await this.percorrer(sessao, inicio.id);
    return this.resumo(sessao);
  }

  /** O cliente respondeu: retoma de onde o fluxo parou. */
  async send(sessionId, texto, replyId = null) {
    const sessao = SESSOES.get(sessionId);
    if (!sessao) throw new Error("Sessão de simulação expirada. Inicie de novo.");
    sessao.updatedAt = Date.now();

    sessao.mensagens.push({ de: "lead", texto, replyId, em: agora() });
    sessao.contexto.variables.conversation.last_message = texto;

    if (!sessao.esperando) {
      this.log(sessao, {
        nivel: "aviso",
        titulo: "Mensagem ignorada",
        detalhe: "O fluxo não está esperando resposta neste ponto — no fluxo real, quem responderia seria o agente de IA.",
      });
      return this.resumo(sessao);
    }

    const { nodeId, variable, tipo } = sessao.esperando;
    if (variable) {
      sessao.contexto.variables.input[variable] = texto;
      if (replyId) sessao.contexto.variables.input[`${variable}_id`] = replyId;
      this.log(sessao, {
        nivel: "variavel",
        titulo: `input.${variable} = "${texto}"`,
        detalhe: replyId ? `Clique no botão/opção "${replyId}".` : "Resposta digitada pelo cliente.",
      });
    }

    sessao.esperando = null;
    // Botão clicado escolhe o ramo pelo id da opção, igual ao fluxo real.
    await this.percorrer(sessao, null, { deNode: nodeId, handle: tipo === "escolha" ? replyId : null });
    return this.resumo(sessao);
  }

  get(sessionId) {
    const sessao = SESSOES.get(sessionId);
    if (!sessao) return null;
    return this.resumo(sessao);
  }

  stop(sessionId) {
    SESSOES.delete(sessionId);
    return { success: true };
  }

  // ── Execução ───────────────────────────────────────────────────

  acharInicio(sessao) {
    const alvos = new Set(sessao.edges.map((e) => e.target));
    return sessao.nodes.find((n) => !alvos.has(n.id)) || sessao.nodes[0];
  }

  proximos(sessao, nodeId, handle = null) {
    const saindo = sessao.edges.filter((e) => e.source === nodeId);
    if (!handle) return saindo.map((e) => e.target);
    const especificas = saindo.filter((e) => e.sourceHandle === handle);
    if (especificas.length) return especificas.map((e) => e.target);
    // Mesma regra do motor: opção sem ramo próprio cai na saída padrão.
    return saindo.filter((e) => !e.sourceHandle).map((e) => e.target);
  }

  /**
   * Caminha pelo fluxo até acabar ou parar esperando resposta.
   * `origem` permite retomar a partir do bloco que estava esperando.
   */
  async percorrer(sessao, nodeIdInicial, { deNode = null, handle = null } = {}) {
    let fila = nodeIdInicial ? [nodeIdInicial] : this.proximos(sessao, deNode, handle);

    if (deNode && fila.length === 0) {
      this.log(sessao, {
        nivel: "aviso",
        titulo: "Fim de caminho",
        detalhe: `O bloco "${this.rotulo(sessao, deNode)}" não tem ligação de saída${handle ? ` para a opção "${handle}"` : ""}. O fluxo para aqui.`,
      });
      sessao.status = "FINISHED";
      return;
    }

    while (fila.length) {
      if (++sessao.passos > MAX_PASSOS) {
        this.log(sessao, {
          nivel: "erro",
          titulo: "Limite de passos atingido",
          detalhe: `Mais de ${MAX_PASSOS} blocos executados — provavelmente há um ciclo no fluxo.`,
        });
        sessao.status = "ERROR";
        return;
      }

      const id = fila.shift();
      const node = sessao.nodes.find((n) => n.id === id);
      if (!node) {
        this.log(sessao, {
          nivel: "erro",
          titulo: "Ligação quebrada",
          detalhe: `Existe uma ligação apontando para o bloco "${id}", que não está no fluxo.`,
        });
        continue;
      }

      const resultado = await this.executar(sessao, node);
      if (resultado.pausar) {
        sessao.status = "WAITING";
        return;
      }
      if (resultado.parar) {
        sessao.status = "FINISHED";
        return;
      }
      fila = fila.concat(this.proximos(sessao, node.id, resultado.handle));
      if (!fila.length) sessao.status = "FINISHED";
    }
  }

  rotulo(sessao, nodeId) {
    const n = sessao.nodes.find((x) => x.id === nodeId);
    return n?.data?.label || n?.type || nodeId;
  }

  /** Executa um bloco e registra na trilha o que aconteceu. */
  async executar(sessao, node) {
    const tipo = node.type || node.data?.nodeType;
    const config = node.data?.config || {};
    const resolver = (v) => AutomationEngine.resolveTemplate(String(v ?? ""), sessao.contexto);

    const base = { nodeId: node.id, nodeType: tipo, rotulo: node.data?.label || tipo };

    try {
      switch (tipo) {
        case "SEND_MSG": {
          const texto = resolver(config.message);
          this.enviar(sessao, { texto });
          this.log(sessao, { ...base, nivel: "acao", titulo: "Mensagem enviada", detalhe: texto, config });
          return {};
        }

        case "SEND_BUTTONS":
        case "SEND_LIST": {
          const ehLista = tipo === "SEND_LIST";
          const opcoes = ehLista
            ? (config.sections || []).flatMap((s) => s.rows || [])
            : config.buttons || [];
          const texto = resolver(config.body || config.message || "");
          this.enviar(sessao, {
            texto,
            opcoes: opcoes.map((o, i) => ({ id: o.id || `opt_${i + 1}`, titulo: o.title || o.titulo || `Opção ${i + 1}` })),
          });
          this.log(sessao, {
            ...base,
            nivel: "acao",
            titulo: ehLista ? "Menu enviado" : "Botões enviados",
            detalhe: `${texto} — ${opcoes.length} opção(ões).`,
            config,
          });
          // A escolha do cliente decide o ramo: o fluxo para até ele responder.
          sessao.esperando = { nodeId: node.id, variable: config.variable || null, tipo: "escolha" };
          return { pausar: true };
        }

        case "COLLECT_INPUT": {
          const pergunta = resolver(config.prompt || config.message || "");
          this.enviar(sessao, { texto: pergunta });
          this.log(sessao, {
            ...base,
            nivel: "acao",
            titulo: "Pergunta enviada",
            detalhe: `${pergunta} → guarda a resposta em input.${config.variable || "resposta"}`,
            config,
          });
          sessao.esperando = { nodeId: node.id, variable: config.variable || "resposta", tipo: "texto" };
          return { pausar: true };
        }

        case "SEND_TEMPLATE": {
          this.enviar(sessao, { texto: `[template: ${config.templateName || config.templateId || "?"}]` });
          this.log(sessao, {
            ...base,
            nivel: "acao",
            titulo: "Template enviado",
            detalhe: `Template "${config.templateName || config.templateId || "?"}" (na simulação não vai para a Meta).`,
            config,
          });
          return {};
        }

        case "WAIT": {
          const espera = `${config.value || 0} ${config.unit || "min"}`;
          this.log(sessao, {
            ...base,
            nivel: "info",
            titulo: `Espera de ${espera}`,
            detalhe: "Na simulação a espera é pulada — no fluxo real o contato só recebe o próximo bloco depois desse tempo.",
            config,
          });
          return {};
        }

        case "CONDITION": {
          const regras = config.rules || [];
          const logica = config.logic || "AND";
          const avaliadas = regras.map((r) => {
            const campo = resolver(r.field);
            const valor = resolver(r.value || "");
            const passou = this.compara(campo, r.operator, valor);
            return { regra: `${r.field} ${r.operator} ${r.value ?? ""}`, campo, valor, passou };
          });
          const resultado = logica === "OR" ? avaliadas.some((a) => a.passou) : avaliadas.every((a) => a.passou);
          this.log(sessao, {
            ...base,
            nivel: "logica",
            titulo: `Condição: ${resultado ? "VERDADEIRO" : "FALSO"}`,
            detalhe: avaliadas
              .map((a) => `${a.passou ? "✓" : "✗"} "${a.campo}" ${a.regra.split(" ").slice(1).join(" ")}`)
              .join(" · ") || "Sem regras configuradas — sempre falso.",
            config,
            saida: resultado ? "true" : "false",
          });
          return { handle: resultado ? "true" : "false" };
        }

        case "AI_RESPONSE":
        case "AI_TOOLS": {
          const prompt = resolver(config.prompt || "");
          const resposta = `[resposta da IA simulada para: "${prompt.slice(0, 80)}"]`;
          sessao.contexto.variables.ai.response = resposta;
          if (config.sendToLead !== false) this.enviar(sessao, { texto: resposta });
          this.log(sessao, {
            ...base,
            nivel: "ia",
            titulo: "Chamada de IA (simulada)",
            detalhe: `Prompt resolvido: ${prompt}\n\nA simulação não gasta tokens — no fluxo real a resposta vem do provedor configurado.`,
            config,
          });
          return {};
        }

        case "CLASSIFY_INTENT": {
          const intents = config.intents || [];
          const escolhida = intents[0]?.id || intents[0] || "outros";
          sessao.contexto.variables.ai.intent = escolhida;
          this.log(sessao, {
            ...base,
            nivel: "ia",
            titulo: `Intenção classificada (simulada): ${escolhida}`,
            detalhe: "Na simulação assumimos a primeira intenção da lista para você ver o caminho.",
            config,
            saida: String(escolhida),
          });
          return { handle: String(escolhida) };
        }

        case "AI_SCORE": {
          sessao.contexto.variables.ai.score = 75;
          this.log(sessao, {
            ...base,
            nivel: "ia",
            titulo: "Score simulado: 75",
            detalhe: "Valor fixo na simulação, para você conferir os ramos de temperatura.",
            config,
            saida: "warm",
          });
          return { handle: "warm" };
        }

        case "EXTRACT_DATA": {
          const campos = config.fields || [];
          for (const f of campos) sessao.contexto.variables[`extracted.${f}`] = `<${f} extraído>`;
          this.log(sessao, {
            ...base,
            nivel: "ia",
            titulo: "Extração de dados (simulada)",
            detalhe: campos.length ? `Campos: ${campos.join(", ")}` : "Nenhum campo configurado.",
            config,
          });
          return {};
        }

        case "AB_TEST": {
          sessao.contexto.variables.ab = { variant: "A" };
          this.log(sessao, {
            ...base,
            nivel: "logica",
            titulo: "Teste A/B: variante A",
            detalhe: "A simulação sempre segue a variante A para o caminho ficar previsível.",
            config,
            saida: "a",
          });
          return { handle: "a" };
        }

        case "HTTP_REQUEST": {
          const url = resolver(config.url || "");
          this.log(sessao, {
            ...base,
            nivel: "requisicao",
            titulo: `${(config.method || "GET").toUpperCase()} ${url || "(sem URL)"}`,
            detalhe: `Corpo: ${resolver(config.body || "") || "(vazio)"}\n\nA simulação não dispara a requisição de verdade.`,
            config,
          });
          return {};
        }

        case "SUBFLOW": {
          this.log(sessao, {
            ...base,
            nivel: "info",
            titulo: "Subfluxo",
            detalhe: `Chamaria o fluxo "${config.subflowName || config.subflowId || "(não escolhido)"}". A simulação não entra em subfluxos.`,
            config,
          });
          return {};
        }

        case "END": {
          this.log(sessao, { ...base, nivel: "info", titulo: "Fim do fluxo", detalhe: "Bloco de encerramento." });
          return { parar: true };
        }

        default: {
          const descreve = EFEITOS_COLATERAIS[tipo];
          this.log(sessao, {
            ...base,
            nivel: "acao",
            titulo: descreve ? "Ação simulada" : `Bloco ${tipo}`,
            detalhe: descreve ? descreve(config) : "Bloco sem efeito visível na simulação.",
            config,
          });
          return {};
        }
      }
    } catch (e) {
      this.log(sessao, { ...base, nivel: "erro", titulo: "Erro ao executar o bloco", detalhe: e.message, config });
      return {};
    }
  }

  compara(campo, operador, valor) {
    const a = String(campo ?? "").toLowerCase();
    const b = String(valor ?? "").toLowerCase();
    switch (operador) {
      case "equals": return campo === valor;
      case "not_equals": return campo !== valor;
      case "contains": return a.includes(b);
      case "not_contains": return !a.includes(b);
      case "starts_with": return a.startsWith(b);
      case "ends_with": return a.endsWith(b);
      case "gt": return parseFloat(campo) > parseFloat(valor);
      case "lt": return parseFloat(campo) < parseFloat(valor);
      case "gte": return parseFloat(campo) >= parseFloat(valor);
      case "lte": return parseFloat(campo) <= parseFloat(valor);
      case "empty": return !campo;
      case "not_empty": return !!campo;
      case "regex": try { return new RegExp(valor, "i").test(String(campo)); } catch { return false; }
      case "in": return String(valor).split(",").map((v) => v.trim().toLowerCase()).includes(a);
      default: return false;
    }
  }

  enviar(sessao, { texto, opcoes = [] }) {
    sessao.mensagens.push({ de: "fluxo", texto, opcoes, em: agora() });
  }

  log(sessao, entrada) {
    sessao.trilha.push({ ...entrada, em: agora(), passo: sessao.trilha.length + 1 });
    sessao.updatedAt = Date.now();
  }

  resumo(sessao) {
    return {
      sessionId: sessao.id,
      status: sessao.status,
      esperando: sessao.esperando,
      mensagens: sessao.mensagens,
      trilha: sessao.trilha,
      variaveis: sessao.contexto.variables,
      // O caminho percorrido serve para acender os blocos no canvas.
      caminho: sessao.trilha.filter((t) => t.nodeId).map((t) => t.nodeId),
      nodeAtual: sessao.esperando?.nodeId || null,
    };
  }
}

export default new FlowSimulator();
