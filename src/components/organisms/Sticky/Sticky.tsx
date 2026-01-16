import { useRef, useState, useLayoutEffect, useCallback, useEffect, useMemo } from 'react'
import { Trash2, Palette, Check } from 'lucide-react'
import { STICKY_WIDTH, TASK_STICKY_WIDTH, MIN_STICKY_HEIGHT, MIN_TASK_STICKY_HEIGHT, STICKY_COLORS, STICKY_COLOR_ORDER } from '@/constants'
import { TiptapEditor } from '@/components/molecules/TiptapEditor'
import { parseContent } from '@/utils/parseContent'
import { useLongPress } from '@/hooks'
import { useStickies } from '@/context/StickiesContext'
import type { Sticky as StickyType, StickyColor } from '@/types'

/**
 * Transform HTML content to add data-canceled attribute to task items starting with //
 * This enables CSS styling for canceled tasks in view mode
 */
function addCanceledAttributes(html: string): string {
  if (!html.includes('data-type="taskItem"')) return html

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Find all task items and check if their text starts with //
  const taskItems = doc.querySelectorAll('li[data-type="taskItem"]')
  const canceledItems = new Set<Element>()

  taskItems.forEach(item => {
    // Get direct text content (first paragraph)
    const firstP = item.querySelector(':scope > div > p')
    const text = firstP?.textContent?.trim() || ''

    if (text.startsWith('//')) {
      canceledItems.add(item)
      item.setAttribute('data-canceled', 'true')
    }
  })

  // Mark all descendants of canceled items as canceled too
  canceledItems.forEach(item => {
    const nestedItems = item.querySelectorAll('li[data-type="taskItem"]')
    nestedItems.forEach(nested => {
      nested.setAttribute('data-canceled', 'true')
    })
  })

  return doc.body.innerHTML
}

// Simple view-only content renderer
function StickyContentView({ content }: { content: string }) {
  const processedContent = useMemo(() => {
    if (!content) return '<p class="is-editor-empty" data-placeholder="Type here..."></p>'
    return addCanceledAttributes(content)
  }, [content])

  return (
    <div
      className="sticky-content outline-none text-sm"
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  )
}

interface StickyProps {
  sticky: StickyType
  onUpdate: (id: string, updates: Partial<StickyType>) => void
  onDelete: (id: string) => void
  onDragStart: (id: string, e: React.MouseEvent | React.TouchEvent) => void
  isSelected: boolean
  onSelect: (id: string, addToSelection?: boolean) => void
  isEditing: boolean
  onSetEditing: (id: string | null, sourceId?: string) => void
  // Task mode props
  variant?: 'note' | 'task'
  onToggleTodo?: (id: string) => void
  onFocusSource?: (id: string) => void
  // Direct todo data (avoids parsing content in task mode)
  todoData?: { checked: boolean; priority: number; tags: Set<string> }
  // Called when long-press is cancelled due to movement - triggers pan
  onRequestPan?: (e: React.TouchEvent) => void
}

// TODO: Re-enable memo after fixing edit mode issue
const StickyComponent = function Sticky({
  sticky,
  onUpdate,
  onDelete,
  onDragStart,
  isSelected,
  onSelect,
  isEditing,
  onSetEditing,
  variant = 'note',
  onToggleTodo,
  onFocusSource,
  todoData,
  onRequestPan,
}: StickyProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  const [clickCoords, setClickCoords] = useState<{ x: number; y: number } | null>(null)
  const [toggleTaskIndex, setToggleTaskIndex] = useState<number | null>(null)
  const toggleTaskIndexRef = useRef<number | null>(null) // Ref for synchronous access in event handlers
  const [focusTaskIndex, setFocusTaskIndex] = useState<number | null>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [isLongPressing, setIsLongPressing] = useState(false)

  // Scroll on focus: update context when cursor moves to a task item
  const { scrollOnFocus, setFocusedTodoKey } = useStickies()
  const handleCursorMove = useCallback((lineIndex: number | null) => {
    if (!scrollOnFocus) return
    if (lineIndex !== null) {
      setFocusedTodoKey(`${sticky.id}-${lineIndex}`)
    } else {
      setFocusedTodoKey(null)
    }
  }, [sticky.id, scrollOnFocus, setFocusedTodoKey])

  const isTaskMode = variant === 'task'
  const width = isTaskMode ? TASK_STICKY_WIDTH : STICKY_WIDTH
  const minHeight = isTaskMode ? MIN_TASK_STICKY_HEIGHT : MIN_STICKY_HEIGHT
  const headerHeight = isTaskMode ? 16 : 20

  // Show checkbox for task stickies (isTask flag) even without variant="task"
  const showCheckbox = sticky.isTask === true || isTaskMode

  // Parse content for task mode to get todo info
  const parsedContent = useMemo(() => {
    if (!showCheckbox) return null
    return parseContent(sticky.content)
  }, [showCheckbox, sticky.content])

  // Extract todo info for task stickies
  const todoInfo = useMemo(() => {
    // If todoData is provided directly, use it
    if (todoData) {
      return todoData
    }
    // Use stored task state from sticky (for task overlay stickies)
    if (sticky.isTask) {
      return {
        checked: sticky.taskChecked ?? false,
        priority: sticky.taskPriority ?? 0,
        tags: new Set(sticky.taskTags ?? [])
      }
    }
    // Fall back to parsing content
    if (!parsedContent || parsedContent.todos.length === 0) {
      return { checked: false, priority: 0, tags: new Set<string>() }
    }
    const todo = parsedContent.todos[0]
    // Task gets its own tags + note-level tags (tags outside any task item)
    return {
      checked: todo.checked,
      priority: todo.priority || parsedContent.priority,
      tags: new Set([...todo.tags, ...parsedContent.noteTags])
    }
  }, [parsedContent, todoData, sticky.isTask, sticky.taskChecked, sticky.taskPriority, sticky.taskTags])

  // Close color picker when clicking outside
  useEffect(() => {
    if (!showColorPicker) return

    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showColorPicker])

  // Measure actual rendered height from DOM and report to parent for collision detection
  useLayoutEffect(() => {
    if (containerRef.current) {
      const actualHeight = containerRef.current.offsetHeight

      // Update if stored height doesn't match actual DOM height
      if (sticky.measuredHeight !== actualHeight) {
        queueMicrotask(() => {
          onUpdate(sticky.id, { measuredHeight: actualHeight })
        })
      }
    }
  }, [sticky.content, sticky.id, sticky.measuredHeight, onUpdate])

  const handleContentChange = useCallback((html: string) => {
    onUpdate(sticky.id, { content: html })
  }, [sticky.id, onUpdate])

  const handleBlur = useCallback(() => {
    // Pass our id so context can ignore stale blur events
    // (when clicking another card, blur fires after the new card starts editing)
    onSetEditing(null, sticky.id)
    setToggleTaskIndex(null) // Clear pending toggle
    toggleTaskIndexRef.current = null
  }, [onSetEditing, sticky.id])

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault() // Prevent text selection while dragging
    const addToSelection = e.metaKey || e.ctrlKey

    if (addToSelection) {
      onSelect(sticky.id, true)
    } else {
      if (!isSelected) {
        onSelect(sticky.id, false)
      }
      onDragStart(sticky.id, e)
    }
  }, [isSelected, sticky.id, onSelect, onDragStart])

  // Long-press hook for touch drag anywhere on card
  const longPress = useLongPress({
    onLongPress: (e) => {
      if (isEditing) return
      setIsLongPressing(false)
      if (!isSelected) onSelect(sticky.id, false)
      onDragStart(sticky.id, e)
    },
    onTouchStart: () => {
      if (!isEditing) setIsLongPressing(true)
    },
    onTouchEnd: () => setIsLongPressing(false),
    onMoveCancel: (e) => {
      // Movement cancelled long-press - trigger canvas pan instead
      onRequestPan?.(e)
    },
    delay: 400,
    moveThreshold: 10
  })

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement

    // Check if user clicked a checkbox
    if (target.tagName === 'INPUT' && target.getAttribute('type') === 'checkbox') {
      e.stopPropagation()

      // If we have a pending toggle from mousedown, don't do anything else
      // The toggle effect in TiptapEditor will handle both toggle and cursor positioning
      // Use ref for synchronous check since state might not be updated yet
      if (toggleTaskIndexRef.current !== null) {
        return
      }

      // If already in edit mode (user clicked checkbox while editing this same sticky),
      // TipTap handles the native toggle. Just position cursor afterward.
      if (isEditing) {
        const taskItem = target.closest('li[data-checked]') // TipTap uses data-checked in edit mode
        if (taskItem) {
          const contentEl = target.closest('.ProseMirror')
          if (contentEl) {
            const allTaskItems = Array.from(contentEl.querySelectorAll('li[data-checked]'))
            const lineIndex = allTaskItems.indexOf(taskItem as Element)
            if (lineIndex !== -1) {
              // Position cursor after TipTap processes the toggle
              requestAnimationFrame(() => {
                setFocusTaskIndex(lineIndex)
                setTimeout(() => setFocusTaskIndex(null), 100)
              })
            }
          }
        }
        return
      }

      // Not in edit mode and no pending toggle - this shouldn't happen normally
      // because mousedown should have set things up, but handle it just in case
      const taskItem = target.closest('li[data-type="taskItem"]')
      if (taskItem) {
        const contentEl = target.closest('.sticky-content')
        if (contentEl) {
          const allTaskItems = Array.from(contentEl.querySelectorAll('li[data-type="taskItem"]'))
          const lineIndex = allTaskItems.indexOf(taskItem as Element)
          if (lineIndex !== -1) {
            e.preventDefault()
            if (!isSelected) {
              onSelect(sticky.id, false)
            }
            toggleTaskIndexRef.current = lineIndex
            setToggleTaskIndex(lineIndex)
            setClickCoords(null)
            onSetEditing(sticky.id)
          }
        }
      }
      return
    }

    // Always stop propagation to prevent canvas from clearing editing state
    e.stopPropagation()

    // For non-checkbox clicks, let TiptapEditor handle if already editing
    if (isEditing) return

    // Check if user clicked a link - open it instead of entering edit mode
    if (target.tagName === 'A' && target.getAttribute('href')) {
      e.preventDefault()
      window.open(target.getAttribute('href')!, '_blank', 'noopener,noreferrer')
      return
    }

    const isMultiSelect = e.metaKey || e.ctrlKey

    if (isMultiSelect) {
      // Multi-select: exit any edit mode, toggle selection
      onSetEditing(null)
      onSelect(sticky.id, true)
    } else {
      // Single click: editing, selection, and clickCoords were already set in handleContentMouseDown
      setToggleTaskIndex(null) // Clear any pending toggle
      toggleTaskIndexRef.current = null
    }
  }, [isEditing, isSelected, sticky.id, onSelect, onSetEditing])

  const handleContentMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditing) return
    e.stopPropagation()

    // For checkbox clicks, handle everything in mousedown to avoid race conditions
    // When switching from another editing sticky, by the time click fires, isEditing is already true
    // which causes the click handler to go into the wrong branch
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' && target.getAttribute('type') === 'checkbox') {
      e.preventDefault() // Prevent native checkbox toggle, we'll handle it via TipTap

      // Find which task was clicked
      const taskItem = target.closest('li[data-type="taskItem"]')
      if (taskItem) {
        const contentEl = target.closest('.sticky-content')
        if (contentEl) {
          const allTaskItems = Array.from(contentEl.querySelectorAll('li[data-type="taskItem"]'))
          const lineIndex = allTaskItems.indexOf(taskItem as Element)
          if (lineIndex !== -1) {
            // Select the sticky
            if (!isSelected) {
              onSelect(sticky.id, false)
            }
            // Set toggle index BEFORE entering edit mode - this will toggle + position cursor
            // Set ref immediately for synchronous access in click handler
            toggleTaskIndexRef.current = lineIndex
            setToggleTaskIndex(lineIndex)
            setClickCoords(null)
            // Set editing state immediately, before blur from other editor
            onSetEditing(sticky.id)
            return
          }
        }
      }

      // Fallback: couldn't find task, just enter edit mode
      if (!isSelected) {
        onSelect(sticky.id, false)
      }
      onSetEditing(sticky.id)
      return
    }

    // Don't enter edit mode for multi-select clicks
    const isMultiSelect = e.metaKey || e.ctrlKey
    if (isMultiSelect) {
      return
    }

    // Don't enter edit mode for link clicks
    if (target.tagName === 'A' && target.getAttribute('href')) {
      return
    }

    e.preventDefault() // Prevent text selection when not editing

    // Select the sticky (handles deselecting others)
    if (!isSelected) {
      onSelect(sticky.id, false)
    }

    // Set editing state immediately on mousedown, before blur events from other editors
    // This ensures the stale blur check in context works correctly
    onSetEditing(sticky.id)
    setClickCoords({ x: e.clientX, y: e.clientY })
  }, [isEditing, isSelected, sticky.id, onSelect, onSetEditing])

  const handleColorSelect = useCallback((color: StickyColor) => {
    onUpdate(sticky.id, { color })
    setShowColorPicker(false)
  }, [sticky.id, onUpdate])

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (onToggleTodo) {
      onToggleTodo(sticky.id)
    }
  }, [sticky.id, onToggleTodo])

  const handleFocusSource = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (onFocusSource && sticky.sourceId) {
      onFocusSource(sticky.sourceId)
    }
  }, [sticky.sourceId, onFocusSource])

  // Shadow classes
  const shadowClass = isEditing
    ? 'ring-2 ring-indigo-400 shadow-xl'
    : isSelected
      ? 'shadow-[0_0_0_2px_#6366f1,0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)]'
      : 'shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)]'

  // Background color based on sticky color
  const currentColor = sticky.color || 'default'
  const colorConfig = STICKY_COLORS[currentColor]
  const bgClass = colorConfig.bg
  const headerClass = isSelected ? colorConfig.header : ''

  // Opacity for completed tasks
  const completedOpacity = showCheckbox && todoInfo.checked ? 'opacity-50' : ''

  return (
    <>
      <div
        ref={containerRef}
        data-sticky
        className={`
          absolute rounded-lg overflow-hidden
          ${bgClass}
          border border-gray-200 dark:border-gray-700
          transition-all duration-200
          ${shadowClass}
          ${completedOpacity}
          ${isLongPressing ? 'scale-[1.02] opacity-90' : ''}
          ${!isEditing ? 'select-none' : ''}
        `}
        style={{
          left: sticky.x,
          top: sticky.y,
          width: width,
          minHeight: minHeight,
          zIndex: isEditing ? 9999 : isSelected ? 100 : sticky.zIndex || 1,
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={longPress.onTouchStart}
        onTouchMove={longPress.onTouchMove}
        onTouchEnd={longPress.onTouchEnd}
      >
      {/* Header - drag handle (mouse only, touch uses long-press on whole card) */}
      <div
        className={`
          ${isTaskMode ? 'h-4' : 'h-5'} w-full flex items-center justify-between px-2
          cursor-grab active:cursor-grabbing
          group
          ${headerClass}
        `}
        onMouseDown={handleHeaderMouseDown}
      >
        {/* Left side: Checkbox (for task stickies) or Color picker (for regular notes) */}
        {showCheckbox ? (
          <div className="flex items-center gap-1.5">
            {/* Checkbox */}
            <input
              type="checkbox"
              checked={todoInfo.checked}
              onChange={() => {}}
              onClick={handleCheckboxClick}
              onMouseDown={e => e.stopPropagation()}
              className="w-3.5 h-3.5 accent-[var(--color-accent)] cursor-pointer rounded"
            />
            {/* Priority indicator */}
            {todoInfo.priority >= 3 && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            )}
            {todoInfo.priority === 2 && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            )}
            {todoInfo.priority === 1 && (
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            )}
          </div>
        ) : (
          <div className="relative" ref={colorPickerRef}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowColorPicker(!showColorPicker)
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-opacity cursor-pointer"
            >
              <Palette size={12} />
            </button>

            {/* Color picker dropdown */}
            {showColorPicker && (
              <div
                className="absolute left-0 top-5 z-50 flex gap-1 p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {STICKY_COLOR_ORDER.map((color) => (
                  <button
                    key={color}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleColorSelect(color)
                    }}
                    className={`
                      w-5 h-5 rounded-full border transition-transform hover:scale-110 cursor-pointer
                      ${STICKY_COLORS[color].swatch}
                      ${currentColor === color ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}
                    `}
                    title={color.charAt(0).toUpperCase() + color.slice(1)}
                  >
                    {currentColor === color && (
                      <Check size={12} className="mx-auto text-gray-600 dark:text-gray-300" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Right side: Source link (for task stickies with source) or Delete button */}
        {showCheckbox && sticky.sourceId ? (
          <button
            onClick={handleFocusSource}
            onMouseDown={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-accent text-xs transition-opacity cursor-pointer"
            title="Go to source"
          >
            ↗
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(sticky.id)
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-red-500 transition-opacity cursor-pointer"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Parent context for promoted subtasks */}
      {sticky.taskParentText && (
        <div
          className="px-3 -mt-0.5 mb-1"
          onClick={handleFocusSource}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-accent cursor-pointer truncate block">
            ↳ {sticky.taskParentText}
          </span>
        </div>
      )}

      {/* Content */}
      <div
        className={`${isTaskMode ? 'px-3 pb-3' : 'px-4 pb-4'} cursor-text overflow-hidden`}
        style={{ minHeight: minHeight - headerHeight - 16 }}
        onMouseDown={handleContentMouseDown}
        onClick={handleContentClick}
      >
        <div ref={contentRef}>
          {isEditing ? (
            <TiptapEditor
              content={sticky.content}
              onChange={handleContentChange}
              onBlur={handleBlur}
              onDeleteEmpty={() => onDelete(sticky.id)}
              onCursorMove={handleCursorMove}
              placeholder={isTaskMode ? "Task..." : "Type here..."}
              editable={true}
              focusCoords={clickCoords}
              toggleTaskIndex={toggleTaskIndex}
              focusTaskIndex={focusTaskIndex}
            />
          ) : (
            <StickyContentView content={sticky.content} />
          )}
        </div>
      </div>
    </div>
    </>
  )
}

// Export with original name for backwards compatibility
export { StickyComponent as Sticky }
