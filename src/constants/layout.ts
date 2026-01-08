// =============================================================================
// LAYOUT CONSTANTS - Single source of truth for all layout calculations
// =============================================================================

// Grid
export const GRID_SIZE = 16

// Typography (must match globals.css)
export const FONT_SIZE = 15  // --text-base: 15px
export const LINE_HEIGHT_RATIO = 1.733  // Gives us exactly 26px lines (15 * 1.733 ≈ 26)
export const LINE_HEIGHT = 26  // FONT_SIZE * LINE_HEIGHT_RATIO rounded
export const FONT_FAMILY = "'IBM Plex Sans', system-ui, -apple-system, sans-serif"

// Sticky dimensions - all must align with GRID_SIZE for consistent spacing
export const STICKY_WIDTH = 256  // 16 * 16 = 256 (grid-aligned)
export const TASK_STICKY_WIDTH = 200  // Smaller width for task cards
export const STICKY_PADDING = 16  // Grid-aligned padding
export const STICKY_GAP = 16     // Same as GRID_SIZE for consistent gaps

// Derived values (use these in calculations)
export const CONTENT_WIDTH = STICKY_WIDTH - STICKY_PADDING * 2  // 224px - actual text area width

// Minimum height: 2 lines of text + padding
export const MIN_LINES = 2
export const MIN_STICKY_HEIGHT = MIN_LINES * LINE_HEIGHT + STICKY_PADDING * 2  // 2 * 26 + 36 = 88
export const MIN_TASK_STICKY_HEIGHT = 60  // Smaller min height for task cards

// Group container - even 24px padding on all sides, label positioned above
export const GROUP_PADDING = 24

// Z-index scale
export const Z_INDEX = {
  base: 1,
  sticky: 10,
  stickySelected: 100,
  menu: 1000,
  modal: 2000,
} as const
