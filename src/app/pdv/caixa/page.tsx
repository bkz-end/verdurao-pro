'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { CashRegisterSession, CashMovement } from '@/types'

interface CashSummary {
  session: CashRegisterSession
  totalSales: number
  salesByMethod: {
    dinheiro: number
    pix: number
    cartao: number
    fiado: number
  }
  withdrawals: number
  deposits: number
  expectedCash: number
}

export default function CaixaPage() {
  const [session, setSession] = useState<CashRegisterSession | null>(null)
  const [summary, setSummary] = useState<CashSummary | null>(null)
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [tenantId, setTenantId] = useState('')
  const [userId, setUserId] = useState('')
  
  // Modal states
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [showMovementModal, setShowMovementModal] = useState(false)
  const [movementType, setMovementType] = useState<'withdrawal' | 'deposit'>('withdrawal')
  
  // Form states
  const [openingAmount, setOpeningAmount] = useState('')
  const [closingAmount, setClosingAmount] = useState('')
  const [closingNotes, setClosingNotes] = useState('')
  const [movementAmount, setMovementAmount] = useState('')
  const [movementReason, setMovementReason] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return

    const { data: storeUser } = await supabase
      .from('store_users')
      .select('tenant_id, id')
      .eq('email', user.email.toLowerCase())
      .single()

    if (!storeUser) return
    
    setTenantId(storeUser.tenant_id)
    setUserId(storeUser.id)

    // Check for open session
    const { data: openSession } = await supabase
      .from('cash_register_sessions')
      .select('*')
      .eq('tenant_id', storeUser.tenant_id)
      .eq('status', 'open')
      .single()

    if (openSession) {
      setSession(openSession)
      await loadSummary(openSession.id, storeUser.tenant_id)
      await loadMovements(openSession.id)
    }
    
    setLoading(false)
  }

  async function loadSummary(sessionId: string, tid: string) {
    const supabase = createClient()
    
    // Get session
    const { data: sess } = await supabase
      .from('cash_register_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (!sess) return

    // Get sales
    const { data: sales } = await supabase
      .from('sales')
      .select('total, payment_method')
      .eq('session_id', sessionId)

    // Get movements
    const { data: movs } = await supabase
      .from('cash_movements')
      .select('type, amount')
      .eq('session_id', sessionId)

    const salesByMethod = { dinheiro: 0, pix: 0, cartao: 0, fiado: 0 }
    let totalSales = 0
    
    sales?.forEach(s => {
      totalSales += s.total
      if (s.payment_method && s.payment_method in salesByMethod) {
        salesByMethod[s.payment_method as keyof typeof salesByMethod] += s.total
      }
    })

    let withdrawals = 0, deposits = 0
    movs?.forEach(m => {
      if (m.type === 'withdrawal') withdrawals += m.amount
      else deposits += m.amount
    })

    const expectedCash = sess.opening_amount + salesByMethod.dinheiro + deposits - withdrawals

    setSummary({
      session: sess,
      totalSales,
      salesByMethod,
      withdrawals,
      deposits,
      expectedCash
    })
  }

  async function loadMovements(sessionId: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('cash_movements')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
    
    setMovements(data || [])
  }

  async function handleOpenCash() {
    const supabase = createClient()
    const amount = parseFloat(openingAmount.replace(',', '.')) || 0

    const { data, error } = await supabase
      .from('cash_register_sessions')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        opening_amount: amount,
        status: 'open'
      })
      .select()
      .single()

    if (error) {
      alert('Erro ao abrir caixa: ' + error.message)
      return
    }

    setSession(data)
    setSummary({
      session: data,
      totalSales: 0,
      salesByMethod: { dinheiro: 0, pix: 0, cartao: 0, fiado: 0 },
      withdrawals: 0,
      deposits: 0,
      expectedCash: amount
    })
    setShowOpenModal(false)
    setOpeningAmount('')
  }

  async function handleCloseCash() {
    if (!session || !summary) return
    
    const supabase = createClient()
    const actual = parseFloat(closingAmount.replace(',', '.')) || 0
    const difference = actual - summary.expectedCash

    const { error } = await supabase
      .from('cash_register_sessions')
      .update({
        closed_at: new Date().toISOString(),
        expected_amount: summary.expectedCash,
        actual_amount: actual,
        difference,
        notes: closingNotes,
        status: 'closed'
      })
      .eq('id', session.id)

    if (error) {
      alert('Erro ao fechar caixa: ' + error.message)
      return
    }

    setSession(null)
    setSummary(null)
    setMovements([])
    setShowCloseModal(false)
    setClosingAmount('')
    setClosingNotes('')
  }

  async function handleAddMovement() {
    if (!session) return
    
    const supabase = createClient()
    const amount = parseFloat(movementAmount.replace(',', '.')) || 0

    const { error } = await supabase
      .from('cash_movements')
      .insert({
        session_id: session.id,
        user_id: userId,
        type: movementType,
        amount,
        reason: movementReason
      })

    if (error) {
      alert('Erro: ' + error.message)
      return
    }

    await loadSummary(session.id, tenantId)
    await loadMovements(session.id)
    setShowMovementModal(false)
    setMovementAmount('')
    setMovementReason('')
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/pdv" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-800">Caixa</h1>
          </div>
          <Link href="/pdv/caixa/historico" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {!session ? (
          /* Caixa Fechado */
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-5xl">🔒</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Caixa Fechado</h2>
            <p className="text-gray-500 mb-8">Abra o caixa para começar a vender</p>
            <button
              onClick={() => setShowOpenModal(true)}
              className="px-8 py-4 bg-green-500 text-white font-bold text-lg rounded-2xl
                         hover:bg-green-600 active:scale-[0.98] transition-all shadow-lg"
            >
              🔓 Abrir Caixa
            </button>
          </div>
        ) : (
          /* Caixa Aberto */
          <>
            {/* Status Card */}
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                <span className="font-medium">Caixa Aberto</span>
                <span className="text-green-100 text-sm ml-auto">
                  desde {formatTime(session.opened_at)}
                </span>
              </div>
              
              {summary && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-green-100 text-sm">Vendas</p>
                    <p className="text-2xl font-bold">{formatCurrency(summary.totalSales)}</p>
                  </div>
                  <div>
                    <p className="text-green-100 text-sm">Em Caixa (esperado)</p>
                    <p className="text-2xl font-bold">{formatCurrency(summary.expectedCash)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Sales by Method */}
            {summary && (
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-4">Vendas por Forma de Pagamento</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'dinheiro', icon: '💵', label: 'Dinheiro' },
                    { key: 'pix', icon: '📱', label: 'Pix' },
                    { key: 'cartao', icon: '💳', label: 'Cartão' },
                    { key: 'fiado', icon: '📝', label: 'Fiado' }
                  ].map(({ key, icon, label }) => (
                    <div key={key} className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
                      <span className="text-2xl">{icon}</span>
                      <div>
                        <p className="text-sm text-gray-500">{label}</p>
                        <p className="font-semibold text-gray-800">
                          {formatCurrency(summary.salesByMethod[key as keyof typeof summary.salesByMethod])}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setMovementType('withdrawal'); setShowMovementModal(true) }}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100
                           hover:shadow-md transition-shadow text-left"
              >
                <span className="text-2xl mb-2 block">💸</span>
                <p className="font-semibold text-gray-800">Sangria</p>
                <p className="text-sm text-gray-500">Retirar dinheiro</p>
              </button>
              
              <button
                onClick={() => { setMovementType('deposit'); setShowMovementModal(true) }}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100
                           hover:shadow-md transition-shadow text-left"
              >
                <span className="text-2xl mb-2 block">💰</span>
                <p className="font-semibold text-gray-800">Suprimento</p>
                <p className="text-sm text-gray-500">Adicionar dinheiro</p>
              </button>
            </div>

            {/* Movements */}
            {movements.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-4">Movimentações</h3>
                <div className="space-y-3">
                  {movements.map((mov) => (
                    <div key={mov.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{mov.type === 'withdrawal' ? '💸' : '💰'}</span>
                        <div>
                          <p className="font-medium text-gray-800">{mov.reason}</p>
                          <p className="text-sm text-gray-500">{formatTime(mov.created_at)}</p>
                        </div>
                      </div>
                      <p className={`font-semibold ${mov.type === 'withdrawal' ? 'text-red-500' : 'text-green-500'}`}>
                        {mov.type === 'withdrawal' ? '-' : '+'}{formatCurrency(mov.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={() => setShowCloseModal(true)}
              className="w-full py-4 bg-red-500 text-white font-bold rounded-2xl
                         hover:bg-red-600 active:scale-[0.98] transition-all"
            >
              🔒 Fechar Caixa
            </button>
          </>
        )}
      </main>

      {/* Open Cash Modal */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
          <div className="w-full max-w-lg bg-white rounded-t-3xl animate-slide-up">
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-bold text-gray-800">Abrir Caixa</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor inicial em caixa (troco)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={openingAmount}
                    onChange={(e) => setOpeningAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full h-14 pl-12 pr-4 text-2xl font-bold border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowOpenModal(false)}
                  className="flex-1 py-4 border-2 border-gray-200 text-gray-600 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleOpenCash}
                  className="flex-1 py-4 bg-green-500 text-white font-bold rounded-xl"
                >
                  Abrir Caixa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Cash Modal */}
      {showCloseModal && summary && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
          <div className="w-full max-w-lg bg-white rounded-t-3xl animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-bold text-gray-800">Fechar Caixa</h2>
              
              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Abertura</span>
                  <span className="font-medium">{formatCurrency(summary.session.opening_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">+ Vendas (dinheiro)</span>
                  <span className="font-medium text-green-600">+{formatCurrency(summary.salesByMethod.dinheiro)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">+ Suprimentos</span>
                  <span className="font-medium text-green-600">+{formatCurrency(summary.deposits)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">- Sangrias</span>
                  <span className="font-medium text-red-500">-{formatCurrency(summary.withdrawals)}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between">
                  <span className="font-semibold text-gray-800">Esperado em caixa</span>
                  <span className="font-bold text-gray-800">{formatCurrency(summary.expectedCash)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor contado em caixa
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={closingAmount}
                    onChange={(e) => setClosingAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full h-14 pl-12 pr-4 text-2xl font-bold border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none"
                  />
                </div>
              </div>

              {closingAmount && (
                <div className={`rounded-xl p-4 text-center ${
                  parseFloat(closingAmount.replace(',', '.')) === summary.expectedCash
                    ? 'bg-green-50 text-green-700'
                    : parseFloat(closingAmount.replace(',', '.')) > summary.expectedCash
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-red-50 text-red-700'
                }`}>
                  <p className="text-sm mb-1">Diferença</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(parseFloat(closingAmount.replace(',', '.')) - summary.expectedCash)}
                  </p>
                  <p className="text-sm mt-1">
                    {parseFloat(closingAmount.replace(',', '.')) === summary.expectedCash
                      ? '✓ Caixa batendo!'
                      : parseFloat(closingAmount.replace(',', '.')) > summary.expectedCash
                        ? 'Sobra de caixa'
                        : 'Falta de caixa'}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações (opcional)
                </label>
                <textarea
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Alguma observação sobre o fechamento..."
                  className="w-full h-24 p-4 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCloseModal(false)}
                  className="flex-1 py-4 border-2 border-gray-200 text-gray-600 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCloseCash}
                  disabled={!closingAmount}
                  className="flex-1 py-4 bg-red-500 text-white font-bold rounded-xl disabled:opacity-50"
                >
                  Fechar Caixa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {showMovementModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
          <div className="w-full max-w-lg bg-white rounded-t-3xl animate-slide-up">
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-bold text-gray-800">
                {movementType === 'withdrawal' ? '💸 Sangria' : '💰 Suprimento'}
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Valor</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={movementAmount}
                    onChange={(e) => setMovementAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full h-14 pl-12 pr-4 text-2xl font-bold border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Motivo</label>
                <input
                  type="text"
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  placeholder={movementType === 'withdrawal' ? 'Ex: Pagamento fornecedor' : 'Ex: Troco adicional'}
                  className="w-full h-14 px-4 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowMovementModal(false)}
                  className="flex-1 py-4 border-2 border-gray-200 text-gray-600 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddMovement}
                  disabled={!movementAmount || !movementReason}
                  className={`flex-1 py-4 text-white font-bold rounded-xl disabled:opacity-50
                    ${movementType === 'withdrawal' ? 'bg-red-500' : 'bg-green-500'}`}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
