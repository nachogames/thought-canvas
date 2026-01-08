interface PriorityProps {
  level: 1 | 2 | 3 | 4
  className?: string
}

const levelClasses: Record<number, string> = {
  1: 'opacity-60',
  2: 'text-yellow-500',
  3: 'text-orange-500',
  4: 'text-red-500 font-semibold'
}

export function Priority({ level, className = '' }: PriorityProps) {
  return (
    <span className={`text-xs ${levelClasses[level]} ${className}`}>
      {'!'.repeat(level)}
    </span>
  )
}
