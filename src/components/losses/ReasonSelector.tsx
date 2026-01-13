'use client'

import { LossReason } from '@/types'
import { haptics } from '@/lib/utils/haptics'

/**
 * ReasonSelector - Component for selecting loss reason
 * Requirements: 7.1, 7.3
 * 
 * Features:
 * - Visual selection of loss reasons
 * - Large touch targets (56px min)
 * - Haptic feedback on selection
 * - Icons for each reason type
 */
export interface ReasonSelectorProps {
  value: LossReason | null
  onChange: (reason: LossReason) => void
}

interface ReasonOption {
  value: LossReason
  label: string
  icon: React.ReactNode
  color: string
}

const REASON_OPTIONS: ReasonOption[] = [
  {
    value: 'expiration',
    label: 'Vencimento',
    color: 'bg-orange-100 text-orange-700 border-orange-300',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    value: 'damage',
    label: 'Dano',
    color: 'bg-red-100 text-red-700 border-red-300',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )
  },
  {
    value: 'theft',
    label: 'Furto',
    color: 'bg-purple-100 text-purple-700 border-purple-300',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    )
  },
  {
    value: 'other',
    label: 'Outro',
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
]

export function ReasonSelector({ value, onChange }: ReasonSelectorProps) {
  const handleSelect = (reason: LossReason) => {
    haptics.tap()
    onChange(reason)
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Motivo da perda
      </label>
      <div className="grid grid-cols-2 gap-3">
        {REASON_OPTIONS.map((option) => {
          const isSelected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`
                h-14 flex items-center justify-center gap-2 rounded-xl border-2
                font-medium transition-all
                ${isSelected 
                  ? `${option.color} border-current` 
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }
              `}
              aria-pressed={isSelected}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
