import { useRef, useCallback } from 'react'

interface UseLongPressOptions {
  onLongPress: (e: React.TouchEvent) => void
  onTouchStart?: () => void
  onTouchEnd?: () => void
  onMoveCancel?: (e: React.TouchEvent) => void  // Called when movement cancels long-press
  delay?: number
  moveThreshold?: number
}

export function useLongPress({
  onLongPress,
  onTouchStart,
  onTouchEnd,
  onMoveCancel,
  delay = 400,
  moveThreshold = 10
}: UseLongPressOptions) {
  const timerRef = useRef<number | null>(null)
  const startPosRef = useRef<{ x: number; y: number } | null>(null)
  const longPressTriggeredRef = useRef(false)
  const cancelledRef = useRef(false)
  const savedEventRef = useRef<React.TouchEvent | null>(null)

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    startPosRef.current = null
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation()
    onTouchStart?.()
    longPressTriggeredRef.current = false
    cancelledRef.current = false
    // Save the event for use in the timeout callback
    savedEventRef.current = e
    startPosRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    }
    timerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true
      if (savedEventRef.current) {
        onLongPress(savedEventRef.current)
      }
    }, delay)
  }, [onLongPress, onTouchStart, delay])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!startPosRef.current) return
    // If long-press already triggered or already cancelled, don't do anything
    if (longPressTriggeredRef.current || cancelledRef.current) return

    const dx = e.touches[0].clientX - startPosRef.current.x
    const dy = e.touches[0].clientY - startPosRef.current.y
    if (Math.sqrt(dx * dx + dy * dy) > moveThreshold) {
      clear()
      cancelledRef.current = true
      onTouchEnd?.() // Clear visual feedback
      // Notify that movement cancelled the long-press - pass original start event
      if (savedEventRef.current) {
        onMoveCancel?.(savedEventRef.current)
      }
    }
  }, [moveThreshold, clear, onTouchEnd, onMoveCancel])

  const handleTouchEnd = useCallback(() => {
    clear()
    onTouchEnd?.()
    savedEventRef.current = null
    cancelledRef.current = false
  }, [clear, onTouchEnd])

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    isLongPressActive: () => longPressTriggeredRef.current
  }
}
