import { useMemo } from 'react'
import { parseContent } from '@/utils'
import { Heading, MonoText } from '@/components/atoms/Typography'
import { TagFilter, CompletedToggle } from '@/components/molecules/FilterControls'
import { TodoItem } from './TodoItem'
import { EmptyState } from './EmptyState'
import type { Sticky, TodoFilters, TodoWithContext } from '@/types'

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
    <div className="h-full flex flex-col bg-bg-elevated border-l border-border">
      {/* Header */}
      <div className="p-5 border-b border-border">
        <div className="flex justify-between items-center mb-4">
          <Heading level={2}>Todos</Heading>
          <MonoText variant="muted">
            {completedCount}/{totalCount}
          </MonoText>
        </div>

        <div className="space-y-2.5">
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
      <div className="flex-1 overflow-auto p-4">
        {filteredTodos.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-2.5">
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
