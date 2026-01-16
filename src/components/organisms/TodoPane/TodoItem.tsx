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
  const { checked, cleanText, htmlContent, allTags, priority, parentText } = todo
  const isNested = depth > 0

  // Render content - cleanText with line breaks preserved
  const renderContent = () => {
    // Split by <br> allTags from HTML content and render with line breaks
    if (htmlContent && htmlContent.includes('<br>')) {
      const parts = htmlContent
        .replace(/<[^>]*>/g, (match) => match === '<br>' ? '\n' : '') // Keep only <br> as newlines, strip other allTags
        .split('\n')
        .filter(Boolean)

      if (parts.length > 1) {
        return (
          <span>
            {parts.map((part, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {part.trim()}
              </span>
            ))}
          </span>
        )
      }
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
          ${isFocused ? 'ring-1 ring-accent/30 bg-accent/5' : 'border-transparent'}
        `}
      >
        {/* Header: parent task name (left) + priority dot (right) */}
        {(parentText || priority > 0) && (
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
            <PriorityDot priority={priority} />
          </div>
        )}

        {/* Task content: checkbox + text */}
        <div className={`flex items-start gap-2 px-3 ${(parentText || priority > 0) ? 'pt-2' : 'pt-3'} ${allTags.size > 0 ? 'pb-2' : 'pb-3'}`}>
          <Checkbox
            checked={checked}
            onChange={onToggle}
            className="mt-[3px]"
          />
          <div className="flex-1 min-w-0">
            <div
              className={`
                text-sm leading-relaxed
                ${onFocus ? 'cursor-pointer hover:text-accent' : ''}
                text-gray-800 dark:text-gray-100
                transition-colors
                ${checked ? 'line-through text-gray-400 dark:text-gray-500' : ''}
              `}
              onClick={onFocus}
            >
              {renderContent()}
            </div>

            {/* Nested subtasks */}
            {children && (
              <div className="mt-2 space-y-0.5 pl-2">
                {children}
              </div>
            )}
          </div>
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
      className={`
        py-0.5 px-1.5 -mx-1.5 rounded-md transition-all duration-150
        ${isFocused ? 'bg-accent/5 ring-1 ring-accent/20' : ''}
      `}
    >
      {/* Checkbox + content row */}
      <div className="flex items-start gap-2">
        <Checkbox
          checked={checked}
          onChange={onToggle}
          size="sm"
          className="mt-[5px]"
        />
        <div className="flex-1 min-w-0">
          <span
            className={`
              text-xs leading-relaxed
              ${onFocus ? 'cursor-pointer hover:text-accent' : ''}
              text-gray-600 dark:text-gray-300
              transition-colors
              ${checked ? 'line-through text-gray-400 dark:text-gray-500' : ''}
            `}
            onClick={onFocus}
          >
            {renderContent()}
          </span>

          {/* Further nested subtasks */}
          {children && (
            <div className="mt-1 space-y-0 pl-2">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
