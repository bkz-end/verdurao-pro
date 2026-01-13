/**
 * Haptic Feedback Utilities
 * Requirements: 12.3
 * 
 * Provides haptic (vibration) feedback for mobile devices.
 * Uses the Vibration API when available.
 */

/**
 * Types of haptic feedback
 */
export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'

/**
 * Vibration patterns for different feedback types (in milliseconds)
 */
const HAPTIC_PATTERNS: Record<HapticType, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 50, 10],
  warning: [25, 50, 25],
  error: [50, 100, 50, 100, 50]
}

/**
 * Check if haptic feedback is supported
 */
export function isHapticSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator
}

/**
 * Trigger haptic feedback
 * Requirements: 12.3
 * 
 * @param type - Type of haptic feedback
 * @returns true if haptic was triggered, false otherwise
 */
export function triggerHaptic(type: HapticType = 'light'): boolean {
  if (!isHapticSupported()) {
    return false
  }

  try {
    const pattern = HAPTIC_PATTERNS[type]
    navigator.vibrate(pattern)
    return true
  } catch {
    return false
  }
}

/**
 * Cancel any ongoing haptic feedback
 */
export function cancelHaptic(): void {
  if (isHapticSupported()) {
    navigator.vibrate(0)
  }
}

/**
 * Haptic feedback for common actions
 */
export const haptics = {
  /**
   * Light tap feedback - for button presses
   */
  tap: () => triggerHaptic('light'),

  /**
   * Medium feedback - for selections
   */
  select: () => triggerHaptic('medium'),

  /**
   * Heavy feedback - for important actions
   */
  impact: () => triggerHaptic('heavy'),

  /**
   * Success feedback - for completed actions
   */
  success: () => triggerHaptic('success'),

  /**
   * Warning feedback - for warnings
   */
  warning: () => triggerHaptic('warning'),

  /**
   * Error feedback - for errors
   */
  error: () => triggerHaptic('error')
}
