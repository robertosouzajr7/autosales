/**
 * Adaptadores dos CRMs suportados.
 *
 * Cada provedor fala uma língua diferente — RD Station usa e-mail como
 * chave e chama tudo de "contact", HubSpot trabalha com `properties`,
 * Salesforce exige SOQL e uma instância própria, Pipedrive separa telefone
 * e e-mail em listas. O resto do sistema não precisa saber disso: todos
 * expõem o mesmo contrato.
 *
 *   testar(conn)                  → { ok, conta }
 *   enviar(conn, contato)         → { externalId }
 *   listarAtualizados(conn, desde)→ [ contatoNormalizado ]
 *
 * O "contato normalizado" é sempre { externalId, name, email, phone,
 * company, jobTitle, tags, raw }.
 */

const TIMEOUT_MS = 20_000;

async function chamar(url, opcoes = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opcoes.timeout || TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opcoes, signal: ctrl.signal });
    const texto = await res.text();
    let corpo = null;
    try { corpo = texto ? JSON.parse(texto) : null; } catch { corpo = { raw: texto }; }
    if (!res.ok) {
      const msg = corpo?.message || corpo?.error || corpo?.errors?.[0]?.message || `HTTP ${res.status}`;
      const erro = new Error(msg);
      erro.status = res.status;
      erro.corpo = corpo;
      throw erro;
    }
    return corpo;
  } finally {
    clearTimeout(t);
  }
}

function config(conn) {
  try { return conn.config ? JSON.parse(conn.config) : {}; } catch { return {}; }
}

// ── RD Station ────────────────────────────────────────────────────
// A chave é o e-mail: a API expõe /platform/contacts/email:<email>.
const rdstation = {
  id: "RDSTATION",
  label: "RD Station",
  campos: ["accessToken"],
  ajuda: "Token de acesso da API do RD Station Marketing (Integrações → API).",

  async testar(conn) {
    const r = await chamar("https://api.rd.services/marketing/account_info", {
      headers: { Authorization: `Bearer ${conn.accessToken}` },
    });
    return { ok: true, conta: r?.name || r?.site || "RD Station" };
  },

  async enviar(conn, c) {
    if (!c.email) throw new Error("RD Station identifica o contato pelo e-mail — este contato não tem e-mail.");
    const corpo = {
      name: c.name || undefined,
      personal_phone: c.phone || undefined,
      // A conversão é o que faz o contato aparecer no funil do RD.
      ...(c.tags?.length ? { tags: c.tags } : {}),
    };
    const r = await chamar(`https://api.rd.services/platform/contacts/email:${encodeURIComponent(c.email)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${conn.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    return { externalId: r?.uuid || c.email };
  },

  async listarAtualizados(conn, desde) {
    // A API pública do RD não tem listagem incremental de contatos; a
    // entrada de dados é feita pelo webhook (POST /api/webhooks/crm/rdstation).
    return [];
  },

  /** Normaliza o corpo que o RD manda no webhook de conversão/marcação. */
  doWebhook(payload) {
    const lista = payload?.leads || (payload?.email ? [payload] : []);
    return lista.map((l) => ({
      externalId: l.uuid || l.id || l.email,
      name: l.name || null,
      email: l.email || null,
      phone: l.personal_phone || l.mobile_phone || null,
      company: l.company || null,
      jobTitle: l.job_title || null,
      tags: l.tags || [],
      raw: l,
    }));
  },
};

// ── HubSpot ───────────────────────────────────────────────────────
const hubspot = {
  id: "HUBSPOT",
  label: "HubSpot",
  campos: ["accessToken"],
  ajuda: "Token do app privado (Settings → Integrations → Private Apps) com escopo crm.objects.contacts.",

  async testar(conn) {
    const r = await chamar("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
      headers: { Authorization: `Bearer ${conn.accessToken}` },
    });
    return { ok: true, conta: `HubSpot (${r?.results?.length ?? 0} contato(s) visíveis)` };
  },

  async enviar(conn, c) {
    const properties = limpar({
      email: c.email,
      phone: c.phone,
      firstname: primeiroNome(c.name),
      lastname: sobrenome(c.name),
      company: c.company,
      jobtitle: c.jobTitle,
    });
    if (!properties.email && !properties.phone) throw new Error("HubSpot precisa de e-mail ou telefone.");

    // O endpoint de upsert por e-mail evita duplicar do lado do CRM também.
    if (properties.email) {
      try {
        const r = await chamar(
          `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(properties.email)}?idProperty=email`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${conn.accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ properties }),
          }
        );
        return { externalId: r?.id };
      } catch (e) {
        if (e.status !== 404) throw e;
      }
    }
    const r = await chamar("https://api.hubapi.com/crm/v3/objects/contacts", {
      method: "POST",
      headers: { Authorization: `Bearer ${conn.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ properties }),
    });
    return { externalId: r?.id };
  },

  async listarAtualizados(conn, desde) {
    const corpo = {
      limit: 100,
      properties: ["email", "phone", "firstname", "lastname", "company", "jobtitle"],
      sorts: [{ propertyName: "lastmodifieddate", direction: "DESCENDING" }],
      ...(desde
        ? {
            filterGroups: [
              { filters: [{ propertyName: "lastmodifieddate", operator: "GTE", value: String(new Date(desde).getTime()) }] },
            ],
          }
        : {}),
    };
    const r = await chamar("https://api.hubapi.com/crm/v3/objects/contacts/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${conn.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    return (r?.results || []).map((x) => ({
      externalId: x.id,
      name: [x.properties?.firstname, x.properties?.lastname].filter(Boolean).join(" ") || null,
      email: x.properties?.email || null,
      phone: x.properties?.phone || null,
      company: x.properties?.company || null,
      jobTitle: x.properties?.jobtitle || null,
      tags: [],
      raw: x.properties,
    }));
  },
};

// ── Salesforce ────────────────────────────────────────────────────
const salesforce = {
  id: "SALESFORCE",
  label: "Salesforce",
  campos: ["accessToken", "instanceUrl"],
  ajuda: "Access token OAuth e a URL da instância (ex.: https://sua-empresa.my.salesforce.com).",

  base(conn) {
    const url = config(conn).instanceUrl;
    if (!url) throw new Error("Informe a URL da instância do Salesforce.");
    return `${String(url).replace(/\/$/, "")}/services/data/v60.0`;
  },

  async testar(conn) {
    const r = await chamar(`${this.base(conn)}/sobjects/Lead/describe`, {
      headers: { Authorization: `Bearer ${conn.accessToken}` },
    });
    return { ok: true, conta: r?.label ? `Salesforce (${r.label})` : "Salesforce" };
  },

  async enviar(conn, c) {
    const corpo = limpar({
      LastName: sobrenome(c.name) || primeiroNome(c.name) || "Contato",
      FirstName: sobrenome(c.name) ? primeiroNome(c.name) : undefined,
      Email: c.email,
      Phone: c.phone,
      Company: c.company || "Não informado", // campo obrigatório em Lead
      Title: c.jobTitle,
    });
    // Procura antes de criar: o Salesforce não deduplica sozinho.
    const existente = await this.buscar(conn, c);
    if (existente) {
      await chamar(`${this.base(conn)}/sobjects/Lead/${existente}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${conn.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      return { externalId: existente };
    }
    const r = await chamar(`${this.base(conn)}/sobjects/Lead`, {
      method: "POST",
      headers: { Authorization: `Bearer ${conn.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    return { externalId: r?.id };
  },

  async buscar(conn, c) {
    const filtros = [];
    if (c.email) filtros.push(`Email = '${escapar(c.email)}'`);
    if (c.phone) filtros.push(`Phone = '${escapar(c.phone)}'`);
    if (!filtros.length) return null;
    const soql = `SELECT Id FROM Lead WHERE ${filtros.join(" OR ")} LIMIT 1`;
    const r = await chamar(`${this.base(conn)}/query?q=${encodeURIComponent(soql)}`, {
      headers: { Authorization: `Bearer ${conn.accessToken}` },
    });
    return r?.records?.[0]?.Id || null;
  },

  async listarAtualizados(conn, desde) {
    const quando = new Date(desde || Date.now() - 24 * 3600 * 1000).toISOString();
    const soql =
      `SELECT Id, FirstName, LastName, Email, Phone, Company, Title FROM Lead ` +
      `WHERE LastModifiedDate >= ${quando} ORDER BY LastModifiedDate DESC LIMIT 200`;
    const r = await chamar(`${this.base(conn)}/query?q=${encodeURIComponent(soql)}`, {
      headers: { Authorization: `Bearer ${conn.accessToken}` },
    });
    return (r?.records || []).map((x) => ({
      externalId: x.Id,
      name: [x.FirstName, x.LastName].filter(Boolean).join(" ") || null,
      email: x.Email || null,
      phone: x.Phone || null,
      company: x.Company || null,
      jobTitle: x.Title || null,
      tags: [],
      raw: x,
    }));
  },
};

// ── Pipedrive ─────────────────────────────────────────────────────
const pipedrive = {
  id: "PIPEDRIVE",
  label: "Pipedrive",
  campos: ["accessToken", "domain"],
  ajuda: "API token (Configurações pessoais → API) e o domínio da empresa (ex.: minhaempresa).",

  base(conn) {
    const dominio = config(conn).domain;
    return dominio ? `https://${dominio}.pipedrive.com/api/v1` : "https://api.pipedrive.com/v1";
  },

  async testar(conn) {
    const r = await chamar(`${this.base(conn)}/users/me?api_token=${encodeURIComponent(conn.accessToken)}`);
    return { ok: true, conta: r?.data?.company_name || "Pipedrive" };
  },

  async enviar(conn, c) {
    const corpo = limpar({
      name: c.name || c.email || c.phone,
      email: c.email ? [{ value: c.email, primary: true }] : undefined,
      phone: c.phone ? [{ value: c.phone, primary: true }] : undefined,
      job_title: c.jobTitle,
    });
    const busca = c.email || c.phone;
    if (busca) {
      const achado = await chamar(
        `${this.base(conn)}/persons/search?term=${encodeURIComponent(busca)}&exact_match=true&api_token=${encodeURIComponent(conn.accessToken)}`
      ).catch(() => null);
      const id = achado?.data?.items?.[0]?.item?.id;
      if (id) {
        await chamar(`${this.base(conn)}/persons/${id}?api_token=${encodeURIComponent(conn.accessToken)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(corpo),
        });
        return { externalId: String(id) };
      }
    }
    const r = await chamar(`${this.base(conn)}/persons?api_token=${encodeURIComponent(conn.accessToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    return { externalId: String(r?.data?.id || "") };
  },

  async listarAtualizados(conn, desde) {
    const quando = new Date(desde || Date.now() - 24 * 3600 * 1000)
      .toISOString().replace("T", " ").slice(0, 19);
    const r = await chamar(
      `${this.base(conn)}/recents?since_timestamp=${encodeURIComponent(quando)}&items=person&limit=200&api_token=${encodeURIComponent(conn.accessToken)}`
    );
    return (r?.data || [])
      .map((x) => x.data)
      .filter(Boolean)
      .map((p) => ({
        externalId: String(p.id),
        name: p.name || null,
        email: p.email?.[0]?.value || null,
        phone: p.phone?.[0]?.value || null,
        company: p.org_name || null,
        jobTitle: p.job_title || null,
        tags: [],
        raw: p,
      }));
  },
};

export const PROVIDERS = { RDSTATION: rdstation, HUBSPOT: hubspot, SALESFORCE: salesforce, PIPEDRIVE: pipedrive };

export function getProvider(id) {
  return PROVIDERS[String(id || "").toUpperCase()] || null;
}

/** Catálogo para a tela montar o formulário de cada CRM. */
export function catalogoProvedores() {
  return Object.values(PROVIDERS).map((p) => ({
    id: p.id, label: p.label, campos: p.campos, ajuda: p.ajuda,
    entrada: p.id === "RDSTATION" ? "WEBHOOK" : "POLLING",
  }));
}

function limpar(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ""));
}
function primeiroNome(nome) {
  return nome ? String(nome).trim().split(/\s+/)[0] : null;
}
function sobrenome(nome) {
  if (!nome) return null;
  const partes = String(nome).trim().split(/\s+/);
  return partes.length > 1 ? partes.slice(1).join(" ") : null;
}
function escapar(v) {
  return String(v).replace(/'/g, "\\'");
}

export default { PROVIDERS, getProvider, catalogoProvedores };
