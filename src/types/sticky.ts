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
  // Task-specific fields
  isTask?: boolean // Marks this as a task sticky
  sourceId?: string // Reference to source note sticky (for linked tasks)
  sourceLineIndex?: number // Line index in source sticky for sync
  taskChecked?: boolean // Checkbox state for task stickies
  taskPriority?: number // Priority level (1-3) for task stickies
  taskTags?: string[] // Tags for task stickies
  taskCompletedAt?: string // ISO timestamp when task was completed
  taskParentText?: string // Parent task text (for promoted subtasks)
  taskDepth?: number // Nesting depth (0 = top-level)
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
