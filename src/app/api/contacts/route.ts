import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    console.log("🔍 API /api/contacts GET chamada");

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    console.log("✅ Usuário autenticado:", session.user.email);
    console.log(
      "🔑 Session.user.id:",
      session.user.id,
      "Length:",
      session.user.id.length
    );

    // 🚨 VERIFICAÇÃO: Se userId não é UUID válido
    const isValidUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        session.user.id
      );

    if (!isValidUUID) {
      console.log("❌ UserId não é UUID válido:", session.user.id);

      // TENTAR BUSCAR USER PELO EMAIL PARA PEGAR O UUID CORRETO
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

      console.log("✅ UUID correto encontrado:", user.id);

      // Usar o UUID correto do banco
      const correctUserId = user.id;

      const searchParams = request.nextUrl.searchParams;
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "10");
      const search = searchParams.get("search") || "";
      const status = searchParams.get("status") || "";

      console.log("📋 Parâmetros:", { page, limit, search, status });

      // Construir filtros
      const where: any = {
        userId: correctUserId, // ✅ USAR UUID CORRETO
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ];
      }

      if (status && status !== "") {
        where.status = status;
      }

      console.log("🔍 Filtros WHERE:", where);

      // Buscar contatos
      const [contacts, total] = await Promise.all([
        prisma.contact.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.contact.count({ where }),
      ]);

      console.log("📊 Contatos encontrados:", contacts.length, "Total:", total);

      return NextResponse.json({
        contacts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    }

    // Se userId já é UUID válido, continuar normalmente
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

    const where: any = {
      userId: session.user.id, // UUID válido
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status && status !== "") {
      where.status = status;
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.contact.count({ where }),
    ]);

    return NextResponse.json({
      contacts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("❌ Erro ao buscar contatos:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// CRIAR   - Criar UM contato específico
export async function POST(request: NextRequest) {
  try {
    console.log("➕ POST create contact iniciado");

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log("❌ Usuário não autorizado");
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    console.log("✅ Usuário autorizado:", session.user.email);

    // Ler dados da requisição
    const body = await request.json();
    const {
      name,
      phone,
      email,
      company,
      value,
      dueDate,
      notes,
      status,
      description,
      invoiceNumber,
    } = body;

    console.log("📝 Dados recebidos:", { name, phone, email });

    // Validações
    if (!name || !phone) {
      console.log("❌ Campos obrigatórios faltando");
      return NextResponse.json(
        { error: "Nome e telefone são obrigatórios" },
        { status: 400 }
      );
    }

    // ✅ CORREÇÃO: Buscar UUID correto do usuário (mesmo padrão do GET)
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
        console.log("❌ Usuário não encontrado no banco");
        return NextResponse.json(
          { error: "Usuário não encontrado" },
          { status: 404 }
        );
      }

      userId = user.id;
      console.log("✅ UUID real encontrado:", userId);
    }

    // Limpar telefone
    const cleanPhone = phone.replace(/\D/g, "");
    console.log("📞 Telefone limpo:", cleanPhone);

    // Verificar se telefone já existe para este usuário
    const existingContact = await prisma.contact.findFirst({
      where: {
        userId: userId,
        phone: cleanPhone,
      },
    });

    if (existingContact) {
      console.log("❌ Telefone já existe:", cleanPhone);
      return NextResponse.json(
        { error: "Já existe um contato com este telefone" },
        { status: 400 }
      );
    }

    // Preparar dados para criação
    const contactData = {
      name: name.trim(),
      phone: cleanPhone,
      email: email?.trim() || null,
      company: company?.trim() || null,
      value: value ? parseFloat(value.toString()) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      description: description?.trim() || null,
      notes: notes?.trim() || null,
      status: status || "pending",
      invoiceNumber: invoiceNumber?.trim() || null,
      userId: userId,
    };

    console.log("💾 Criando contato com dados:", contactData);

    // Criar contato
    const contact = await prisma.contact.create({
      data: contactData,
    });

    console.log("✅ Contato criado com sucesso:", contact.id);

    return NextResponse.json(
      {
        success: true,
        contact,
        message: "Contato criado com sucesso!",
      },
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("❌ Erro detalhado ao criar contato:", error);

    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}

// PUT - Atualizar contato completo
export async function PUT(request: NextRequest) {
  try {
    console.log("✏️ PUT update contact iniciado");

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log("❌ Usuário não autorizado");
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    console.log("✅ Usuário autorizado:", session.user.email);

    // Ler dados da requisição
    const body = await request.json();
    const {
      id,
      name,
      phone,
      email,
      company,
      value,
      dueDate,
      notes,
      status,
      description,
      invoiceNumber,
    } = body;

    console.log("🔍 Atualizando contato ID:", id);

    if (!id) {
      console.log("❌ ID não fornecido");
      return NextResponse.json(
        { error: "ID do contato é obrigatório" },
        { status: 400 }
      );
    }

    // ✅ CORREÇÃO: Buscar UUID correto do usuário (mesmo padrão do GET)
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
        console.log("❌ Usuário não encontrado no banco");
        return NextResponse.json(
          { error: "Usuário não encontrado" },
          { status: 404 }
        );
      }

      userId = user.id;
      console.log("✅ UUID real encontrado:", userId);
    }

    // Verificar se contato existe e pertence ao usuário
    const existingContact = await prisma.contact.findFirst({
      where: { id, userId: userId },
    });

    if (!existingContact) {
      console.log("❌ Contato não encontrado");
      return NextResponse.json(
        { error: "Contato não encontrado" },
        { status: 404 }
      );
    }

    // Verificar se telefone já existe em outro contato (se telefone foi alterado)
    if (phone && phone !== existingContact.phone) {
      const cleanPhone = phone.replace(/\D/g, "");
      const phoneExists = await prisma.contact.findFirst({
        where: {
          userId: userId,
          phone: cleanPhone,
          id: { not: id },
        },
      });

      if (phoneExists) {
        console.log("❌ Telefone já existe em outro contato");
        return NextResponse.json(
          { error: "Já existe outro contato com este telefone" },
          { status: 400 }
        );
      }
    }

    // Preparar dados para atualização
    const updateData: any = {};

    if (name !== undefined) updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = phone.replace(/\D/g, "");
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (company !== undefined) updateData.company = company?.trim() || null;
    if (value !== undefined)
      updateData.value = value ? parseFloat(value.toString()) : null;
    if (dueDate !== undefined)
      updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (description !== undefined)
      updateData.description = description?.trim() || null;
    if (notes !== undefined) updateData.notes = notes?.trim() || null;
    if (status !== undefined) updateData.status = status;
    if (invoiceNumber !== undefined)
      updateData.invoiceNumber = invoiceNumber?.trim() || null;

    updateData.updatedAt = new Date();

    console.log("💾 Atualizando com dados:", updateData);

    // Atualizar contato
    const contact = await prisma.contact.update({
      where: { id },
      data: updateData,
    });

    console.log("✅ Contato atualizado com sucesso:", contact.id);

    return NextResponse.json(
      {
        success: true,
        contact,
        message: "Contato atualizado com sucesso!",
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("❌ Erro detalhado ao atualizar contato:", error);

    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}

// PATCH - Atualização parcial (ex: só status)
export async function PATCH(request: NextRequest) {
  try {
    console.log("🔧 PATCH update contact iniciado");

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

    // ✅ CORREÇÃO: Buscar UUID correto do usuário
    let userId = session.user.id;

    const isValidUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        userId
      );

    if (!isValidUUID) {
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
    }

    // Verificar se contato existe e pertence ao usuário
    const existingContact = await prisma.contact.findFirst({
      where: { id, userId: userId },
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
// DELETE - Excluir UM contato específico
export async function DELETE(request: NextRequest) {
  try {
    console.log("🗑️ DELETE single contact iniciado");

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log("❌ Usuário não autorizado");
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    console.log("✅ Usuário autorizado:", session.user.email);

    // Ler body da requisição
    const body = await request.json();
    const { id } = body;

    console.log("🔍 ID recebido para deleção:", id);

    if (!id) {
      console.log("❌ ID não fornecido");
      return NextResponse.json(
        { error: "ID do contato é obrigatório" },
        { status: 400 }
      );
    }

    // ✅ CORREÇÃO: Buscar UUID correto do usuário
    let userId = session.user.id;

    // Se session.user.id não é UUID válido, buscar o UUID real
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
        console.log("❌ Usuário não encontrado no banco");
        return NextResponse.json(
          { error: "Usuário não encontrado" },
          { status: 404 }
        );
      }

      userId = user.id;
      console.log("✅ UUID real encontrado:", userId);
    }

    // Verificar se contato existe e pertence ao usuário
    console.log("🔍 Verificando se contato existe...");
    const existingContact = await prisma.contact.findFirst({
      where: {
        id: id,
        userId: userId,
      },
    });

    console.log("📋 Contato encontrado:", existingContact ? "SIM" : "NÃO");

    if (!existingContact) {
      console.log("❌ Contato não encontrado ou não pertence ao usuário");
      return NextResponse.json(
        { error: "Contato não encontrado" },
        { status: 404 }
      );
    }

    // Excluir contato
    console.log("🗑️ Deletando contato do banco...");
    await prisma.contact.delete({
      where: { id: id },
    });

    console.log("✅ Contato excluído com sucesso:", id);

    return NextResponse.json(
      {
        success: true,
        message: "Contato excluído com sucesso!",
        deletedId: id,
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("❌ Erro detalhado ao excluir contato:", error);

    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
