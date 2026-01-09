import { useRef, useEffect, useMemo, useCallback, type ReactNode } from 'react'
import { Crosshair } from 'lucide-react'
import { useStickies } from '@/hooks'
import { STICKY_WIDTH } from '@/constants'
import { IconButton } from '@/components/atoms/Button'
import { CanvasBackground } from './CanvasBackground'
import { Sticky } from '../Sticky'
import { DayGroup } from '../DayGroup'
import type { DayGroup as DayGroupType } from '@/types'

const TASKS_GROUP_DATE = '__tasks__'

interface CanvasProps {
  children?: ReactNode
}

export function Canvas({ children }: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
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
    // Clear selection if clicking anywhere except on a sticky or group header
    if (!target.closest('[data-sticky]') && !target.closest('[data-group-header]')) {
      selectSticky(null)
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

  // Scroll/wheel to pan
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Update offset based on scroll delta
    setOffset(prev => ({
      x: prev.x - e.deltaX,
      y: prev.y - e.deltaY
    }))
  }, [setOffset])

  // Recenter view
  const handleRecenter = useCallback(() => {
    setOffset({ x: 0, y: 0 })
  }, [setOffset])

  return (
    <div
      ref={canvasRef}
      className={`flex-1 relative overflow-hidden bg-bg touch-none ${isDragging || panning ? 'select-none' : ''}`}
      style={{ cursor: panning ? 'grabbing' : isDragging ? 'grabbing' : 'default' }}
      onClick={handleCanvasClick}
      onDoubleClick={handleCanvasDoubleClick}
      onMouseDown={handleCanvasMouseDown}
      onTouchStart={handleCanvasTouchStart}
      onWheel={handleWheel}
    >
      <CanvasBackground offsetX={offset.x} offsetY={offset.y} />

      <div
        className="canvas-bg absolute"
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
          />
        )}

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
            onUpdate={(id, updates) => {
              // Bidirectional sync: update source sticky when content changes
              if (updates.content !== undefined) {
                updateTaskStickyContent(id, updates.content)
              } else {
                updateSticky(id, updates)
              }
            }}
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

      {/* Bottom controls */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <IconButton
          icon={Crosshair}
          variant="ghost"
          size="sm"
          label="Recenter view"
          onClick={handleRecenter}
          className="opacity-50 hover:opacity-100"
        />
      </div>
    </div>
  )
}
