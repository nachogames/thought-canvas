import { Check } from 'lucide-react'

interface CheckboxProps {
  checked: boolean
  onChange: () => void
  className?: string
}

export function Checkbox({ checked, onChange, className = '' }: CheckboxProps) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={`
        flex-shrink-0 w-4 h-4 rounded
        border-2 transition-all duration-150
        flex items-center justify-center
        cursor-pointer mt-0.5
        ${checked
          ? 'bg-accent border-accent'
          : 'bg-transparent border-muted hover:border-accent-light'
        }
        ${className}
      `}
    >
      {checked && <Check size={10} className="text-white" strokeWidth={3} />}
    </button>
  )
}
