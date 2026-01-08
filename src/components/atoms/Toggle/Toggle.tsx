import { Check } from 'lucide-react'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  className?: string
}

export function Toggle({ checked, onChange, label, className = '' }: ToggleProps) {
  return (
    <label className={`flex items-center cursor-pointer select-none group ${className}`}>
      <button
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`
          flex-shrink-0 w-4 h-4 rounded
          border-2 transition-all duration-150
          flex items-center justify-center
          ${checked
            ? 'bg-accent border-accent'
            : 'bg-transparent border-muted group-hover:border-accent-light'
          }
        `}
      >
        {checked && <Check size={10} className="text-white" strokeWidth={3} />}
      </button>
      {label && (
        <span className="ml-2.5 text-sm text-secondary group-hover:text-foreground transition-colors">
          {label}
        </span>
      )}
    </label>
  )
}
