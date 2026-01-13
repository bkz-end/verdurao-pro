/**
 * Offline Database Manager
 * Requirements: 5.1
 * 
 * Manages IndexedDB for offline storage.
 * Provides a WatermelonDB-like API for browser compatibility.
 */

import {
  DB_NAME,
  DB_VERSION,
  STORE_NAMES,
  LocalProduct,
  PendingSale,
  ConflictLog
} from './schema'

/**
 * Opens and initializes the IndexedDB database
 */
export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Check if IndexedDB is available
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error(`Failed to open database: ${request.error?.message}`))
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Create products store
      if (!db.objectStoreNames.contains(STORE_NAMES.PRODUCTS)) {
        const productsStore = db.createObjectStore(STORE_NAMES.PRODUCTS, { keyPath: 'id' })
        productsStore.createIndex('tenantId', 'tenantId', { unique: false })
        productsStore.createIndex('serverId', 'serverId', { unique: false })
        productsStore.createIndex('isSynced', 'isSynced', { unique: false })
        productsStore.createIndex('sku', ['tenantId', 'sku'], { unique: true })
      }

      // Create pending_sales store
      if (!db.objectStoreNames.contains(STORE_NAMES.PENDING_SALES)) {
        const salesStore = db.createObjectStore(STORE_NAMES.PENDING_SALES, { keyPath: 'id' })
        salesStore.createIndex('tenantId', 'tenantId', { unique: false })
        salesStore.createIndex('isSynced', 'isSynced', { unique: false })
        salesStore.createIndex('createdAt', 'createdAt', { unique: false })
      }

      // Create conflict_logs store
      if (!db.objectStoreNames.contains(STORE_NAMES.CONFLICT_LOGS)) {
        const conflictsStore = db.createObjectStore(STORE_NAMES.CONFLICT_LOGS, { keyPath: 'id' })
        conflictsStore.createIndex('entityType', 'entityType', { unique: false })
        conflictsStore.createIndex('resolvedAt', 'resolvedAt', { unique: false })
      }
    }
  })
}

/**
 * Generic function to add or update a record
 */
async function putRecord<T>(storeName: string, record: T): Promise<T> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.put(record)

    request.onsuccess = () => resolve(record)
    request.onerror = () => reject(new Error(`Failed to put record: ${request.error?.message}`))
    
    transaction.oncomplete = () => db.close()
  })
}

/**
 * Generic function to get a record by key
 */
async function getRecord<T>(storeName: string, key: string): Promise<T | null> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.get(key)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(new Error(`Failed to get record: ${request.error?.message}`))
    
    transaction.oncomplete = () => db.close()
  })
}

/**
 * Generic function to get all records from a store
 */
async function getAllRecords<T>(storeName: string): Promise<T[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(new Error(`Failed to get all records: ${request.error?.message}`))
    
    transaction.oncomplete = () => db.close()
  })
}

/**
 * Generic function to get records by index
 */
async function getByIndex<T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const index = store.index(indexName)
    const request = index.getAll(value)

    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(new Error(`Failed to get by index: ${request.error?.message}`))
    
    transaction.oncomplete = () => db.close()
  })
}

/**
 * Generic function to delete a record
 */
async function deleteRecord(storeName: string, key: string): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.delete(key)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error(`Failed to delete record: ${request.error?.message}`))
    
    transaction.oncomplete = () => db.close()
  })
}

/**
 * Clear all records from a store
 */
async function clearStore(storeName: string): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.clear()

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error(`Failed to clear store: ${request.error?.message}`))
    
    transaction.oncomplete = () => db.close()
  })
}


// ============================================
// Product Operations
// ============================================

/**
 * Save a product to local storage
 */
export async function saveLocalProduct(product: LocalProduct): Promise<LocalProduct> {
  return putRecord<LocalProduct>(STORE_NAMES.PRODUCTS, product)
}

/**
 * Get a product by ID
 */
export async function getLocalProduct(id: string): Promise<LocalProduct | null> {
  return getRecord<LocalProduct>(STORE_NAMES.PRODUCTS, id)
}

/**
 * Get all products for a tenant
 */
export async function getLocalProductsByTenant(tenantId: string): Promise<LocalProduct[]> {
  return getByIndex<LocalProduct>(STORE_NAMES.PRODUCTS, 'tenantId', tenantId)
}

/**
 * Get all unsynced products
 */
export async function getUnsyncedProducts(): Promise<LocalProduct[]> {
  return getByIndex<LocalProduct>(STORE_NAMES.PRODUCTS, 'isSynced', 0)
}

/**
 * Delete a local product
 */
export async function deleteLocalProduct(id: string): Promise<void> {
  return deleteRecord(STORE_NAMES.PRODUCTS, id)
}

/**
 * Clear all local products
 */
export async function clearLocalProducts(): Promise<void> {
  return clearStore(STORE_NAMES.PRODUCTS)
}

// ============================================
// Pending Sales Operations
// ============================================

/**
 * Save a pending sale to local storage
 * Requirements: 4.7, 5.1
 */
export async function savePendingSale(sale: PendingSale): Promise<PendingSale> {
  return putRecord<PendingSale>(STORE_NAMES.PENDING_SALES, sale)
}

/**
 * Get a pending sale by ID
 */
export async function getPendingSale(id: string): Promise<PendingSale | null> {
  return getRecord<PendingSale>(STORE_NAMES.PENDING_SALES, id)
}

/**
 * Get all pending sales for a tenant
 */
export async function getPendingSalesByTenant(tenantId: string): Promise<PendingSale[]> {
  return getByIndex<PendingSale>(STORE_NAMES.PENDING_SALES, 'tenantId', tenantId)
}

/**
 * Get all unsynced pending sales
 * Requirements: 5.2
 */
export async function getUnsyncedSales(): Promise<PendingSale[]> {
  return getByIndex<PendingSale>(STORE_NAMES.PENDING_SALES, 'isSynced', 0)
}

/**
 * Get count of unsynced sales for a tenant
 */
export async function getUnsyncedSalesCount(tenantId: string): Promise<number> {
  const sales = await getPendingSalesByTenant(tenantId)
  return sales.filter(s => !s.isSynced).length
}

/**
 * Delete a pending sale
 */
export async function deletePendingSale(id: string): Promise<void> {
  return deleteRecord(STORE_NAMES.PENDING_SALES, id)
}

/**
 * Clear all pending sales
 */
export async function clearPendingSales(): Promise<void> {
  return clearStore(STORE_NAMES.PENDING_SALES)
}

// ============================================
// Conflict Log Operations
// ============================================

/**
 * Save a conflict log entry
 * Requirements: 5.4
 */
export async function saveConflictLog(conflict: ConflictLog): Promise<ConflictLog> {
  return putRecord<ConflictLog>(STORE_NAMES.CONFLICT_LOGS, conflict)
}

/**
 * Get all conflict logs
 */
export async function getAllConflictLogs(): Promise<ConflictLog[]> {
  return getAllRecords<ConflictLog>(STORE_NAMES.CONFLICT_LOGS)
}

/**
 * Clear all conflict logs
 */
export async function clearConflictLogs(): Promise<void> {
  return clearStore(STORE_NAMES.CONFLICT_LOGS)
}
