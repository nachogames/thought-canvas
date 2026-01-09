import { useState, useRef, useEffect } from 'react'
import { Plus, Undo2, Redo2, Trash2, ListTodo, Sun, Moon, PanelRight, Layers, ChevronDown, Crosshair } from 'lucide-react'
import { useStickies, useTheme, useIsMobile } from '@/hooks'
import { DataMenu } from '@/components/molecules'

function Divider() {
  return <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
}

export function Toolbar() {
  const {
    createStickyInTodayGroup,
    undo,
    redo,
    canUndo,
    canRedo,
    deleteSelectedStickies,
    selectedIds,
    showTasks,
    setShowTasks,
    taskViewMode,
    setTaskViewMode,
    centerOnToday,
  } = useStickies()
  const [showTaskMenu, setShowTaskMenu] = useState(false)
  const taskMenuRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()

  // Hide toolbar when bottom sheet is open on mobile
  const isHidden = isMobile && showTasks

  // Close menu when clicking outside
  useEffect(() => {
    if (!showTaskMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (taskMenuRef.current && !taskMenuRef.current.contains(e.target as Node)) {
        setShowTaskMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showTaskMenu])
  const { isDark, toggleTheme } = useTheme()

  const handleNewNote = () => {
    createStickyInTodayGroup()
  }

  const handleDeleteSelected = () => {
    if (selectedIds.size > 0) {
      deleteSelectedStickies()
    }
  }

  return (
    <>
      {/* Centered pill toolbar */}
      <div className={`
        fixed bottom-6 left-1/2 -translate-x-1/2 z-50
        bg-white dark:bg-gray-800
        shadow-lg rounded-full
        px-3 py-2
        flex items-center gap-2
        border border-gray-200 dark:border-gray-700
        transition-all duration-300
        ${isHidden ? 'translate-y-20 opacity-0 pointer-events-none' : ''}
      `}>
        {/* New Note */}
        <button
          onClick={handleNewNote}
          className="p-2 rounded-full text-indigo-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          title="New Note"
        >
          <Plus size={20} />
        </button>

        {/* Go to Today */}
        <button
          onClick={centerOnToday}
          className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          title="Go to Today (0)"
        >
          <Crosshair size={18} />
        </button>

        <Divider />

        {/* Undo/Redo */}
        <button
          onClick={undo}
          disabled={!canUndo}
          className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title="Undo (Cmd+Z)"
        >
          <Undo2 size={18} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title="Redo (Cmd+Shift+Z)"
        >
          <Redo2 size={18} />
        </button>

        <Divider />

        {/* Tasks with dropdown (dropdown hidden on mobile) */}
        <div className="relative" ref={taskMenuRef}>
          <div className="flex items-center h-[34px]">
            {/* Main toggle button */}
            <button
              onClick={() => setShowTasks(prev => !prev)}
              className={`
                h-full px-2 flex items-center transition-colors cursor-pointer
                ${isMobile ? 'rounded-full' : 'rounded-l-full'}
                ${showTasks
                  ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
              title={showTasks ? 'Hide Tasks' : 'Show Tasks'}
            >
              <ListTodo size={18} />
            </button>
            {/* Dropdown trigger - desktop only */}
            {!isMobile && (
              <button
                onClick={() => setShowTaskMenu(prev => !prev)}
                className={`
                  h-full px-1.5 flex items-center rounded-r-full transition-colors cursor-pointer
                  ${showTasks
                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
                title="Task view options"
              >
                <ChevronDown size={14} />
              </button>
            )}
          </div>

          {/* Dropdown menu - desktop only */}
          {!isMobile && showTaskMenu && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[140px]">
              <button
                onClick={() => { setTaskViewMode('panel'); setShowTaskMenu(false) }}
                className={`w-full px-3 py-1.5 flex items-center gap-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer ${taskViewMode === 'panel' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}
              >
                <PanelRight size={14} />
                <span>Panel</span>
                {taskViewMode === 'panel' && <span className="ml-auto text-xs">✓</span>}
              </button>
              <button
                onClick={() => { setTaskViewMode('overlay'); setShowTaskMenu(false) }}
                className={`w-full px-3 py-1.5 flex items-center gap-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer ${taskViewMode === 'overlay' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}
              >
                <Layers size={14} />
                <span>Overlay</span>
                {taskViewMode === 'overlay' && <span className="ml-auto text-xs">✓</span>}
              </button>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Data Menu (Import/Export) */}
        <DataMenu />

        {/* Contextual Delete - appears when notes selected */}
        {selectedIds.size > 0 && (
          <>
            <Divider />
            <button
              onClick={handleDeleteSelected}
              className="p-2 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
              title={`Delete ${selectedIds.size} selected note${selectedIds.size > 1 ? 's' : ''}`}
            >
              <Trash2 size={18} />
            </button>
          </>
        )}
      </div>

      {/* Subtle help text - hidden on mobile */}
      <div className={`
        fixed top-4 left-4 z-10
        text-xs text-gray-400/70 dark:text-gray-500/70
        bg-white/50 dark:bg-black/30
        backdrop-blur-sm
        px-2.5 py-1.5 rounded-md
        pointer-events-none
        ${isMobile ? 'hidden' : ''}
      `}>
        Double-click to create • Drag to pan • / for commands
      </div>
    </>
  )
}
