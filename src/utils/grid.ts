import { GRID_SIZE, STICKY_WIDTH, STICKY_GAP, GROUP_PADDING } from '@/constants'
import type { Sticky, DayGroupBounds } from '@/types'
import { getStickyHeight } from './textMeasurement'

/**
 * Snap a value to the nearest grid point
 */
export function snap(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE
}

/**
 * Snap a point to the grid
 */
export function snapPoint(x: number, y: number): { x: number; y: number } {
  return {
    x: snap(x),
    y: snap(y)
  }
}

// =============================================================================
// COLLISION RESOLUTION - Spiral search for nearest non-overlapping position
// =============================================================================

/**
 * Check if two rectangles overlap with required gap (STICKY_GAP = 20px)
 */
function doRectsOverlap(
  r1: { x: number; y: number; w: number; h: number },
  r2: { x: number; y: number; w: number; h: number }
): boolean {
  return !(
    r1.x >= r2.x + r2.w + STICKY_GAP ||
    r1.x + r1.w + STICKY_GAP <= r2.x ||
    r1.y >= r2.y + r2.h + STICKY_GAP ||
    r1.y + r1.h + STICKY_GAP <= r2.y
  )
}

// Pre-calculate spiral search offsets (sorted by distance from origin)
const SEARCH_RADIUS = 50 // Covers ~800px radius
const BASE_OFFSETS: { x: number; y: number }[] = []
for (let x = -SEARCH_RADIUS; x <= SEARCH_RADIUS; x++) {
  for (let y = -SEARCH_RADIUS; y <= SEARCH_RADIUS; y++) {
    BASE_OFFSETS.push({ x: x * GRID_SIZE, y: y * GRID_SIZE })
  }
}

// Euclidean spiral - nearest positions first (for drag)
const EUCLIDEAN_OFFSETS = [...BASE_OFFSETS].sort(
  (a, b) => (a.x * a.x + a.y * a.y) - (b.x * b.x + b.y * b.y)
)

// Down-right biased spiral - prefers positive offsets (for auto-placement)
const DOWNRIGHT_OFFSETS = [...BASE_OFFSETS].sort((a, b) => {
  // Penalize negative directions (up/left) by 1.5x
  const aBias = (a.x < 0 ? 1.5 : 1) * (a.y < 0 ? 1.5 : 1)
  const bBias = (b.x < 0 ? 1.5 : 1) * (b.y < 0 ? 1.5 : 1)
  const aDist = Math.sqrt(a.x * a.x + a.y * a.y) * aBias
  const bDist = Math.sqrt(b.x * b.x + b.y * b.y) * bBias
  return aDist - bDist
})

// Placement intent determines bounds and spiral behavior
export type PlacementIntent = 'auto' | 'drag'

export interface GroupObstacle {
  date: string
  bounds: DayGroupBounds
}

export interface CollisionOptions {
  intent?: PlacementIntent
  viewport?: { width: number; height: number }
  canvasOffset?: { x: number; y: number }
  groups?: GroupObstacle[]  // Groups to avoid (excluding same-date groups)
  movingDate?: string       // Date of the moving sticky(s) - to exclude same-date group
}

interface MovedSticky {
  id: string
  x: number
  y: number
  width: number
  height: number
  date?: string  // Date of the sticky for group exclusion
}

/**
 * Resolve collisions for moved stickies using spiral search.
 * Returns the final positions for each moved sticky.
 *
 * @param movedStickies - Stickies being placed/moved
 * @param allStickies - All stickies in the canvas
 * @param options - Placement options (intent, viewport bounds)
 */
export function resolveCollisions(
  movedStickies: MovedSticky[],
  allStickies: Sticky[],
  options?: CollisionOptions
): Record<string, { x: number; y: number }> {
  const finalPositions: Record<string, { x: number; y: number }> = {}
  const intent = options?.intent ?? 'drag'

  // Select spiral pattern based on intent
  const offsets = intent === 'auto' ? DOWNRIGHT_OFFSETS : EUCLIDEAN_OFFSETS

  // Calculate bounds for auto-placement (keep cards on screen)
  let bounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null
  if (intent === 'auto' && options?.viewport && options?.canvasOffset) {
    const padding = STICKY_GAP
    bounds = {
      minX: -options.canvasOffset.x + padding,
      minY: -options.canvasOffset.y + padding,
      maxX: -options.canvasOffset.x + options.viewport.width - STICKY_WIDTH - padding,
      maxY: -options.canvasOffset.y + options.viewport.height - padding
    }
  }

  // Build list of static rectangles (stickies not being moved)
  const movedIds = new Set(movedStickies.map(s => s.id))
  const occupiedRects: { x: number; y: number; w: number; h: number; id: string }[] = []

  allStickies.forEach(sticky => {
    if (!movedIds.has(sticky.id)) {
      occupiedRects.push({
        x: sticky.x,
        y: sticky.y,
        w: STICKY_WIDTH,
        h: getStickyHeight(sticky.content, sticky.measuredHeight),
        id: sticky.id
      })
    }
  })

  // Add group bounds as obstacles (excluding groups the moving stickies belong to)
  const movingDate = options?.movingDate
  if (options?.groups) {
    options.groups.forEach(group => {
      // Skip the group that contains the moving sticky(s)
      if (movingDate && group.date === movingDate) return

      // Add group bounds with padding as an obstacle
      // Groups have GROUP_PADDING around them visually, so include that
      occupiedRects.push({
        x: group.bounds.x - GROUP_PADDING,
        y: group.bounds.y - GROUP_PADDING,
        w: group.bounds.width + GROUP_PADDING * 2,
        h: group.bounds.height + GROUP_PADDING * 2,
        id: `group-${group.date}`
      })
    })
  }

  // Process each moved sticky
  movedStickies.forEach(moved => {
    let bestPos = { x: moved.x, y: moved.y }

    // Spiral search for the nearest non-colliding position
    for (const offset of offsets) {
      const testX = moved.x + offset.x
      const testY = moved.y + offset.y

      // For auto-placement, skip positions outside viewport bounds
      if (bounds) {
        if (testX < bounds.minX || testX > bounds.maxX ||
            testY < bounds.minY || testY > bounds.maxY) {
          continue
        }
      }

      const testRect = { x: testX, y: testY, w: moved.width, h: moved.height }

      let collision = false
      for (const obst of occupiedRects) {
        if (doRectsOverlap(testRect, obst)) {
          collision = true
          break
        }
      }

      if (!collision) {
        bestPos = { x: testX, y: testY }
        break
      }
    }

    // Add this final position to occupied for subsequent moved stickies
    occupiedRects.push({ x: bestPos.x, y: bestPos.y, w: moved.width, h: moved.height, id: moved.id })
    finalPositions[moved.id] = bestPos
  })

  return finalPositions
}
