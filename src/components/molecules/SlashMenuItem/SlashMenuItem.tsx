import type { LucideIcon } from 'lucide-react'
import { Icon } from '@/components/atoms/Icon'
import { Text, MonoText } from '@/components/atoms/Typography'

interface SlashMenuItemProps {
  icon: LucideIcon
  label: string
  shortcut?: string
  selected?: boolean
  onClick: () => void
}

export function SlashMenuItem({
  icon,
  label,
  shortcut,
  selected = false,
  onClick
}: SlashMenuItemProps) {
  return (
    <div
      onClick={onClick}
      className={`
        flex items-center px-3 py-2.5 rounded-lg cursor-pointer
        transition-colors duration-100
        ${selected ? 'bg-accent-muted' : 'hover:bg-accent-muted'}
      `}
    >
      <span className="w-7">
        <Icon icon={icon} size={15} className="text-secondary" />
      </span>
      <Text variant="primary" size="base" className="flex-1">
        {label}
      </Text>
      {shortcut && (
        <MonoText variant="muted">
          {shortcut}
        </MonoText>
      )}
    </div>
  )
}
