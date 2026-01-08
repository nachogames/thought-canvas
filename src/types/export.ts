import type { Sticky } from './sticky'

export interface ThoughtCanvasExport {
  version: 1
  exportedAt: string // ISO timestamp
  stickies: Sticky[]
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  data?: ThoughtCanvasExport
}

export type ImportMode = 'replace' | 'merge'
