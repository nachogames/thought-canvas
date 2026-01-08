import { Select } from '@/components/atoms/Input'

interface TagFilterProps {
  tags: string[]
  value: string | null
  onChange: (tag: string | null) => void
}

export function TagFilter({ tags, value, onChange }: TagFilterProps) {
  return (
    <Select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">All tags</option>
      {tags.map(tag => (
        <option key={tag} value={tag}>#{tag}</option>
      ))}
    </Select>
  )
}
