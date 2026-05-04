import prisma from "../config/prisma.js";
import axios from "axios";

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const SNOV_CLIENT_ID = process.env.SNOV_CLIENT_ID;
const SNOV_CLIENT_SECRET = process.env.SNOV_CLIENT_SECRET;

async function getSnovToken() {
  if (!SNOV_CLIENT_ID || !SNOV_CLIENT_SECRET) return null;
  try {
    const res = await axios.post('https://api.snov.io/v1/oauth/access_token', {
      grant_type: 'client_credentials',
      client_id: SNOV_CLIENT_ID,
      client_secret: SNOV_CLIENT_SECRET
    });
    return res.data.access_token;
  } catch (e) {
    console.error("[Snov.io] Auth Error:", e.message);
    return null;
  }
}

export const prospectGeneric = async (req, res) => {
  const { niche, location } = req.body;
  const query = `${niche} em ${location}`;

  try {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: "Configuração SERPER_API_KEY ausente no servidor. Verifique o arquivo .env" });
    }

    const tenantId = req.headers["x-tenant-id"] || req.tenantId;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, include: { plan: true } });
    if (tenant?.plan && tenant.usedProspects >= tenant.plan.maxProspects) {
      return res.status(403).json({ error: "Limite de prospecção mensal atingido para o seu plano." });
    }

    const response = await axios.post('https://google.serper.dev/places', {
      q: query,
      gl: 'br',
      hl: 'pt-br'
    }, {
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      }
    });

    // Increment usage
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { usedProspects: { increment: 1 } }
    });

    const results = (response.data.places || []).map((place, idx) => ({
      id: `serper-${idx}-${Date.now()}`,
      name: place.title,
      phone: place.phoneNumber || "",
      displayPhone: place.phoneNumber || "Solicitar WhatsApp",
      address: place.address,
      website: place.website,
      rating: place.rating,
      reviews: place.ratingCount,
      category: place.category,
      source: 'Google Maps',
      imported: false
    }));

    res.json(results);
  } catch (error) {
    console.error("[Prospecting] Serper Error:", error.message);
    res.status(500).json({ error: "Falha ao consultar base do Google Maps" });
  }
};

export const searchApollo = async (req, res) => {
  const { query, location, title } = req.body;

  try {
    if (!SERPER_API_KEY) {
      return res.status(400).json({ error: "Configuração SERPER_API_KEY ausente para busca Apollo." });
    }

    const tenantId = req.headers["x-tenant-id"] || req.tenantId;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, include: { plan: true } });
    if (tenant?.plan && tenant.usedProspects >= tenant.plan.maxProspects) {
      return res.status(403).json({ error: "Limite de prospecção mensal atingido." });
    }

    // Proxy Apollo search via Serper Google Search focusing on LinkedIn/Company data
    const searchQuery = `site:apollo.io/people "${query || title}" "${location}"`;
    const response = await axios.post('https://google.serper.dev/search', {
      q: searchQuery,
      num: 15
    }, {
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { usedProspects: { increment: 1 } }
    });

    const results = (response.data.organic || []).map((item, idx) => ({
      id: `apollo-proxy-${idx}-${Date.now()}`,
      name: item.title.split('-')[0].trim(),
      title: title || "Decisor",
      company: item.snippet.split('at')[1]?.split('·')[0]?.trim() || "Empresa Identificada",
      url: item.link,
      displayPhone: "Aguardando Enriquecimento",
      source: 'Apollo.io (via Search)',
      imported: false
    }));

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Erro na busca Apollo Engine" });
  }
};

export const prospectLinkedIn = async (req, res) => {
  const { title, location } = req.body;

  try {
    if (!SERPER_API_KEY) {
      return res.status(400).json({ error: "Configuração SERPER_API_KEY ausente." });
    }

    const tenantId = req.headers["x-tenant-id"] || req.tenantId;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, include: { plan: true } });
    if (tenant?.plan && tenant.usedProspects >= tenant.plan.maxProspects) {
      return res.status(403).json({ error: "Limite de prospecção mensal atingido." });
    }

    const query = `site:linkedin.com/in/ "${title}" "${location}"`;
    const response = await axios.post('https://google.serper.dev/search', {
      q: query,
      num: 15
    }, {
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { usedProspects: { increment: 1 } }
    });

    const results = (response.data.organic || []).map((item, idx) => ({
      id: `li-${idx}-${Date.now()}`,
      name: item.title.split('|')[0].split('-')[0].trim(),
      title: title,
      url: item.link,
      displayPhone: "Aguardando Enriquecimento",
      source: 'LinkedIn Pro',
      imported: false
    }));

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar perfis no LinkedIn" });
  }
};

export const enrichData = async (req, res) => {
  const { url } = req.body;

  try {
    const token = await getSnovToken();
    if (token && url.includes("linkedin.com")) {
      // Use Snov.io to find email/phone by LinkedIn URL
      const snovRes = await axios.post('https://api.snov.io/v1/get-emails-from-url', {
        url: url
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (snovRes.data.success) {
        return res.json({
          success: true,
          email: snovRes.data.data.email || "Não localizado",
          phone: snovRes.data.data.phone || "Solicitar WhatsApp",
          provider: "Snov.io Engine"
        });
      }
    }

    // Fallback: If Snov fails or no key, return an error (no more mocks)
    res.status(404).json({ error: "Dados de contato não localizados para este perfil nos motores ativos." });
  } catch (error) {
    res.status(500).json({ error: "Falha no motor de enriquecimento" });
  }
};
