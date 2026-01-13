'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BillingService } from '@/lib/billing'
import { Charge, Tenant, ChargeStatus } from '@/types'
import Link from 'next/link'

type ChargeWithTenant = Charge & { tenant?: Tenant }

type TabType = 'pending' | 'paid'

export default function ChargesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [pendingCharges, setPendingCharges] = useState<ChargeWithTenant[]>([])
  const [paidCharges, setPaidCharges] = useState<ChargeWithTenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const supabase = createClient()
  const billingService = new BillingService(supabase)

  useEffect(() => {
    loadCharges()
  }, [])

  async function loadCharges() {
    try {
      setLoading(true)
      setError(null)

      const [pending, paid] = await Promise.all([
        billingService.getPendingCharges(),
        billingService.getPaidCharges()
      ])

      setPendingCharges(pending)
      setPaidCharges(paid)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar cobranças')
    } finally {
      setLoading(false)
    }
  }

  async function handleSendReminder(chargeId: string) {
    try {
      setActionLoading(chargeId)
      setError(null)
      setSuccessMessage(null)

      const result = await billingService.sendPaymentReminder(chargeId)
      
      if (result.success) {
        setSuccessMessage('Lembrete enviado com sucesso!')
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        setError(result.error || 'Erro ao enviar lembrete')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar lembrete')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCancelCharge(chargeId: string) {
    if (!confirm('Tem certeza que deseja cancelar esta cobrança?')) return

    try {
      setActionLoading(chargeId)
      setError(null)

      await billingService.cancelCharge(chargeId)
      await loadCharges()
      setSuccessMessage('Cobrança cancelada com sucesso!')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cancelar cobrança')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Carregando...</div>
      </div>
    )
  }

  const currentCharges = activeTab === 'pending' ? pendingCharges : paidCharges

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/admin" 
                className="text-gray-500 hover:text-gray-700"
              >
                ← Voltar
              </Link>
              <h1 className="text-xl font-bold text-green-600">Cobranças</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {successMessage}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <SummaryCard
            title="Cobranças Pendentes"
            value={pendingCharges.length}
            total={pendingCharges.reduce((sum, c) => sum + c.amount, 0)}
            color="yellow"
          />
          <SummaryCard
            title="Cobranças Pagas"
            value={paidCharges.length}
            total={paidCharges.reduce((sum, c) => sum + c.amount, 0)}
            color="green"
          />
          <SummaryCard
            title="Total em Aberto"
            value={pendingCharges.filter(c => c.status === 'overdue').length}
            total={pendingCharges.filter(c => c.status === 'overdue').reduce((sum, c) => sum + c.amount, 0)}
            color="red"
            subtitle="Vencidas"
          />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <TabButton
                active={activeTab === 'pending'}
                onClick={() => setActiveTab('pending')}
                count={pendingCharges.length}
              >
                Pendentes
              </TabButton>
              <TabButton
                active={activeTab === 'paid'}
                onClick={() => setActiveTab('paid')}
                count={paidCharges.length}
              >
                Pagas
              </TabButton>
            </nav>
          </div>

          {/* Charges List */}
          {currentCharges.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              {activeTab === 'pending' 
                ? 'Nenhuma cobrança pendente' 
                : 'Nenhuma cobrança paga'}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {currentCharges.map(charge => (
                <ChargeCard
                  key={charge.id}
                  charge={charge}
                  onSendReminder={() => handleSendReminder(charge.id)}
                  onCancel={() => handleCancelCharge(charge.id)}
                  loading={actionLoading === charge.id}
                  showActions={activeTab === 'pending'}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}


function SummaryCard({ 
  title, 
  value, 
  total, 
  color,
  subtitle 
}: { 
  title: string
  value: number
  total: number
  color: 'green' | 'yellow' | 'red'
  subtitle?: string
}) {
  const colorClasses = {
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red: 'bg-red-50 text-red-700 border-red-200'
  }

  return (
    <div className={`p-6 rounded-lg border ${colorClasses[color]}`}>
      <p className="text-sm font-medium opacity-75">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className="text-sm mt-1">
        R$ {total.toFixed(2)}
        {subtitle && <span className="opacity-75"> • {subtitle}</span>}
      </p>
    </div>
  )
}

function TabButton({ 
  active, 
  onClick, 
  count, 
  children 
}: { 
  active: boolean
  onClick: () => void
  count: number
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-green-500 text-green-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {children}
      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
        active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
      }`}>
        {count}
      </span>
    </button>
  )
}

function ChargeCard({
  charge,
  onSendReminder,
  onCancel,
  loading,
  showActions
}: {
  charge: ChargeWithTenant
  onSendReminder: () => void
  onCancel: () => void
  loading: boolean
  showActions: boolean
}) {
  const dueDate = new Date(charge.due_date).toLocaleDateString('pt-BR')
  const paidAt = charge.paid_at 
    ? new Date(charge.paid_at).toLocaleDateString('pt-BR')
    : null

  const statusConfig: Record<ChargeStatus, { label: string; className: string }> = {
    pending: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' },
    overdue: { label: 'Vencida', className: 'bg-red-100 text-red-800' },
    paid: { label: 'Paga', className: 'bg-green-100 text-green-800' },
    cancelled: { label: 'Cancelada', className: 'bg-gray-100 text-gray-800' }
  }

  const status = statusConfig[charge.status]

  const paymentMethodLabels: Record<string, string> = {
    mercado_pago: 'Mercado Pago',
    pix: 'PIX',
    boleto: 'Boleto'
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">
              {charge.tenant?.store_name || 'Loja não encontrada'}
            </h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.className}`}>
              {status.label}
            </span>
          </div>
          
          <div className="mt-2 text-sm text-gray-600 space-y-1">
            <p>
              <span className="font-medium">Valor:</span>{' '}
              <span className="text-lg font-semibold text-gray-900">
                R$ {charge.amount.toFixed(2)}
              </span>
            </p>
            <p>
              <span className="font-medium">Vencimento:</span> {dueDate}
            </p>
            {charge.tenant && (
              <>
                <p>
                  <span className="font-medium">Email:</span> {charge.tenant.owner_email}
                </p>
                <p>
                  <span className="font-medium">Telefone:</span> {charge.tenant.owner_phone}
                </p>
              </>
            )}
            {paidAt && (
              <p>
                <span className="font-medium">Pago em:</span> {paidAt}
                {charge.payment_method && (
                  <span> via {paymentMethodLabels[charge.payment_method] || charge.payment_method}</span>
                )}
              </p>
            )}
          </div>
        </div>

        {showActions && (
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={onSendReminder}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {loading ? 'Enviando...' : 'Enviar Lembrete'}
            </button>
            <button
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 text-sm font-medium"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
