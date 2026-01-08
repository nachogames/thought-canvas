interface BulletProps {
  className?: string
}

export function Bullet({ className = '' }: BulletProps) {
  return (
    <span
      className={`
        flex-shrink-0 w-1.5 h-1.5 rounded-full
        mt-2 mr-2
        ${className}
      `}
      style={{ backgroundColor: 'var(--color-muted)' }}
    />
  )
}
