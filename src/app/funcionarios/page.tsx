'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StoreUserService, AddEmployeeInput } from '@/lib/store-users'
import { StoreUser, UserRole } from '@/types'

/**
 * Employee Management Page
 * Requirements: 10.1 - Add and manage employees
 */
export default function EmployeeManagementPage() {
  const [employees, setEmployees] = useState<StoreUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [tenantId, setTenantId] = useState<string | null>(null)

  const supabase = createClient()
  const storeUserService = new StoreUserService(supabase)

  useEffect(() => {
    loadTenantAndEmployees()
  }, [])

  async function loadTenantAndEmployees() {
    try {
      setLoading(true)
      setError(null)

      // Get current user's tenant
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Usuário não autenticado')
        return
      }

      // Get tenant ID from store_users table
      const { data: storeUser } = await supabase
        .from('store_users')
        .select('tenant_id')
        .eq('email', user.email?.toLowerCase())
        .single()

      if (!storeUser) {
        setError('Usuário não encontrado na loja')
        return
      }

      setTenantId(storeUser.tenant_id)

      // Load employees
      const employeesData = await storeUserService.getEmployeesByTenant(storeUser.tenant_id)
      setEmployees(employeesData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar funcionários')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeactivate(employeeId: string) {
    if (!confirm('Tem certeza que deseja desativar este funcionário?')) return

    try {
      setActionLoading(employeeId)
      const result = await storeUserService.deactivateEmployee(employeeId)
      if (!result.success) {
        setError(result.error)
        return
      }
      await loadTenantAndEmployees()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desativar funcionário')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReactivate(employeeId: string) {
    try {
      setActionLoading(employeeId)
      const result = await storeUserService.reactivateEmployee(employeeId)
      if (!result.success) {
        setError(result.error)
        return
      }
      await loadTenantAndEmployees()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao reativar funcionário')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleAddEmployee(data: Omit<AddEmployeeInput, 'tenant_id'>) {
    if (!tenantId) return

    try {
      setActionLoading('add')
      const result = await storeUserService.addEmployee({
        ...data,
        tenant_id: tenantId
      })

      if (!result.success) {
        setError(result.errors.map(e => e.message).join(', '))
        return
      }

      setShowAddModal(false)
      await loadTenantAndEmployees()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar funcionário')
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
          <h1 className="text-xl font-bold text-green-600">Gestão de Funcionários</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            + Adicionar Funcionário
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
            <button 
              onClick={() => setError(null)} 
              className="ml-2 text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}

        {/* Employee List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Funcionários ({employees.length})
            </h2>
          </div>

          {employees.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Nenhum funcionário cadastrado
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {employees.map(employee => (
                <EmployeeCard
                  key={employee.id}
                  employee={employee}
                  onDeactivate={() => handleDeactivate(employee.id)}
                  onReactivate={() => handleReactivate(employee.id)}
                  loading={actionLoading === employee.id}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add Employee Modal */}
      {showAddModal && (
        <AddEmployeeModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddEmployee}
          loading={actionLoading === 'add'}
        />
      )}
    </div>
  )
}

/**
 * Employee Card Component
 */
function EmployeeCard({
  employee,
  onDeactivate,
  onReactivate,
  loading
}: {
  employee: StoreUser
  onDeactivate: () => void
  onReactivate: () => void
  loading: boolean
}) {
  const roleLabels: Record<UserRole, string> = {
    owner: 'Proprietário',
    manager: 'Gerente',
    cashier: 'Caixa'
  }

  const roleColors: Record<UserRole, string> = {
    owner: 'bg-purple-100 text-purple-800',
    manager: 'bg-blue-100 text-blue-800',
    cashier: 'bg-gray-100 text-gray-800'
  }

  const createdAt = new Date(employee.created_at).toLocaleDateString('pt-BR')

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">{employee.name}</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[employee.role]}`}>
              {roleLabels[employee.role]}
            </span>
            {!employee.is_active && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Desativado
              </span>
            )}
          </div>
          <div className="mt-1 text-sm text-gray-600">
            <p>{employee.email}</p>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Cadastrado em {createdAt}
          </div>
        </div>

        <div className="flex gap-2">
          {employee.is_active ? (
            <button
              onClick={onDeactivate}
              disabled={loading || employee.role === 'owner'}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
              title={employee.role === 'owner' ? 'Não é possível desativar o proprietário' : ''}
            >
              {loading ? 'Desativando...' : 'Desativar'}
            </button>
          ) : (
            <button
              onClick={onReactivate}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
            >
              {loading ? 'Reativando...' : 'Reativar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Add Employee Modal Component
 * Requirements: 10.1 - Form with role selection (owner/manager/cashier)
 */
function AddEmployeeModal({
  onClose,
  onSubmit,
  loading
}: {
  onClose: () => void
  onSubmit: (data: Omit<AddEmployeeInput, 'tenant_id'>) => void
  loading: boolean
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('cashier')
  const [formError, setFormError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!name.trim()) {
      setFormError('Nome é obrigatório')
      return
    }
    if (!email.trim()) {
      setFormError('Email é obrigatório')
      return
    }

    onSubmit({ name: name.trim(), email: email.trim(), role })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Adicionar Funcionário</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {formError}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nome *
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="Nome do funcionário"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="email@exemplo.com"
            />
            <p className="mt-1 text-xs text-gray-500">
              Um convite será enviado para este email
            </p>
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              Papel *
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="cashier">Caixa</option>
              <option value="manager">Gerente</option>
              <option value="owner">Proprietário</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {role === 'owner' && 'Acesso total à loja'}
              {role === 'manager' && 'Acesso a vendas, produtos e relatórios'}
              {role === 'cashier' && 'Acesso apenas a vendas'}
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
