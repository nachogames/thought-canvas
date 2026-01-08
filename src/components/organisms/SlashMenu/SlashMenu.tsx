import { SLASH_COMMANDS } from '@/constants'
import { SlashMenuItem } from '@/components/molecules/SlashMenuItem'
import type { SlashCommand, SlashMenuPosition } from '@/types'

interface SlashMenuProps {
  position: SlashMenuPosition
  filter: string
  selectedIndex: number
  onSelect: (command: SlashCommand) => void
}

export function SlashMenu({ position, filter, selectedIndex, onSelect }: SlashMenuProps) {
  const filtered = SLASH_COMMANDS.filter(cmd =>
    cmd.id.includes(filter.toLowerCase()) ||
    cmd.label.toLowerCase().includes(filter.toLowerCase())
  )

  if (filtered.length === 0) return null

  return (
    <div
      className="
        absolute z-[1000]
        border border-border
        rounded-xl p-1.5 min-w-[220px]
        shadow-lg shadow-black/20
      "
      style={{
        left: position.x,
        top: position.y,
        backgroundColor: 'var(--color-bg-elevated)'
      }}
    >
      {filtered.map((cmd, i) => (
        <SlashMenuItem
          key={cmd.id}
          icon={cmd.icon}
          label={cmd.label}
          shortcut={cmd.shortcut}
          selected={i === selectedIndex}
          onClick={() => onSelect(cmd)}
        />
      ))}
    </div>
  )
}
