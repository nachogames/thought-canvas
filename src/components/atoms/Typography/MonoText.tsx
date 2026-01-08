import type { ReactNode } from 'react'

type MonoVariant = 'primary' | 'secondary' | 'muted'

interface MonoTextProps {
  children: ReactNode
  variant?: MonoVariant
  className?: string
}

const variantClasses: Record<MonoVariant, string> = {
  primary: 'text-foreground',
  secondary: 'text-secondary',
  muted: 'text-muted'
}

export function MonoText({ children, variant = 'primary', className = '' }: MonoTextProps) {
  return (
    <span className={`font-mono text-xs tabular-nums ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  )
}
