import { MonoText } from '@/components/atoms/Typography'

interface HelpTextProps {
  className?: string
}

export function HelpText({ className = '' }: HelpTextProps) {
  return (
    <MonoText variant="muted" className={className}>
      Double-click to create &bull; Alt+drag to pan &bull; / for commands &bull; Cmd+Enter for todo
    </MonoText>
  )
}
