import { Sun, Moon } from 'lucide-react'
import { IconButton } from '@/components/atoms/Button'
import { useTheme } from '@/hooks'

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme()

  return (
    <IconButton
      icon={isDark ? Sun : Moon}
      variant="subtle"
      size="md"
      label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleTheme}
      className={`
        bg-faint border border-border
        hover:bg-border
        ${className}
      `}
    />
  )
}
