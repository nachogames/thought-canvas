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
  if (typeof filter === 'string' && filter.startsWith('completed-')) return true

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

// Get label for N days ago with date (e.g., "2 days ago (Fri, Jan 17)")
function getDayLabel(daysAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
  const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${daysAgo} days ago (${dayName}, ${monthDay})`
}

// Get yesterday label with date
function getYesterdayLabel(): string {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
  const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `Yesterday (${dayName}, ${monthDay})`
}

// Check if a filter is a completion-based filter
function isCompletionBasedFilter(filter: DateFilterValue): boolean {
  if (typeof filter !== 'string') return false
  return filter.startsWith('completed-')
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
  // Handle "completed N days ago" filters
  if (typeof filter === 'string' && filter.match(/^completed-\d+-days-ago$/)) {
    if (!completedAt) return false
    const daysAgo = parseInt(filter.split('-')[1])
    const completedDate = new Date(completedAt)
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() - daysAgo)
    return (
      completedDate.getFullYear() === targetDate.getFullYear() &&
      completedDate.getMonth() === targetDate.getMonth() &&
      completedDate.getDate() === targetDate.getDate()
    )
  }
  return true
}

interface FilterOption {
  value: string
  label: string
  submenu?: FilterOption[]
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
  options: FilterOption[]
  value: string
  onChange: (value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [submenuOpen, setSubmenuOpen] = useState<string | null>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSubmenuOpen(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  // Delayed close for submenu - allows mouse to travel to submenu
  const handleSubmenuMouseEnter = (optionValue: string) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    setSubmenuOpen(optionValue)
  }

  const handleSubmenuMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setSubmenuOpen(null)
    }, 150) // 150ms delay before closing
  }

  // Find the selected label - check both top-level and submenu options
  const findSelectedLabel = (): string => {
    for (const option of options) {
      if (option.value === value) return option.label
      if (option.submenu) {
        const subOption = option.submenu.find(o => o.value === value)
        if (subOption) return subOption.label
      }
    }
    return label
  }
  const selectedLabel = findSelectedLabel()

  // Check if current value is in a submenu
  const isValueInSubmenu = (option: FilterOption): boolean => {
    return option.submenu?.some(o => o.value === value) ?? false
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-1 px-1.5 py-1
          text-[11px] font-medium rounded-md
          transition-all duration-150
          ${active
            ? 'text-accent bg-accent/10'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5'
          }
        `}
      >
        <Icon size={12} />
        <span>{selectedLabel}</span>
        <ChevronDown size={10} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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
            option.submenu ? (
              // Submenu item with flyout to the right
              <div
                key={option.value}
                className="relative"
                onMouseEnter={() => handleSubmenuMouseEnter(option.value)}
                onMouseLeave={handleSubmenuMouseLeave}
              >
                <button
                  className={`
                    w-full text-left px-3 py-2 text-xs flex items-center justify-between
                    transition-colors
                    ${isValueInSubmenu(option)
                      ? 'text-accent bg-accent/10'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                    }
                  `}
                >
                  <span>{option.label}</span>
                  <ChevronDown size={10} className="-rotate-90" />
                </button>
                {submenuOpen === option.value && (
                  <div
                    className="
                      absolute left-full top-0 z-[101]
                      min-w-[180px] pl-1
                    "
                    onMouseEnter={() => handleSubmenuMouseEnter(option.value)}
                    onMouseLeave={handleSubmenuMouseLeave}
                  >
                    <div className="
                      bg-white dark:bg-gray-800 rounded-lg
                      border border-gray-200 dark:border-white/10
                      shadow-lg dark:shadow-xl dark:shadow-black/30
                      py-1.5
                    ">
                      {option.submenu.map(subOption => (
                        <button
                          key={subOption.value}
                          onClick={() => { onChange(subOption.value); setIsOpen(false); setSubmenuOpen(null) }}
                          className={`
                            w-full text-left px-3 py-2 text-xs
                            transition-colors
                            ${value === subOption.value
                              ? 'text-accent bg-accent/10'
                              : 'text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                            }
                          `}
                        >
                          {subOption.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Regular item
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
            )
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

  // Scroll focused todo into view - center it for better visibility
  useEffect(() => {
    if (!scrollOnFocus || !focusedTodoKey) return

    const element = todoRefsMap.current.get(focusedTodoKey)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
    const isCompletionFilter = isCompletionBasedFilter(filters.dateFilter)

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

    // Recursively filter a tree node
    // If parent is checked and hideCompleted is on, hide the entire tree (parent + subtasks)
    // Subtasks only hidden if their own checkbox is checked
    function filterTree(node: TaskTreeNode, parentCheckedAndHidden: boolean = false): TaskTreeNode | null {
      // If parent was checked and hidden, hide entire subtree
      if (parentCheckedAndHidden) {
        return null
      }

      // Check if this node should be hidden (checked parent hides all children)
      const thisNodeHidden = filters.hideCompleted && !isCompletionFilter && node.todo.checked

      const filteredChildren = node.children
        .map(child => filterTree(child, thisNodeHidden)) // Pass down if this parent is checked
        .filter((child): child is TaskTreeNode => child !== null)

      const nodePassesFilters = passesFilters(node.todo)

      // If node passes filters, show it with filtered children
      if (nodePassesFilters) {
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
    const isCompletionFilter = isCompletionBasedFilter(filters.dateFilter)

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

  // Set of keys for promoted todos - used to avoid showing them as subtasks in trees
  const promotedKeys = useMemo(() => {
    return new Set(promotedTodos.map(t => `${t.stickyId}-${t.lineIndex}`))
  }, [promotedTodos])

  const completedCount = allTodos.filter(t => t.checked).length
  const totalCount = allTodos.filter(t => t.cleanText.length > 0).length
  const hasActiveFilters = filters.tag || filters.dateFilter !== 'all' || filters.hideCompleted

  const dateOptions: FilterOption[] = [
    { value: 'all', label: 'All dates' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'week', label: 'This week' },
    {
      value: '__done__',
      label: 'Done',
      submenu: [
        { value: 'completed-today', label: 'Today' },
        { value: 'completed-yesterday', label: getYesterdayLabel() },
        { value: 'completed-2-days-ago', label: getDayLabel(2) },
        { value: 'completed-3-days-ago', label: getDayLabel(3) },
        { value: 'completed-week', label: 'This week' },
      ]
    },
  ]

  const tagOptions = [
    { value: '', label: 'All tags' },
    ...allTags.map(tag => ({ value: tag, label: `#${tag}` }))
  ]

  // Recursive function to render a tree node and its children
  // Promoted subtasks still appear nested, but scroll-on-focus targets the promoted standalone card
  const renderTreeNode = (node: TaskTreeNode, depth: number): React.ReactNode => {
    const key = `${node.todo.stickyId}-${node.todo.lineIndex}`
    const isPromoted = promotedKeys.has(key)

    return (
      <TodoItem
        key={key}
        // Only register ref if NOT promoted (promoted tasks get ref on their standalone card)
        ref={isPromoted ? undefined : (el) => setTodoRef(key, el)}
        todo={node.todo}
        depth={depth}
        onToggle={() => onToggle(node.todo.stickyId, node.todo.lineIndex)}
        onFocus={() => onFocusSticky(node.todo.stickyId)}
        // Only show focus highlight if NOT promoted (promoted cards show focus on standalone)
        isFocused={!isPromoted && focusedTodoKey === key}
      >
        {node.children.length > 0 && node.children.map(child =>
          renderTreeNode(child, depth + 1)
        )}
      </TodoItem>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-sm shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)] dark:shadow-none dark:border-l dark:border-white/10">
      {/* Header - compact single row */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-white/5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Title + count */}
          <div className="flex items-center gap-1.5 mr-1">
            <h2 className="text-xs font-semibold text-gray-900 dark:text-white">Tasks</h2>
            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 font-mono">
              {completedCount}/{totalCount}
            </span>
          </div>

          {/* Divider */}
          <div className="w-px h-4 bg-gray-200 dark:bg-white/10" />

          {/* Filters - inline */}
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
            title={filters.hideCompleted ? 'Show completed' : 'Hide completed'}
            className={`
              p-1.5 rounded-md transition-all duration-150
              ${filters.hideCompleted
                ? 'text-accent bg-accent/10'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
              }
            `}
          >
            {filters.hideCompleted ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Sync toggle - minimal */}
          <button
            role="switch"
            aria-checked={scrollOnFocus}
            title="Auto-scroll to focused task"
            onClick={() => setScrollOnFocus(!scrollOnFocus)}
            className={`
              relative w-7 h-4 rounded-full transition-colors duration-200
              ${!scrollOnFocus ? 'bg-gray-300 dark:bg-gray-600' : ''}
            `}
            style={scrollOnFocus ? { backgroundColor: 'var(--color-accent)' } : undefined}
          >
            <span
              className={`
                absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow-sm
                transition-transform duration-200
                ${scrollOnFocus ? 'translate-x-3' : 'translate-x-0'}
              `}
            />
          </button>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={() => setFilters({ tag: null, hideCompleted: false, dateFilter: 'all' })}
              className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
              title="Clear filters"
            >
              <X size={14} />
            </button>
          )}
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
