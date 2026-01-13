'use client'

import { haptics } from '@/lib/utils/haptics'

/**
 * PeriodSelector - Component for selecting report period
 * Requirements: 7.4
 */
export type ReportPeriod = 'today' | 'week' | 'month' | 'custom'

export interface PeriodSelectorProps {
  value: ReportPeriod
  onChange: (period: ReportPeriod) => void
}

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
]

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const handleSelect = (period: ReportPeriod) => {
    haptics.tap()
    onChange(period)
  }

  return (
    <div className="flex gap-2">
      {PERIOD_OPTIONS.map((option) => {
        const isSelected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleSelect(option.value)}
            className={`
              flex-1 h-11 rounded-lg font-medium transition-colors
              ${isSelected
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Helper function to get date range for a period
 */
export function getDateRangeForPeriod(period: ReportPeriod): { startDate: Date; endDate: Date } {
  const now = new Date()
  const endDate = new Date(now)
  endDate.setHours(23, 59, 59, 999)

  let startDate: Date

  switch (period) {
    case 'today':
      startDate = new Date(now)
      startDate.setHours(0, 0, 0, 0)
      break
    case 'week':
      startDate = new Date(now)
      startDate.setDate(now.getDate() - 7)
      startDate.setHours(0, 0, 0, 0)
      break
    case 'month':
      startDate = new Date(now)
      startDate.setMonth(now.getMonth() - 1)
      startDate.setHours(0, 0, 0, 0)
      break
    default:
      startDate = new Date(now)
      startDate.setHours(0, 0, 0, 0)
  }

  return { startDate, endDate }
}
