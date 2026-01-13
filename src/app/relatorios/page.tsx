'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ReportService, SalesReport, MostSoldProduct, ProductProfitMargin, ReportPeriod, ProductSalesData } from '@/lib/reports'
import { Product } from '@/types'

/**
 * Dashboard de Relatórios da Loja
 * Requirements: 11.1, 11.2, 11.3
 * 
 * - Cards com métricas principais (vendas, receita, ticket médio)
 * - Filtro por período (dia, semana, mês)
 * - Lista de produtos em falta
 */

interface DashboardData {
  today: SalesReport
  week: SalesReport
  month: SalesReport
  mostSoldToday: MostSoldProduct | null
  mostSoldWeek: MostSoldProduct | null
  mostSoldMonth: MostSoldProduct | null
  topProducts: ProductSalesData[]
  outOfStock: Product[]
  profitMargins: ProductProfitMargin[]
}

export default function RelatoriosPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('day')
  const [tenantId, setTenantId] = useState<string | null>(null)

  const supabase = createClient()
  const reportService = new ReportService(supabase)

  useEffect(() => {
    loadTenantAndData()
  }, [])

  async function loadTenantAndData() {
    try {
      setLoading(true)
      setError(null)

      // Get current user and their tenant
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Usuário não autenticado')
        return
      }

      // Get tenant from store_users
      const { data: storeUser } = await supabase
        .from('store_users')
        .select('tenant_id')
        .eq('email', user.email)
        .single()

      if (!storeUser) {
        setError('Usuário não vinculado a uma loja')
        return
      }

      setTenantId(storeUser.tenant_id)
      await loadDashboardData(storeUser.tenant_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = useCallback(async () => {
    if (!tenantId || refreshing) return
    setRefreshing(true)
    try {
      await loadDashboardData(tenantId)
    } finally {
      setRefreshing(false)
    }
  }, [tenantId, refreshing])


  async function loadDashboardData(tid: string) {
    try {
      const [dashboardReport, mostSoldWeek, mostSoldMonth, topProducts, profitMargins] = await Promise.all([
        reportService.getDashboardReport(tid),
        reportService.getMostSoldProduct(tid, 'week'),
        reportService.getMostSoldProduct(tid, 'month'),
        reportService.getTopSellingProducts(tid, selectedPeriod, 5),
        reportService.getProductProfitMargins(tid)
      ])

      setData({
        ...dashboardReport,
        mostSoldWeek,
        mostSoldMonth,
        topProducts,
        profitMargins
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar relatórios')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Carregando relatórios...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    )
  }

  const currentReport = selectedPeriod === 'day' 
    ? data?.today 
    : selectedPeriod === 'week' 
      ? data?.week 
      : data?.month

  const currentMostSold = selectedPeriod === 'day'
    ? data?.mostSoldToday
    : selectedPeriod === 'week'
      ? data?.mostSoldWeek
      : data?.mostSoldMonth

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-green-600">Relatórios da Loja</h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 text-sm font-medium text-green-600 hover:text-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            <svg 
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Period Filter - Requirements: 11.3 */}
        <div className="mb-6">
          <PeriodSelector 
            selected={selectedPeriod} 
            onChange={setSelectedPeriod} 
          />
        </div>

        {/* Sales Metrics Cards - Requirements: 11.1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <MetricCard
            title="Total de Vendas"
            value={currentReport?.totalSales || 0}
            subtitle={`${getPeriodLabel(selectedPeriod)}`}
            color="blue"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            }
          />
          <MetricCard
            title="Receita Total"
            value={formatCurrency(currentReport?.totalRevenue || 0)}
            subtitle={`${getPeriodLabel(selectedPeriod)}`}
            color="green"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <MetricCard
            title="Ticket Médio"
            value={formatCurrency(currentReport?.averageTicket || 0)}
            subtitle={`${getPeriodLabel(selectedPeriod)}`}
            color="purple"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            }
          />
        </div>


        {/* Most Sold Product - Requirements: 11.2 */}
        {currentMostSold && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Produto Mais Vendido - {getPeriodLabel(selectedPeriod)}
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold text-gray-900">
                  {currentMostSold.product.name}
                </p>
                <p className="text-sm text-gray-600">
                  SKU: {currentMostSold.product.sku}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">
                  {currentMostSold.totalQuantity} {currentMostSold.product.unit}
                </p>
                <p className="text-sm text-gray-600">
                  {formatCurrency(currentMostSold.totalRevenue)} em vendas
                </p>
              </div>
            </div>
          </div>
        )}

        {!currentMostSold && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Produto Mais Vendido - {getPeriodLabel(selectedPeriod)}
            </h2>
            <p className="text-gray-500 text-center py-4">
              Nenhuma venda registrada neste período
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Out of Stock Products - Requirements: 11.2 (produtos em falta) */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h2 className="text-lg font-semibold text-gray-900">
                Produtos em Falta ({data?.outOfStock.length || 0})
              </h2>
            </div>
            {data?.outOfStock.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Todos os produtos estão em estoque
              </div>
            ) : (
              <div className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
                {data?.outOfStock.map(product => (
                  <div key={product.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                      </div>
                      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                        Sem estoque
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>


          {/* Profit Margins - Requirements: 11.4 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <h2 className="text-lg font-semibold text-gray-900">
                Margem de Lucro por Produto
              </h2>
            </div>
            {data?.profitMargins.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Nenhum produto com preço de custo cadastrado
              </div>
            ) : (
              <div className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
                {data?.profitMargins.map(margin => (
                  <div key={margin.productId} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-900">{margin.productName}</p>
                        <p className="text-sm text-gray-500">
                          Custo: {formatCurrency(margin.costPrice)} → Venda: {formatCurrency(margin.price)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          margin.profitMargin >= 30 
                            ? 'bg-green-100 text-green-700' 
                            : margin.profitMargin >= 15 
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                        }`}>
                          {margin.profitMargin.toFixed(1)}%
                        </span>
                        <p className="text-sm text-gray-500 mt-1">
                          Lucro: {formatCurrency(margin.absoluteProfit)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top Selling Products - Requirements: 11.2 */}
        {data?.topProducts && data.topProducts.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              <h2 className="text-lg font-semibold text-gray-900">
                Top 5 Produtos Mais Vendidos - {getPeriodLabel(selectedPeriod)}
              </h2>
            </div>
            <div className="divide-y divide-gray-200">
              {data.topProducts.map((product, index) => (
                <div key={product.productId} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-gray-100 text-gray-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-50 text-gray-500'
                    }`}>
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{product.productName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{product.totalQuantity.toFixed(2)}</p>
                      <p className="text-sm text-gray-500">{formatCurrency(product.totalRevenue)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}


function PeriodSelector({ 
  selected, 
  onChange 
}: { 
  selected: ReportPeriod
  onChange: (period: ReportPeriod) => void 
}) {
  const periods: { value: ReportPeriod; label: string }[] = [
    { value: 'day', label: 'Hoje' },
    { value: 'week', label: 'Esta Semana' },
    { value: 'month', label: 'Este Mês' }
  ]

  return (
    <div className="flex gap-2">
      {periods.map(period => (
        <button
          key={period.value}
          onClick={() => onChange(period.value)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selected === period.value
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  )
}

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  color,
  icon
}: { 
  title: string
  value: string | number
  subtitle: string
  color: 'blue' | 'green' | 'purple' | 'red' | 'yellow'
  icon?: React.ReactNode
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200'
  }

  return (
    <div className={`p-6 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium opacity-75">{title}</p>
        {icon && <span className="opacity-50">{icon}</span>}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-60 mt-1">{subtitle}</p>
    </div>
  )
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

function getPeriodLabel(period: ReportPeriod): string {
  switch (period) {
    case 'day': return 'Hoje'
    case 'week': return 'Esta Semana'
    case 'month': return 'Este Mês'
    default: return ''
  }
}
