import { useRef, useEffect, useMemo, useCallback, useState, type ReactNode } from 'react'
import { HelpCircle, X } from 'lucide-react'
import { useStickies, useIsMobile } from '@/hooks'
import { STICKY_WIDTH, STICKY_GAP } from '@/constants'
import { CanvasBackground } from './CanvasBackground'
import { Sticky } from '../Sticky'
import { DayGroup } from '../DayGroup'
import type { DayGroup as DayGroupType, Sticky as StickyType } from '@/types'

const TASKS_GROUP_DATE = '__tasks__'

// Debug: visualize gaps between stickies
const DEBUG_GAPS = false

interface GapRect {
  x: number
  y: number
  width: number
  height: number
  type: 'horizontal' | 'vertical'
  actualGap: number
}

function GapDebugOverlay({ stickies, getStickyHeight }: { stickies: StickyType[], getStickyHeight: (content: string, measuredHeight?: number) => number }) {
  if (!DEBUG_GAPS) return null

  const gaps: GapRect[] = []

  // Group stickies by date
  const byDate: Record<string, StickyType[]> = {}
  stickies.forEach(s => {
    const date = s.date || 'unknown'
    if (!byDate[date]) byDate[date] = []
    byDate[date].push(s)
  })

  // Helper: check if another sticky blocks the gap between a and b
  const hasBlockingSticky = (
    groupStickies: StickyType[],
    a: StickyType,
    b: StickyType,
    aBottom: number,
    direction: 'vertical' | 'horizontal'
  ): boolean => {
    const aHeight = getStickyHeight(a.content, a.measuredHeight)
    const bHeight = getStickyHeight(b.content, b.measuredHeight)

    for (const c of groupStickies) {
      if (c.id === a.id || c.id === b.id) continue
      const cHeight = getStickyHeight(c.content, c.measuredHeight)

      if (direction === 'vertical') {
        // Check if c is horizontally overlapping with both a and b
        const cOverlapsA = !(c.x + STICKY_WIDTH <= a.x || a.x + STICKY_WIDTH <= c.x)
        const cOverlapsB = !(c.x + STICKY_WIDTH <= b.x || b.x + STICKY_WIDTH <= c.x)
        if (cOverlapsA && cOverlapsB) {
          // Check if c is vertically between a and b
          const gapTop = Math.min(aBottom, b.y + bHeight)
          const gapBottom = Math.max(aBottom, b.y)
          if (c.y < gapBottom && c.y + cHeight > gapTop) {
            return true // c blocks the gap
          }
        }
      } else {
        // Horizontal: check if c is vertically overlapping with both a and b
        const cOverlapsA = !(c.y + cHeight <= a.y || a.y + aHeight <= c.y)
        const cOverlapsB = !(c.y + cHeight <= b.y || b.y + bHeight <= c.y)
        if (cOverlapsA && cOverlapsB) {
          // Check if c is horizontally between a and b
          const gapLeft = Math.min(a.x + STICKY_WIDTH, b.x + STICKY_WIDTH)
          const gapRight = Math.max(a.x, b.x)
          if (c.x < gapRight && c.x + STICKY_WIDTH > gapLeft) {
            return true // c blocks the gap
          }
        }
      }
    }
    return false
  }

  // Find gaps only between neighboring cards within each group
  Object.values(byDate).forEach(groupStickies => {
    for (let i = 0; i < groupStickies.length; i++) {
      const a = groupStickies[i]
      const aHeight = getStickyHeight(a.content, a.measuredHeight)
      const aBottom = a.y + aHeight

      for (let j = i + 1; j < groupStickies.length; j++) {
        const b = groupStickies[j]
        const bHeight = getStickyHeight(b.content, b.measuredHeight)

        // Check if horizontally overlapping (same column)
        const horizOverlap = !(a.x + STICKY_WIDTH <= b.x || b.x + STICKY_WIDTH <= a.x)

        if (horizOverlap) {
          // Check if b is below a
          if (b.y > aBottom) {
            // Only show if no other card blocks this gap
            if (!hasBlockingSticky(groupStickies, a, b, aBottom, 'vertical')) {
              const gap = b.y - aBottom
              gaps.push({
                x: Math.max(a.x, b.x),
                y: aBottom,
                width: Math.min(a.x + STICKY_WIDTH, b.x + STICKY_WIDTH) - Math.max(a.x, b.x),
                height: gap,
                type: 'vertical',
                actualGap: gap
              })
            }
          }
          // Check if a is below b
          const bBottom = b.y + bHeight
          if (a.y > bBottom) {
            // Only show if no other card blocks this gap
            if (!hasBlockingSticky(groupStickies, b, a, bBottom, 'vertical')) {
              const gap = a.y - bBottom
              gaps.push({
                x: Math.max(a.x, b.x),
                y: bBottom,
                width: Math.min(a.x + STICKY_WIDTH, b.x + STICKY_WIDTH) - Math.max(a.x, b.x),
                height: gap,
                type: 'vertical',
                actualGap: gap
              })
            }
          }
        }

        // Check if vertically overlapping (same row)
        const vertOverlap = !(a.y + aHeight <= b.y || b.y + bHeight <= a.y)

        if (vertOverlap) {
          // Check if b is to the right of a
          if (b.x > a.x + STICKY_WIDTH) {
            // Only show if no other card blocks this gap
            if (!hasBlockingSticky(groupStickies, a, b, aBottom, 'horizontal')) {
              const gap = b.x - (a.x + STICKY_WIDTH)
              gaps.push({
                x: a.x + STICKY_WIDTH,
                y: Math.max(a.y, b.y),
                width: gap,
                height: Math.min(a.y + aHeight, b.y + bHeight) - Math.max(a.y, b.y),
                type: 'horizontal',
                actualGap: gap
              })
            }
          }
          // Check if a is to the right of b
          if (a.x > b.x + STICKY_WIDTH) {
            // Only show if no other card blocks this gap
            const bBottomLocal = b.y + bHeight
            if (!hasBlockingSticky(groupStickies, b, a, bBottomLocal, 'horizontal')) {
              const gap = a.x - (b.x + STICKY_WIDTH)
              gaps.push({
                x: b.x + STICKY_WIDTH,
                y: Math.max(a.y, b.y),
                width: gap,
                height: Math.min(a.y + aHeight, b.y + bHeight) - Math.max(a.y, b.y),
                type: 'horizontal',
                actualGap: gap
              })
            }
          }
        }
      }
    }
  })

  return (
    <>
      {gaps.map((gap, i) => (
        <div key={i}>
          {/* Gap rectangle */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: gap.x,
              top: gap.y,
              width: gap.width,
              height: gap.height,
              background: gap.actualGap === STICKY_GAP ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)',
              border: `1px solid ${gap.actualGap === STICKY_GAP ? 'lime' : 'red'}`,
              zIndex: 9000,
            }}
          />
          {/* Gap size label */}
          <div
            className="absolute pointer-events-none text-xs font-mono"
            style={{
              left: gap.x + gap.width / 2 - 10,
              top: gap.y + gap.height / 2 - 8,
              color: gap.actualGap === STICKY_GAP ? 'lime' : 'red',
              background: 'rgba(0,0,0,0.8)',
              padding: '2px 4px',
              borderRadius: 4,
              zIndex: 9001,
            }}
          >
            {gap.actualGap}
          </div>
        </div>
      ))}
    </>
  )
}

interface CanvasProps {
  children?: ReactNode
}

export function Canvas({ children }: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const helpRef = useRef<HTMLDivElement>(null)
  const [showHelp, setShowHelp] = useState(false)
  const isMobile = useIsMobile()
  const {
    stickies,
    selectedIds,
    editingId,
    setEditingId,
    offset,
    panning,
    drag,
    createSticky,
    updateSticky,
    deleteSticky,
    selectSticky,
    startDrag,
    startGroupDrag,
    updateDrag,
    endDrag,
    arrangeGroup,
    startPan,
    updatePan,
    endPan,
    setOffset,
    getStickyHeight,
    showTasks,
    taskViewMode,
    setShowTasks,
    toggleTaskTodo,
    updateTaskStickyContent,
    panToSticky,
    filters,
    setFilters,
  } = useStickies()

  // Check if overlay mode is active
  const showOverlay = showTasks && taskViewMode === 'overlay'

  // Memoized update handler for task stickies (avoids re-render on every Canvas render)
  const handleTaskStickyUpdate = useCallback((id: string, updates: Partial<import('@/types').Sticky>) => {
    // Bidirectional sync: update source sticky when content changes
    if (updates.content !== undefined) {
      updateTaskStickyContent(id, updates.content)
    } else {
      updateSticky(id, updates)
    }
  }, [updateTaskStickyContent, updateSticky])

  // ? key to toggle help (when not editing)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !editingId) {
        e.preventDefault()
        setShowHelp(prev => !prev)
      }
      // Escape to close help
      if (e.key === 'Escape' && showHelp) {
        setShowHelp(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editingId, showHelp])

  // Click outside to close help
  useEffect(() => {
    if (!showHelp) return
    const handleClick = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setShowHelp(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showHelp])

  // Separate task stickies from regular stickies
  // Regular stickies (not tasks)
  const regularStickies = useMemo(() =>
    stickies.filter(s => s.date !== TASKS_GROUP_DATE),
    [stickies]
  )

  // Task stickies - already filtered by the sync effect based on current filters
  const taskStickies = useMemo(() =>
    stickies.filter(s => s.date === TASKS_GROUP_DATE),
    [stickies]
  )

  // Task count for header (shows visible counts since taskStickies is pre-filtered)
  const taskCount = useMemo(() => ({
    completed: taskStickies.filter(s => s.taskChecked).length,
    total: taskStickies.length
  }), [taskStickies])

  // Create a key that changes when any sticky's measuredHeight changes
  // This ensures bounds recalculate after Sticky components measure themselves
  const measuredHeightsKey = useMemo(() =>
    regularStickies.map(s => s.measuredHeight ?? 0).join(','),
    [regularStickies]
  )

  // Calculate day groups with bounds (regular stickies only)
  const dayGroups = useMemo(() => {
    const groups: Record<string, DayGroupType> = {}

    regularStickies.forEach(s => {
      if (!groups[s.date]) {
        groups[s.date] = { stickies: [], bounds: null }
      }
      groups[s.date].stickies.push(s)
    })

    Object.keys(groups).forEach(date => {
      const groupStickies = groups[date].stickies
      if (!groupStickies.length) return

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      groupStickies.forEach(s => {
        const height = getStickyHeight(s.content, s.measuredHeight)
        minX = Math.min(minX, s.x)
        minY = Math.min(minY, s.y)
        maxX = Math.max(maxX, s.x + STICKY_WIDTH)
        maxY = Math.max(maxY, s.y + height)
      })

      // No grid snapping needed - sticky positions are already grid-aligned
      groups[date].bounds = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      }
    })

    return groups
  }, [regularStickies, getStickyHeight, measuredHeightsKey])

  // Same for task stickies
  const taskMeasuredHeightsKey = useMemo(() =>
    taskStickies.map(s => s.measuredHeight ?? 0).join(','),
    [taskStickies]
  )

  // Calculate tasks group bounds (taskStickies is already filtered by sync effect)
  const tasksGroupBounds = useMemo(() => {
    if (!showOverlay) return null

    // If no visible task stickies, show empty group at a default position
    if (taskStickies.length === 0) {
      return {
        x: 100,
        y: 100,
        width: STICKY_WIDTH,
        height: 80
      }
    }

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    taskStickies.forEach(s => {
      const height = getStickyHeight(s.content, s.measuredHeight)
      minX = Math.min(minX, s.x)
      minY = Math.min(minY, s.y)
      maxX = Math.max(maxX, s.x + STICKY_WIDTH)
      maxY = Math.max(maxY, s.y + height)
    })

    // No grid snapping needed - sticky positions are already grid-aligned
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
  }, [showOverlay, taskStickies, getStickyHeight, taskMeasuredHeightsKey])

  // Determine if we're dragging (for cursor and text selection)
  const isDragging = drag !== null

  // Disable text selection globally when dragging or panning
  useEffect(() => {
    if (isDragging || panning) {
      document.body.classList.add('select-none')
    } else {
      document.body.classList.remove('select-none')
    }
    return () => {
      document.body.classList.remove('select-none')
    }
  }, [isDragging, panning])

  // Mouse and touch event handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (panning) {
        updatePan(e)
      } else {
        updateDrag(e)
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (panning) {
        e.preventDefault() // Prevent scrolling while panning
        updatePan(e)
      } else if (drag) {
        e.preventDefault() // Prevent scrolling while dragging
        updateDrag(e)
      }
    }

    const handleMouseUp = () => {
      endDrag()
      endPan()
    }

    const handleTouchEnd = () => {
      endDrag()
      endPan()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [panning, updateDrag, endDrag, updatePan, endPan])

  const handleCanvasClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    // Clear selection and edit mode if clicking anywhere except on a sticky or group header
    if (!target.closest('[data-sticky]') && !target.closest('[data-group-header]')) {
      selectSticky(null)
      setEditingId(null)
    }
  }

  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    // Only create sticky if not clicking on an existing sticky or group header
    if (!target.closest('[data-sticky]') && !target.closest('[data-group-header]')) {
      createSticky(e.clientX, e.clientY)
    }
  }

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Middle mouse button always pans
    if (e.button === 1) {
      e.preventDefault()
      startPan(e)
      return
    }

    // Left click on empty space starts pan
    if (e.button === 0) {
      const target = e.target as HTMLElement
      // Only pan if clicking directly on canvas background, not stickies or group headers
      if (!target.closest('[data-sticky]') && !target.closest('[data-group-header]')) {
        startPan(e)
      }
    }
  }

  const handleCanvasTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement
    // Only pan if touching directly on canvas background, not stickies or group headers
    if (!target.closest('[data-sticky]') && !target.closest('[data-group-header]')) {
      startPan(e)
    }
  }

  // Check if element is inside a no-pan zone (help popover, modals, etc.)
  const isInNoPanZone = useCallback((target: HTMLElement): boolean => {
    let el: HTMLElement | null = target
    while (el && el !== canvasRef.current) {
      // Check for data-no-pan attribute or if inside help popover
      if (el.hasAttribute('data-no-pan') || el === helpRef.current) {
        return true
      }
      el = el.parentElement
    }
    return false
  }, [])

  // Native wheel handler to prevent browser back/forward and handle panning
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheel = (e: WheelEvent) => {
      // Don't pan if inside a no-pan zone (help popover, etc.)
      if (isInNoPanZone(e.target as HTMLElement)) {
        return
      }

      // Prevent browser back/forward navigation on horizontal swipe (Chrome Mac)
      e.preventDefault()

      // Update offset based on scroll delta
      setOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }))
    }

    // Must use { passive: false } to allow preventDefault
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [setOffset, isInNoPanZone])

  return (
    <div
      ref={canvasRef}
      className={`flex-1 relative overflow-hidden bg-bg touch-none ${isDragging || panning ? 'select-none' : ''}`}
      style={{ cursor: panning ? 'grabbing' : isDragging ? 'grabbing' : 'default' }}
      onClick={handleCanvasClick}
      onDoubleClick={handleCanvasDoubleClick}
      onMouseDown={handleCanvasMouseDown}
      onTouchStart={handleCanvasTouchStart}
    >
      <CanvasBackground offsetX={offset.x} offsetY={offset.y} />

      <div
        className={`canvas-bg absolute ${isDragging ? 'is-dragging' : ''}`}
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      >
        {/* Day groups */}
        {Object.entries(dayGroups).map(([date, group]) =>
          group.bounds && (
            <DayGroup
              key={date}
              date={date}
              bounds={group.bounds}
              onDragStart={(e) => startGroupDrag(date, e)}
              onArrange={() => arrangeGroup(date)}
              onRequestPan={startPan}
              isDragging={isDragging}
            />
          )
        )}

        {/* Tasks group (overlay mode) */}
        {showOverlay && tasksGroupBounds && (
          <DayGroup
            key={TASKS_GROUP_DATE}
            date={TASKS_GROUP_DATE}
            bounds={tasksGroupBounds}
            label="Tasks"
            onDragStart={(e) => startGroupDrag(TASKS_GROUP_DATE, e)}
            onArrange={() => arrangeGroup(TASKS_GROUP_DATE, new Set(taskStickies.map(s => s.id)))}
            onClose={() => setShowTasks(false)}
            filters={filters}
            setFilters={setFilters}
            taskCount={taskCount}
            onRequestPan={startPan}
            isDragging={isDragging}
          />
        )}

        {/* Debug: Gap visualization */}
        <GapDebugOverlay stickies={regularStickies} getStickyHeight={getStickyHeight} />

        {/* Regular stickies */}
        {regularStickies.map(sticky => (
          <Sticky
            key={sticky.id}
            sticky={sticky}
            onUpdate={updateSticky}
            onDelete={deleteSticky}
            onDragStart={startDrag}
            isSelected={selectedIds.has(sticky.id)}
            onSelect={selectSticky}
            isEditing={editingId === sticky.id}
            onSetEditing={setEditingId}
            onRequestPan={startPan}
          />
        ))}

        {/* Task stickies (overlay mode) */}
        {showOverlay && taskStickies.map(sticky => (
          <Sticky
            key={sticky.id}
            sticky={sticky}
            onUpdate={handleTaskStickyUpdate}
            onDelete={deleteSticky}
            onDragStart={startDrag}
            isSelected={selectedIds.has(sticky.id)}
            onSelect={selectSticky}
            isEditing={editingId === sticky.id}
            onSetEditing={setEditingId}
            onToggleTodo={toggleTaskTodo}
            onFocusSource={panToSticky}
            onRequestPan={startPan}
          />
        ))}
      </div>

      {children}

      {/* Help button & popover - hidden on mobile */}
      {!isMobile && (
        <div className="absolute bottom-4 right-4" ref={helpRef}>
          <button
            onClick={() => setShowHelp(prev => !prev)}
            className={`
              p-2 rounded-full transition-all cursor-pointer
              ${showHelp
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 scale-110'
                : 'bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:scale-105'
              }
              shadow-md border border-gray-200 dark:border-gray-700
            `}
            title="Keyboard shortcuts (?)"
          >
            <HelpCircle size={18} />
          </button>

          {showHelp && (
            <div className="absolute bottom-full right-0 mb-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-[100]">
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <span className="font-medium text-sm text-gray-700 dark:text-gray-200">Keyboard Shortcuts</span>
                <button
                  onClick={() => setShowHelp(false)}
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="p-3 space-y-3 text-[13px] max-h-80 overflow-y-auto">
                {/* Canvas shortcuts */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Canvas</div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">New note</span>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">double-click</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Edit selected</span>
                    <kbd className="key">Enter</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Delete selected</span>
                    <kbd className="key">Backspace</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Arrange group</span>
                    <div className="flex gap-0.5">
                      <kbd className="key">⌘</kbd>
                      <kbd className="key">⇧</kbd>
                      <kbd className="key">G</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Undo / Redo</span>
                    <div className="flex gap-0.5">
                      <kbd className="key">⌘</kbd>
                      <kbd className="key">Z</kbd>
                      <span className="text-gray-400 mx-1">/</span>
                      <kbd className="key">⌘</kbd>
                      <kbd className="key">⇧</kbd>
                      <kbd className="key">Z</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Center on today</span>
                    <kbd className="key">0</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Previous / Next day</span>
                    <div className="flex gap-0.5">
                      <kbd className="key">←</kbd>
                      <kbd className="key">→</kbd>
                    </div>
                  </div>
                </div>

                {/* Editor shortcuts */}
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Editor</div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Slash commands</span>
                    <kbd className="key">/</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Toggle todo</span>
                    <div className="flex gap-0.5">
                      <kbd className="key">⌘</kbd>
                      <kbd className="key">Enter</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Bullet list</span>
                    <div className="flex gap-0.5">
                      <kbd className="key">⌘</kbd>
                      <kbd className="key">⇧</kbd>
                      <kbd className="key">B</kbd>
                    </div>
                  </div>
                </div>

                {/* General */}
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">General</div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">This help</span>
                    <kbd className="key">?</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Close / Deselect</span>
                    <kbd className="key">Esc</kbd>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
