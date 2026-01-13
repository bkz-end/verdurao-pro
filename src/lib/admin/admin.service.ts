import { SupabaseClient } from '@supabase/supabase-js'
import { Tenant } from '@/types'

/**
 * Dashboard metrics for Super Admin
 * Requirements: 3.1
 */
export interface DashboardMetrics {
  activeStores: number
  monthlyRevenue: number
  pendingApprovals: number
  totalStores: number
  suspendedStores: number
}

/**
 * Transaction data for CSV export
 * Requirements: 3.5
 */
export interface TransactionExport {
  id: string
  tenant_id: string
  store_name: string
  total: number
  created_at: string
  user_name: string
}

/**
 * AdminService - Manages Super Admin dashboard operations
 * Requirements: 3.1, 3.2, 3.5
 */
export class AdminService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Gets consolidated dashboard metrics
   * Requirements: 3.1
   * 
   * - Active stores count
   * - Monthly revenue (sum of paid charges for current month)
   * - Pending approvals count
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    // Get tenant counts by status
    const { data: tenants, error: tenantsError } = await this.supabase
      .from('tenants')
      .select('subscription_status')

    if (tenantsError) {
      throw new Error(`Failed to fetch tenants: ${tenantsError.message}`)
    }

    const activeStores = tenants?.filter(t => t.subscription_status === 'active').length || 0
    const pendingApprovals = tenants?.filter(t => t.subscription_status === 'pending').length || 0
    const suspendedStores = tenants?.filter(t => t.subscription_status === 'suspended').length || 0
    const totalStores = tenants?.length || 0

    // Get monthly revenue from paid charges
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const { data: charges, error: chargesError } = await this.supabase
      .from('charges')
      .select('amount')
      .eq('status', 'paid')
      .gte('paid_at', firstDayOfMonth.toISOString())
      .lte('paid_at', lastDayOfMonth.toISOString())

    if (chargesError) {
      throw new Error(`Failed to fetch charges: ${chargesError.message}`)
    }

    const monthlyRevenue = charges?.reduce((sum, charge) => sum + Number(charge.amount), 0) || 0

    return {
      activeStores,
      monthlyRevenue,
      pendingApprovals,
      totalStores,
      suspendedStores
    }
  }

  /**
   * Gets pending tenants ordered by creation date (oldest first)
   * Requirements: 3.2
   */
  async getPendingTenants(): Promise<Tenant[]> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('*')
      .eq('subscription_status', 'pending')
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch pending tenants: ${error.message}`)
    }

    return (data || []) as Tenant[]
  }

  /**
   * Gets all transactions from all stores for CSV export
   * Requirements: 3.5
   */
  async getAllTransactions(): Promise<TransactionExport[]> {
    // Get all sales with tenant and user info
    const { data: sales, error: salesError } = await this.supabase
      .from('sales')
      .select(`
        id,
        tenant_id,
        total,
        created_at,
        user_id,
        tenants!inner(store_name),
        store_users!inner(name)
      `)
      .order('created_at', { ascending: false })

    if (salesError) {
      throw new Error(`Failed to fetch transactions: ${salesError.message}`)
    }

    return (sales || []).map((sale: any) => ({
      id: sale.id,
      tenant_id: sale.tenant_id,
      store_name: sale.tenants?.store_name || 'N/A',
      total: sale.total,
      created_at: sale.created_at,
      user_name: sale.store_users?.name || 'N/A'
    }))
  }

  /**
   * Generates CSV content from transactions
   * Requirements: 3.5
   */
  generateTransactionsCSV(transactions: TransactionExport[]): string {
    const headers = ['ID', 'Loja', 'Vendedor', 'Total (R$)', 'Data']
    const rows = transactions.map(t => [
      t.id,
      t.store_name,
      t.user_name,
      t.total.toFixed(2),
      new Date(t.created_at).toLocaleString('pt-BR')
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    return csvContent
  }
}

/**
 * Sorts tenants by created_at in ascending order (oldest first)
 * Requirements: 3.2
 * 
 * This is a pure function that can be tested independently of the database.
 * The actual getPendingTenants() method uses this ordering via Supabase query.
 */
export function sortTenantsByCreatedAt(tenants: Tenant[]): Tenant[] {
  return [...tenants].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime()
    const dateB = new Date(b.created_at).getTime()
    return dateA - dateB
  })
}

/**
 * Verifies that an array of tenants is correctly ordered by created_at ascending
 * Requirements: 3.2
 * 
 * Returns true if the array is in correct order (oldest first), false otherwise.
 */
export function isOrderedByCreatedAtAscending(tenants: Tenant[]): boolean {
  if (tenants.length <= 1) return true
  
  for (let i = 1; i < tenants.length; i++) {
    const prevDate = new Date(tenants[i - 1].created_at).getTime()
    const currDate = new Date(tenants[i].created_at).getTime()
    if (prevDate > currDate) {
      return false
    }
  }
  return true
}

/**
 * Filters tenants to only include those with pending status
 * Requirements: 3.2
 */
export function filterPendingTenants(tenants: Tenant[]): Tenant[] {
  return tenants.filter(t => t.subscription_status === 'pending')
}
