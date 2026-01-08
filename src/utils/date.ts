/**
 * Parse a date string (YYYY-MM-DD) as local time, not UTC
 * This avoids timezone issues where "2026-01-08" gets interpreted as UTC
 * and shows as the previous day in western timezones
 */
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Check if a date string represents today
 */
export function isToday(dateString: string): boolean {
  const today = new Date()
  const date = parseLocalDate(dateString)
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

/**
 * Format a date string for display
 * Returns "Today" for today's date, otherwise "Mon, Jan 6"
 */
export function formatDateLabel(dateString: string): string {
  if (isToday(dateString)) {
    return 'Today'
  }

  return parseLocalDate(dateString).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
export function getTodayISO(): string {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}
