'use client'

import { ReactNode } from 'react'
import { Icons } from './icons'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: {
    value: number
    label: string
  }
  icon?: keyof typeof Icons
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
}

export function StatCard({ 
  title, 
  value, 
  subtitle, 
  trend, 
  icon,
  variant = 'default' 
}: StatCardProps) {
  const variants = {
    default: {
      bg: 'bg-white',
      border: 'border-slate-100',
      title: 'text-slate-500',
      value: 'text-slate-900',
      icon: 'text-slate-400 bg-slate-100'
    },
    primary: {
      bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
      border: 'border-emerald-400',
      title: 'text-emerald-100',
      value: 'text-white',
      icon: 'text-emerald-100 bg-emerald-400/30'
    },
    success: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      title: 'text-emerald-600',
      value: 'text-emerald-700',
      icon: 'text-emerald-500 bg-emerald-100'
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      title: 'text-amber-600',
      value: 'text-amber-700',
      icon: 'text-amber-500 bg-amber-100'
    },
    danger: {
      bg: 'bg-red-50',
      border: 'border-red-100',
      title: 'text-red-600',
      value: 'text-red-700',
      icon: 'text-red-500 bg-red-100'
    }
  }

  const styles = variants[variant]
  const Icon = icon ? Icons[icon] : null

  return (
    <div className={`${styles.bg} rounded-2xl border ${styles.border} p-5 shadow-sm`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`text-sm font-medium ${styles.title}`}>{title}</p>
          <p className={`text-3xl font-bold tracking-tight mt-1 ${styles.value}`}>
            {value}
          </p>
          {subtitle && (
            <p className={`text-sm mt-1 ${styles.title}`}>{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.value >= 0 ? (
                <Icons.arrowUp className={`w-4 h-4 ${trend.value >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
              ) : (
                <Icons.arrowDown className={`w-4 h-4 text-red-500`} />
              )}
              <span className={`text-sm font-medium ${trend.value >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {trend.value >= 0 ? '+' : ''}{trend.value}%
              </span>
              <span className={`text-sm ${styles.title}`}>{trend.label}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${styles.icon}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  )
}
