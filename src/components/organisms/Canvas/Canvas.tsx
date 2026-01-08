import { useRef, useEffect, useMemo, useCallback, type ReactNode } from 'react'
import { Crosshair } from 'lucide-react'
import { useStickies } from '@/hooks'
import { STICKY_WIDTH, GRID_SIZE } from '@/constants'
import { IconButton } from '@/components/atoms/Button'
import { CanvasBackground } from './CanvasBackground'
import { Sticky } from '../Sticky'
import { DayGroup } from '../DayGroup'
import type { DayGroup as DayGroupType } from '@/types'

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
    startPan,
    updatePan,
    endPan,
    setOffset,
    getStickyHeight
  } = useStickies()

  // Calculate day groups with bounds
  const dayGroups = useMemo(() => {
    const groups: Record<string, DayGroupType> = {}

    stickies.forEach(s => {
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

      // Snap bounds to grid for consistent gaps
      const snappedMinX = Math.floor(minX / GRID_SIZE) * GRID_SIZE
      const snappedMinY = Math.floor(minY / GRID_SIZE) * GRID_SIZE
      const snappedMaxX = Math.ceil(maxX / GRID_SIZE) * GRID_SIZE
      const snappedMaxY = Math.ceil(maxY / GRID_SIZE) * GRID_SIZE

      groups[date].bounds = {
        x: snappedMinX,
        y: snappedMinY,
        width: snappedMaxX - snappedMinX,
        height: snappedMaxY - snappedMinY
      }
    })

    return groups
  }, [stickies, getStickyHeight])

  // Mouse event handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (panning) {
        updatePan(e)
      } else {
        updateDrag(e)
      }
    }

    const handleMouseUp = () => {
      endDrag()
      endPan()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [panning, updateDrag, endDrag, updatePan, endPan])

  const handleCanvasClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    // Clear selection if clicking anywhere except on a sticky
    if (!target.closest('[data-sticky]')) {
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

  // Determine if we're dragging (for cursor and text selection)
  const isDragging = drag !== null

  return (
    <div
      ref={canvasRef}
      className={`flex-1 relative overflow-hidden bg-bg ${isDragging || panning ? 'select-none' : ''}`}
      style={{ cursor: panning ? 'grabbing' : isDragging ? 'grabbing' : 'default' }}
      onClick={handleCanvasClick}
      onDoubleClick={handleCanvasDoubleClick}
      onMouseDown={handleCanvasMouseDown}
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
            />
          )
        )}

        {/* Stickies */}
        {stickies.map(sticky => (
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
          />
        ))}
      </div>

      {children}

      {/* Recenter button */}
      <IconButton
        icon={Crosshair}
        variant="ghost"
        size="sm"
        label="Recenter view"
        onClick={handleRecenter}
        className="absolute bottom-4 right-4 opacity-50 hover:opacity-100"
      />
    </div>
  )
}
