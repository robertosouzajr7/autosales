import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, companyName, phone } = await request.json();

    // Validações
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nome, email e senha são obrigatórios" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Senha deve ter pelo menos 6 caracteres" },
        { status: 400 }
      );
    }

    // Verificar se usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Já existe uma conta com este email" },
        { status: 400 }
      );
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 12);

    // Buscar plano trial
    const trialPlan = await prisma.plan.findFirst({
      where: { name: "Trial" },
    });

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        companyName: companyName?.trim() || null,
        phone: phone?.trim() || null,
        planId: trialPlan?.id || "trial",
      },
      include: {
        plan: true,
      },
    });

    console.log(`✅ Novo usuário criado: ${user.email}`);

    // Remover senha do retorno
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json(
      {
        message: "Conta criada com sucesso!",
        user: userWithoutPassword,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("❌ Erro no registro:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor. Tente novamente." },
      { status: 500 }
    );
  }
}
