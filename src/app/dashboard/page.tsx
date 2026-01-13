import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from '@/lib/auth/actions'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-green-600">VerdurãoPro</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            <form action={logout}>
              <button
                type="submit"
                className="text-sm text-red-600 hover:text-red-500"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Dashboard</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Link 
            href="/estoque"
            className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow border-2 border-green-200"
          >
            <h3 className="font-semibold text-gray-900">📦 Estoque</h3>
            <p className="text-sm text-gray-600 mt-1">Cadastrar produtos</p>
          </Link>
          <Link 
            href="/pdv"
            className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <h3 className="font-semibold text-gray-900">💰 PDV</h3>
            <p className="text-sm text-gray-600 mt-1">Registrar vendas</p>
          </Link>
          <Link 
            href="/relatorios"
            className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <h3 className="font-semibold text-gray-900">📊 Relatórios</h3>
            <p className="text-sm text-gray-600 mt-1">Ver métricas e análises</p>
          </Link>
          <Link 
            href="/perdas"
            className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <h3 className="font-semibold text-gray-900">🗑️ Perdas</h3>
            <p className="text-sm text-gray-600 mt-1">Registrar perdas</p>
          </Link>
          <Link 
            href="/funcionarios"
            className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <h3 className="font-semibold text-gray-900">👥 Funcionários</h3>
            <p className="text-sm text-gray-600 mt-1">Gerenciar equipe</p>
          </Link>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg shadow p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-green-800 font-medium">
                🎉 Bem-vindo ao VerdurãoPro!
              </p>
              <p className="text-green-700 text-sm mt-1">
                Comece cadastrando seus produtos no <strong>Estoque</strong>, depois use o <strong>PDV</strong> para vender.
              </p>
            </div>
            <Link 
              href="/tutorial"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium whitespace-nowrap"
            >
              📚 Ver Tutorial
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
