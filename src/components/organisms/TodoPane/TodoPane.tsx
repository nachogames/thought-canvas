import { useMemo, useState, useRef, useEffect } from 'react'
import { ChevronDown, X, Calendar, Hash, Eye, EyeOff } from 'lucide-react'
import { parseContent } from '@/utils'
import { TodoItem } from './TodoItem'
import { EmptyState } from './EmptyState'
import type { Sticky, TodoFilters, TodoWithContext, DateFilterValue } from '@/types'

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function matchesDateFilter(todoDate: string, filter: DateFilterValue): boolean {
  if (filter === 'all') return true
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = parseLocalDate(todoDate)

  if (filter === 'today') return date.getTime() === today.getTime()
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
  if (typeof filter === 'object') {
    const start = parseLocalDate(filter.start)
    const end = parseLocalDate(filter.end)
    end.setHours(23, 59, 59, 999)
    return date >= start && date <= end
  }
  return true
}

function FilterButton({
  icon: Icon,
  label,
  active,
  options,
  value,
  onChange,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  active: boolean
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  const selectedLabel = options.find(o => o.value === value)?.label || label

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5
          text-xs font-medium rounded-lg
          border transition-all duration-150
          ${active
            ? 'bg-accent/10 text-accent border-accent/20'
            : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-800 dark:hover:text-white'
          }
        `}
      >
        <Icon size={13} />
        <span>{selectedLabel}</span>
        <ChevronDown size={11} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="
          absolute left-0 top-full mt-1.5 z-[100]
          min-w-[140px] py-1.5
          bg-white dark:bg-gray-800 rounded-lg
          border border-gray-200 dark:border-white/10
          shadow-lg dark:shadow-xl dark:shadow-black/30
        ">
          {options.map(option => (
            <button
              key={option.value}
              onClick={() => { onChange(option.value); setIsOpen(false) }}
              className={`
                w-full text-left px-3 py-2 text-xs
                transition-colors
                ${value === option.value
                  ? 'text-accent bg-accent/10'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                }
              `}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface TodoPaneProps {
  stickies: Sticky[]
  onToggle: (stickyId: string, lineIndex: number) => void
  onFocusSticky: (stickyId: string) => void
  filters: TodoFilters
  setFilters: React.Dispatch<React.SetStateAction<TodoFilters>>
}

export function TodoPane({ stickies, onToggle, onFocusSticky, filters, setFilters }: TodoPaneProps) {
  const allTodos = useMemo(() => {
    const todos: TodoWithContext[] = []
    stickies.forEach(s => {
      const { todos: stickyTodos, noteTags } = parseContent(s.content)
      stickyTodos.forEach(t => {
        // Task gets its own tags + note-level tags (tags outside any task item)
        todos.push({
          ...t,
          stickyId: s.id,
          allTags: new Set([...t.tags, ...noteTags]),
          date: s.date
        })
      })
    })
    return todos
  }, [stickies])

  const allTags = useMemo(() => {
    return Array.from(new Set(allTodos.flatMap(t => [...t.allTags]))).sort()
  }, [allTodos])

  const filteredTodos = useMemo(() => {
    let result = allTodos.filter(t => t.cleanText.length > 0)
    if (filters.dateFilter !== 'all') {
      result = result.filter(t => matchesDateFilter(t.date, filters.dateFilter))
    }
    if (filters.tag) {
      result = result.filter(t => t.allTags.has(filters.tag!))
    }
    if (filters.hideCompleted) {
      result = result.filter(t => !t.checked)
    }
    return result.sort((a, b) =>
      b.priority - a.priority || new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [allTodos, filters])

  const completedCount = allTodos.filter(t => t.checked).length
  const totalCount = allTodos.filter(t => t.cleanText.length > 0).length
  const hasActiveFilters = filters.tag || filters.dateFilter !== 'all' || filters.hideCompleted

  const dateOptions = [
    { value: 'all', label: 'All dates' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'week', label: 'This week' },
  ]

  const tagOptions = [
    { value: '', label: 'All tags' },
    ...allTags.map(tag => ({ value: tag, label: `#${tag}` }))
  ]

  return (
    <div className="h-full flex flex-col bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-sm shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)] dark:shadow-none dark:border-l dark:border-white/10">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-white/5">
        {/* Title row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Tasks</h2>
            <span className="px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-white/5 rounded-full font-mono">
              {completedCount}/{totalCount}
            </span>
          </div>
          {hasActiveFilters && (
            <button
              onClick={() => setFilters({ tag: null, hideCompleted: false, dateFilter: 'all' })}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-200 dark:hover:bg-white/5 transition-colors"
            >
              <X size={11} />
              Clear
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterButton
            icon={Calendar}
            label="Date"
            active={filters.dateFilter !== 'all'}
            options={dateOptions}
            value={typeof filters.dateFilter === 'string' ? filters.dateFilter : 'all'}
            onChange={(v) => setFilters(f => ({ ...f, dateFilter: v as DateFilterValue }))}
          />

          {allTags.length > 0 && (
            <FilterButton
              icon={Hash}
              label="Tag"
              active={!!filters.tag}
              options={tagOptions}
              value={filters.tag || ''}
              onChange={(v) => setFilters(f => ({ ...f, tag: v || null }))}
            />
          )}

          <button
            onClick={() => setFilters(f => ({ ...f, hideCompleted: !f.hideCompleted }))}
            className={`
              flex items-center gap-1.5 px-2.5 py-1.5
              text-xs font-medium rounded-lg
              border transition-all duration-150
              ${filters.hideCompleted
                ? 'bg-accent/10 text-accent border-accent/20'
                : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-800 dark:hover:text-white'
              }
            `}
          >
            {filters.hideCompleted ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>{filters.hideCompleted ? 'Hidden' : 'Show all'}</span>
          </button>
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-auto p-3">
        {filteredTodos.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
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
