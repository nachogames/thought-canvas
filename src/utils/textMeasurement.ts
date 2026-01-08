import {
  CONTENT_WIDTH,
  FONT_SIZE,
  FONT_FAMILY,
  LINE_HEIGHT,
  MIN_STICKY_HEIGHT
} from '@/constants'

// Re-export for convenience
export { CONTENT_WIDTH }

// Create a canvas for text measurement (created once, reused)
let measureCanvas: HTMLCanvasElement | null = null
const getMeasureContext = () => {
  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas')
  }
  return measureCanvas.getContext('2d')
}

/**
 * Calculate how many visual lines a string takes within a given width.
 * Accounts for word wrapping at word boundaries.
 */
export const getWrappedLineCount = (
  text: string,
  maxWidth: number = CONTENT_WIDTH,
  fontSize: number = FONT_SIZE
): number => {
  const ctx = getMeasureContext()
  if (!ctx) return Math.max(1, text.split('\n').length) // Fallback

  ctx.font = `${fontSize}px ${FONT_FAMILY}`

  let totalLines = 0
  const paragraphs = text.split('\n')

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      totalLines += 1 // Empty line
      continue
    }

    // Handle long words that need to break
    const words = paragraph.split(' ')
    let currentLine = ''
    let linesInParagraph = 1

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const metrics = ctx.measureText(testLine)

      if (metrics.width > maxWidth && currentLine) {
        linesInParagraph++
        currentLine = word

        // Check if single word is wider than maxWidth (needs to wrap mid-word)
        const wordMetrics = ctx.measureText(word)
        if (wordMetrics.width > maxWidth) {
          // Estimate additional lines needed for long word
          const extraLines = Math.floor(wordMetrics.width / maxWidth)
          linesInParagraph += extraLines
        }
      } else {
        currentLine = testLine
      }
    }

    totalLines += linesInParagraph
  }

  return Math.max(1, totalLines)
}

// Hidden element for measuring actual rendered height
let measureDiv: HTMLDivElement | null = null

const getMeasureDiv = (): HTMLDivElement => {
  if (!measureDiv) {
    measureDiv = document.createElement('div')
    measureDiv.style.cssText = `
      position: absolute;
      visibility: hidden;
      width: ${CONTENT_WIDTH}px;
      font-family: ${FONT_FAMILY};
      font-size: ${FONT_SIZE}px;
      line-height: ${LINE_HEIGHT}px;
      white-space: pre-wrap;
      word-wrap: break-word;
    `
    document.body.appendChild(measureDiv)
  }
  return measureDiv
}

/**
 * Snap height to grid for consistent vertical gaps.
 */
const snapHeightToGrid = (height: number): number => {
  const GRID = 16  // Must match GRID_SIZE
  return Math.ceil(height / GRID) * GRID
}

/**
 * Get sticky height - prefers stored measuredHeight, falls back to estimation.
 * Height is snapped to grid for consistent vertical spacing.
 */
export const getStickyHeight = (content: string, measuredHeight?: number): number => {
  let height: number

  if (measuredHeight !== undefined) {
    // Use actual measured height
    height = measuredHeight
  } else {
    // Fallback: render to hidden div and measure
    const div = getMeasureDiv()
    div.innerHTML = content
    const contentHeight = div.offsetHeight
    // Match Sticky component: header (20px) + content + padding (16 top + 16 bottom)
    height = contentHeight + 20 + 32
  }

  // Snap to grid for consistent gaps
  return snapHeightToGrid(Math.max(height, MIN_STICKY_HEIGHT))
}

/**
 * Calculate the visual cursor line, accounting for text wrapping.
 * Returns 0-indexed line number.
 */
export const getVisualCursorLine = (
  text: string,
  cursorPos: number,
  maxWidth: number = CONTENT_WIDTH,
  fontSize: number = FONT_SIZE
): number => {
  const textBeforeCursor = text.substring(0, cursorPos)
  return Math.max(0, getWrappedLineCount(textBeforeCursor, maxWidth, fontSize) - 1)
}
