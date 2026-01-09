import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}

export function BottomSheet({ isOpen, onClose, children }: BottomSheetProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragY, setDragY] = useState(0)
  // Track if we should render (stays true during close animation)
  const [shouldRender, setShouldRender] = useState(false)
  // Track the visual state (for animation)
  const [isVisible, setIsVisible] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef(0)
  const sheetHeight = useRef(0)
  // Track if drag started from content at scroll top
  const dragFromContentRef = useRef(false)

  // Handle open/close with animation timing
  useEffect(() => {
    if (isOpen) {
      // Mount first, then animate in after browser paint
      setShouldRender(true)
      setDragY(0)
      // Small delay ensures DOM is painted at initial position before animating
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 20)
      return () => clearTimeout(timer)
    } else {
      // Animate out first, then unmount
      setIsVisible(false)
      const timer = setTimeout(() => {
        setShouldRender(false)
      }, 300) // Match transition duration
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const handleDragStart = useCallback((clientY: number) => {
    setIsDragging(true)
    dragStartY.current = clientY
    if (sheetRef.current) {
      sheetHeight.current = sheetRef.current.offsetHeight
    }
  }, [])

  const handleDragMove = useCallback((clientY: number) => {
    if (!isDragging) return
    const delta = clientY - dragStartY.current
    // Only allow dragging down (positive delta)
    setDragY(Math.max(0, delta))
  }, [isDragging])

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)

    // If dragged more than 25% of sheet height, close it
    if (dragY > sheetHeight.current * 0.25) {
      onClose()
    }
    setDragY(0)
  }, [isDragging, dragY, onClose])

  // Touch handlers for handle area
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragFromContentRef.current = false
    handleDragStart(e.touches[0].clientY)
  }, [handleDragStart])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientY)
  }, [handleDragMove])

  const handleTouchEnd = useCallback(() => {
    handleDragEnd()
    dragFromContentRef.current = false
  }, [handleDragEnd])

  // Touch handlers for content area (scroll-aware drag to close)
  const handleContentTouchStart = useCallback((e: React.TouchEvent) => {
    const content = contentRef.current
    if (!content) return

    // Check if we're at the top of scroll
    if (content.scrollTop <= 0) {
      dragFromContentRef.current = true
      dragStartY.current = e.touches[0].clientY
      if (sheetRef.current) {
        sheetHeight.current = sheetRef.current.offsetHeight
      }
    }
  }, [])

  const handleContentTouchMove = useCallback((e: React.TouchEvent) => {
    // Only handle if touch started at scroll top
    if (!dragFromContentRef.current) return

    const currentY = e.touches[0].clientY
    const delta = currentY - dragStartY.current

    // Only activate drag if swiping down (delta > 0)
    if (delta > 0) {
      e.preventDefault()
      setIsDragging(true)
      setDragY(delta)
    } else if (!isDragging) {
      // Swiping up from scroll top - allow normal scroll, disable drag detection
      dragFromContentRef.current = false
    }
  }, [isDragging])

  const handleContentTouchEnd = useCallback(() => {
    if (isDragging && dragFromContentRef.current) {
      handleDragEnd()
    }
    dragFromContentRef.current = false
  }, [isDragging, handleDragEnd])

  // Mouse handlers (for testing on desktop)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    handleDragStart(e.clientY)
  }, [handleDragStart])

  // Global mouse events for drag
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientY)
    }

    const handleMouseUp = () => {
      handleDragEnd()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  // Close on backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }, [onClose])

  if (!shouldRender) return null

  return (
    <div
      className={`
        fixed inset-0 z-50
        transition-colors duration-300
        ${isVisible ? 'bg-black/30' : 'bg-transparent'}
      `}
      onClick={handleBackdropClick}
    >
      <div
        ref={sheetRef}
        className={`
          absolute bottom-0 left-0 right-0
          bg-white dark:bg-gray-900 rounded-t-2xl
          shadow-[0_-4px_20px_rgba(0,0,0,0.15)]
          ${isDragging ? '' : 'transition-transform duration-300 ease-out'}
        `}
        style={{
          height: '85vh',
          transform: isVisible ? `translateY(${dragY}px)` : 'translateY(100%)',
        }}
      >
        {/* Drag handle area */}
        <div
          className="flex flex-col items-center pt-3 pb-1 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          {/* Visual handle */}
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {/* Content - TodoPane has its own header */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto h-[calc(100%-24px)]"
          onTouchStart={handleContentTouchStart}
          onTouchMove={handleContentTouchMove}
          onTouchEnd={handleContentTouchEnd}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
