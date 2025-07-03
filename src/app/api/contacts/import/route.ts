import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/app/lib/prisma";

// POST - Importar contatos
export async function POST(request: NextRequest) {
  try {
    console.log("🔍 API /api/contacts/import POST chamada");

    const session = await getServerSession(authOptions);
    if (!session) {
      console.log("❌ Não autenticado");
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    console.log("✅ Usuário autenticado:", session.user.email);

    const body = await request.json();
    const { contacts } = body;

    console.log("📤 Recebidos", contacts?.length, "contatos para importar");

    if (!Array.isArray(contacts) || contacts.length === 0) {
      console.log("❌ Contatos inválidos:", contacts);
      return NextResponse.json(
        { error: "Contatos inválidos ou vazios" },
        { status: 400 }
      );
    }

    // Preparar dados para inserção
    const contactsData = contacts.map((contact) => {
      console.log("📋 Processando contato:", contact.nome);

      return {
        userId: session.user.id,
        name: contact.nome,
        phone: contact.telefone,
        email: contact.email || null,
        company: contact.empresa || null,
        value: contact.valor ? parseFloat(contact.valor.toString()) : null,
        dueDate: contact.vencimento ? new Date(contact.vencimento) : null,
        invoiceNumber: contact.documento || null,
        description: contact.descricao || null,
        status: "pending",
        source: "upload",
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

    console.log("✅ Contatos inseridos:", result.count);

    // Log da importação
    console.log(
      `✅ ${result.count} contatos importados para usuário ${session.user.email}`
    );

    return NextResponse.json({
      message: "Contatos importados com sucesso",
      imported: result.count,
      success: true,
    });
  } catch (error) {
    console.error("❌ Erro na importação:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor: " + error },
      { status: 500 }
    );
  }
}
