import { useRef, useState, useLayoutEffect, useCallback, useEffect } from 'react'
import { Trash2, Palette, Check } from 'lucide-react'
import { STICKY_WIDTH, MIN_STICKY_HEIGHT, STICKY_GAP, GRID_SIZE, STICKY_COLORS, STICKY_COLOR_ORDER } from '@/constants'
import { TiptapEditor } from '@/components/molecules/TiptapEditor'
import { getStickyHeight } from '@/utils/textMeasurement'
import type { Sticky as StickyType, StickyColor } from '@/types'

// Debug: show collision boxes (set to true to visualize)
const DEBUG_COLLISION_BOXES = false

interface StickyProps {
  sticky: StickyType
  onUpdate: (id: string, updates: Partial<StickyType>) => void
  onDelete: (id: string) => void
  onDragStart: (id: string, e: React.MouseEvent) => void
  isSelected: boolean
  onSelect: (id: string, addToSelection?: boolean) => void
  isEditing: boolean
  onSetEditing: (id: string | null) => void
}

export function Sticky({
  sticky,
  onUpdate,
  onDelete,
  onDragStart,
  isSelected,
  onSelect,
  isEditing,
  onSetEditing
}: StickyProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState(0)
  const [clickCoords, setClickCoords] = useState<{ x: number; y: number } | null>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)

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
      const rawHeight = Math.max(MIN_STICKY_HEIGHT, newContentHeight + 20 + 32)
      const snappedHeight = Math.ceil(rawHeight / GRID_SIZE) * GRID_SIZE

      // Report measured height if different (for collision detection)
      if (sticky.measuredHeight !== snappedHeight) {
        onUpdate(sticky.id, { measuredHeight: snappedHeight })
      }
    }
  }, [sticky.content, sticky.id, sticky.measuredHeight, onUpdate])

  const handleContentChange = useCallback((html: string) => {
    onUpdate(sticky.id, { content: html })
  }, [sticky.id, onUpdate])

  const handleBlur = useCallback(() => {
    onSetEditing(null)
  }, [onSetEditing])

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditing) return
    e.stopPropagation()
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

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    if (isEditing) return
    e.stopPropagation()

    if (!isSelected) {
      onSelect(sticky.id, e.metaKey || e.ctrlKey)
    } else {
      // Capture click coordinates for cursor positioning
      setClickCoords({ x: e.clientX, y: e.clientY })
      onSetEditing(sticky.id)
    }
  }, [isEditing, isSelected, sticky.id, onSelect, onSetEditing])

  const handleContentMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditing) return
    e.stopPropagation()
  }, [isEditing])

  const handleColorSelect = useCallback((color: StickyColor) => {
    onUpdate(sticky.id, { color })
    setShowColorPicker(false)
  }, [sticky.id, onUpdate])

  // Calculate height based on actual content, snapped to grid for consistent spacing
  const rawHeight = Math.max(
    MIN_STICKY_HEIGHT,
    contentHeight + 20 + 32 // header + content padding (16 top + 16 bottom)
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
              width: STICKY_WIDTH + STICKY_GAP,
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
              left: sticky.x + STICKY_WIDTH + 4,
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
          transition-shadow duration-200
          ${shadowClass}
        `}
        style={{
          left: sticky.x,
          top: sticky.y,
          width: STICKY_WIDTH,
          minHeight: MIN_STICKY_HEIGHT,
          height: calculatedHeight,
          zIndex: isEditing ? 9999 : isSelected ? 100 : sticky.zIndex || 1,
        }}
        onClick={(e) => e.stopPropagation()}
      >
      {/* Header - drag handle */}
      <div
        className={`
          h-5 w-full flex items-center justify-between px-2
          cursor-grab active:cursor-grabbing
          group
          ${headerClass}
        `}
        onMouseDown={handleHeaderMouseDown}
      >
        {/* Color picker button */}
        <div className="relative" ref={colorPickerRef}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowColorPicker(!showColorPicker)
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-opacity"
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
                    w-5 h-5 rounded-full border transition-transform hover:scale-110
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

        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(sticky.id)
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-red-500 transition-opacity"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Content */}
      <div
        className="px-4 pb-4 cursor-text"
        style={{ minHeight: MIN_STICKY_HEIGHT - 20 - 16 }}
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
            placeholder="Type here..."
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
