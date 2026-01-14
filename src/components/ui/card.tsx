import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  hover?: boolean
}

export function Card({ children, className = '', onClick, hover = false }: CardProps) {
  const baseStyles = 'bg-white rounded-2xl border border-slate-100'
  const hoverStyles = hover ? 'hover:shadow-md hover:border-slate-200 cursor-pointer' : ''
  const shadowStyles = 'shadow-sm'
  const transitionStyles = 'transition-all duration-200'
  
  return (
    <div 
      className={`${baseStyles} ${shadowStyles} ${hoverStyles} ${transitionStyles} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`px-5 py-4 border-b border-slate-100 ${className}`}>
      {children}
    </div>
  )
}

export function CardContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`px-5 py-4 ${className}`}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`px-5 py-4 border-t border-slate-100 ${className}`}>
      {children}
    </div>
  )
}
