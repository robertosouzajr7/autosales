// app/api/test-db/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    console.log('🔍 Testando conexão com banco...')

    // Testar conexão básica
    await prisma.$connect()
    console.log('✅ Conexão estabelecida!')

    // Buscar planos disponíveis
    const plans = await prisma.plan.findMany()
    console.log('📋 Planos encontrados:', plans.length)

    // Contar usuários
    const userCount = await prisma.user.count()
    console.log('👥 Total de usuários:', userCount)

    // Buscar templates padrão (se existirem)
    const templates = await prisma.$queryRaw`
      SELECT * FROM template_defaults LIMIT 3
    `
    console.log('📝 Templates padrão:', Array.isArray(templates) ? templates.length : 0)

    return NextResponse.json({
      success: true,
      message: 'Conexão com banco funcionando!',
      data: {
        plans: plans,
        userCount: userCount,
        templatesCount: Array.isArray(templates) ? templates.length : 0,
        database: 'PostgreSQL',
        prisma: 'Conectado',
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Erro na conexão:', error)
    
    return NextResponse.json({
      success: false,
      message: 'Erro na conexão com banco',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Endpoint para criar usuário de teste
export async function POST() {
  try {
    console.log('🧪 Criando usuário de teste...')

    const testUser = await prisma.user.create({
      data: {
        email: 'teste@autosales.com',
        name: 'Usuario Teste',
        companyName: 'Empresa Teste',
        planId: 'trial'
      },
      include: {
        plan: true
      }
    })

    console.log('✅ Usuário criado:', testUser.id)

    return NextResponse.json({
      success: true,
      message: 'Usuário de teste criado!',
      user: testUser
    })

  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error)
    
    return NextResponse.json({
      success: false,
      message: 'Erro ao criar usuário de teste',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}
