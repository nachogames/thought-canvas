interface TagProps {
  children: string
  className?: string
}

export function Tag({ children, className = '' }: TagProps) {
  // Ensure the # is included
  const label = children.startsWith('#') ? children : `#${children}`

  return (
    <span
      className={`
        inline-flex px-2 py-0.5 rounded
        text-xs font-mono
        bg-accent-muted text-accent-light
        ${className}
      `}
    >
      {label}
    </span>
  )
}
