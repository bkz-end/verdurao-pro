// Database types for VerdurãoPro SaaS
// These types match the Supabase schema defined in the design document

export type SubscriptionStatus = 'pending' | 'active' | 'suspended' | 'cancelled'
export type UserRole = 'owner' | 'manager' | 'cashier'
export type ProductUnit = 'un' | 'kg' | 'g' | 'l' | 'ml'
export type LossReason = 'expiration' | 'damage' | 'theft' | 'other'
export type PaymentMethod = 'mercado_pago' | 'pix' | 'boleto'
export type ChargeStatus = 'pending' | 'paid' | 'overdue' | 'cancelled'

export interface SuperAdminUser {
  id: string
  email: string
  name: string
  created_at: string
}

export interface Tenant {
  id: string
  store_name: string
  owner_name: string
  owner_email: string
  owner_phone: string
  cnpj: string | null
  address: string | null
  subscription_status: SubscriptionStatus
  trial_ends_at: string
  monthly_price: number
  approved_by_admin: boolean
  approved_at: string | null
  approved_by: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export interface Charge {
  id: string
  tenant_id: string
  amount: number
  due_date: string
  status: ChargeStatus
  paid_at: string | null
  payment_method: PaymentMethod | null
  created_at: string
}

export interface StoreUser {
  id: string
  tenant_id: string
  email: string
  name: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface Product {
  id: string
  tenant_id: string
  sku: string
  name: string
  price: number
  cost_price: number | null
  unit: ProductUnit
  default_quantity: number
  stock: number
  category: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Sale {
  id: string
  tenant_id: string
  user_id: string
  total: number
  created_at: string
  synced_at: string | null
  local_id: string | null
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  quantity: number
  unit_price: number
  subtotal: number
}

export interface Loss {
  id: string
  tenant_id: string
  product_id: string
  user_id: string
  quantity: number
  reason: LossReason
  notes: string | null
  created_at: string
}

export interface StockHistory {
  id: string
  product_id: string
  quantity_change: number
  reason: string
  reference_id: string | null
  created_at: string
}

// Database schema type for Supabase client
export interface Database {
  public: {
    Tables: {
      super_admin_users: {
        Row: SuperAdminUser
        Insert: Omit<SuperAdminUser, 'id' | 'created_at'>
        Update: Partial<Omit<SuperAdminUser, 'id' | 'created_at'>>
      }
      tenants: {
        Row: Tenant
        Insert: Omit<Tenant, 'id' | 'created_at' | 'updated_at' | 'trial_ends_at' | 'monthly_price' | 'approved_by_admin' | 'approved_at' | 'approved_by' | 'subscription_status'>
        Update: Partial<Omit<Tenant, 'id' | 'created_at'>>
      }
      charges: {
        Row: Charge
        Insert: Omit<Charge, 'id' | 'created_at' | 'status' | 'paid_at' | 'payment_method'>
        Update: Partial<Omit<Charge, 'id' | 'created_at'>>
      }
      store_users: {
        Row: StoreUser
        Insert: Omit<StoreUser, 'id' | 'created_at' | 'is_active'>
        Update: Partial<Omit<StoreUser, 'id' | 'created_at'>>
      }
      products: {
        Row: Product
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'is_active'>
        Update: Partial<Omit<Product, 'id' | 'created_at'>>
      }
      sales: {
        Row: Sale
        Insert: Omit<Sale, 'id' | 'created_at' | 'synced_at'>
        Update: Partial<Omit<Sale, 'id' | 'created_at'>>
      }
      sale_items: {
        Row: SaleItem
        Insert: Omit<SaleItem, 'id'>
        Update: Partial<Omit<SaleItem, 'id'>>
      }
      losses: {
        Row: Loss
        Insert: Omit<Loss, 'id' | 'created_at'>
        Update: Partial<Omit<Loss, 'id' | 'created_at'>>
      }
      stock_history: {
        Row: StockHistory
        Insert: Omit<StockHistory, 'id' | 'created_at'>
        Update: Partial<Omit<StockHistory, 'id' | 'created_at'>>
      }
    }
  }
}
