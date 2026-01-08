import { GRID_SIZE } from '@/constants'
import { useTheme } from '@/hooks'

interface CanvasBackgroundProps {
  offsetX: number
  offsetY: number
}

export function CanvasBackground({ offsetX, offsetY }: CanvasBackgroundProps) {
  const { isDark } = useTheme()

  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: `radial-gradient(circle, ${
          isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
        } 1px, transparent 1px)`,
        backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
        backgroundPosition: `${offsetX % GRID_SIZE}px ${offsetY % GRID_SIZE}px`
      }}
    />
  )
}
