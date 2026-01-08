import { useMemo } from 'react'
import { parseContent } from '@/utils'
import { Heading } from '@/components/atoms/Typography'
import { TagFilter, CompletedToggle, DateFilter } from '@/components/molecules/FilterControls'
import { TodoItem } from './TodoItem'
import { EmptyState } from './EmptyState'
import type { Sticky, TodoFilters, TodoWithContext, DateFilterValue } from '@/types'

// Parse date string as local time to avoid timezone issues
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// Helper to check if a date matches the filter
function matchesDateFilter(todoDate: string, filter: DateFilterValue): boolean {
  if (filter === 'all') return true

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const date = parseLocalDate(todoDate)

  if (filter === 'today') {
    return date.getTime() === today.getTime()
  }

  if (filter === 'yesterday') {
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    return date.getTime() === yesterday.getTime()
  }

  if (filter === 'week') {
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)
    return date >= weekAgo && date <= today
  }

  // Custom range
  if (typeof filter === 'object') {
    const start = parseLocalDate(filter.start)
    const end = parseLocalDate(filter.end)
    end.setHours(23, 59, 59, 999)
    return date >= start && date <= end
  }

  return true
}

interface TodoPaneProps {
  stickies: Sticky[]
  onToggle: (stickyId: string, lineIndex: number) => void
  onFocusSticky: (stickyId: string) => void
  filters: TodoFilters
  setFilters: React.Dispatch<React.SetStateAction<TodoFilters>>
}

export function TodoPane({ stickies, onToggle, onFocusSticky, filters, setFilters }: TodoPaneProps) {
  // Aggregate all todos from all stickies
  const allTodos = useMemo(() => {
    const todos: TodoWithContext[] = []

    stickies.forEach(s => {
      const { todos: stickyTodos, tags: stickyTags } = parseContent(s.content)

      stickyTodos.forEach(t => {
        todos.push({
          ...t,
          stickyId: s.id,
          allTags: new Set([...t.tags, ...stickyTags]),
          date: s.date
        })
      })
    })

    return todos
  }, [stickies])

  // Get all unique tags
  const allTags = useMemo(() => {
    return Array.from(
      new Set(allTodos.flatMap(t => [...t.allTags]))
    ).sort()
  }, [allTodos])

  // Filter todos
  const filteredTodos = useMemo(() => {
    let result = [...allTodos]

    // Filter out empty todos (no content after removing tags/priority)
    result = result.filter(t => t.cleanText.length > 0)

    // Date filter
    if (filters.dateFilter !== 'all') {
      result = result.filter(t => matchesDateFilter(t.date, filters.dateFilter))
    }

    if (filters.tag) {
      result = result.filter(t => t.allTags.has(filters.tag!))
    }

    if (filters.hideCompleted) {
      result = result.filter(t => !t.checked)
    }

    // Sort by priority (highest first) then by date (newest first)
    return result.sort((a, b) =>
      b.priority - a.priority || new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [allTodos, filters])

  const completedCount = allTodos.filter(t => t.checked).length
  const totalCount = allTodos.length

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex justify-between items-center mb-3">
          <Heading level={2} className="text-base">Todos</Heading>
          <span className="text-xs font-medium text-muted bg-faint px-2 py-0.5 rounded-full">
            {completedCount}/{totalCount}
          </span>
        </div>

        <div className="space-y-3">
          <DateFilter
            value={filters.dateFilter}
            onChange={(dateFilter) => setFilters(f => ({ ...f, dateFilter }))}
          />
          <TagFilter
            tags={allTags}
            value={filters.tag}
            onChange={(tag) => setFilters(f => ({ ...f, tag }))}
          />
          <CompletedToggle
            checked={filters.hideCompleted}
            onChange={(hideCompleted) => setFilters(f => ({ ...f, hideCompleted }))}
          />
        </div>
      </div>

      {/* Todo list */}
      <div className="flex-1 overflow-auto p-3">
        {filteredTodos.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-2">
            {filteredTodos.map(todo => (
              <TodoItem
                key={`${todo.stickyId}-${todo.lineIndex}`}
                todo={todo}
                onToggle={() => onToggle(todo.stickyId, todo.lineIndex)}
                onFocus={() => onFocusSticky(todo.stickyId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
