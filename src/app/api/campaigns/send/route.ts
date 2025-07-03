import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/app/lib/prisma";

interface SendMessageRequest {
  contactIds: string[];
  templateId: string;
  config: {
    horarioInicio: string;
    horarioFim: string;
    intervalMinutes: number;
    diasUteis: boolean;
  };
}

// POST - Enviar mensagens via Evolution API
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body: SendMessageRequest = await request.json();
    const { contactIds, templateId, config } = body;

    console.log("📤 Iniciando envio de campanha:", {
      contactIds,
      templateId,
      config,
    });

    // Validações
    if (!contactIds || contactIds.length === 0) {
      return NextResponse.json(
        {
          error: "Selecione pelo menos um contato",
        },
        { status: 400 }
      );
    }

    if (!templateId) {
      return NextResponse.json(
        {
          error: "Selecione um template",
        },
        { status: 400 }
      );
    }

    // Buscar template
    const template = await prisma.template.findFirst({
      where: {
        id: templateId,
        userId: session.user.id,
        isActive: true,
        category: "cobranca",
      },
    });

    if (!template) {
      return NextResponse.json(
        {
          error: "Template não encontrado ou inativo",
        },
        { status: 404 }
      );
    }

    console.log("📝 Template encontrado:", template.name);

    // Buscar contatos
    const contacts = await prisma.contact.findMany({
      where: {
        id: {
          in: contactIds,
        },
        userId: session.user.id,
      },
    });

    if (contacts.length === 0) {
      return NextResponse.json(
        {
          error: "Nenhum contato válido encontrado",
        },
        { status: 404 }
      );
    }

    console.log("👥 Contatos encontrados:", contacts.length);

    // Verificar limites do plano (se implementado)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { plan: true },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: "Usuário não encontrado",
        },
        { status: 404 }
      );
    }

    // Criar campanha para tracking
    const campaign = await prisma.campaign.create({
      data: {
        name: `Cobrança ${new Date().toLocaleDateString("pt-BR")}`,
        description: `Campanha de cobrança para ${contacts.length} contatos`,
        type: "cobranca",
        targetContacts: contactIds,
        templateId,
        status: "active",
        userId: session.user.id,
        stats: {
          total_contacts: contacts.length,
          messages_sent: 0,
          messages_delivered: 0,
          messages_read: 0,
          responses_received: 0,
          conversions: 0,
        },
      },
    });

    console.log("📊 Campanha criada:", campaign.id);

    // Verificar se está dentro do horário de funcionamento
    if (!isWithinBusinessHours(config)) {
      return NextResponse.json(
        {
          error: "Fora do horário de funcionamento configurado",
        },
        { status: 400 }
      );
    }

    // Enviar mensagens
    const results = await sendMessagesInBatch(
      contacts,
      template,
      config,
      campaign.id,
      session.user.id
    );

    // Atualizar estatísticas da campanha
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        stats: {
          total_contacts: contacts.length,
          messages_sent: successCount,
          messages_delivered: 0, // Será atualizado via webhooks se configurado
          messages_read: 0,
          responses_received: 0,
          conversions: 0,
        },
        startedAt: new Date(),
        status: "completed",
      },
    });

    // Atualizar status dos contatos enviados com sucesso
    const successfulContactIds = results
      .filter((r) => r.success)
      .map((r) => r.contactId);

    if (successfulContactIds.length > 0) {
      await prisma.contact.updateMany({
        where: {
          id: {
            in: successfulContactIds,
          },
        },
        data: {
          status: "contacted",
          lastContactAt: new Date(),
          contactCount: {
            increment: 1,
          },
        },
      });
    }

    // Incrementar usage count do template
    await prisma.template.update({
      where: { id: templateId },
      data: {
        usageCount: {
          increment: successCount,
        },
      },
    });

    console.log("✅ Envio concluído:", { successCount, failureCount });

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      sent: successCount,
      failed: failureCount,
      total: contacts.length,
      message: `${successCount} mensagens enviadas com sucesso!`,
      details: results,
    });
  } catch (error: any) {
    console.error("❌ Erro ao enviar campanhas:", error);
    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// Função para enviar mensagens em lote com controle de rate limiting
async function sendMessagesInBatch(
  contacts: any[],
  template: any,
  config: SendMessageRequest["config"],
  campaignId: string,
  userId: string
): Promise<
  Array<{
    contactId: string;
    success: boolean;
    message: string;
    response?: string;
    error?: string;
  }>
> {
  const results = [];

  console.log("🚀 Iniciando envio em lote para", contacts.length, "contatos");

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];

    try {
      console.log(`📱 Enviando para ${contact.name} (${contact.phone})...`);

      // Substituir variáveis no template
      let message = template.content
        .replace(/\{nome\}/g, contact.name || "Cliente")
        .replace(
          /\{valor\}/g,
          contact.value ? formatCurrency(contact.value) : "N/A"
        )
        .replace(
          /\{dataVencimento\}/g,
          contact.dueDate ? formatDate(contact.dueDate) : "N/A"
        )
        .replace(/\{diasAtraso\}/g, contact.daysOverdue?.toString() || "0");

      console.log(
        "📝 Mensagem personalizada:",
        message.substring(0, 100) + "..."
      );

      // Enviar via Evolution API
      const result = await sendWhatsAppMessage({
        phone: contact.phone,
        message,
        contactId: contact.id,
      });

      // Salvar log no banco
      await prisma.message.create({
        data: {
          userId,
          contactId: contact.id,
          templateId: template.id,
          content: message,
          direction: "outbound",
          messageType: "text",
          status: result.success ? "sent" : "failed",
          errorMessage: result.error,
          whatsappMessageId: result.messageId,
          sentAt: new Date(),
        },
      });

      results.push({
        contactId: contact.id,
        success: result.success,
        message,
        response: result.response,
        error: result.error,
      });

      console.log(
        result.success ? "✅ Enviado com sucesso" : "❌ Erro no envio:",
        result.error
      );

      // Rate limiting - aguardar intervalo entre mensagens
      if (i < contacts.length - 1) {
        console.log(`⏱️ Aguardando ${config.intervalMinutes} segundos...`);
        await sleep(config.intervalMinutes * 1000);
      }
    } catch (error: any) {
      console.error("❌ Erro ao enviar para", contact.name, ":", error);
      results.push({
        contactId: contact.id,
        success: false,
        message: template.content,
        error: `Erro no envio: ${error.message}`,
      });
    }
  }

  return results;
}

// Função para enviar mensagem via Evolution API
async function sendWhatsAppMessage(message: {
  phone: string;
  message: string;
  contactId: string;
}): Promise<{
  success: boolean;
  response?: string;
  error?: string;
  messageId?: string;
}> {
  try {
    const evolutionApiUrl = process.env.EVOLUTION_API_URL;
    const instanceName = process.env.EVOLUTION_INSTANCE;
    const apiKey = process.env.EVOLUTION_API_KEY;

    console.log("🔗 Enviando via Evolution API:", {
      evolutionApiUrl,
      instanceName,
      phone: message.phone,
    });

    if (!apiKey) {
      throw new Error("EVOLUTION_API_KEY não configurada");
    }

    const response = await fetch(
      `${evolutionApiUrl}/message/sendText/${instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apiKey: apiKey,
        },
        body: JSON.stringify({
          number: message.phone,
          text: message.message,
        }),
      }
    );

    const data = await response.json();

    console.log("📨 Resposta Evolution API:", {
      status: response.status,
      data,
    });

    if (response.ok && data.key) {
      return {
        success: true,
        response: JSON.stringify(data),
        messageId: data.key.id,
      };
    } else {
      return {
        success: false,
        error:
          data.message || `HTTP ${response.status}: ${JSON.stringify(data)}`,
      };
    }
  } catch (error: any) {
    console.error("❌ Erro na Evolution API:", error);
    return {
      success: false,
      error: `Erro de conexão: ${error.message}`,
    };
  }
}

// Verificar se está dentro do horário de funcionamento
function isWithinBusinessHours(config: SendMessageRequest["config"]): boolean {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const [startHour, startMinute] = config.horarioInicio.split(":").map(Number);
  const [endHour, endMinute] = config.horarioFim.split(":").map(Number);

  const currentTime = currentHour * 60 + currentMinute;
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;

  // Se apenas dias úteis e hoje é fim de semana
  if (config.diasUteis) {
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Domingo ou Sábado
      return false;
    }
  }

  return currentTime >= startTime && currentTime <= endTime;
}

// Função para delay
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Formatação de moeda
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

// Formatação de data
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("pt-BR");
}
