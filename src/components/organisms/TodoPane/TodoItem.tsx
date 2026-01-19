import { forwardRef } from 'react'
import { Checkbox } from '@/components/atoms'
import type { TodoWithContext } from '@/types'

// Tag chip component - compact with subtle background
function TagChip({ tag }: { tag: string }) {
  return (
    <span className="
      inline-flex items-center
      px-1.5 py-0.5
      text-[10px] font-medium
      text-gray-500 dark:text-gray-400
      bg-gray-100 dark:bg-white/5
      rounded-md
      whitespace-nowrap
    ">
      #{tag}
    </span>
  )
}

// Priority dot - colored indicator next to checkbox
function PriorityDot({ priority }: { priority: number }) {
  if (priority === 0) return null

  // 4 priority levels with distinct colors
  const colorClass =
    priority >= 4 ? 'bg-red-500' :      // !!!! - critical (red)
    priority === 3 ? 'bg-orange-500' :  // !!! - high (orange)
    priority === 2 ? 'bg-amber-400' :   // !! - medium (amber)
    'bg-gray-400'                       // ! - low (gray)

  return (
    <span className={`
      flex-shrink-0 w-2 h-2 rounded-full
      ${colorClass}
    `} />
  )
}

// Format completion date for display
function formatCompletionDate(isoTimestamp: string): string {
  const date = new Date(isoTimestamp)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }) // e.g., "Fri, Jan 17"
}

interface TodoItemProps {
  todo: TodoWithContext
  depth?: number // 0 = parent, 1+ = nested
  onToggle: () => void
  onFocus?: () => void
  children?: React.ReactNode // Nested subtasks
  isFocused?: boolean // Highlighted when cursor is on this task in editor
}

export const TodoItem = forwardRef<HTMLDivElement, TodoItemProps>(function TodoItem(
  { todo, depth = 0, onToggle, onFocus, children, isFocused },
  ref
) {
  const { checked, cleanText, htmlContent, allTags, priority, parentText, completedAt } = todo
  const isNested = depth > 0

  // Render content - use HTML for proper formatting (bold, italic, links, line breaks)
  const renderContent = () => {
    if (htmlContent) {
      return (
        <span
          className="todo-html-content"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      )
    }
    return <span>{cleanText}</span>
  }

  // Parent/top-level task card styling
  if (!isNested) {
    return (
      <div
        ref={ref}
        className={`
          group rounded-xl
          bg-white dark:bg-gray-800/80
          border dark:border-white/5
          shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]
          hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)]
          dark:hover:border-white/10
          transition-all duration-150
          ${isFocused ? 'border-gray-400 dark:border-gray-500 border-dashed border-2' : 'border-transparent'}
        `}
      >
        {/* Header: parent task name (left) + completion date + priority dot (right) */}
        {(parentText || priority > 0 || (checked && completedAt)) && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-white/[0.02] rounded-t-xl border-b border-gray-100 dark:border-white/5">
            {parentText && !children ? (
              <span
                className="flex-1 text-[10px] text-gray-400 dark:text-gray-500 hover:text-accent cursor-pointer truncate"
                onClick={onFocus}
                title={parentText}
              >
                {parentText}
              </span>
            ) : (
              <div className="flex-1" />
            )}
            {/* Completion date - only show if checked and has completedAt */}
            {checked && completedAt && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                {formatCompletionDate(completedAt)}
              </span>
            )}
            <PriorityDot priority={priority} />
          </div>
        )}

        {/* Task content: checkbox + text */}
        <div className={`px-3 ${(parentText || priority > 0 || (checked && completedAt)) ? 'pt-2' : 'pt-3'} ${allTags.size > 0 ? 'pb-2' : 'pb-3'}`}>
          {/* Checkbox + text row with consistent 20px height */}
          <div className="flex items-start gap-2 mb-2.5">
            <div className="h-5 flex items-center">
              <Checkbox
                checked={checked}
                onChange={onToggle}
              />
            </div>
            <div
              className={`
                flex-1 min-w-0 text-sm leading-5
                ${onFocus ? 'cursor-pointer hover:text-accent' : ''}
                text-gray-800 dark:text-gray-100
                transition-colors
                ${checked ? 'line-through text-gray-400 dark:text-gray-500' : ''}
              `}
              onClick={onFocus}
            >
              {renderContent()}
            </div>
          </div>

          {/* Nested subtasks */}
          {children && (
            <div className="space-y-0.5 pl-2">
              {children}
            </div>
          )}
        </div>

        {/* Footer: tags */}
        {allTags.size > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-white/[0.02] rounded-b-xl border-t border-gray-100 dark:border-white/5">
            {[...allTags].map(tag => (
              <TagChip key={tag} tag={tag} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Nested task styling (depth >= 1) - simple, no tags, no priority dot
  return (
    <div
      ref={ref}
      className="rounded-md transition-colors duration-150"
    >
      {/* Checkbox + text row with consistent 20px height */}
      <div className={`flex items-start gap-2 mb-2.5 p-0.5 border rounded ${isFocused ? 'border-gray-400 dark:border-gray-500 border-dashed' : 'border-transparent'}`}>
        <div className="h-5 flex items-center">
          <Checkbox
            checked={checked}
            onChange={onToggle}
            size="sm"
          />
        </div>
        <span
          className={`
            flex-1 min-w-0 text-xs leading-5
            ${onFocus ? 'cursor-pointer hover:text-accent' : ''}
            text-gray-600 dark:text-gray-300
            transition-colors
            ${checked ? 'line-through text-gray-400 dark:text-gray-500' : ''}
          `}
          onClick={onFocus}
        >
          {renderContent()}
        </span>
      </div>

      {/* Further nested subtasks */}
      {children && (
        <div className="space-y-0 pl-2">
          {children}
        </div>
      )}
    </div>
  )
})
