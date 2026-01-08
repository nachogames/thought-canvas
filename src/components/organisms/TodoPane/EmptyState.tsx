import { Square } from 'lucide-react'
import { Icon } from '@/components/atoms/Icon'
import { Text } from '@/components/atoms/Typography'

export function EmptyState() {
  return (
    <div className="text-center mt-12">
      <Icon icon={Square} size={28} className="text-muted mx-auto mb-3" />
      <Text variant="muted" size="lg" as="p" className="mb-1.5">
        No todos yet
      </Text>
      <Text variant="muted" size="sm" as="p" className="opacity-70">
        Use /todo or Cmd+Enter
      </Text>
    </div>
  )
}
