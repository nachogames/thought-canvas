import { useCallback, useState, useRef, useEffect } from 'react'
import { LayoutGrid, Calendar, Eye, EyeOff, ChevronDown } from 'lucide-react'
import { isToday, formatDateLabel } from '@/utils'
import { useLongPress } from '@/hooks'
import type { DayGroupBounds, TodoFilters, DateFilterValue } from '@/types'
import { GROUP_PADDING } from '@/constants'

interface DayGroupProps {
  date: string
  bounds: DayGroupBounds
  onDragStart?: (e: React.MouseEvent | React.TouchEvent) => void
  onArrange?: () => void
  label?: string
  onClose?: () => void
  // Filter props (only for tasks group)
  filters?: TodoFilters
  setFilters?: React.Dispatch<React.SetStateAction<TodoFilters>>
  taskCount?: { completed: number; total: number }
  // Called when long-press is cancelled due to movement - triggers pan
  onRequestPan?: (e: React.TouchEvent) => void
}

const dateOptions = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This week' },
]

export function DayGroup({
  date,
  bounds,
  onDragStart,
  onArrange,
  label,
  onClose,
  filters,
  setFilters,
  taskCount,
  onRequestPan,
}: DayGroupProps) {
  const today = isToday(date)
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false)
  const [isLongPressing, setIsLongPressing] = useState(false)
  const dateDropdownRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    onDragStart?.(e)
  }, [onDragStart])

  // Long-press hook for touch drag on group header
  const longPress = useLongPress({
    onLongPress: (e) => {
      setIsLongPressing(false)
      onDragStart?.(e)
    },
    onTouchStart: () => setIsLongPressing(true),
    onTouchEnd: () => setIsLongPressing(false),
    onMoveCancel: (e) => {
      // Movement cancelled long-press - trigger canvas pan instead
      onRequestPan?.(e)
    },
    delay: 400,
    moveThreshold: 10
  })

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!dateDropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setDateDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dateDropdownOpen])

  const labelText = label || (today ? 'Today' : formatDateLabel(date))
  const isTasksGroup = filters !== undefined && setFilters !== undefined
  const selectedDateLabel = dateOptions.find(o => o.value === (typeof filters?.dateFilter === 'string' ? filters.dateFilter : 'all'))?.label || 'All dates'

  return (
    <div
      className="absolute rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 pointer-events-none"
      style={{
        left: bounds.x - GROUP_PADDING,
        top: bounds.y - GROUP_PADDING,
        width: bounds.width + GROUP_PADDING * 2,
        height: bounds.height + GROUP_PADDING * 2,
      }}
    >
      {/* Header row */}
      <div className="absolute -top-8 left-0 right-0 flex items-center gap-2 pointer-events-auto">
        {/* Label pill with arrange button */}
        <div
          data-group-header
          className={`
            group flex items-center h-6 px-3 rounded-full text-xs font-bold uppercase tracking-wider
            cursor-grab active:cursor-grabbing bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300
            transition-transform duration-200
            ${isLongPressing ? 'scale-105' : ''}
          `}
          onMouseDown={handleMouseDown}
          onTouchStart={longPress.onTouchStart}
          onTouchMove={longPress.onTouchMove}
          onTouchEnd={longPress.onTouchEnd}
        >
          <span>{labelText}</span>
          {taskCount && (
            <span className="ml-1.5 text-[10px] font-medium text-gray-400 dark:text-gray-500 font-mono">
              {taskCount.completed}/{taskCount.total}
            </span>
          )}
          {onArrange && (
            <div className="flex items-center overflow-hidden max-w-0 group-hover:max-w-[24px] transition-all duration-200 ease-out">
              <button
                onClick={(e) => { e.stopPropagation(); onArrange() }}
                onMouseDown={e => e.stopPropagation()}
                className="ml-1.5 p-0.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center cursor-pointer"
                title="Arrange into grid"
              >
                <LayoutGrid size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Filter controls (only for tasks group) */}
        {isTasksGroup && (
          <>
            {/* Date filter dropdown */}
            <div ref={dateDropdownRef} className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setDateDropdownOpen(!dateDropdownOpen) }}
                onMouseDown={e => e.stopPropagation()}
                className={`
                  flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-medium
                  transition-colors
                  ${filters.dateFilter !== 'all'
                    ? 'bg-accent/20 text-accent'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }
                `}
              >
                <Calendar size={11} />
                <span>{selectedDateLabel}</span>
                <ChevronDown size={10} className={`transition-transform ${dateDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {dateDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 z-[10000] min-w-[120px] py-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-white/10 shadow-lg">
                  {dateOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={(e) => { e.stopPropagation(); setFilters!(f => ({ ...f, dateFilter: option.value as DateFilterValue })); setDateDropdownOpen(false) }}
                      onMouseDown={e => e.stopPropagation()}
                      className={`
                        w-full text-left px-3 py-1.5 text-[11px]
                        transition-colors
                        ${(typeof filters.dateFilter === 'string' ? filters.dateFilter : 'all') === option.value
                          ? 'text-accent bg-accent/10'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                        }
                      `}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Hide completed toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); setFilters!(f => ({ ...f, hideCompleted: !f.hideCompleted })) }}
              onMouseDown={e => e.stopPropagation()}
              className={`
                flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-medium
                transition-colors
                ${filters.hideCompleted
                  ? 'bg-accent/20 text-accent'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }
              `}
              title={filters.hideCompleted ? 'Show completed' : 'Hide completed'}
            >
              {filters.hideCompleted ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Close button */}
        {onClose && (
          <button
            onClick={(e) => { e.stopPropagation(); onClose() }}
            onMouseDown={e => e.stopPropagation()}
            className="flex items-center justify-center w-6 h-6 rounded-full text-xs bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
