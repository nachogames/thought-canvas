import type { Block } from './block'

export type StickyColor = 'default' | 'blue' | 'green' | 'yellow' | 'rose'

export interface Sticky {
  id: string
  content: string // Legacy field - kept for backward compatibility
  blocks?: Block[] // New block-based content
  x: number
  y: number
  date: string // ISO date string YYYY-MM-DD
  zIndex: number
  measuredHeight?: number // Actual rendered height from DOM
  color?: StickyColor // Card background color
}

export interface StickyRect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface DraggedSticky {
  id: string
  origX: number
  origY: number
}

export interface DragState {
  leaderId: string          // The sticky that was clicked to start drag
  startX: number            // Mouse start position
  startY: number
  stickies: DraggedSticky[] // All stickies being dragged with their original positions
}

export interface PanState {
  x: number
  y: number
}

export interface DayGroupBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface DayGroup {
  stickies: Sticky[]
  bounds: DayGroupBounds | null
}
