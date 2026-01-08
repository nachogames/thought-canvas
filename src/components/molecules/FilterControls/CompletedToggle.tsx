import { Toggle } from '@/components/atoms/Toggle'

interface CompletedToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
}

export function CompletedToggle({ checked, onChange }: CompletedToggleProps) {
  return (
    <Toggle
      checked={checked}
      onChange={onChange}
      label="Hide completed"
    />
  )
}
