import { Checkbox } from '@/components/atoms/Checkbox'
import { Tag } from '@/components/atoms/Tag'
import { Priority } from '@/components/atoms/Priority'
import { Text } from '@/components/atoms/Typography'
import type { TodoWithContext } from '@/types'

interface TodoItemProps {
  todo: TodoWithContext
  onToggle: () => void
  onFocus?: () => void
}

export function TodoItem({ todo, onToggle, onFocus }: TodoItemProps) {
  const { checked, cleanText, allTags, priority } = todo

  return (
    <div
      className={`
        p-3.5 rounded-xl border transition-all duration-150
        bg-faint/50 border-border
        hover:bg-faint hover:border-border-hover
        ${checked ? 'opacity-50' : ''}
      `}
    >
      <div className="flex items-start">
        <Checkbox checked={checked} onChange={onToggle} className="mr-2" />
        <div className="flex-1 min-w-0">
          <span
            className={onFocus ? 'cursor-pointer hover:underline' : ''}
            onClick={onFocus}
          >
            <Text
              variant="primary"
              size="base"
              strikethrough={checked}
              className={checked ? 'text-muted' : ''}
            >
              {cleanText}
            </Text>
          </span>

          {(allTags.size > 0 || priority > 0) && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {[...allTags].map(tag => (
                <Tag key={tag}>{tag}</Tag>
              ))}
              {priority > 0 && (
                <Priority level={priority as 1 | 2 | 3 | 4} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
