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
        group p-3 rounded-xl
        bg-white dark:bg-gray-800/80
        border border-transparent dark:border-white/5
        shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]
        hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)]
        dark:hover:border-white/10
        transition-all duration-150
        ${checked ? 'opacity-50' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Native checkbox - same as editor */}
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="
            flex-shrink-0 w-4 h-4 mt-0.5
            accent-[var(--color-accent)] cursor-pointer
            rounded
          "
        />

        {/* Content */}
        <div className="flex-1 min-w-0 pt-px">
          <div className="flex items-start gap-2">
            {/* Priority indicator */}
            {priority >= 3 && (
              <span className="flex-shrink-0 mt-1.5 w-2 h-2 rounded-full bg-red-500" />
            )}
            {priority === 2 && (
              <span className="flex-shrink-0 mt-1.5 w-2 h-2 rounded-full bg-amber-500" />
            )}
            {priority === 1 && (
              <span className="flex-shrink-0 mt-1.5 w-2 h-2 rounded-full bg-gray-400" />
            )}

            {/* Task text */}
            <span
              className={`
                text-sm leading-relaxed
                ${onFocus ? 'cursor-pointer hover:text-accent' : ''}
                ${checked ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-800 dark:text-gray-100'}
                transition-colors
              `}
              onClick={onFocus}
            >
              {cleanText}
            </span>
          </div>

          {/* Tags */}
          {allTags.size > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[...allTags].map(tag => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 text-[10px] font-medium text-accent bg-accent/10 rounded"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
