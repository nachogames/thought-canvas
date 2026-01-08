import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown, X } from 'lucide-react'
import type { DateFilterValue } from '@/types'

interface DateFilterProps {
  value: DateFilterValue
  onChange: (value: DateFilterValue) => void
}

const PRESETS: { value: DateFilterValue; label: string }[] = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This week' },
]

function getDateLabel(value: DateFilterValue): string {
  if (typeof value === 'string') {
    return PRESETS.find(p => p.value === value)?.label || 'All dates'
  }
  // Custom range
  return `${value.start} - ${value.end}`
}

function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function DateFilter({ value, onChange }: DateFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  // Initialize custom dates if value is a range
  useEffect(() => {
    if (typeof value === 'object') {
      setCustomStart(value.start)
      setCustomEnd(value.end)
      setShowCustom(true)
    }
  }, [value])

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setShowCustom(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handlePresetClick = (preset: DateFilterValue) => {
    onChange(preset)
    setIsOpen(false)
    setShowCustom(false)
  }

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      onChange({ start: customStart, end: customEnd })
      setIsOpen(false)
    }
  }

  const today = formatDateForInput(new Date())

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between gap-2
          px-3.5 py-2.5 text-sm rounded-lg
          bg-faint border border-border
          text-secondary
          outline-none cursor-pointer
          hover:border-border-hover
          focus:border-accent focus:ring-1 focus:ring-accent/50
          transition-colors duration-150
        `}
      >
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-muted" />
          <span>{getDateLabel(value)}</span>
        </div>
        <ChevronDown size={14} className={`text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="
          absolute top-full left-0 right-0 mt-1 z-50
          bg-white dark:bg-gray-800
          rounded-lg shadow-lg
          border border-gray-200 dark:border-gray-700
          overflow-hidden
        ">
          {!showCustom ? (
            <>
              {/* Preset options */}
              <div className="p-1">
                {PRESETS.map(preset => (
                  <button
                    key={typeof preset.value === 'string' ? preset.value : 'custom'}
                    onClick={() => handlePresetClick(preset.value)}
                    className={`
                      w-full text-left px-3 py-2 text-sm rounded-md
                      transition-colors
                      ${value === preset.value
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom range option */}
              <div className="border-t border-gray-200 dark:border-gray-700 p-1">
                <button
                  onClick={() => setShowCustom(true)}
                  className="
                    w-full text-left px-3 py-2 text-sm rounded-md
                    text-gray-700 dark:text-gray-300
                    hover:bg-gray-100 dark:hover:bg-gray-700
                    transition-colors
                  "
                >
                  Custom range...
                </button>
              </div>
            </>
          ) : (
            /* Custom date picker */
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Custom range</span>
                <button
                  onClick={() => setShowCustom(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">From</label>
                  <input
                    type="date"
                    value={customStart}
                    max={customEnd || today}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="
                      w-full px-2.5 py-1.5 text-sm rounded-md
                      bg-faint border border-border
                      text-foreground
                      outline-none
                      focus:border-accent focus:ring-1 focus:ring-accent/50
                    "
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">To</label>
                  <input
                    type="date"
                    value={customEnd}
                    min={customStart}
                    max={today}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="
                      w-full px-2.5 py-1.5 text-sm rounded-md
                      bg-faint border border-border
                      text-foreground
                      outline-none
                      focus:border-accent focus:ring-1 focus:ring-accent/50
                    "
                  />
                </div>
              </div>

              <button
                onClick={handleCustomApply}
                disabled={!customStart || !customEnd}
                className="
                  w-full py-2 text-sm font-medium rounded-md
                  bg-accent text-white
                  hover:bg-accent/90
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors
                "
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
