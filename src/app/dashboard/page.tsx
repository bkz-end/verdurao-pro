'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icons } from '@/components/ui/icons'
import { StatCard } from '@/components/ui/stat-card'
import { ActionCard, ActionCardLarge } from '@/components/ui/action-card'
import { BottomNav } from '@/components/ui/bottom-nav'

interface DashboardStats {
  todaySales: number
  todayTotal: number
  yesterdayTotal: number
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
  const [stats, setStats] = useState<DashboardStats>({ 
    todaySales: 0, 
    todayTotal: 0, 
    yesterdayTotal: 0,
    productsCount: 0, 
    lowStockCount: 0 
  })
  const [loading, setLoading] = useState(true)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      
      // Get user first - fast operation
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user?.email) {
        router.replace('/login')
        return
      }
      
      setUser({ email: user.email })

      // Load store user
      const { data: storeUser } = await supabase
        .from('store_users')
        .select('tenant_id, name')
        .eq('email', user.email.toLowerCase())
        .maybeSingle()

      if (!storeUser) {
        // User doesn't have store_user - check if they have a pending tenant
        const { data: tenant } = await supabase
          .from('tenants')
          .select('subscription_status')
          .eq('owner_email', user.email.toLowerCase())
          .maybeSingle()
        
        if (tenant) {
          if (tenant.subscription_status === 'pending') {
            router.replace('/aguardando-aprovacao')
          } else {
            // Tenant exists but no store_user - something went wrong in approval
            // Redirect to waiting page with message
            router.replace('/aguardando-aprovacao')
          }
        } else {
          // No tenant at all - redirect to register
          router.replace('/register')
        }
        return
      }

      // Check if user has seen the tutorial
      const tutorialKey = `tutorial_seen_${user.email}`
      const hasSeenTutorial = localStorage.getItem(tutorialKey)
      
      if (!hasSeenTutorial) {
        router.replace('/tutorial?first=true')
        return
      }

      setUserName(storeUser.name || '')

      // Load tenant info and stats in parallel for speed
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      const [tenantRes, todaySalesRes, yesterdaySalesRes, productsRes] = await Promise.all([
        supabase
          .from('tenants')
          .select('store_name, trial_ends_at, subscription_status')
          .eq('id', storeUser.tenant_id)
          .single(),
        supabase
          .from('sales')
          .select('total')
          .eq('tenant_id', storeUser.tenant_id)
          .gte('created_at', today.toISOString()),
        supabase
          .from('sales')
          .select('total')
          .eq('tenant_id', storeUser.tenant_id)
          .gte('created_at', yesterday.toISOString())
          .lt('created_at', today.toISOString()),
        supabase
          .from('products')
          .select('id, stock')
          .eq('tenant_id', storeUser.tenant_id)
          .eq('is_active', true)
      ])

      if (tenantRes.data) {
        setStoreName(tenantRes.data.store_name)
        setSubscriptionStatus(tenantRes.data.subscription_status || '')
        
        if (tenantRes.data.trial_ends_at) {
          const trialEnd = new Date(tenantRes.data.trial_ends_at)
          const now = new Date()
          const diffTime = trialEnd.getTime() - now.getTime()
          const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          setTrialDaysLeft(daysLeft > 0 ? daysLeft : 0)
        }
      }

      const todaySales = todaySalesRes.data?.length || 0
      const todayTotal = todaySalesRes.data?.reduce((sum, s) => sum + s.total, 0) || 0
      const yesterdayTotal = yesterdaySalesRes.data?.reduce((sum, s) => sum + s.total, 0) || 0
      const productsCount = productsRes.data?.length || 0
      const lowStockCount = productsRes.data?.filter(p => p.stock <= 5).length || 0

      setStats({ todaySales, todayTotal, yesterdayTotal, productsCount, lowStockCount })
      setLoading(false)
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

  const getTrendPercentage = () => {
    if (stats.yesterdayTotal === 0) return stats.todayTotal > 0 ? 100 : 0
    return Math.round(((stats.todayTotal - stats.yesterdayTotal) / stats.yesterdayTotal) * 100)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Icons.loader className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-lg mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <p className="text-sm text-slate-500">Olá, {userName?.split(' ')[0] || 'Lojista'}</p>
            <h1 className="text-lg font-semibold text-slate-800">{storeName}</h1>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Subscription Badge */}
            {(trialDaysLeft !== null && trialDaysLeft > 0) && (
              <Link 
                href="/assinatura" 
                className={`text-xs font-medium px-2.5 py-1 rounded-full
                  ${trialDaysLeft <= 2 
                    ? 'bg-red-100 text-red-700' 
                    : trialDaysLeft <= 5 
                      ? 'bg-amber-100 text-amber-700' 
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
              >
                {trialDaysLeft}d trial
              </Link>
            )}
            {subscriptionStatus !== 'active' && trialDaysLeft !== null && trialDaysLeft <= 0 && (
              <Link 
                href="/assinatura" 
                className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-700"
              >
                Assinar
              </Link>
            )}
            
            {/* Profile Menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center
                           hover:bg-slate-200 transition-colors"
              >
                <Icons.menu className="w-5 h-5 text-slate-600" />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="font-semibold text-slate-800">{storeName}</p>
                    <p className="text-sm text-slate-500">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <Link href="/assinatura" className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50" onClick={() => setIsMenuOpen(false)}>
                      <Icons.star className="w-5 h-5 text-slate-400" />
                      <span className="text-slate-700">Assinatura</span>
                    </Link>
                    <Link href="/funcionarios" className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50" onClick={() => setIsMenuOpen(false)}>
                      <Icons.team className="w-5 h-5 text-slate-400" />
                      <span className="text-slate-700">Equipe</span>
                    </Link>
                    <Link href="/tutorial" className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50" onClick={() => setIsMenuOpen(false)}>
                      <Icons.help className="w-5 h-5 text-slate-400" />
                      <span className="text-slate-700">Ajuda</span>
                    </Link>
                    <div className="border-t border-slate-100 my-1" />
                    <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 w-full text-left text-red-600">
                      <Icons.logout className="w-5 h-5" />
                      <span>Sair</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Primary CTA */}
        <ActionCardLarge
          href="/pdv"
          icon="pdv"
          title="Iniciar Venda"
          description="Abrir ponto de venda"
        />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title="Vendas Hoje"
            value={formatCurrency(stats.todayTotal)}
            subtitle={`${stats.todaySales} ${stats.todaySales === 1 ? 'venda' : 'vendas'}`}
            trend={stats.yesterdayTotal > 0 || stats.todayTotal > 0 ? {
              value: getTrendPercentage(),
              label: 'vs ontem'
            } : undefined}
            icon="dollar"
            variant="primary"
          />
          <StatCard
            title="Produtos"
            value={stats.productsCount}
            subtitle={stats.lowStockCount > 0 ? `${stats.lowStockCount} estoque baixo` : 'Estoque ok'}
            icon="stock"
            variant={stats.lowStockCount > 0 ? 'warning' : 'default'}
          />
        </div>

        {/* Quick Actions Grid */}
        <div>
          <h2 className="text-sm font-medium text-slate-500 mb-3">Acesso Rápido</h2>
          <div className="grid grid-cols-4 gap-3">
            <ActionCard href="/estoque" icon="stock" title="Estoque" />
            <ActionCard href="/perdas" icon="losses" title="Perdas" />
            <ActionCard href="/pdv/caixa" icon="wallet" title="Caixa" />
            <ActionCard href="/funcionarios" icon="team" title="Equipe" />
          </div>
        </div>

        {/* Low Stock Alert */}
        {stats.lowStockCount > 0 && (
          <Link href="/estoque" className="block">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Icons.losses className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-amber-800">Estoque Baixo</p>
                <p className="text-sm text-amber-600">{stats.lowStockCount} produtos precisam de reposição</p>
              </div>
              <Icons.chevronRight className="w-5 h-5 text-amber-400" />
            </div>
          </Link>
        )}

        {/* Recent Activity Placeholder */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-slate-500">Atividade Recente</h2>
            <Link href="/pdv/historico" className="text-sm text-emerald-600 font-medium">
              Ver tudo
            </Link>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 text-center">
            <Icons.transactions className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">
              {stats.todaySales > 0 
                ? `${stats.todaySales} vendas realizadas hoje`
                : 'Nenhuma venda hoje ainda'
              }
            </p>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
