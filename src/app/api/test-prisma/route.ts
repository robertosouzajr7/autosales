import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    // Testar conexão básica
    await prisma.$connect();

    // Testar query simples
    const userCount = await prisma.user.count();

    return NextResponse.json({
      status: "success",
      message: "Prisma conectado com sucesso",
      userCount,
    });
  } catch (error) {
    console.error("❌ Erro Prisma:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Erro na conexão Prisma",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
