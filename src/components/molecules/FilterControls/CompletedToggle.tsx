import { Text } from '@/components/atoms/Typography'

interface CompletedToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
}

export function CompletedToggle({ checked, onChange }: CompletedToggleProps) {
  return (
    <label className="flex items-center cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 mr-2.5 accent-accent"
      />
      <Text variant="secondary" size="base">
        Hide completed
      </Text>
    </label>
  )
}
