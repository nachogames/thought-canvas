import { useRef, useState, useLayoutEffect, useCallback, useEffect, useMemo } from 'react'
import { Trash2, Palette, Check } from 'lucide-react'
import { STICKY_WIDTH, TASK_STICKY_WIDTH, MIN_STICKY_HEIGHT, MIN_TASK_STICKY_HEIGHT, STICKY_GAP, GRID_SIZE, STICKY_COLORS, STICKY_COLOR_ORDER } from '@/constants'
import { TiptapEditor } from '@/components/molecules/TiptapEditor'
import { getStickyHeight } from '@/utils/textMeasurement'
import { parseContent } from '@/utils/parseContent'
import { useLongPress } from '@/hooks'
import type { Sticky as StickyType, StickyColor } from '@/types'

// Debug: show collision boxes (set to true to visualize)
const DEBUG_COLLISION_BOXES = false

interface StickyProps {
  sticky: StickyType
  onUpdate: (id: string, updates: Partial<StickyType>) => void
  onDelete: (id: string) => void
  onDragStart: (id: string, e: React.MouseEvent | React.TouchEvent) => void
  isSelected: boolean
  onSelect: (id: string, addToSelection?: boolean) => void
  isEditing: boolean
  onSetEditing: (id: string | null) => void
  // Task mode props
  variant?: 'note' | 'task'
  onToggleTodo?: (id: string) => void
  onFocusSource?: (id: string) => void
  // Direct todo data (avoids parsing content in task mode)
  todoData?: { checked: boolean; priority: number; tags: Set<string> }
  // Called when long-press is cancelled due to movement - triggers pan
  onRequestPan?: (e: React.TouchEvent) => void
  // Disable transitions during drag
  isDragging?: boolean
}

export function Sticky({
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
  isDragging = false,
}: StickyProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState(0)
  const [clickCoords, setClickCoords] = useState<{ x: number; y: number } | null>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [isLongPressing, setIsLongPressing] = useState(false)

  const isTaskMode = variant === 'task'
  const width = isTaskMode ? TASK_STICKY_WIDTH : STICKY_WIDTH
  const minHeight = isTaskMode ? MIN_TASK_STICKY_HEIGHT : MIN_STICKY_HEIGHT

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

  // Measure content height and report to parent for collision detection
  useLayoutEffect(() => {
    if (contentRef.current) {
      const newContentHeight = contentRef.current.offsetHeight
      setContentHeight(newContentHeight)

      // Calculate total height same as render, snapped to grid
      const headerHeight = isTaskMode ? 16 : 20
      const rawHeight = Math.max(minHeight, newContentHeight + headerHeight + 32)
      const snappedHeight = Math.ceil(rawHeight / GRID_SIZE) * GRID_SIZE

      // Report measured height if different (for collision detection)
      if (sticky.measuredHeight !== snappedHeight) {
        onUpdate(sticky.id, { measuredHeight: snappedHeight })
      }
    }
  }, [sticky.content, sticky.id, sticky.measuredHeight, onUpdate, isTaskMode, minHeight])

  const handleContentChange = useCallback((html: string) => {
    onUpdate(sticky.id, { content: html })
  }, [sticky.id, onUpdate])

  const handleBlur = useCallback(() => {
    onSetEditing(null)
  }, [onSetEditing])

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditing) return
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
  }, [isEditing, isSelected, sticky.id, onSelect, onDragStart])

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
    if (isEditing) return
    e.stopPropagation()

    // Check if content is empty (just whitespace or empty HTML)
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = sticky.content
    const isEmpty = !tempDiv.textContent?.trim()

    // For empty notes, go straight to edit mode
    if (isEmpty) {
      if (!isSelected) {
        onSelect(sticky.id, false)
      }
      setClickCoords({ x: e.clientX, y: e.clientY })
      onSetEditing(sticky.id)
      return
    }

    if (!isSelected) {
      onSelect(sticky.id, e.metaKey || e.ctrlKey)
    } else {
      // Capture click coordinates for cursor positioning
      setClickCoords({ x: e.clientX, y: e.clientY })
      onSetEditing(sticky.id)
    }
  }, [isEditing, isSelected, sticky.id, sticky.content, onSelect, onSetEditing])

  const handleContentMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditing) return
    e.stopPropagation()
    e.preventDefault() // Prevent text selection when not editing
  }, [isEditing])

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

  // Calculate height based on actual content, snapped to grid for consistent spacing
  const headerHeight = isTaskMode ? 16 : 20
  const rawHeight = Math.max(
    minHeight,
    contentHeight + headerHeight + 32 // header + content padding (16 top + 16 bottom)
  )
  const calculatedHeight = Math.ceil(rawHeight / GRID_SIZE) * GRID_SIZE

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

  // Height the collision algorithm calculates (from text content)
  const collisionHeight = getStickyHeight(sticky.content, sticky.measuredHeight)

  // Opacity for completed tasks
  const completedOpacity = showCheckbox && todoInfo.checked ? 'opacity-50' : ''

  return (
    <>
      {/* Debug: Shows collision zones - cyan boxes should just TOUCH, not overlap */}
      {DEBUG_COLLISION_BOXES && (
        <>
          {/* CYAN: 10px buffer on each side - when two cyan boxes TOUCH, that's 20px gap */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: sticky.x - STICKY_GAP / 2,
              top: sticky.y - STICKY_GAP / 2,
              width: width + STICKY_GAP,
              height: collisionHeight + STICKY_GAP,
              border: '2px solid rgba(0, 255, 255, 0.5)',
              borderRadius: 12,
              zIndex: 0,
            }}
          />
          {/* Debug label */}
          <div
            className="absolute pointer-events-none text-xs font-mono"
            style={{
              left: sticky.x + width + 4,
              top: sticky.y,
              color: collisionHeight !== calculatedHeight ? 'red' : 'lime',
              zIndex: 9999,
              background: 'rgba(0,0,0,0.8)',
              padding: '2px 4px',
              borderRadius: 4,
            }}
          >
            H:{collisionHeight}
          </div>
        </>
      )}
      <div
        ref={containerRef}
        data-sticky
        className={`
          absolute rounded-lg overflow-hidden
          ${bgClass}
          border border-gray-200 dark:border-gray-700
          ${isDragging ? '' : 'transition-all duration-200'}
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
          height: calculatedHeight,
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

      {/* Content */}
      <div
        className={`${isTaskMode ? 'px-3 pb-3' : 'px-4 pb-4'} cursor-text`}
        style={{ minHeight: minHeight - headerHeight - 16 }}
        onMouseDown={handleContentMouseDown}
        onClick={handleContentClick}
      >
        <div
          ref={contentRef}
          style={{ pointerEvents: isEditing ? 'auto' : 'none' }}
        >
          <TiptapEditor
            content={sticky.content}
            onChange={handleContentChange}
            onBlur={handleBlur}
            onDeleteEmpty={() => onDelete(sticky.id)}
            placeholder={isTaskMode ? "Task..." : "Type here..."}
            autoFocus={isEditing}
            editable={isEditing}
            focusCoords={clickCoords}
          />
        </div>
      </div>
    </div>
    </>
  )
}
