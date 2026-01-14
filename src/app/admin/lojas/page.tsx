'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Tenant } from '@/types'
import Link from 'next/link'

type StatusFilter = 'all' | 'active' | 'pending' | 'suspended' | 'cancelled'

export default function LojasPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadTenants = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setTenants(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar lojas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTenants()
  }, [loadTenants])

  async function handleDelete(tenantId: string, storeName: string) {
    if (!confirm(`Tem certeza que deseja EXCLUIR a loja "${storeName}"?\n\nEssa ação é IRREVERSÍVEL!`)) return
    const confirmText = prompt(`Digite "${storeName}" para confirmar:`)
    if (confirmText !== storeName) { alert('Nome incorreto. Cancelado.'); return }

    try {
      setActionLoading(tenantId)
      const supabase = createClient()
      const { error } = await supabase.from('tenants').delete().eq('id', tenantId)
      if (error) throw error
      await loadTenants()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleSuspend(tenantId: string) {
    try {
      setActionLoading(tenantId)
      const supabase = createClient()
      const { error } = await supabase.from('tenants').update({ subscription_status: 'suspended' }).eq('id', tenantId)
      if (error) throw error
      await loadTenants()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao suspender')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReactivate(tenantId: string) {
    try {
      setActionLoading(tenantId)
      const supabase = createClient()
      const { error } = await supabase.from('tenants').update({ subscription_status: 'active' }).eq('id', tenantId)
      if (error) throw error
      await loadTenants()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao reativar')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleFixStoreUser(tenantId: string) {
    try {
      setActionLoading(tenantId)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user?.email) {
        setError('Usuário não autenticado')
        return
      }

      const response = await fetch('/api/admin/fix-store-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, adminEmail: user.email })
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error + (result.details ? `: ${result.details}` : ''))
        return
      }

      alert(result.message)
      await loadTenants()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao corrigir usuário')
    } finally {
      setActionLoading(null)
    }
  }

  const filteredTenants = tenants.filter(tenant => {
    const matchesStatus = statusFilter === 'all' || tenant.subscription_status === statusFilter
    const matchesSearch = searchTerm === '' || 
      tenant.store_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.owner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.owner_email.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const statusCounts = {
    all: tenants.length,
    active: tenants.filter(t => t.subscription_status === 'active').length,
    pending: tenants.filter(t => t.subscription_status === 'pending').length,
    suspended: tenants.filter(t => t.subscription_status === 'suspended').length,
    cancelled: tenants.filter(t => t.subscription_status === 'cancelled').length,
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-600">Carregando...</div></div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-500 hover:text-gray-700">← Voltar</Link>
            <h1 className="text-xl font-bold text-green-600">Lojas Registradas</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}

        <div className="mb-6">
          <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {(['all', 'active', 'pending', 'suspended', 'cancelled'] as StatusFilter[]).map(status => (
            <button key={status} onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${statusFilter === status ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}>
              {status === 'all' && `Todas (${statusCounts.all})`}
              {status === 'active' && `Ativas (${statusCounts.active})`}
              {status === 'pending' && `Pendentes (${statusCounts.pending})`}
              {status === 'suspended' && `Suspensas (${statusCounts.suspended})`}
              {status === 'cancelled' && `Canceladas (${statusCounts.cancelled})`}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredTenants.length === 0 ? (
            <div className="p-6 text-center text-gray-500">Nenhuma loja encontrada</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loja</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dono</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contato</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTenants.map(tenant => (
                    <tr key={tenant.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4"><div className="font-medium text-gray-900">{tenant.store_name}</div></td>
                      <td className="px-6 py-4 text-gray-900">{tenant.owner_name}</td>
                      <td className="px-6 py-4"><div className="text-gray-900">{tenant.owner_email}</div><div className="text-sm text-gray-500">{tenant.owner_phone}</div></td>
                      <td className="px-6 py-4"><StatusBadge status={tenant.subscription_status} /></td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {tenant.subscription_status === 'active' && (
                            <>
                              <button onClick={() => handleFixStoreUser(tenant.id)} disabled={actionLoading === tenant.id}
                                className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 disabled:opacity-50">Corrigir Usuário</button>
                              <button onClick={() => handleSuspend(tenant.id)} disabled={actionLoading === tenant.id}
                                className="px-3 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 disabled:opacity-50">Suspender</button>
                            </>
                          )}
                          {tenant.subscription_status === 'suspended' && (
                            <button onClick={() => handleReactivate(tenant.id)} disabled={actionLoading === tenant.id}
                              className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 disabled:opacity-50">Reativar</button>
                          )}
                          <button onClick={() => handleDelete(tenant.id, tenant.store_name)} disabled={actionLoading === tenant.id}
                            className="px-3 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 disabled:opacity-50">Excluir</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    active: { label: 'Ativa', className: 'bg-green-100 text-green-800' },
    pending: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' },
    suspended: { label: 'Suspensa', className: 'bg-red-100 text-red-800' },
    cancelled: { label: 'Cancelada', className: 'bg-gray-100 text-gray-800' },
  }
  const { label, className } = config[status] || { label: status, className: 'bg-gray-100 text-gray-800' }
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}>{label}</span>
}
