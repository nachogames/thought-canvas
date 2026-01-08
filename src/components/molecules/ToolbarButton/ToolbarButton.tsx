import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Icon } from '@/components/atoms/Icon'

interface ToolbarButtonProps {
  icon?: LucideIcon
  children: ReactNode
  active?: boolean
  onClick: () => void
}

export function ToolbarButton({
  icon,
  children,
  active = false,
  onClick
}: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-2 px-4 py-3 rounded-xl
        text-sm font-medium cursor-pointer
        border transition-colors duration-150
        ${active
          ? 'bg-accent-muted text-accent-light border-accent/30'
          : 'bg-faint text-secondary border-border hover:text-foreground hover:bg-border'
        }
      `}
    >
      {icon && <Icon icon={icon} size={17} />}
      {children}
    </button>
  )
}
