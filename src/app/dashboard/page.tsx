'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface DashboardStats {
  todaySales: number
  todayTotal: number
  productsCount: number
  lowStockCount: number
}

export default function DashboardPage() {
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [storeName, setStoreName] = useState('')
  const [userName, setUserName] = useState('')
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState('')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [stats, setStats] = useState<DashboardStats>({ todaySales: 0, todayTotal: 0, productsCount: 0, lowStockCount: 0 })
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

      // Load stats
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const [salesRes, productsRes] = await Promise.all([
        supabase
          .from('sales')
          .select('total')
          .eq('tenant_id', storeUser.tenant_id)
          .gte('created_at', today.toISOString()),
        supabase
          .from('products')
          .select('id, stock')
          .eq('tenant_id', storeUser.tenant_id)
          .eq('is_active', true)
      ])

      const todaySales = salesRes.data?.length || 0
      const todayTotal = salesRes.data?.reduce((sum, s) => sum + s.total, 0) || 0
      const productsCount = productsRes.data?.length || 0
      const lowStockCount = productsRes.data?.filter(p => p.stock <= 5).length || 0

      setStats({ todaySales, todayTotal, productsCount, lowStockCount })
    }
    loadData()
  }, [router])

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

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
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const menuItems = [
    { href: '/pdv', icon: '💰', label: 'PDV', desc: 'Vender' },
    { href: '/estoque', icon: '📦', label: 'Estoque', desc: 'Produtos' },
    { href: '/perdas', icon: '📉', label: 'Perdas', desc: 'Registrar' },
    { href: '/relatorios', icon: '📊', label: 'Relatórios', desc: 'Análises' },
    { href: '/funcionarios', icon: '👥', label: 'Equipe', desc: 'Gerenciar' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-green-600">FeiraPro</h1>
            {getSubscriptionBadge()}
          </div>
          
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50 animate-slide-up">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="font-semibold text-gray-800">{storeName || 'Minha Loja'}</p>
                  <p className="text-sm text-gray-500">{userName || user.email}</p>
                </div>
                <div className="py-1">
                  <Link href="/assinatura" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50" onClick={() => setIsMenuOpen(false)}>
                    <span className="text-xl">⭐</span>
                    <span className="text-gray-700 font-medium">Assinatura</span>
                  </Link>
                  <Link href="/tutorial" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50" onClick={() => setIsMenuOpen(false)}>
                    <span className="text-xl">📚</span>
                    <span className="text-gray-700">Tutorial</span>
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

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Welcome */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Olá, {userName?.split(' ')[0] || 'Lojista'}! 👋
          </h2>
          <p className="text-gray-500">{storeName}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-4 text-white">
            <p className="text-green-100 text-sm">Vendas Hoje</p>
            <p className="text-2xl font-bold">{formatCurrency(stats.todayTotal)}</p>
            <p className="text-green-100 text-sm">{stats.todaySales} vendas</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-gray-500 text-sm">Produtos</p>
            <p className="text-2xl font-bold text-gray-800">{stats.productsCount}</p>
            {stats.lowStockCount > 0 && (
              <p className="text-orange-500 text-sm">⚠️ {stats.lowStockCount} baixo estoque</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="font-semibold text-gray-800 mb-3">Acesso Rápido</h3>
          <div className="grid grid-cols-3 gap-3">
            {menuItems.slice(0, 3).map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm
                           hover:shadow-md hover:border-green-200 transition-all text-center"
              >
                <span className="text-3xl block mb-2">{item.icon}</span>
                <p className="font-semibold text-gray-800">{item.label}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* All Menu Items */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {menuItems.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-4 px-4 py-4 hover:bg-gray-50 transition-colors
                ${index !== menuItems.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <span className="text-2xl">{item.icon}</span>
              <div className="flex-1">
                <p className="font-medium text-gray-800">{item.label}</p>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/pdv"
          className="block w-full py-4 bg-green-500 text-white font-bold text-lg rounded-2xl
                     text-center hover:bg-green-600 active:scale-[0.98] transition-all shadow-lg"
        >
          💰 Abrir PDV
        </Link>

        {/* Help Card */}
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div className="flex-1">
              <p className="font-medium text-green-800">Dica do dia</p>
              <p className="text-sm text-green-700 mt-1">
                Cadastre seus produtos no Estoque antes de usar o PDV. Assim você terá controle total das vendas!
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
