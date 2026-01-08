import type { ReactNode } from 'react'

type HeadingLevel = 1 | 2 | 3 | 4

interface HeadingProps {
  children: ReactNode
  level?: HeadingLevel
  className?: string
}

const levelClasses: Record<HeadingLevel, string> = {
  1: 'text-2xl font-semibold tracking-tight',
  2: 'text-xl font-semibold tracking-tight',
  3: 'text-lg font-medium',
  4: 'text-base font-medium'
}

export function Heading({ children, level = 2, className = '' }: HeadingProps) {
  const Tag = `h${level}` as const
  const classes = `text-foreground ${levelClasses[level]} ${className}`

  return <Tag className={classes}>{children}</Tag>
}
