import type { LucideIcon } from 'lucide-react'

export interface SlashCommand {
  id: string
  label: string
  icon: LucideIcon
  insert?: string
  action?: 'convert'
  shortcut?: string
}

export interface SlashMenuPosition {
  x: number
  y: number
}
