import type { ReactNode } from 'react'

type TextVariant = 'primary' | 'secondary' | 'muted' | 'faint'
type TextSize = 'xs' | 'sm' | 'base' | 'lg'

interface TextProps {
  children: ReactNode
  variant?: TextVariant
  size?: TextSize
  className?: string
  as?: 'span' | 'p' | 'div'
  strikethrough?: boolean
}

const variantClasses: Record<TextVariant, string> = {
  primary: 'text-foreground',
  secondary: 'text-secondary',
  muted: 'text-muted',
  faint: 'text-faint'
}

const sizeClasses: Record<TextSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg'
}

export function Text({
  children,
  variant = 'primary',
  size = 'base',
  className = '',
  as: Component = 'span',
  strikethrough = false
}: TextProps) {
  const classes = [
    variantClasses[variant],
    sizeClasses[size],
    strikethrough && 'line-through',
    className
  ].filter(Boolean).join(' ')

  return <Component className={classes}>{children}</Component>
}
