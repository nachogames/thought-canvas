import type { Sticky, StickyColor } from '../types/sticky'
import type { ThoughtCanvasExport, ValidationResult } from '../types/export'
import { getTodayISO } from './date'

const VALID_COLORS: StickyColor[] = ['default', 'blue', 'green', 'yellow', 'rose']

/**
 * Creates an export data object from stickies
 */
export function createExportData(stickies: Sticky[]): ThoughtCanvasExport {
  // Strip measuredHeight as it's computed on render
  const cleanStickies = stickies.map(({ measuredHeight, ...rest }) => rest)

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    stickies: cleanStickies as Sticky[],
  }
}

/**
 * Validates import data and returns validation result
 */
export function validateExportData(data: unknown): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check basic structure
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid data format'], warnings }
  }

  const obj = data as Record<string, unknown>

  // Check version
  if (!('version' in obj)) {
    errors.push('Missing version field')
  } else if (obj.version !== 1) {
    warnings.push(`Unknown version: ${obj.version}, attempting import anyway`)
  }

  // Check stickies array
  if (!('stickies' in obj)) {
    errors.push('Missing stickies field')
    return { valid: false, errors, warnings }
  }

  if (!Array.isArray(obj.stickies)) {
    errors.push('Stickies must be an array')
    return { valid: false, errors, warnings }
  }

  if (obj.stickies.length === 0) {
    errors.push('No cards found in import data')
    return { valid: false, errors, warnings }
  }

  // Validate each sticky
  const validStickies: Sticky[] = []
  obj.stickies.forEach((sticky, index) => {
    const result = validateSticky(sticky, index)
    if (result.valid && result.sticky) {
      validStickies.push(result.sticky)
    } else {
      warnings.push(...result.warnings)
    }
  })

  if (validStickies.length === 0) {
    errors.push('No valid cards found in import data')
    return { valid: false, errors, warnings }
  }

  if (validStickies.length < obj.stickies.length) {
    warnings.push(`${obj.stickies.length - validStickies.length} invalid cards were skipped`)
  }

  return {
    valid: true,
    errors,
    warnings,
    data: {
      version: 1,
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
      stickies: validStickies,
    },
  }
}

interface StickyValidationResult {
  valid: boolean
  sticky?: Sticky
  warnings: string[]
}

function validateSticky(data: unknown, index: number): StickyValidationResult {
  const warnings: string[] = []

  if (!data || typeof data !== 'object') {
    return { valid: false, warnings: [`Card ${index + 1}: Invalid format`] }
  }

  const obj = data as Record<string, unknown>

  // Required fields
  const requiredFields = ['id', 'content', 'x', 'y', 'date', 'zIndex']
  for (const field of requiredFields) {
    if (!(field in obj)) {
      return { valid: false, warnings: [`Card ${index + 1}: Missing ${field}`] }
    }
  }

  // Type validation
  if (typeof obj.id !== 'string') {
    return { valid: false, warnings: [`Card ${index + 1}: Invalid id`] }
  }
  if (typeof obj.content !== 'string') {
    return { valid: false, warnings: [`Card ${index + 1}: Invalid content`] }
  }
  if (typeof obj.x !== 'number' || isNaN(obj.x)) {
    return { valid: false, warnings: [`Card ${index + 1}: Invalid x position`] }
  }
  if (typeof obj.y !== 'number' || isNaN(obj.y)) {
    return { valid: false, warnings: [`Card ${index + 1}: Invalid y position`] }
  }
  if (typeof obj.date !== 'string') {
    return { valid: false, warnings: [`Card ${index + 1}: Invalid date`] }
  }
  if (typeof obj.zIndex !== 'number' || isNaN(obj.zIndex)) {
    return { valid: false, warnings: [`Card ${index + 1}: Invalid zIndex`] }
  }

  // Validate color if present
  let color: StickyColor | undefined
  if ('color' in obj && obj.color !== undefined) {
    if (typeof obj.color === 'string' && VALID_COLORS.includes(obj.color as StickyColor)) {
      color = obj.color as StickyColor
    } else {
      warnings.push(`Card ${index + 1}: Invalid color, using default`)
    }
  }

  // Build valid sticky
  const sticky: Sticky = {
    id: obj.id as string,
    content: obj.content as string,
    x: obj.x as number,
    y: obj.y as number,
    date: obj.date as string,
    zIndex: obj.zIndex as number,
    ...(color && { color }),
    ...(Array.isArray(obj.blocks) && { blocks: obj.blocks }),
  }

  return { valid: true, sticky, warnings }
}

/**
 * Generates new unique IDs for stickies (for merge mode)
 */
export function generateNewIds(stickies: Sticky[]): Sticky[] {
  return stickies.map((sticky, index) => ({
    ...sticky,
    id: `${Date.now()}-${index}`,
  }))
}

/**
 * Offsets positions of stickies (for merge mode to avoid overlap)
 */
export function offsetPositions(stickies: Sticky[], offset: number): Sticky[] {
  return stickies.map(sticky => ({
    ...sticky,
    x: sticky.x + offset,
    y: sticky.y + offset,
  }))
}

/**
 * Gets export filename with current date
 */
export function getExportFilename(): string {
  return `thought-canvas-${getTodayISO()}.json`
}

/**
 * Converts export data to JSON string
 */
export function exportToJson(data: ThoughtCanvasExport): string {
  return JSON.stringify(data, null, 2)
}

/**
 * Parses JSON string to export data
 */
export function parseImportJson(json: string): ThoughtCanvasExport | null {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * Copies text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older browsers
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      return true
    } catch {
      return false
    }
  }
}

/**
 * Reads text from clipboard
 */
export async function readFromClipboard(): Promise<string | null> {
  try {
    const text = await navigator.clipboard.readText()
    return text || null
  } catch {
    return null
  }
}

/**
 * Downloads JSON data as a file
 */
export function downloadJson(data: ThoughtCanvasExport): void {
  const json = exportToJson(data)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = getExportFilename()
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Reads content from a File object
 */
export function readJsonFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to read file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
