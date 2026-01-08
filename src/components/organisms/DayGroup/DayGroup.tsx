import { useCallback } from 'react'
import { isToday, formatDateLabel } from '@/utils'
import type { DayGroupBounds } from '@/types'
import { GROUP_PADDING } from '@/constants'

interface DayGroupProps {
  date: string
  bounds: DayGroupBounds
  onDragStart?: (e: React.MouseEvent) => void
}

export function DayGroup({ date, bounds, onDragStart }: DayGroupProps) {
  const today = isToday(date)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return // Only left click
    e.stopPropagation()
    onDragStart?.(e)
  }, [onDragStart])

  return (
    <div
      className="absolute rounded-xl pointer-events-none border-2 border-dashed border-gray-300 dark:border-gray-700"
      style={{
        left: bounds.x - GROUP_PADDING,
        top: bounds.y - GROUP_PADDING,
        width: bounds.width + GROUP_PADDING * 2,
        height: bounds.height + GROUP_PADDING * 2,
      }}
    >
      {/* Label positioned above the box */}
      <div
        data-group-header
        className="absolute -top-8 left-0 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider cursor-grab active:cursor-grabbing pointer-events-auto bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
        onMouseDown={handleMouseDown}
      >
        {today ? 'Today' : formatDateLabel(date)}
      </div>
    </div>
  )
}
