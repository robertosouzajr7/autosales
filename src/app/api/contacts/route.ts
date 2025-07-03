import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/app/lib/prisma";

// GET - Listar contatos
export async function GET(request: NextRequest) {
  try {
    console.log("🔍 API /api/contacts GET chamada");

    const session = await getServerSession(authOptions);
    if (!session) {
      console.log("❌ Não autenticado");
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    console.log("✅ Usuário autenticado:", session.user.email);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "";

    console.log("📋 Parâmetros:", { page, limit, search, status });

    const skip = (page - 1) * limit;

    // Construir filtros
    const where: any = {
      userId: session.user.id,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    console.log("🔍 Filtros WHERE:", where);

    // Buscar contatos
    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.contact.count({ where }),
    ]);

    console.log("📊 Contatos encontrados:", contacts.length, "Total:", total);

    // Calcular estatísticas
    const stats = await prisma.contact.groupBy({
      by: ["status"],
      where: { userId: session.user.id },
      _count: true,
    });

    const totalValue = await prisma.contact.aggregate({
      where: { userId: session.user.id },
      _sum: { value: true },
    });

    const response = {
      contacts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats: {
        total,
        pending: stats.find((s) => s.status === "pending")?._count || 0,
        sent: stats.find((s) => s.status === "sent")?._count || 0,
        paid: stats.find((s) => s.status === "paid")?._count || 0,
        totalValue: totalValue._sum.value || 0,
      },
    };

    console.log("✅ Resposta enviada - Stats:", response.stats);
    return NextResponse.json(response);
  } catch (error) {
    console.error("❌ Erro ao buscar contatos:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor: " + error },
      { status: 500 }
    );
  }
}

// PATCH - Atualizar status do contato
export async function PATCH(request: NextRequest) {
  try {
    console.log("🔍 API /api/contacts PATCH chamada");

    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { contactId, status } = await request.json();
    console.log("📝 Atualizando contato:", contactId, "para status:", status);

    const contact = await prisma.contact.updateMany({
      where: {
        id: contactId,
        userId: session.user.id,
      },
      data: {
        status,
        updatedAt: new Date(),
      },
    });

    console.log("✅ Contato atualizado:", contact);
    return NextResponse.json({ success: true, updated: contact.count });
  } catch (error) {
    console.error("❌ Erro ao atualizar contato:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor: " + error },
      { status: 500 }
    );
  }
}
