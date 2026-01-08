import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Icon } from '../Icon'

type IconButtonVariant = 'ghost' | 'subtle' | 'danger'
type IconButtonSize = 'sm' | 'md' | 'lg'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  variant?: IconButtonVariant
  size?: IconButtonSize
  label: string // For accessibility
}

const variantClasses: Record<IconButtonVariant, string> = {
  ghost: 'text-secondary hover:text-foreground hover:bg-faint',
  subtle: 'text-muted hover:text-secondary hover:bg-faint',
  danger: 'text-red-500 bg-red-500/10 hover:bg-red-500/20'
}

const sizeClasses: Record<IconButtonSize, string> = {
  sm: 'w-6 h-6 rounded-md',
  md: 'w-8 h-8 rounded-lg',
  lg: 'w-10 h-10 rounded-xl'
}

const iconSizes: Record<IconButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 18
}

export function IconButton({
  icon,
  variant = 'ghost',
  size = 'md',
  label,
  className = '',
  ...props
}: IconButtonProps) {
  const classes = [
    'inline-flex items-center justify-center',
    'cursor-pointer transition-colors duration-150',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    variantClasses[variant],
    sizeClasses[size],
    className
  ].filter(Boolean).join(' ')

  return (
    <button className={classes} aria-label={label} {...props}>
      <Icon icon={icon} size={iconSizes[size]} />
    </button>
  )
}
