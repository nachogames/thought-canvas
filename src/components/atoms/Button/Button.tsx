import type { ReactNode, ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent-subtle text-accent-light border border-accent/25 hover:bg-accent-muted',
  secondary: 'bg-faint text-secondary border border-border hover:bg-border hover:text-foreground',
  ghost: 'bg-transparent text-secondary hover:bg-faint hover:text-foreground',
  danger: 'bg-red-500/15 text-red-500 border border-red-500/25 hover:bg-red-500/25'
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-xs rounded-md',
  md: 'px-4 py-2.5 text-sm rounded-lg',
  lg: 'px-5 py-3 text-base rounded-xl'
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  const classes = [
    'inline-flex items-center justify-center gap-2',
    'font-medium cursor-pointer',
    'transition-colors duration-150',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    variantClasses[variant],
    sizeClasses[size],
    className
  ].filter(Boolean).join(' ')

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  )
}
