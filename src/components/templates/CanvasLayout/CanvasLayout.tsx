import { useState, useCallback } from 'react'
import { useStickies, useIsMobile } from '@/hooks'
import { Canvas } from '@/components/organisms/Canvas'
import { TodoPane } from '@/components/organisms/TodoPane'
import { Toolbar } from '@/components/organisms/Toolbar'
import { BottomSheet } from '@/components/molecules'

const PANE_WIDTH_KEY = 'thought-canvas-pane-width'

const getInitialPaneWidth = () => {
  try {
    const saved = localStorage.getItem(PANE_WIDTH_KEY)
    if (saved) {
      const width = parseInt(saved, 10)
      if (!isNaN(width) && width >= 200 && width <= 500) {
        return width
      }
    }
  } catch {
    // localStorage not available
  }
  return 320
}

export function CanvasLayout() {
  const { stickies, toggleTodo, panToSticky, filters, setFilters, showTasks, setShowTasks, taskViewMode } = useStickies()
  const [paneWidth, setPaneWidth] = useState(getInitialPaneWidth)
  const [isResizing, setIsResizing] = useState(false)
  const isMobile = useIsMobile()

  // Show panel when tasks visible AND in panel mode AND not mobile
  const showPanel = showTasks && taskViewMode === 'panel' && !isMobile

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)

    const startX = e.clientX
    const startWidth = paneWidth

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startX - e.clientX
      const newWidth = Math.min(Math.max(startWidth + delta, 200), 500)
      setPaneWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      // Save final width to localStorage
      setPaneWidth(w => {
        try {
          localStorage.setItem(PANE_WIDTH_KEY, String(w))
        } catch {
          // localStorage not available
        }
        return w
      })
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [paneWidth])

  return (
    <div className="h-screen flex bg-bg">
      <Canvas>
        <Toolbar />
      </Canvas>

      {showPanel && (
        <>
          {/* Resize handle */}
          <div
            className={`
              w-1 cursor-col-resize
              transition-colors duration-150
              ${isResizing ? 'bg-accent' : 'bg-transparent hover:bg-accent/50'}
            `}
            onMouseDown={handleResizeStart}
          />
          <div style={{ width: paneWidth }}>
            <TodoPane
              stickies={stickies}
              onToggle={toggleTodo}
              onFocusSticky={panToSticky}
              filters={filters}
              setFilters={setFilters}
            />
          </div>
        </>
      )}

      {/* Mobile bottom sheet for tasks */}
      {isMobile && (
        <BottomSheet
          isOpen={showTasks}
          onClose={() => setShowTasks(false)}
        >
          <TodoPane
            stickies={stickies}
            onToggle={toggleTodo}
            onFocusSticky={panToSticky}
            filters={filters}
            setFilters={setFilters}
          />
        </BottomSheet>
      )}
    </div>
  )
}
