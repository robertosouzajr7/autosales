import prisma from "../config/prisma.js";
import { buildIdentifiers, mergeLeads } from "./ContactIdentity.js";

/**
 * Fusão automática de contatos duplicados.
 *
 * O CDP já impede duplicata nova: todo canal entra por `resolveContact`, e
 * quem chega com um identificador conhecido cai na ficha que já existe. O que
 * sobrava era a base antiga — o que foi gravado antes do CDP — e isso virava
 * uma tela "Ver duplicados" que só limpava se alguém lembrasse de abrir.
 *
 * Contato duplicado não é uma decisão de negócio quando os identificadores
 * são os mesmos: dois cadastros com o mesmo telefone SÃO a mesma pessoa, e é
 * exatamente a regra que o CDP já aplica na entrada. Aplicar na base antiga é
 * a mesma regra, com atraso. Aqui isso acontece sozinho.
 *
 * O que NÃO é fundido sozinho: contatos que só compartilham o nome. "João
 * Silva" e "João Silva" sem telefone nem e-mail em comum podem ser duas
 * pessoas, e juntar duas pessoas é irreversível. Esses continuam como
 * sugestão para o dono decidir.
 */

/** Une os contatos que dividem qualquer identificador (telefone ou e-mail). */
function agrupar(leads) {
  // Estrutura de conjuntos disjuntos: se A divide telefone com B e B divide
  // e-mail com C, os três são a mesma pessoa. Agrupar por chave, uma chave
  // de cada vez, perderia essa transitividade.
  const pai = new Map();
  const raiz = (x) => {
    while (pai.get(x) !== x) {
      pai.set(x, pai.get(pai.get(x)));
      x = pai.get(x);
    }
    return x;
  };
  const unir = (a, b) => {
    const ra = raiz(a), rb = raiz(b);
    if (ra !== rb) pai.set(rb, ra);
  };

  for (const l of leads) pai.set(l.id, l.id);

  const donoDaChave = new Map();
  for (const lead of leads) {
    for (const c of buildIdentifiers({
      phone: lead.phone,
      email: lead.email,
      channel: lead.channel,
      externalId: lead.externalId,
      igUsername: lead.igUsername,
    })) {
      const chave = `${c.type}|${c.value}`;
      const anterior = donoDaChave.get(chave);
      if (anterior) unir(anterior, lead.id);
      else donoDaChave.set(chave, lead.id);
    }
  }

  const grupos = new Map();
  for (const lead of leads) {
    const r = raiz(lead.id);
    if (!grupos.has(r)) grupos.set(r, []);
    grupos.get(r).push(lead);
  }
  return [...grupos.values()].filter((g) => g.length > 1);
}

/**
 * Quem fica. O mais antigo: é a ficha que o resto do sistema já referencia,
 * e `mergeLeads` traz para ela o que houver de melhor nas outras.
 */
function canonico(grupo) {
  return [...grupo].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
}

class ContactCleanup {
  /**
   * Funde as duplicatas de alta confiança de uma conta.
   *
   * `desde` limita a varredura ao que mudou: numa base grande, reprocessar
   * tudo de hora em hora seria caro e não acharia nada de novo. Sem `desde`,
   * varre a base inteira — é o que o botão "unificar agora" faz.
   */
  async varrer(tenantId, { desde = null } = {}) {
    const resumo = { grupos: 0, fundidos: 0, erros: 0 };

    if (desde) {
      // Só vale varrer se algo mudou; senão nem carrega a base.
      const mexeu = await prisma.lead.count({
        where: { tenantId, updatedAt: { gte: desde } },
      });
      if (!mexeu) return resumo;
    }

    const leads = await prisma.lead.findMany({
      where: {
        tenantId,
        OR: [
          { phone: { not: null } }, { email: { not: null } },
          { igUsername: { not: null } }, { externalId: { not: null } },
        ],
      },
      select: {
        id: true, name: true, phone: true, email: true, channel: true,
        igUsername: true, externalId: true, createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    for (const grupo of agrupar(leads)) {
      const principal = canonico(grupo);
      resumo.grupos++;
      for (const outro of grupo) {
        if (outro.id === principal.id) continue;
        try {
          await mergeLeads(principal.id, outro.id);
          resumo.fundidos++;
        } catch (e) {
          // Um contato problemático não pode parar a limpeza dos outros.
          resumo.erros++;
          console.error(`[CDP] Falha ao fundir ${outro.id} em ${principal.id}:`, e.message);
        }
      }
    }

    if (resumo.fundidos) {
      console.log(`[CDP] ${resumo.fundidos} contato(s) unificado(s) em ${resumo.grupos} pessoa(s) no tenant ${tenantId}.`);
      await prisma
        .auditLog.create({
          data: {
            tenantId,
            action: "CONTACTS_AUTO_MERGED",
            entity: "Lead",
            entityId: tenantId,
            metadata: JSON.stringify(resumo),
          },
        })
        .catch(() => {});
    }
    return resumo;
  }

  /** Passagem por todas as contas ativas. Chamada pelo motor, de hora em hora. */
  async varrerTodas({ desde = null } = {}) {
    const tenants = await prisma.tenant.findMany({ where: { active: true }, select: { id: true } });
    const total = { contas: 0, fundidos: 0 };
    for (const t of tenants) {
      const r = await this.varrer(t.id, { desde }).catch(() => null);
      if (r?.fundidos) {
        total.contas++;
        total.fundidos += r.fundidos;
      }
    }
    return total;
  }

  /**
   * O que sobra para decisão humana: contatos com o mesmo nome e nenhum
   * identificador em comum. Podem ser a mesma pessoa em duas fichas ou dois
   * homônimos — e não dá para saber sem conhecer o cliente.
   */
  async ambiguos(tenantId) {
    const leads = await prisma.lead.findMany({
      where: { tenantId },
      select: { id: true, name: true, phone: true, email: true, channel: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const porNome = new Map();
    for (const lead of leads) {
      const n = normalizarNome(lead.name);
      if (!n || n.length < 5) continue;
      if (!porNome.has(n)) porNome.set(n, []);
      porNome.get(n).push(lead);
    }

    const grupos = [];
    for (const lista of porNome.values()) {
      if (lista.length < 2) continue;
      grupos.push({ motivo: "Mesmo nome", valor: lista[0].name, contatos: lista, confianca: "BAIXA" });
    }
    return grupos;
  }
}

/** Nome comparável: sem acento, sem caixa, sem pontuação. */
function normalizarNome(nome) {
  return String(nome || "")
    .trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ");
}

export default new ContactCleanup();
