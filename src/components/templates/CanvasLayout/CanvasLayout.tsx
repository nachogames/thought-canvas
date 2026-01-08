import { useState, useCallback } from 'react'
import { useStickies } from '@/hooks'
import { Canvas } from '@/components/organisms/Canvas'
import { TodoPane } from '@/components/organisms/TodoPane'
import { Toolbar } from '@/components/organisms/Toolbar'

export function CanvasLayout() {
  const { stickies, toggleTodo, panToSticky, filters, setFilters, showPane, setShowPane } = useStickies()
  const [paneWidth, setPaneWidth] = useState(320)
  const [isResizing, setIsResizing] = useState(false)

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
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [paneWidth])

  return (
    <div className="h-screen flex bg-bg">
      <Canvas>
        <Toolbar showPane={showPane} onTogglePane={() => setShowPane(p => !p)} />
      </Canvas>

      {showPane && (
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
    </div>
  )
}
