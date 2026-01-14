'use client'

import Link from 'next/link'
import { Icons, IconName } from './icons'

interface ActionCardProps {
  href: string
  icon: IconName
  title: string
  description?: string
  badge?: string
  badgeVariant?: 'default' | 'warning' | 'danger'
}

export function ActionCard({ 
  href, 
  icon, 
  title, 
  description,
  badge,
  badgeVariant = 'default'
}: ActionCardProps) {
  const Icon = Icons[icon]
  
  const badgeStyles = {
    default: 'bg-slate-100 text-slate-600',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700'
  }

  return (
    <Link
      href={href}
      className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm
                 hover:shadow-md hover:border-slate-200 
                 active:scale-[0.98] transition-all duration-200
                 flex flex-col items-center text-center"
    >
      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
        <Icon className="w-7 h-7 text-slate-600" />
      </div>
      <p className="font-semibold text-slate-800">{title}</p>
      {description && (
        <p className="text-sm text-slate-500 mt-0.5">{description}</p>
      )}
      {badge && (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-2 ${badgeStyles[badgeVariant]}`}>
          {badge}
        </span>
      )}
    </Link>
  )
}

export function ActionCardLarge({ 
  href, 
  icon, 
  title, 
  description 
}: ActionCardProps) {
  const Icon = Icons[icon]

  return (
    <Link
      href={href}
      className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 shadow-lg
                 hover:shadow-xl hover:from-emerald-600 hover:to-emerald-700
                 active:scale-[0.98] transition-all duration-200
                 flex items-center gap-4 text-white"
    >
      <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
        <Icon className="w-7 h-7 text-white" />
      </div>
      <div>
        <p className="font-bold text-lg">{title}</p>
        {description && (
          <p className="text-emerald-100 text-sm">{description}</p>
        )}
      </div>
      <Icons.chevronRight className="w-6 h-6 ml-auto text-emerald-200" />
    </Link>
  )
}
