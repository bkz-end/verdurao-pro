'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [storeName, setStoreName] = useState('')
  const [userName, setUserName] = useState('')
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState('')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user?.email) {
        router.push('/login')
        return
      }
      
      setUser({ email: user.email })

      const { data: storeUser } = await supabase
        .from('store_users')
        .select('tenant_id, name')
        .eq('email', user.email.toLowerCase())
        .single()

      if (!storeUser) return

      setUserName(storeUser.name || '')

      const { data: tenant } = await supabase
        .from('tenants')
        .select('store_name, trial_ends_at, subscription_status')
        .eq('id', storeUser.tenant_id)
        .single()

      if (tenant) {
        setStoreName(tenant.store_name)
        setSubscriptionStatus(tenant.subscription_status || '')
        
        if (tenant.trial_ends_at) {
          const trialEnd = new Date(tenant.trial_ends_at)
          const now = new Date()
          const diffTime = trialEnd.getTime() - now.getTime()
          const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          setTrialDaysLeft(daysLeft > 0 ? daysLeft : 0)
        }
      }
    }
    loadData()
  }, [router])

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Subscription badge
  const getSubscriptionBadge = () => {
    if (subscriptionStatus === 'active' && (trialDaysLeft === null || trialDaysLeft <= 0)) {
      return null
    }
    
    if (trialDaysLeft !== null && trialDaysLeft > 0) {
      const bgColor = trialDaysLeft <= 2 ? 'bg-red-500' : trialDaysLeft <= 5 ? 'bg-orange-500' : 'bg-blue-500'
      return (
        <Link href="/assinatura" className={`${bgColor} text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse`}>
          {trialDaysLeft}d
        </Link>
      )
    }
    
    return (
      <Link href="/assinatura" className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
        Assinar
      </Link>
    )
  }

  if (!user) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Carregando...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-green-600">FeiraPro</h1>
            {getSubscriptionBadge()}
          </div>
          
          {/* Profile Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="text-sm text-gray-600 hidden sm:inline">{userName || user.email}</span>
              <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="font-semibold text-gray-800">{storeName || 'Minha Loja'}</p>
                  <p className="text-sm text-gray-500">{userName || user.email}</p>
                </div>

                <div className="py-1">
                  <Link href="/pdv" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50" onClick={() => setIsMenuOpen(false)}>
                    <span className="text-xl">💰</span>
                    <span className="text-gray-700">PDV</span>
                  </Link>
                  <Link href="/estoque" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50" onClick={() => setIsMenuOpen(false)}>
                    <span className="text-xl">📦</span>
                    <span className="text-gray-700">Estoque</span>
                  </Link>
                  <Link href="/perdas" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50" onClick={() => setIsMenuOpen(false)}>
                    <span className="text-xl">📉</span>
                    <span className="text-gray-700">Perdas</span>
                  </Link>
                  <Link href="/relatorios" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50" onClick={() => setIsMenuOpen(false)}>
                    <span className="text-xl">📊</span>
                    <span className="text-gray-700">Relatórios</span>
                  </Link>
                  <Link href="/funcionarios" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50" onClick={() => setIsMenuOpen(false)}>
                    <span className="text-xl">👥</span>
                    <span className="text-gray-700">Funcionários</span>
                  </Link>
                  <div className="border-t border-gray-100 my-1" />
                  <Link href="/assinatura" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50" onClick={() => setIsMenuOpen(false)}>
                    <span className="text-xl">⭐</span>
                    <span className="text-gray-700 font-medium">Assinatura</span>
                  </Link>
                  <div className="border-t border-gray-100 my-1" />
                  <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 w-full text-left text-red-600">
                    <span className="text-xl">🚪</span>
                    <span>Sair</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Dashboard</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Link href="/estoque" className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow border-2 border-green-200">
            <h3 className="font-semibold text-gray-900">📦 Estoque</h3>
            <p className="text-sm text-gray-600 mt-1">Cadastrar produtos</p>
          </Link>
          <Link href="/pdv" className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-gray-900">💰 PDV</h3>
            <p className="text-sm text-gray-600 mt-1">Registrar vendas</p>
          </Link>
          <Link href="/relatorios" className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-gray-900">📊 Relatórios</h3>
            <p className="text-sm text-gray-600 mt-1">Ver métricas e análises</p>
          </Link>
          <Link href="/perdas" className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-gray-900">🗑️ Perdas</h3>
            <p className="text-sm text-gray-600 mt-1">Registrar perdas</p>
          </Link>
          <Link href="/funcionarios" className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-gray-900">👥 Funcionários</h3>
            <p className="text-sm text-gray-600 mt-1">Gerenciar equipe</p>
          </Link>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg shadow p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-green-800 font-medium">🎉 Bem-vindo ao FeiraPro!</p>
              <p className="text-green-700 text-sm mt-1">
                Comece cadastrando seus produtos no <strong>Estoque</strong>, depois use o <strong>PDV</strong> para vender.
              </p>
            </div>
            <Link href="/tutorial" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium whitespace-nowrap">
              📚 Ver Tutorial
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
