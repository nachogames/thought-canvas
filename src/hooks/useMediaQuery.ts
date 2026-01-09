import { useState, useEffect } from 'react'

/**
 * Hook to detect if a media query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    setMatches(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [query])

  return matches
}

/**
 * Hook to detect mobile viewport (max-width: 768px)
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 768px)')
}
