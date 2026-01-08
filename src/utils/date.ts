/**
 * Check if a date string represents today
 */
export function isToday(dateString: string): boolean {
  return new Date().toDateString() === new Date(dateString).toDateString()
}

/**
 * Format a date string for display
 * Returns "Today" for today's date, otherwise "Mon, Jan 6"
 */
export function formatDateLabel(dateString: string): string {
  if (isToday(dateString)) {
    return 'Today'
  }

  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
export function getTodayISO(): string {
  return new Date().toISOString().split('T')[0]
}
