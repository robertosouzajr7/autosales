import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();

/**
 * WhatsApp Command Center — Modo Comando para o Dono
 * 
 * Quando o dono da empresa manda mensagem pro WhatsApp, o sistema
 * interpreta como comandos de gestão (estilo Eesier):
 * - Consultar métricas
 * - Definir/ajustar ICP
 * - Ver leads que responderam
 * - Relatório do dia
 * - Pausar/retomar SDR
 */
export class CommandCenter {

  /**
   * Verifica se o número que mandou mensagem é de um admin/owner
   */
  static async isAdminPhone(phone, tenantId) {
    const normalizedPhone = phone.replace(/\\D/g, '').slice(-11);
    
    const user = await prisma.user.findFirst({
      where: {
        tenantId,
        phone: { contains: normalizedPhone },
        role: { in: ['ADMIN', 'OWNER', 'SUPERADMIN'] }
      }
    });
    
    return user;
  }

  /**
   * Processa um comando do dono via WhatsApp
   */
  static async handleOwnerCommand(phone, content, tenantId, adminUser) {
    try {
      // Buscar dados do tenant para contexto
      const tenant = await prisma.tenant.findUnique({ 
        where: { id: tenantId },
        include: { plan: true }
      });

      // Buscar métricas em tempo real
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        totalLeads, leadsHoje, leadsQualificados,
        totalAppointments, appointmentsHoje,
        totalConversas, conversasAtivasHoje,
        sdrs
      ] = await Promise.all([
        prisma.lead.count({ where: { tenantId } }),
        prisma.lead.count({ where: { tenantId, createdAt: { gte: today } } }),
        prisma.lead.count({ where: { tenantId, qualificationScore: { gte: 70 } } }),
        prisma.appointment.count({ where: { tenantId } }),
        prisma.appointment.count({ where: { tenantId, createdAt: { gte: today } } }),
        prisma.conversation.count({ where: { tenantId } }),
        prisma.conversation.count({ where: { tenantId, updatedAt: { gte: today } } }),
        prisma.sdrBot.findMany({ where: { tenantId, active: true } })
      ]);

      // Buscar últimos leads que responderam (hoje)
      const recentMessages = await prisma.message.findMany({
        where: { 
          tenantId, 
          role: 'USER',
          createdAt: { gte: today }
        },
        include: {
          conversation: {
            include: { lead: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      const leadsQueResponderam = recentMessages
        .filter(m => m.conversation?.lead)
        .map(m => `• ${m.conversation.lead.name} (${m.conversation.lead.phone}): "${m.content.substring(0, 60)}..."`)
        .filter((v, i, a) => a.indexOf(v) === i) // deduplica
        .join('\n');

      // ICP atual
      const icpProfiles = await prisma.icpProfile.findMany({ where: { tenantId } });
      const icpText = icpProfiles.length > 0
        ? icpProfiles.map(i => `📋 ${i.name}: ${i.industry} | ${i.companySize} | ${i.goals}`).join('\n')
        : 'Nenhum ICP definido ainda.';

      // Pipeline stages
      const stages = await prisma.pipelineStage.findMany({ 
        where: { tenantId },
        orderBy: { order: 'asc' }
      });
      
      const pipelineData = await Promise.all(
        stages.map(async (stage) => {
          const count = await prisma.lead.count({ where: { stageId: stage.id } });
          return `${stage.name}: ${count}`;
        })
      );

      // Montar contexto para a IA
      const systemContext = `
Você é o Assistente de Gestão do Agentes Virtuais. O DONO da empresa "${tenant.name}" está falando com você pelo WhatsApp.
Seu nome é Agentes Virtuais AI. Seja direto, objetivo e use emojis moderadamente.

DADOS EM TEMPO REAL DO NEGÓCIO:
━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 MÉTRICAS GERAIS:
- Total de Leads: ${totalLeads}
- Leads Hoje: ${leadsHoje}
- Leads Qualificados (score ≥70): ${leadsQualificados}
- Agendamentos Total: ${totalAppointments}
- Agendamentos Hoje: ${appointmentsHoje}
- Conversas Ativas Hoje: ${conversasAtivasHoje}

🤖 SDRs ATIVOS: ${sdrs.map(s => s.name).join(', ') || 'Nenhum'}

📋 ICP CONFIGURADO:
${icpText}

🔄 PIPELINE:
${pipelineData.join(' → ')}

💬 LEADS QUE RESPONDERAM HOJE:
${leadsQueResponderam || 'Nenhuma resposta de lead hoje ainda.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━

CAPACIDADES DO MODO COMANDO:
1. Responder perguntas sobre métricas e resultados
2. Informar sobre leads que responderam
3. Descrever o estado do pipeline
4. Informar sobre ICPs configurados
5. Dar sugestões de melhoria baseadas nos dados
6. Informar status dos SDRs

REGRAS:
- Responda SEMPRE em português brasileiro
- Seja conciso mas completo
- Use dados reais das métricas acima
- Se o dono pedir algo que não consegue fazer (como alterar ICP), explique que ele pode fazer pelo painel web
- Não invente dados, use apenas os fornecidos acima
      `;

      // Usar a IA configurada do tenant
      const apiKey = tenant.aiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return '⚠️ Chave de IA não configurada. Acesse Configurações > Integrações no painel.';
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const chat = model.startChat({
        history: [{
          role: 'user',
          parts: [{ text: systemContext }]
        }, {
          role: 'model', 
          parts: [{ text: 'Entendido! Estou pronto para ajudar o dono a gerenciar o negócio pelo WhatsApp. Tenho acesso a todas as métricas em tempo real.' }]
        }]
      });

      const result = await chat.sendMessage(content);
      return result.response.text();

    } catch (error) {
      console.error('[CommandCenter] Erro:', error);
      return `⚠️ Erro ao processar comando: ${error.message}`;
    }
  }

  /**
   * Envia alerta pro admin quando um lead demonstra interesse
   */
  static async sendLeadAlert(tenantId, lead, message) {
    try {
      // Buscar o admin com telefone cadastrado
      const admin = await prisma.user.findFirst({
        where: {
          tenantId,
          phone: { not: null },
          role: { in: ['ADMIN', 'OWNER'] }
        }
      });

      if (!admin || !admin.phone) return;

      const alertText = `🔔 *LEAD QUENTE!*\n\n` +
        `*${lead.name}* acabou de enviar uma mensagem:\n` +
        `"${message.substring(0, 200)}"\n\n` +
        `📱 ${lead.phone}\n` +
        `📊 Score: ${lead.qualificationScore || 'N/A'}\n\n` +
        `_Responda aqui para ver mais detalhes._`;

      return { adminPhone: admin.phone, alertText };
    } catch (error) {
      console.error('[CommandCenter] Erro no alerta:', error);
      return null;
    }
  }

  /**
   * Gera o relatório diário para envio via WhatsApp
   */
  static async generateDailyReport(tenantId) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [newLeads, newAppointments, conversations, qualifiedLeads] = await Promise.all([
        prisma.lead.count({ where: { tenantId, createdAt: { gte: today } } }),
        prisma.appointment.count({ where: { tenantId, createdAt: { gte: today } } }),
        prisma.conversation.count({ where: { tenantId, updatedAt: { gte: today } } }),
        prisma.lead.count({ where: { tenantId, qualificationScore: { gte: 70 }, updatedAt: { gte: today } } })
      ]);

      const report = `📊 *RELATÓRIO DIÁRIO — Agentes Virtuais*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `📅 ${new Date().toLocaleDateString('pt-BR')}\n\n` +
        `👤 Leads novos: *${newLeads}*\n` +
        `💬 Conversas ativas: *${conversations}*\n` +
        `⭐ Leads qualificados: *${qualifiedLeads}*\n` +
        `📅 Agendamentos: *${newAppointments}*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `_Responda "detalhes" para mais informações._`;

      return report;
    } catch (error) {
      console.error('[CommandCenter] Erro no relatório:', error);
      return null;
    }
  }
}
