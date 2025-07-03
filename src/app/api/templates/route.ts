import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/app/lib/prisma";

// GET - Listar templates do usuário (ajustado para seu schema)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Buscar templates usando os campos do seu schema
    const templates = await prisma.template.findMany({
      where: {
        userId: session.user.id,
        category: "cobranca", // Filtrar apenas templates de cobrança
        isActive: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        content: true,
        variables: true,
        category: true,
        segment: true,
        isActive: true,
        usageCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      templates,
    });
  } catch (error) {
    console.error("Erro ao buscar templates:", error);
    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// POST - Criar novo template (ajustado para seu schema)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { name, content, segment = "geral" } = body;

    // Validações
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        {
          error: "Nome do template é obrigatório",
        },
        { status: 400 }
      );
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        {
          error: "Conteúdo do template é obrigatório",
        },
        { status: 400 }
      );
    }

    // Extrair variáveis automaticamente do conteúdo
    const variableMatches = content.match(/\{([^}]+)\}/g) || [];
    const variables: string[] = variableMatches.map((match: string) =>
      match.slice(1, -1)
    );

    // Verificar se já existe template com mesmo nome
    const existingTemplate = await prisma.template.findFirst({
      where: {
        userId: session.user.id,
        name: name.trim(),
        category: "cobranca",
      },
    });

    if (existingTemplate) {
      return NextResponse.json(
        {
          error: "Já existe um template com este nome",
        },
        { status: 400 }
      );
    }

    // Criar template usando seu schema
    const template = await prisma.template.create({
      data: {
        name: name.trim(),
        content: content.trim(),
        variables: variables, // JSON array com variáveis encontradas
        category: "cobranca",
        segment: segment,
        isActive: true,
        usageCount: 0,
        userId: session.user.id,
      },
    });

    return NextResponse.json(
      {
        success: true,
        template,
        message: "Template criado com sucesso!",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao criar template:", error);
    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// PUT - Atualizar template (ajustado para seu schema)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, content, isActive, segment } = body;

    // Validações
    if (!id) {
      return NextResponse.json(
        {
          error: "ID do template é obrigatório",
        },
        { status: 400 }
      );
    }

    // Verificar se template existe e pertence ao usuário
    const existingTemplate = await prisma.template.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        {
          error: "Template não encontrado",
        },
        { status: 404 }
      );
    }

    // Extrair variáveis do conteúdo
    const variableMatches = content.match(/\{([^}]+)\}/g) || [];
    const variables: string[] = variableMatches.map((match: string) =>
      match.slice(1, -1)
    );

    // Atualizar template
    const template = await prisma.template.update({
      where: {
        id,
      },
      data: {
        name: name.trim(),
        content: content.trim(),
        variables: variables,
        isActive: Boolean(isActive),
        segment: segment || "geral",
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      template,
      message: "Template atualizado com sucesso!",
    });
  } catch (error) {
    console.error("Erro ao atualizar template:", error);
    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
