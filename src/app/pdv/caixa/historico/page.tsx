'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { CashRegisterSession } from '@/types'
import { Icons } from '@/components/ui/icons'

interface SessionWithDetails extends CashRegisterSession {
  store_user?: { name: string }
  sales_count?: number
  sales_total?: number
}

export default function HistoricoCaixaPage() {
  const [sessions, setSessions] = useState<SessionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<SessionWithDetails | null>(null)
  const [dateFilter, setDateFilter] = useState<'week' | 'month' | 'all'>('week')

  useEffect(() => {
    loadSessions()
  }, [dateFilter])

  async function loadSessions() {
    setLoading(true)
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return

    const { data: storeUser } = await supabase
      .from('store_users')
      .select('tenant_id')
      .eq('email', user.email.toLowerCase())
      .maybeSingle()

    if (!storeUser) return

    let startDate = new Date()
    if (dateFilter === 'week') startDate.setDate(startDate.getDate() - 7)
    else if (dateFilter === 'month') startDate.setDate(startDate.getDate() - 30)
    else startDate.setFullYear(startDate.getFullYear() - 1)

    // Get sessions
    const { data: sessionsData } = await supabase
      .from('cash_register_sessions')
      .select(`
        *,
        store_user:store_users(name)
      `)
      .eq('tenant_id', storeUser.tenant_id)
      .gte('opened_at', startDate.toISOString())
      .order('opened_at', { ascending: false })

    if (sessionsData) {
      // Get sales count and total for each session
      const sessionsWithDetails = await Promise.all(
        sessionsData.map(async (session) => {
          const { data: sales } = await supabase
            .from('sales')
            .select('total')
            .eq('session_id', session.id)

          return {
            ...session,
            sales_count: sales?.length || 0,
            sales_total: sales?.reduce((sum, s) => sum + s.total, 0) || 0
          }
        })
      )
      setSessions(sessionsWithDetails as SessionWithDetails[])
    }
    setLoading(false)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    })
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return 'Em andamento'
    const diff = new Date(end).getTime() - new Date(start).getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}min`
  }

  // Stats
  const stats = {
    totalSessions: sessions.length,
    totalSales: sessions.reduce((sum, s) => sum + (s.sales_total || 0), 0),
    avgDifference: sessions.filter(s => s.difference !== null).length > 0
      ? sessions.filter(s => s.difference !== null).reduce((sum, s) => sum + Math.abs(s.difference || 0), 0) / sessions.filter(s => s.difference !== null).length
      : 0,
    closedSessions: sessions.filter(s => s.status === 'closed').length
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/pdv/caixa" className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
              <Icons.chevronLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-slate-800">Histórico de Caixa</h1>
              <p className="text-xs text-slate-500">{stats.totalSessions} sessões · {formatCurrency(stats.totalSales)}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Date Filter */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 sticky top-[60px] z-10">
        <div className="max-w-lg mx-auto flex gap-2">
          {[
            { key: 'week' as const, label: '7 dias' },
            { key: 'month' as const, label: '30 dias' },
            { key: 'all' as const, label: 'Todos' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDateFilter(key)}
              className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-all text-sm
                ${dateFilter === key
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-4 text-white">
            <p className="text-emerald-100 text-xs">Total em Vendas</p>
            <p className="text-2xl font-bold">{formatCurrency(stats.totalSales)}</p>
            <p className="text-emerald-100 text-xs mt-1">{stats.closedSessions} caixas fechados</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <p className="text-slate-500 text-xs">Diferença Média</p>
            <p className={`text-2xl font-bold ${stats.avgDifference > 5 ? 'text-amber-600' : 'text-slate-800'}`}>
              {formatCurrency(stats.avgDifference)}
            </p>
            <p className="text-slate-400 text-xs mt-1">por fechamento</p>
          </div>
        </div>
      </div>

      {/* Sessions List */}
      <main className="max-w-lg mx-auto px-4 pb-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <Icons.loader className="w-8 h-8 text-emerald-600 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icons.wallet className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 font-medium">Nenhuma sessão encontrada</p>
            <p className="text-slate-400 text-sm mt-1">Abra o caixa para começar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const isOpen = session.status === 'open'
              const hasDifference = session.difference !== null && session.difference !== 0
              
              return (
                <button
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className="w-full bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl
                      ${isOpen ? 'bg-green-100' : 'bg-slate-100'}`}>
                      {isOpen ? '🔓' : '🔒'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-slate-800">{formatDate(session.opened_at)}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                          ${isOpen ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                          {isOpen ? 'Aberto' : 'Fechado'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                        <span>{formatTime(session.opened_at)}</span>
                        {session.closed_at && (
                          <>
                            <span>→</span>
                            <span>{formatTime(session.closed_at)}</span>
                            <span className="text-slate-300">·</span>
                            <span>{formatDuration(session.opened_at, session.closed_at)}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-slate-500">
                          {session.sales_count} vendas · {formatCurrency(session.sales_total || 0)}
                        </span>
                        {hasDifference && (
                          <span className={`text-sm font-medium ${
                            (session.difference || 0) > 0 ? 'text-blue-600' : 'text-red-600'
                          }`}>
                            {(session.difference || 0) > 0 ? '+' : ''}{formatCurrency(session.difference || 0)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Icons.chevronRight className="w-5 h-5 text-slate-300" />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>

      {/* Session Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={() => setSelectedSession(null)}>
          <div 
            className="w-full max-w-lg bg-white rounded-t-3xl max-h-[90vh] overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Detalhes do Caixa</h2>
                <p className="text-sm text-slate-500">{formatDate(selectedSession.opened_at)}</p>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <Icons.close className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="p-6 space-y-6">
                {/* Status */}
                <div className={`rounded-2xl p-5 text-center ${
                  selectedSession.status === 'open' 
                    ? 'bg-gradient-to-br from-green-500 to-green-600 text-white'
                    : 'bg-gradient-to-br from-slate-700 to-slate-800 text-white'
                }`}>
                  <span className="text-4xl mb-2 block">{selectedSession.status === 'open' ? '🔓' : '🔒'}</span>
                  <p className="text-lg font-bold">{selectedSession.status === 'open' ? 'Caixa Aberto' : 'Caixa Fechado'}</p>
                </div>

                {/* Times */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-sm">Abertura</span>
                    <span className="font-medium text-slate-800">
                      {formatDate(selectedSession.opened_at)} às {formatTime(selectedSession.opened_at)}
                    </span>
                  </div>
                  {selectedSession.closed_at && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-sm">Fechamento</span>
                        <span className="font-medium text-slate-800">
                          {formatDate(selectedSession.closed_at)} às {formatTime(selectedSession.closed_at)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-sm">Duração</span>
                        <span className="font-medium text-slate-800">
                          {formatDuration(selectedSession.opened_at, selectedSession.closed_at)}
                        </span>
                      </div>
                    </>
                  )}
                  {selectedSession.store_user && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-sm">Operador</span>
                      <span className="font-medium text-slate-800">{selectedSession.store_user.name}</span>
                    </div>
                  )}
                </div>

                {/* Values */}
                <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                  <div className="p-4 flex justify-between items-center">
                    <span className="text-slate-600">Valor Inicial</span>
                    <span className="font-bold text-slate-800">{formatCurrency(selectedSession.opening_amount)}</span>
                  </div>
                  <div className="p-4 flex justify-between items-center">
                    <span className="text-slate-600">Vendas</span>
                    <span className="font-bold text-emerald-600">+{formatCurrency(selectedSession.sales_total || 0)}</span>
                  </div>
                  {selectedSession.expected_amount !== null && (
                    <div className="p-4 flex justify-between items-center">
                      <span className="text-slate-600">Valor Esperado</span>
                      <span className="font-bold text-slate-800">{formatCurrency(selectedSession.expected_amount)}</span>
                    </div>
                  )}
                  {selectedSession.actual_amount !== null && (
                    <div className="p-4 flex justify-between items-center">
                      <span className="text-slate-600">Valor Contado</span>
                      <span className="font-bold text-slate-800">{formatCurrency(selectedSession.actual_amount)}</span>
                    </div>
                  )}
                  {selectedSession.difference !== null && (
                    <div className={`p-4 flex justify-between items-center ${
                      selectedSession.difference === 0 ? 'bg-green-50' :
                      selectedSession.difference > 0 ? 'bg-blue-50' : 'bg-red-50'
                    }`}>
                      <span className="text-slate-600 font-medium">Diferença</span>
                      <span className={`font-bold text-lg ${
                        selectedSession.difference === 0 ? 'text-green-600' :
                        selectedSession.difference > 0 ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {selectedSession.difference > 0 ? '+' : ''}{formatCurrency(selectedSession.difference)}
                        {selectedSession.difference === 0 && ' ✓'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {selectedSession.notes && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm font-medium text-amber-800 mb-1">Observações</p>
                    <p className="text-amber-700">{selectedSession.notes}</p>
                  </div>
                )}

                {/* Sales Summary */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-sm font-medium text-slate-500 mb-2">Resumo</p>
                  <p className="text-slate-700">
                    {selectedSession.sales_count} vendas realizadas totalizando {formatCurrency(selectedSession.sales_total || 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
      `}</style>
    </div>
  )
}
