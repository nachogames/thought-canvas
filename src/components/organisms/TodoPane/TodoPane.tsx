import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, X, Calendar, Hash, Eye, EyeOff } from 'lucide-react'
import { parseContent } from '@/utils'
import { TodoItem } from './TodoItem'
import { EmptyState } from './EmptyState'
import { useStickies } from '@/context/StickiesContext'
import type { Sticky, TodoFilters, TodoWithContext, DateFilterValue } from '@/types'

// Tree node structure for recursive task rendering
interface TaskTreeNode {
  todo: TodoWithContext
  children: TaskTreeNode[]
}

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function matchesDateFilter(todoDate: string, filter: DateFilterValue): boolean {
  if (filter === 'all') return true
  // Completion-based filters are handled separately
  if (filter === 'completed-today' || filter === 'completed-yesterday' || filter === 'completed-week') return true

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

function matchesCompletionFilter(completedAt: string | undefined, filter: DateFilterValue): boolean {
  if (filter === 'completed-today') {
    if (!completedAt) return false
    const completedDate = new Date(completedAt)
    const today = new Date()
    return (
      completedDate.getFullYear() === today.getFullYear() &&
      completedDate.getMonth() === today.getMonth() &&
      completedDate.getDate() === today.getDate()
    )
  }
  if (filter === 'completed-yesterday') {
    if (!completedAt) return false
    const completedDate = new Date(completedAt)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return (
      completedDate.getFullYear() === yesterday.getFullYear() &&
      completedDate.getMonth() === yesterday.getMonth() &&
      completedDate.getDate() === yesterday.getDate()
    )
  }
  if (filter === 'completed-week') {
    if (!completedAt) return false
    const completedDate = new Date(completedAt)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    weekAgo.setHours(0, 0, 0, 0)
    return completedDate >= weekAgo
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
  // Scroll on Focus: get context state and refs for todo items
  const { scrollOnFocus, setScrollOnFocus, focusedTodoKey } = useStickies()
  const todoRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())

  // Callback to register todo refs
  const setTodoRef = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) {
      todoRefsMap.current.set(key, el)
    } else {
      todoRefsMap.current.delete(key)
    }
  }, [])

  // Scroll focused todo into view
  useEffect(() => {
    if (!scrollOnFocus || !focusedTodoKey) return

    const element = todoRefsMap.current.get(focusedTodoKey)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [focusedTodoKey, scrollOnFocus])

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

  // Build recursive tree structure for tasks
  const taskTrees = useMemo((): TaskTreeNode[] => {
    // Index todos by their lineIndex for efficient lookup
    const todosByLineIndex = new Map<string, TodoWithContext>()
    allTodos.forEach(t => {
      const key = `${t.stickyId}-${t.lineIndex}`
      todosByLineIndex.set(key, t)
    })

    // Build tree recursively
    function buildSubtree(parentTodo: TodoWithContext): TaskTreeNode {
      // Find all direct children of this todo
      const children = allTodos.filter(t =>
        t.cleanText.length > 0 &&
        t.stickyId === parentTodo.stickyId &&
        t.parentLineIndex === parentTodo.lineIndex
      )

      return {
        todo: parentTodo,
        children: children.map(child => buildSubtree(child))
      }
    }

    // Get top-level todos (depth 0 or undefined)
    const topLevelTodos = allTodos.filter(t =>
      t.cleanText.length > 0 && (t.depth === undefined || t.depth === 0)
    )

    return topLevelTodos.map(todo => buildSubtree(todo))
  }, [allTodos])

  // Filter tree nodes based on current filters
  const filteredTrees = useMemo(() => {
    const isCompletionFilter = filters.dateFilter === 'completed-today' || filters.dateFilter === 'completed-yesterday' || filters.dateFilter === 'completed-week'

    // Check if a todo passes the filters
    function passesFilters(todo: TodoWithContext): boolean {
      if (filters.dateFilter !== 'all') {
        if (!matchesDateFilter(todo.date, filters.dateFilter)) return false
        if (!matchesCompletionFilter(todo.completedAt, filters.dateFilter)) return false
      }
      if (filters.tag && !todo.allTags.has(filters.tag)) return false
      if (filters.hideCompleted && !isCompletionFilter && todo.checked) return false
      return true
    }

    // Recursively filter a tree node, keeping nodes that pass or have children that pass
    function filterTree(node: TaskTreeNode): TaskTreeNode | null {
      const filteredChildren = node.children
        .map(child => filterTree(child))
        .filter((child): child is TaskTreeNode => child !== null)

      const nodePassesFilters = passesFilters(node.todo)

      // Keep this node if it passes filters OR has visible children
      if (nodePassesFilters || filteredChildren.length > 0) {
        return {
          todo: node.todo,
          children: filteredChildren
        }
      }

      return null
    }

    return taskTrees
      .map(tree => filterTree(tree))
      .filter((tree): tree is TaskTreeNode => tree !== null)
      // Sort by priority then date
      .sort((a, b) =>
        b.todo.priority - a.todo.priority ||
        new Date(b.todo.date).getTime() - new Date(a.todo.date).getTime()
      )
  }, [taskTrees, filters])

  // Get promoted subtasks that should also appear as standalone items
  const promotedTodos = useMemo(() => {
    const isCompletionFilter = filters.dateFilter === 'completed-today' || filters.dateFilter === 'completed-yesterday' || filters.dateFilter === 'completed-week'

    let promoted = allTodos.filter(t =>
      t.cleanText.length > 0 && t.isPromoted === true
    )

    // Apply filters
    if (filters.dateFilter !== 'all') {
      promoted = promoted.filter(t =>
        matchesDateFilter(t.date, filters.dateFilter) &&
        matchesCompletionFilter(t.completedAt, filters.dateFilter)
      )
    }
    if (filters.tag) {
      promoted = promoted.filter(t => t.allTags.has(filters.tag!))
    }
    if (filters.hideCompleted && !isCompletionFilter) {
      promoted = promoted.filter(t => !t.checked)
    }

    return promoted.sort((a, b) =>
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
    { value: 'completed-today', label: 'Done today' },
    { value: 'completed-yesterday', label: 'Done yesterday' },
    { value: 'completed-week', label: 'Done this week' },
  ]

  const tagOptions = [
    { value: '', label: 'All tags' },
    ...allTags.map(tag => ({ value: tag, label: `#${tag}` }))
  ]

  // Recursive function to render a tree node and its children
  const renderTreeNode = (node: TaskTreeNode, depth: number): React.ReactNode => {
    const key = `${node.todo.stickyId}-${node.todo.lineIndex}`

    return (
      <TodoItem
        key={key}
        ref={(el) => setTodoRef(key, el)}
        todo={node.todo}
        depth={depth}
        onToggle={() => onToggle(node.todo.stickyId, node.todo.lineIndex)}
        onFocus={() => onFocusSticky(node.todo.stickyId)}
        isFocused={focusedTodoKey === key}
      >
        {node.children.length > 0 && node.children.map(child =>
          renderTreeNode(child, depth + 1)
        )}
      </TodoItem>
    )
  }

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

          <label
            title="Auto-scroll to focused task in editor"
            className="flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer"
          >
            <span className={`text-xs font-medium transition-colors ${scrollOnFocus ? 'text-accent' : 'text-gray-500 dark:text-gray-400'}`}>
              Sync
            </span>
            <button
              role="switch"
              aria-checked={scrollOnFocus}
              onClick={() => setScrollOnFocus(!scrollOnFocus)}
              className={`
                relative w-8 h-4 rounded-full transition-colors duration-200
                ${!scrollOnFocus ? 'bg-gray-300 dark:bg-gray-600' : ''}
              `}
              style={scrollOnFocus ? { backgroundColor: 'var(--color-accent)' } : undefined}
            >
              <span
                className={`
                  absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow-sm
                  transition-transform duration-200
                  ${scrollOnFocus ? 'translate-x-4' : 'translate-x-0'}
                `}
              />
            </button>
          </label>
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-auto p-3">
        {filteredTrees.length === 0 && promotedTodos.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            {/* Promoted subtasks shown as standalone cards at the top */}
            {promotedTodos.map(todo => {
              const key = `${todo.stickyId}-${todo.lineIndex}`
              return (
                <TodoItem
                  key={`promoted-${key}`}
                  ref={(el) => setTodoRef(key, el)}
                  todo={todo}
                  onToggle={() => onToggle(todo.stickyId, todo.lineIndex)}
                  onFocus={() => onFocusSticky(todo.stickyId)}
                  isFocused={focusedTodoKey === key}
                />
              )
            })}

            {/* Recursive tree rendering */}
            {filteredTrees.map(tree => renderTreeNode(tree, 0))}
          </div>
        )}
      </div>
    </div>
  )
}
