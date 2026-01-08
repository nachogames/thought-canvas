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
        p-3 rounded-lg transition-all duration-150
        bg-white dark:bg-gray-800/50
        border border-gray-200/60 dark:border-gray-700/50
        hover:border-gray-300 dark:hover:border-gray-600
        hover:shadow-sm
        ${checked ? 'opacity-60' : ''}
      `}
    >
      <div className="flex items-start gap-2.5">
        <Checkbox checked={checked} onChange={onToggle} />
        <div className="flex-1 min-w-0 pt-px">
          <span
            className={onFocus ? 'cursor-pointer hover:text-accent transition-colors' : ''}
            onClick={onFocus}
          >
            <Text
              variant="primary"
              size="sm"
              strikethrough={checked}
              className={checked ? 'text-muted' : ''}
            >
              {cleanText}
            </Text>
          </span>

          {(allTags.size > 0 || priority > 0) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
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
