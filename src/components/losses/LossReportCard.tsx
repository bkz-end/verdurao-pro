'use client'

import { LossReason } from '@/types'

/**
 * LossReportCard - Card displaying loss statistics by reason
 * Requirements: 7.4
 */
export interface LossReportCardProps {
  reason: LossReason
  totalQuantity: number
  count: number
}

const REASON_CONFIG: Record<LossReason, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  expiration: {
    label: 'Vencimento',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  damage: {
    label: 'Dano',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )
  },
  theft: {
    label: 'Furto',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    )
  },
  other: {
    label: 'Outro',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
}

export function LossReportCard({ reason, totalQuantity, count }: LossReportCardProps) {
  const config = REASON_CONFIG[reason]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 ${config.bgColor} rounded-lg flex items-center justify-center ${config.color}`}>
          {config.icon}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-800">{config.label}</h3>
          <p className="text-sm text-gray-500">{count} registro{count !== 1 ? 's' : ''}</p>
        </div>
        <div className="text-right">
          <p className={`text-xl font-bold ${config.color}`}>
            {totalQuantity.toFixed(2)}
          </p>
          <p className="text-sm text-gray-500">unidades</p>
        </div>
      </div>
    </div>
  )
}
