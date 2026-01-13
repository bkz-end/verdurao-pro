'use client'

import { useCallback, useState, createElement } from 'react'
import { haptics, HapticType } from '@/lib/utils/haptics'

/**
 * Visual feedback state
 */
export interface VisualFeedbackState {
  isPressed: boolean
  isSuccess: boolean
  isError: boolean
}

/**
 * Feedback options
 */
export interface FeedbackOptions {
  haptic?: HapticType | false
  visual?: boolean
  duration?: number
}

/**
 * Toast feedback options
 */
export interface ToastFeedbackOptions {
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration?: number
}

/**
 * Toast state
 */
interface ToastState {
  visible: boolean
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
}

/**
 * useFeedback Hook
 * Requirements: 12.3, 12.4
 * 
 * Provides combined haptic and visual feedback for touch interactions.
 * 
 * Features:
 * - Haptic feedback on touch
 * - Visual state management for pressed/success/error states
 * - Toast notifications for user feedback
 * - Configurable feedback types
 */
export function useFeedback() {
  const [visualState, setVisualState] = useState<VisualFeedbackState>({
    isPressed: false,
    isSuccess: false,
    isError: false
  })

  const [toast, setToast] = useState<ToastState>({
    visible: false,
    type: 'info',
    message: ''
  })

  /**
   * Show a toast notification with haptic feedback
   * Requirements: 12.3, 12.4
   */
  const showFeedback = useCallback((options: ToastFeedbackOptions) => {
    const { type, message, duration = 3000 } = options

    // Trigger appropriate haptic feedback
    if (type === 'success') {
      haptics.success()
    } else if (type === 'error') {
      haptics.error()
    } else if (type === 'warning') {
      haptics.warning()
    } else {
      haptics.tap()
    }

    // Show toast
    setToast({ visible: true, type, message })

    // Auto-hide after duration
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }))
    }, duration)
  }, [])

  /**
   * Hide the toast notification
   */
  const hideFeedback = useCallback(() => {
    setToast(prev => ({ ...prev, visible: false }))
  }, [])

  /**
   * Trigger feedback for a tap/press action
   */
  const triggerTap = useCallback((options: FeedbackOptions = {}) => {
    const { haptic = 'light', visual = true, duration = 100 } = options

    // Haptic feedback
    if (haptic !== false) {
      haptics.tap()
    }

    // Visual feedback
    if (visual) {
      setVisualState(prev => ({ ...prev, isPressed: true }))
      setTimeout(() => {
        setVisualState(prev => ({ ...prev, isPressed: false }))
      }, duration)
    }
  }, [])

  /**
   * Trigger feedback for a selection action
   */
  const triggerSelect = useCallback((options: FeedbackOptions = {}) => {
    const { haptic = 'medium', visual = true, duration = 150 } = options

    if (haptic !== false) {
      haptics.select()
    }

    if (visual) {
      setVisualState(prev => ({ ...prev, isPressed: true }))
      setTimeout(() => {
        setVisualState(prev => ({ ...prev, isPressed: false }))
      }, duration)
    }
  }, [])

  /**
   * Trigger feedback for a success action
   */
  const triggerSuccess = useCallback((options: FeedbackOptions = {}) => {
    const { haptic = 'success', visual = true, duration = 500 } = options

    if (haptic !== false) {
      haptics.success()
    }

    if (visual) {
      setVisualState(prev => ({ ...prev, isSuccess: true }))
      setTimeout(() => {
        setVisualState(prev => ({ ...prev, isSuccess: false }))
      }, duration)
    }
  }, [])

  /**
   * Trigger feedback for an error action
   */
  const triggerError = useCallback((options: FeedbackOptions = {}) => {
    const { haptic = 'error', visual = true, duration = 500 } = options

    if (haptic !== false) {
      haptics.error()
    }

    if (visual) {
      setVisualState(prev => ({ ...prev, isError: true }))
      setTimeout(() => {
        setVisualState(prev => ({ ...prev, isError: false }))
      }, duration)
    }
  }, [])

  /**
   * Reset all visual states
   */
  const resetVisual = useCallback(() => {
    setVisualState({
      isPressed: false,
      isSuccess: false,
      isError: false
    })
  }, [])

  /**
   * FeedbackComponent - Toast notification component
   * Requirements: 12.4
   */
  const FeedbackComponent = useCallback(() => {
    if (!toast.visible) return null

    const bgColor = {
      success: 'bg-green-500',
      error: 'bg-red-500',
      warning: 'bg-yellow-500',
      info: 'bg-blue-500'
    }[toast.type]

    const icon = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    }[toast.type]

    return createElement(
      'div',
      {
        className: `fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-slide-down`,
        role: 'alert',
        'aria-live': 'polite'
      },
      createElement(
        'div',
        {
          className: `${bgColor} text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 min-w-[200px] max-w-[90vw]`
        },
        createElement('span', { className: 'text-xl' }, icon),
        createElement('span', { className: 'font-medium' }, toast.message),
        createElement(
          'button',
          {
            type: 'button',
            onClick: hideFeedback,
            className: 'ml-auto p-1 hover:bg-white/20 rounded transition-colors',
            'aria-label': 'Fechar notificação'
          },
          '×'
        )
      )
    )
  }, [toast, hideFeedback])

  return {
    visualState,
    triggerTap,
    triggerSelect,
    triggerSuccess,
    triggerError,
    resetVisual,
    showFeedback,
    hideFeedback,
    FeedbackComponent
  }
}

/**
 * useButtonFeedback Hook
 * Requirements: 12.3, 12.4
 * 
 * Simplified hook for button feedback with press handlers.
 */
export function useButtonFeedback(onAction?: () => void) {
  const [isPressed, setIsPressed] = useState(false)

  const handlePressStart = useCallback(() => {
    setIsPressed(true)
    haptics.tap()
  }, [])

  const handlePressEnd = useCallback(() => {
    setIsPressed(false)
  }, [])

  const handleClick = useCallback(() => {
    haptics.select()
    onAction?.()
  }, [onAction])

  return {
    isPressed,
    handlers: {
      onMouseDown: handlePressStart,
      onMouseUp: handlePressEnd,
      onMouseLeave: handlePressEnd,
      onTouchStart: handlePressStart,
      onTouchEnd: handlePressEnd,
      onClick: handleClick
    }
  }
}
