/**
 * SyncService - Manages offline/online synchronization
 * Requirements: 4.7, 5.1, 5.2, 5.4
 * 
 * Features:
 * - Detects connection status
 * - Stores sales locally when offline
 * - Syncs pending sales in batch when online
 * - Resolves conflicts using last-write-wins
 */

import { SupabaseClient } from '@supabase/supabase-js'
import {
  PendingSale,
  PendingSaleItem,
  LocalProduct,
  ConflictLog,
  SyncResult,
  productToLocal
} from './schema'
import {
  savePendingSale,
  getPendingSale,
  getUnsyncedSales,
  deletePendingSale,
  saveLocalProduct,
  getLocalProduct,
  getLocalProductsByTenant,
  saveConflictLog,
  getUnsyncedSalesCount
} from './database'
import { Cart } from '@/lib/pdv/pdv.service'
import { Product } from '@/types'

/**
 * Connection status change callback type
 */
type ConnectionChangeCallback = (online: boolean) => void

/**
 * Generates a unique ID for local records
 */
function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

/**
 * SyncService class for managing offline synchronization
 * Requirements: 4.7, 5.1, 5.2, 5.4
 */
export class SyncService {
  private connectionCallbacks: ConnectionChangeCallback[] = []
  private isOnlineStatus: boolean = true

  constructor(private supabase: SupabaseClient) {
    // Initialize connection status monitoring
    if (typeof window !== 'undefined') {
      this.isOnlineStatus = navigator.onLine
      
      window.addEventListener('online', () => {
        this.isOnlineStatus = true
        this.notifyConnectionChange(true)
      })
      
      window.addEventListener('offline', () => {
        this.isOnlineStatus = false
        this.notifyConnectionChange(false)
      })
    }
  }

  /**
   * Check if currently online
   * Requirements: 5.3
   */
  isOnline(): boolean {
    if (typeof window === 'undefined') return true
    return this.isOnlineStatus && navigator.onLine
  }

  /**
   * Register a callback for connection status changes
   * Requirements: 5.3
   */
  onConnectionChange(callback: ConnectionChangeCallback): () => void {
    this.connectionCallbacks.push(callback)
    
    // Return unsubscribe function
    return () => {
      const index = this.connectionCallbacks.indexOf(callback)
      if (index > -1) {
        this.connectionCallbacks.splice(index, 1)
      }
    }
  }

  /**
   * Notify all callbacks of connection change
   */
  private notifyConnectionChange(online: boolean): void {
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(online)
      } catch (error) {
        console.error('Error in connection change callback:', error)
      }
    })

    // Auto-sync when coming back online
    if (online) {
      this.syncAll().catch(console.error)
    }
  }

  /**
   * Save a sale locally when offline
   * Requirements: 4.7, 5.1
   * 
   * Property 10: Offline Sales Storage and Sync
   * Sales created while offline SHALL be stored locally
   */
  async saveSaleLocally(
    cart: Cart,
    tenantId: string,
    userId: string
  ): Promise<PendingSale> {
    const items: PendingSaleItem[] = cart.items.map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal
    }))

    const pendingSale: PendingSale = {
      id: generateLocalId(),
      tenantId,
      userId,
      items,
      total: cart.total,
      createdAt: Date.now(),
      isSynced: false,
      syncAttempts: 0,
      lastSyncError: null
    }

    await savePendingSale(pendingSale)
    return pendingSale
  }

  /**
   * Get count of pending sales awaiting sync
   * Requirements: 5.3
   */
  async getPendingSalesCount(tenantId: string): Promise<number> {
    return getUnsyncedSalesCount(tenantId)
  }

  /**
   * Get a pending sale by ID
   */
  async getPendingSale(id: string): Promise<PendingSale | null> {
    return getPendingSale(id)
  }

  /**
   * Sync all pending data
   * Requirements: 5.2
   */
  async syncAll(tenantId?: string): Promise<SyncResult> {
    if (!this.isOnline()) {
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        conflicts: []
      }
    }

    const salesResult = await this.syncPendingSales(tenantId)
    
    return salesResult
  }

  /**
   * Sync pending sales to server
   * Requirements: 5.2
   * 
   * Property 10: Offline Sales Storage and Sync
   * When connection is restored, sales SHALL be synced with matching data
   */
  async syncPendingSales(tenantId?: string): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      conflicts: []
    }

    if (!this.isOnline()) {
      result.success = false
      return result
    }

    try {
      const unsyncedSales = await getUnsyncedSales()
      const salesToSync = tenantId 
        ? unsyncedSales.filter(s => s.tenantId === tenantId)
        : unsyncedSales

      for (const sale of salesToSync) {
        try {
          await this.syncSingleSale(sale)
          result.syncedCount++
        } catch (error) {
          result.failedCount++
          result.success = false
          
          // Update sale with error info
          const updatedSale: PendingSale = {
            ...sale,
            syncAttempts: sale.syncAttempts + 1,
            lastSyncError: error instanceof Error ? error.message : 'Unknown error'
          }
          await savePendingSale(updatedSale)
        }
      }
    } catch (error) {
      result.success = false
      console.error('Error syncing sales:', error)
    }

    return result
  }

  /**
   * Sync a single sale to the server
   */
  private async syncSingleSale(sale: PendingSale): Promise<void> {
    // Check if sale already exists (by local_id)
    const { data: existingSale } = await this.supabase
      .from('sales')
      .select('id')
      .eq('local_id', sale.id)
      .single()

    if (existingSale) {
      // Sale already synced, mark as synced locally
      const updatedSale: PendingSale = { ...sale, isSynced: true }
      await savePendingSale(updatedSale)
      return
    }

    // Create sale on server
    const { data: newSale, error: saleError } = await this.supabase
      .from('sales')
      .insert({
        tenant_id: sale.tenantId,
        user_id: sale.userId,
        total: sale.total,
        local_id: sale.id,
        synced_at: new Date().toISOString()
      })
      .select()
      .single()

    if (saleError) {
      throw new Error(`Failed to create sale: ${saleError.message}`)
    }

    // Create sale items
    const saleItemsData = sale.items.map(item => ({
      sale_id: newSale.id,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      subtotal: item.subtotal
    }))

    const { error: itemsError } = await this.supabase
      .from('sale_items')
      .insert(saleItemsData)

    if (itemsError) {
      // Rollback sale
      await this.supabase.from('sales').delete().eq('id', newSale.id)
      throw new Error(`Failed to create sale items: ${itemsError.message}`)
    }

    // Deduct stock for each item
    for (const item of sale.items) {
      await this.deductStock(item.productId, item.quantity, newSale.id, sale.tenantId)
    }

    // Mark sale as synced
    const updatedSale: PendingSale = { ...sale, isSynced: true }
    await savePendingSale(updatedSale)
  }

  /**
   * Deduct stock from a product
   */
  private async deductStock(
    productId: string,
    quantity: number,
    saleId: string,
    tenantId: string
  ): Promise<void> {
    // Get current stock
    const { data: product } = await this.supabase
      .from('products')
      .select('stock')
      .eq('id', productId)
      .eq('tenant_id', tenantId)
      .single()

    if (!product) return

    const newStock = Math.max(0, product.stock - quantity)

    // Update stock
    await this.supabase
      .from('products')
      .update({ stock: newStock, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .eq('tenant_id', tenantId)

    // Record stock history
    await this.supabase
      .from('stock_history')
      .insert({
        product_id: productId,
        quantity_change: -quantity,
        reason: 'sale',
        reference_id: saleId
      })
  }


  /**
   * Sync products from server to local storage
   * Requirements: 5.1
   */
  async syncProductsFromServer(tenantId: string): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      conflicts: []
    }

    if (!this.isOnline()) {
      result.success = false
      return result
    }

    try {
      // Fetch all products from server
      const { data: serverProducts, error } = await this.supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)

      if (error) {
        throw new Error(`Failed to fetch products: ${error.message}`)
      }

      // Get local products
      const localProducts = await getLocalProductsByTenant(tenantId)
      const localProductMap = new Map(localProducts.map(p => [p.serverId || p.id, p]))

      // Process each server product
      for (const serverProduct of serverProducts || []) {
        const localProduct = localProductMap.get(serverProduct.id)
        
        if (localProduct) {
          // Check for conflicts
          const conflict = await this.resolveProductConflict(localProduct, serverProduct)
          if (conflict) {
            result.conflicts.push(conflict)
          }
        } else {
          // New product from server
          const newLocalProduct = productToLocal(serverProduct as Product, tenantId)
          await saveLocalProduct(newLocalProduct)
        }
        
        result.syncedCount++
      }
    } catch (error) {
      result.success = false
      console.error('Error syncing products:', error)
    }

    return result
  }

  /**
   * Resolve conflict between local and remote product
   * Requirements: 5.4
   * 
   * Property 11: Conflict Resolution Last-Write-Wins
   * The record with the more recent updated_at timestamp SHALL be preserved
   */
  private async resolveProductConflict(
    local: LocalProduct,
    remote: Product
  ): Promise<ConflictLog | null> {
    const remoteUpdatedAt = new Date(remote.updated_at).getTime()
    
    // If local is not synced and has changes, we have a conflict
    if (!local.isSynced && local.updatedAt !== remoteUpdatedAt) {
      const resolution = this.resolveConflict(
        { updatedAt: local.updatedAt },
        { updatedAt: remoteUpdatedAt }
      )

      const conflict: ConflictLog = {
        id: generateLocalId(),
        entityType: 'product',
        entityId: local.id,
        localData: JSON.stringify(local),
        remoteData: JSON.stringify(remote),
        resolution: resolution === 'local' ? 'local' : 'remote',
        resolvedAt: Date.now()
      }

      await saveConflictLog(conflict)

      // Apply resolution
      if (resolution === 'remote') {
        // Remote wins - update local with remote data
        const updatedLocal = productToLocal(remote, local.tenantId)
        await saveLocalProduct(updatedLocal)
      }
      // If local wins, we would push to server (not implemented for products in this version)

      return conflict
    }

    // No conflict - just update local with remote data
    const updatedLocal = productToLocal(remote, local.tenantId)
    await saveLocalProduct(updatedLocal)
    
    return null
  }

  /**
   * Resolve conflict using last-write-wins strategy
   * Requirements: 5.4
   * 
   * Property 11: Conflict Resolution Last-Write-Wins
   * The record with the more recent updated_at timestamp SHALL be preserved
   */
  resolveConflict(
    localData: { updatedAt: number },
    remoteData: { updatedAt: number }
  ): 'local' | 'remote' {
    // Last write wins - compare timestamps
    return localData.updatedAt > remoteData.updatedAt ? 'local' : 'remote'
  }

  /**
   * Get all local products for a tenant
   */
  async getLocalProducts(tenantId: string): Promise<LocalProduct[]> {
    return getLocalProductsByTenant(tenantId)
  }

  /**
   * Get a local product by ID
   */
  async getLocalProduct(id: string): Promise<LocalProduct | null> {
    return getLocalProduct(id)
  }
}

/**
 * Creates a SyncService instance
 */
export function createSyncService(supabase: SupabaseClient): SyncService {
  return new SyncService(supabase)
}
