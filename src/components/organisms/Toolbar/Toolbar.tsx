import { Plus, Undo2, Redo2, Trash2, ListTodo, Sun, Moon } from 'lucide-react'
import { useStickies, useTheme } from '@/hooks'
import { DataMenu } from '@/components/molecules'

interface ToolbarProps {
  showPane: boolean
  onTogglePane: () => void
}

function Divider() {
  return <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
}

export function Toolbar({ showPane, onTogglePane }: ToolbarProps) {
  const {
    createSticky,
    offset,
    undo,
    redo,
    canUndo,
    canRedo,
    deleteSelectedStickies,
    selectedIds
  } = useStickies()
  const { isDark, toggleTheme } = useTheme()

  const handleNewNote = () => {
    const centerX = window.innerWidth / 2 - offset.x
    const centerY = window.innerHeight / 2 - offset.y
    createSticky(centerX, centerY)
  }

  const handleDeleteSelected = () => {
    if (selectedIds.size > 0) {
      deleteSelectedStickies()
    }
  }

  return (
    <>
      {/* Centered pill toolbar */}
      <div className="
        fixed bottom-6 left-1/2 -translate-x-1/2 z-50
        bg-white dark:bg-gray-800
        shadow-lg rounded-full
        px-3 py-2
        flex items-center gap-2
        border border-gray-200 dark:border-gray-700
      ">
        {/* New Note */}
        <button
          onClick={handleNewNote}
          className="p-2 rounded-full text-indigo-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="New Note"
        >
          <Plus size={20} />
        </button>

        <Divider />

        {/* Undo/Redo */}
        <button
          onClick={undo}
          disabled={!canUndo}
          className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Undo (Cmd+Z)"
        >
          <Undo2 size={18} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Redo (Cmd+Shift+Z)"
        >
          <Redo2 size={18} />
        </button>

        <Divider />

        {/* Todo Pane */}
        <button
          onClick={onTogglePane}
          className={`
            p-2 rounded-full transition-colors
            ${showPane
              ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }
          `}
          title="Toggle Todo Pane"
        >
          <ListTodo size={18} />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
              className="p-2 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
              title={`Delete ${selectedIds.size} selected note${selectedIds.size > 1 ? 's' : ''}`}
            >
              <Trash2 size={18} />
            </button>
          </>
        )}
      </div>

      {/* Subtle help text */}
      <div className="
        fixed top-4 left-4 z-10
        text-xs text-gray-400/70 dark:text-gray-500/70
        bg-white/50 dark:bg-black/30
        backdrop-blur-sm
        px-2.5 py-1.5 rounded-md
        pointer-events-none
      ">
        Double-click to create • Drag to pan • / for commands
      </div>
    </>
  )
}
