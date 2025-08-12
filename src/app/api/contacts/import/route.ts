import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/app/lib/prisma";

// POST - Importar contatos
export async function POST(request: NextRequest) {
  try {
    console.log("🔍 API /api/contacts/import POST chamada");

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    console.log("✅ Usuário autenticado:", session.user.email);

    // ✅ CORREÇÃO: Buscar UUID correto do usuário
    let userId = session.user.id;

    const isValidUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        userId
      );

    if (!isValidUUID) {
      console.log("🔄 UserId não é UUID, buscando UUID real pelo email...");
      const user = await prisma.user.findUnique({
        where: { email: session.user.email! },
        select: { id: true },
      });

      if (!user) {
        return NextResponse.json(
          { error: "Usuário não encontrado" },
          { status: 404 }
        );
      }

      userId = user.id;
      console.log("✅ UUID real encontrado:", userId);
    }

    const body = await request.json();
    const { contacts } = body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json(
        { error: "Lista de contatos é obrigatória" },
        { status: 400 }
      );
    }

    console.log("📤 Recebidos", contacts.length, "contatos para importar");

    // Preparar dados para inserção
    const contactsData = contacts.map((contact: any) => {
      console.log("📋 Processando contato:", contact.nome || contact.name);

      return {
        userId: userId,
        name: contact.nome || contact.name,
        phone: contact.telefone || contact.phone,
        email: contact.email || null,
        company: contact.empresa || contact.company || null,
        value: contact.valor || contact.value || null,
        dueDate:
          contact.vencimento || contact.dueDate
            ? new Date(contact.vencimento || contact.dueDate)
            : null,
        invoiceNumber: contact.documento || contact.invoiceNumber || null,
        description: contact.descricao || contact.description || null,
        status: "pending",
        // ❌ REMOVER: source: "upload", (não existe no schema)
        contactCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    console.log(
      "💾 Dados preparados para inserção:",
      contactsData.length,
      "contatos"
    );

    // Inserir contatos em lote
    const result = await prisma.contact.createMany({
      data: contactsData,
      skipDuplicates: true,
    });

    console.log("✅ Importação concluída:", result.count, "contatos inseridos");

    return NextResponse.json({
      success: true,
      imported: result.count,
      total: contacts.length,
      message: `${result.count} contatos importados com sucesso!`,
    });
  } catch (error: any) {
    console.error("❌ Erro na importação:", error);

    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
