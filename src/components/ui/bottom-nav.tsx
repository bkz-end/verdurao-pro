'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icons } from './icons'

interface NavItem {
  href: string
  icon: keyof typeof Icons
  label: string
}

const navItems: NavItem[] = [
  { href: '/dashboard', icon: 'home', label: 'Início' },
  { href: '/pdv/historico', icon: 'transactions', label: 'Vendas' },
  { href: '/estoque', icon: 'stock', label: 'Produtos' },
  { href: '/relatorios', icon: 'reports', label: 'Relatórios' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 safe-area-bottom z-40">
      <div className="max-w-lg mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = Icons[item.icon]
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-2 px-4 min-w-[64px] transition-colors
                ${isActive 
                  ? 'text-emerald-600' 
                  : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2]' : ''}`} />
              <span className={`text-xs mt-1 ${isActive ? 'font-medium' : ''}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
