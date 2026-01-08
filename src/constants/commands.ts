import { Square, Circle, RefreshCw } from 'lucide-react'
import type { SlashCommand } from '@/types'

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'todo',
    label: 'Todo',
    icon: Square,
    insert: '- [ ] ',
    shortcut: 'Cmd+Enter'
  },
  {
    id: 'bullet',
    label: 'Bullet point',
    icon: Circle,
    insert: '- '
  },
  {
    id: 'turn',
    label: 'Turn bullets to todos',
    icon: RefreshCw,
    action: 'convert'
  },
]
