// src/app/api/contacts/bulk-delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { ids } = body;

    console.log("🗑️ Bulk delete - IDs:", ids);

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Lista de IDs é obrigatória" },
        { status: 400 }
      );
    }

    // Verificar se todos os contatos pertencem ao usuário
    const contactsCount = await prisma.contact.count({
      where: {
        id: { in: ids },
        userId: session.user.id,
      },
    });

    if (contactsCount !== ids.length) {
      return NextResponse.json(
        { error: "Alguns contatos não foram encontrados" },
        { status: 404 }
      );
    }

    // Excluir contatos
    const result = await prisma.contact.deleteMany({
      where: {
        id: { in: ids },
        userId: session.user.id,
      },
    });

    console.log("✅ Bulk delete concluído:", result.count);

    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `${result.count} contatos excluídos com sucesso!`,
    });
  } catch (error: any) {
    console.error("❌ Erro ao excluir contatos:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
