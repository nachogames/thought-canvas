interface CheckboxProps {
  checked: boolean
  onChange: () => void
  size?: 'sm' | 'md'
  className?: string
}

export function Checkbox({ checked, onChange, size = 'md', className = '' }: CheckboxProps) {
  // Both sizes are now 18px for consistency
  const dimensions = 18
  const checkmarkStyle = { left: 6, top: 2.5, width: 4, height: 9 }
  // size prop kept for future use but currently both render the same

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      className={`
        flex-shrink-0
        cursor-pointer
        focus:outline-none
        ${className}
      `}
      style={{
        width: dimensions,
        height: dimensions,
        borderRadius: 4,
        border: '1px solid',
        borderColor: checked ? 'var(--color-accent)' : 'var(--color-border)',
        backgroundColor: checked ? 'var(--color-accent)' : 'var(--color-bg)',
        boxShadow: checked ? '0 1px 3px rgba(0, 0, 0, 0.12)' : '0 1px 2px rgba(0, 0, 0, 0.04)',
        transition: 'all 150ms ease-out',
        position: 'relative',
      }}
    >
      {checked && (
        <span
          style={{
            position: 'absolute',
            left: checkmarkStyle.left,
            top: checkmarkStyle.top,
            width: checkmarkStyle.width,
            height: checkmarkStyle.height,
            border: 'solid white',
            borderWidth: '0 2px 2px 0',
            transform: 'rotate(45deg)',
          }}
        />
      )}
    </button>
  )
}
