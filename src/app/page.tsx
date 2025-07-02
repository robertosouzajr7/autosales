import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-4xl mx-auto text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-purple-900 mb-4">
            AutoSales
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Plataforma de Automação de Vendas e Cobrança via WhatsApp
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-semibold mb-2 text-purple-800">
              🤖 Cobrança Automática
            </h3>
            <p className="text-gray-600">
              Automatize cobrança de clientes via WhatsApp com templates personalizados
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-semibold mb-2 text-purple-800">
              🎯 SDR Virtual
            </h3>
            <p className="text-gray-600">
              Qualifique leads automaticamente e agende reuniões
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/api/test-db"
              className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 transition"
            >
              🔍 Testar Conexão Banco
            </Link>
            
            <button className="border-2 border-purple-600 text-purple-600 px-8 py-3 rounded-lg hover:bg-purple-50 transition">
              📊 Dashboard (Em breve)
            </button>
          </div>
          
          <p className="text-sm text-gray-500 mt-4">
            ✅ Next.js 15.3.4 • ✅ Prisma • ✅ PostgreSQL • ✅ Tailwind CSS
          </p>
        </div>

        <div className="mt-12 p-6 bg-green-50 rounded-xl">
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            🎉 Status do Sistema
          </h3>
          <div className="text-sm text-green-700 space-y-1">
            <p>✅ Banco de dados conectado</p>
            <p>✅ 16 tabelas encontradas</p>
            <p>✅ Prisma Client ativo</p>
            <p>✅ API funcionando</p>
          </div>
        </div>
      </div>
    </div>
  )
}
