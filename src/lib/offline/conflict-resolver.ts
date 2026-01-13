/**
 * Conflict Resolution Module
 * Requirements: 5.4
 * 
 * Implements last-write-wins conflict resolution strategy
 * with detailed logging for audit purposes.
 */

import { ConflictLog } from './schema'
import { saveConflictLog, getAllConflictLogs } from './database'

/**
 * Generates a unique ID for conflict logs
 */
function generateConflictId(): string {
  return `conflict_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Entity with timestamp for conflict resolution
 */
export interface TimestampedEntity {
  updatedAt: number
}

/**
 * Conflict resolution result
 */
export interface ConflictResolutionResult {
  winner: 'local' | 'remote'
  conflict: ConflictLog
}

/**
 * Resolves a conflict between local and remote data using last-write-wins
 * Requirements: 5.4
 * 
 * Property 11: Conflict Resolution Last-Write-Wins
 * The record with the more recent updated_at timestamp SHALL be preserved
 * 
 * @param entityType - Type of entity (product, sale, etc.)
 * @param entityId - ID of the entity
 * @param localData - Local version of the data
 * @param remoteData - Remote version of the data
 * @param localTimestamp - Local update timestamp
 * @param remoteTimestamp - Remote update timestamp
 * @returns Resolution result with winner and conflict log
 */
export async function resolveConflict<T>(
  entityType: 'product' | 'sale',
  entityId: string,
  localData: T,
  remoteData: T,
  localTimestamp: number,
  remoteTimestamp: number
): Promise<ConflictResolutionResult> {
  // Last write wins - compare timestamps
  const winner: 'local' | 'remote' = localTimestamp > remoteTimestamp ? 'local' : 'remote'

  // Create conflict log entry
  const conflict: ConflictLog = {
    id: generateConflictId(),
    entityType,
    entityId,
    localData: JSON.stringify(localData),
    remoteData: JSON.stringify(remoteData),
    resolution: winner,
    resolvedAt: Date.now()
  }

  // Save conflict log for audit
  await saveConflictLog(conflict)

  return { winner, conflict }
}

/**
 * Determines the winner without logging (for testing/preview)
 * Requirements: 5.4
 * 
 * Property 11: Conflict Resolution Last-Write-Wins
 * The record with the more recent updated_at timestamp SHALL be preserved
 */
export function determineWinner(
  localTimestamp: number,
  remoteTimestamp: number
): 'local' | 'remote' {
  return localTimestamp > remoteTimestamp ? 'local' : 'remote'
}

/**
 * Get all conflict logs for review
 */
export async function getConflictHistory(): Promise<ConflictLog[]> {
  return getAllConflictLogs()
}

/**
 * Parse conflict log data back to original type
 */
export function parseConflictData<T>(jsonString: string): T {
  return JSON.parse(jsonString) as T
}

/**
 * Conflict statistics
 */
export interface ConflictStats {
  total: number
  byEntityType: Record<string, number>
  byResolution: {
    local: number
    remote: number
  }
  recentConflicts: ConflictLog[]
}

/**
 * Get conflict statistics
 */
export async function getConflictStats(): Promise<ConflictStats> {
  const conflicts = await getAllConflictLogs()
  
  const stats: ConflictStats = {
    total: conflicts.length,
    byEntityType: {},
    byResolution: {
      local: 0,
      remote: 0
    },
    recentConflicts: conflicts.slice(-10) // Last 10 conflicts
  }

  for (const conflict of conflicts) {
    // Count by entity type
    stats.byEntityType[conflict.entityType] = 
      (stats.byEntityType[conflict.entityType] || 0) + 1
    
    // Count by resolution
    stats.byResolution[conflict.resolution]++
  }

  return stats
}
