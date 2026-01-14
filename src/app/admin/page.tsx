'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AdminService, DashboardMetrics } from '@/lib/admin'
import { Tenant } from '@/types'
import { TenantService } from '@/lib/tenants'
import { useRouter } from 'next/navigation'

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [pendingTenants, setPendingTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const router = useRouter()

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const supabase = createClient()
      const adminService = new AdminService(supabase)

      const [metricsData, tenantsData] = await Promise.all([
        adminService.getDashboardMetrics(),
        adminService.getPendingTenants()
      ])

      setMetrics(metricsData)
      setPendingTenants(tenantsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  async function handleApprove(tenantId: string) {
    try {
      setActionLoading(tenantId)
      
      const supabase = createClient()
      
      // Get current user's email
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        setError('Usuário não autenticado')
        return
      }
      
      // Get admin ID from super_admin_users table
      const { data: adminData } = await supabase
        .from('super_admin_users')
        .select('id')
        .eq('email', user.email.toLowerCase())
        .single()
      
      if (!adminData) {
        setError('Você não tem permissão para aprovar')
        return
      }

      // Get tenant data first
      const { data: tenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single()

      if (!tenant) {
        setError('Tenant não encontrado')
        return
      }

      // Update tenant status
      const { error: updateError } = await supabase
        .from('tenants')
        .update({
          approved_by_admin: true,
          subscription_status: 'active',
          approved_at: new Date().toISOString(),
          approved_by: adminData.id
        })
        .eq('id', tenantId)

      if (updateError) {
        setError('Erro ao aprovar: ' + updateError.message)
        return
      }

      // Create store_user for the owner
      const { error: userError } = await supabase
        .from('store_users')
        .insert({
          tenant_id: tenantId,
          email: tenant.owner_email.toLowerCase(),
          name: tenant.owner_name,
          role: 'owner',
          is_active: true
        })

      if (userError) {
        console.error('Erro ao criar store_user:', userError)
        setError('Tenant aprovado, mas erro ao criar usuário: ' + userError.message)
        // Don't return - tenant is approved, just show warning
      }

      await loadDashboardData()
      alert('Loja aprovada com sucesso!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aprovar loja')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReject(tenantId: string) {
    const reason = prompt('Motivo da rejeição:')
    if (!reason) return

    try {
      setActionLoading(tenantId)
      const supabase = createClient()
      const tenantService = new TenantService(supabase)
      await tenantService.rejectTenant(tenantId, reason)
      await loadDashboardData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao rejeitar loja')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRequestInfo(tenantId: string) {
    const questions = prompt('Perguntas (separadas por vírgula):')
    if (!questions) return

    try {
      setActionLoading(tenantId)
      const supabase = createClient()
      const tenantService = new TenantService(supabase)
      await tenantService.requestMoreInfo(tenantId, questions.split(',').map(q => q.trim()))
      alert('Solicitação enviada com sucesso!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao solicitar informações')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleExportTransactions() {
    try {
      setActionLoading('export')
      const supabase = createClient()
      const adminService = new AdminService(supabase)
      const transactions = await adminService.getAllTransactions()
      const csv = adminService.generateTransactionsCSV(transactions)
      
      // Download CSV
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `transacoes_${new Date().toISOString().split('T')[0]}.csv`
      link.click()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao exportar transações')
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-green-600">FeiraPro Admin</h1>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/admin/lojas')}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Ver Lojas
            </button>
            <button
              onClick={() => router.push('/admin/cobrancas')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Cobranças
            </button>
            <button
              onClick={handleExportTransactions}
              disabled={actionLoading === 'export'}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {actionLoading === 'export' ? 'Exportando...' : 'Exportar Transações'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Lojas Ativas"
            value={metrics?.activeStores || 0}
            color="green"
          />
          <MetricCard
            title="Receita Mensal"
            value={`R$ ${(metrics?.monthlyRevenue || 0).toFixed(2)}`}
            color="blue"
          />
          <MetricCard
            title="Aguardando Aprovação"
            value={metrics?.pendingApprovals || 0}
            color="yellow"
          />
          <MetricCard
            title="Lojas Suspensas"
            value={metrics?.suspendedStores || 0}
            color="red"
          />
        </div>

        {/* Pending Approvals Queue */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Fila de Aprovação ({pendingTenants.length})
            </h2>
          </div>
          
          {pendingTenants.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Nenhuma loja aguardando aprovação
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {pendingTenants.map(tenant => (
                <TenantApprovalCard
                  key={tenant.id}
                  tenant={tenant}
                  onApprove={() => handleApprove(tenant.id)}
                  onReject={() => handleReject(tenant.id)}
                  onRequestInfo={() => handleRequestInfo(tenant.id)}
                  loading={actionLoading === tenant.id}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function MetricCard({ title, value, color }: { title: string; value: string | number; color: string }) {
  const colorClasses = {
    green: 'bg-green-50 text-green-700 border-green-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red: 'bg-red-50 text-red-700 border-red-200'
  }

  return (
    <div className={`p-6 rounded-lg border ${colorClasses[color as keyof typeof colorClasses]}`}>
      <p className="text-sm font-medium opacity-75">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  )
}

function TenantApprovalCard({
  tenant,
  onApprove,
  onReject,
  onRequestInfo,
  loading
}: {
  tenant: Tenant
  onApprove: () => void
  onReject: () => void
  onRequestInfo: () => void
  loading: boolean
}) {
  const createdAt = new Date(tenant.created_at).toLocaleDateString('pt-BR')
  const trialEndsAt = new Date(tenant.trial_ends_at).toLocaleDateString('pt-BR')

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{tenant.store_name}</h3>
          <div className="mt-1 text-sm text-gray-600 space-y-1">
            <p><span className="font-medium">Dono:</span> {tenant.owner_name}</p>
            <p><span className="font-medium">Email:</span> {tenant.owner_email}</p>
            <p><span className="font-medium">Telefone:</span> {tenant.owner_phone}</p>
            {tenant.cnpj && <p><span className="font-medium">CNPJ:</span> {tenant.cnpj}</p>}
            {tenant.address && <p><span className="font-medium">Endereço:</span> {tenant.address}</p>}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Cadastrado em {createdAt} • Trial até {trialEndsAt}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={onApprove}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
          >
            Aprovar
          </button>
          <button
            onClick={onRequestInfo}
            disabled={loading}
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 text-sm font-medium"
          >
            Solicitar Info
          </button>
          <button
            onClick={onReject}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
          >
            Rejeitar
          </button>
        </div>
      </div>
    </div>
  )
}
