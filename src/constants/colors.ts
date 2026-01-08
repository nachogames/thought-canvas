import type { StickyColor } from '@/types'

// Color configuration for sticky cards
// All colors are designed to be accessible with black text in both light and dark modes
export const STICKY_COLORS: Record<StickyColor, { bg: string; header: string; swatch: string }> = {
  default: {
    bg: 'bg-white dark:bg-gray-800',
    header: 'bg-gray-50 dark:bg-gray-700/50',
    swatch: 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500'
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    header: 'bg-blue-100 dark:bg-blue-800/40',
    swatch: 'bg-blue-200 dark:bg-blue-700'
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-900/30',
    header: 'bg-green-100 dark:bg-green-800/40',
    swatch: 'bg-green-200 dark:bg-green-700'
  },
  yellow: {
    bg: 'bg-amber-50 dark:bg-amber-900/30',
    header: 'bg-amber-100 dark:bg-amber-800/40',
    swatch: 'bg-amber-200 dark:bg-amber-600'
  },
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-900/30',
    header: 'bg-rose-100 dark:bg-rose-800/40',
    swatch: 'bg-rose-200 dark:bg-rose-700'
  }
} as const

// Order for displaying swatches
export const STICKY_COLOR_ORDER: StickyColor[] = ['default', 'blue', 'green', 'yellow', 'rose']
