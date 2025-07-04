// src/app/api/contacts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/app/lib/prisma";

// GET - Listar contatos com filtros e paginação
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

    console.log("🔍 API /api/contacts GET chamada");
    console.log("✅ Usuário autenticado:", session.user.email);
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
      ];
    }

    if (status && status !== "todos") {
      where.status = status;
    }

    console.log("🔍 Filtros WHERE:", where);

    // Buscar contatos
    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.contact.count({ where }),
    ]);

    console.log("📊 Contatos encontrados:", contacts.length, "Total:", total);

    // Calcular estatísticas
    const stats = await prisma.contact.aggregate({
      where: { userId: session.user.id },
      _count: { id: true },
      _sum: { value: true },
    });

    const statusCounts = await prisma.contact.groupBy({
      by: ["status"],
      where: { userId: session.user.id },
      _count: { id: true },
    });

    const statusStats = {
      pending: statusCounts.find((s) => s.status === "pending")?._count.id || 0,
      sent: statusCounts.find((s) => s.status === "contacted")?._count.id || 0,
      paid: statusCounts.find((s) => s.status === "paid")?._count.id || 0,
    };

    const response = {
      success: true,
      contacts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats: {
        total: stats._count.id,
        totalValue: stats._sum.value || 0,
        ...statusStats,
      },
    };

    console.log("✅ Resposta enviada - Stats:", response.stats);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("❌ Erro ao buscar contatos:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// POST - Criar novo contato
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { name, phone, email, value, dueDate, notes, status } = body;

    console.log("➕ Criando novo contato:", { name, phone });

    // Validações
    if (!name || !phone) {
      return NextResponse.json(
        { error: "Nome e telefone são obrigatórios" },
        { status: 400 }
      );
    }

    // Limpar telefone
    const cleanPhone = phone.replace(/\D/g, "");

    // Verificar se telefone já existe para este usuário
    const existingContact = await prisma.contact.findFirst({
      where: {
        userId: session.user.id,
        phone: cleanPhone,
      },
    });

    if (existingContact) {
      return NextResponse.json(
        { error: "Já existe um contato com este telefone" },
        { status: 400 }
      );
    }

    // Criar contato
    const contact = await prisma.contact.create({
      data: {
        name: name.trim(),
        phone: cleanPhone,
        email: email?.trim() || null,
        value: value ? parseFloat(value) : null,
        dueDate: dueDate || null,
        notes: notes?.trim() || null,
        status: status || "pending",
        userId: session.user.id,
      },
    });

    console.log("✅ Contato criado:", contact.id);

    return NextResponse.json({
      success: true,
      contact,
      message: "Contato criado com sucesso!",
    });
  } catch (error: any) {
    console.error("❌ Erro ao criar contato:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// PUT - Atualizar contato completo
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, phone, email, value, dueDate, notes, status } = body;

    console.log("✏️ Atualizando contato:", id);

    if (!id) {
      return NextResponse.json(
        { error: "ID do contato é obrigatório" },
        { status: 400 }
      );
    }

    // Verificar se contato existe e pertence ao usuário
    const existingContact = await prisma.contact.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingContact) {
      return NextResponse.json(
        { error: "Contato não encontrado" },
        { status: 404 }
      );
    }

    // Verificar se telefone já existe em outro contato
    if (phone && phone !== existingContact.phone) {
      const cleanPhone = phone.replace(/\D/g, "");
      const phoneExists = await prisma.contact.findFirst({
        where: {
          userId: session.user.id,
          phone: cleanPhone,
          id: { not: id },
        },
      });

      if (phoneExists) {
        return NextResponse.json(
          { error: "Já existe outro contato com este telefone" },
          { status: 400 }
        );
      }
    }

    // Atualizar contato
    const contact = await prisma.contact.update({
      where: { id },
      data: {
        name: name?.trim() || existingContact.name,
        phone: phone?.replace(/\D/g, "") || existingContact.phone,
        email: email?.trim() || existingContact.email,
        value:
          value !== undefined
            ? value
              ? parseFloat(value)
              : null
            : existingContact.value,
        dueDate: dueDate !== undefined ? dueDate : existingContact.dueDate,
        notes:
          notes !== undefined ? notes?.trim() || null : existingContact.notes,
        status: status || existingContact.status,
        updatedAt: new Date(),
      },
    });

    console.log("✅ Contato atualizado:", contact.id);

    return NextResponse.json({
      success: true,
      contact,
      message: "Contato atualizado com sucesso!",
    });
  } catch (error: any) {
    console.error("❌ Erro ao atualizar contato:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// PATCH - Atualização parcial (ex: só status)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    console.log("🔧 PATCH contato:", id, updates);

    if (!id) {
      return NextResponse.json(
        { error: "ID do contato é obrigatório" },
        { status: 400 }
      );
    }

    // Verificar se contato existe e pertence ao usuário
    const existingContact = await prisma.contact.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingContact) {
      return NextResponse.json(
        { error: "Contato não encontrado" },
        { status: 404 }
      );
    }

    // Atualizar apenas campos fornecidos
    const contact = await prisma.contact.update({
      where: { id },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });

    console.log("✅ Contato atualizado via PATCH:", contact.id);

    return NextResponse.json({
      success: true,
      contact,
      message: "Contato atualizado com sucesso!",
    });
  } catch (error: any) {
    console.error("❌ Erro ao atualizar contato:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// DELETE - Excluir contato
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    console.log("🗑️ Excluindo contato:", id);

    if (!id) {
      return NextResponse.json(
        { error: "ID do contato é obrigatório" },
        { status: 400 }
      );
    }

    // Verificar se contato existe e pertence ao usuário
    const existingContact = await prisma.contact.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingContact) {
      return NextResponse.json(
        { error: "Contato não encontrado" },
        { status: 404 }
      );
    }

    // Excluir contato
    await prisma.contact.delete({
      where: { id },
    });

    console.log("✅ Contato excluído:", id);

    return NextResponse.json({
      success: true,
      message: "Contato excluído com sucesso!",
    });
  } catch (error: any) {
    console.error("❌ Erro ao excluir contato:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
