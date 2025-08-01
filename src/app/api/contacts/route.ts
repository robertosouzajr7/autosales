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
