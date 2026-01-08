import type { SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  className?: string
}

export function Select({ className = '', children, ...props }: SelectProps) {
  return (
    <select
      className={`
        w-full px-3.5 py-2.5 text-sm rounded-lg
        bg-faint border border-border
        text-secondary
        outline-none cursor-pointer
        hover:border-border-hover
        focus:border-accent focus:ring-1 focus:ring-accent/50
        transition-colors duration-150
        ${className}
      `}
      {...props}
    >
      {children}
    </select>
  )
}
