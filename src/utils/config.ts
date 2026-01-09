// Shared config utility for persisting app state to localStorage
const CONFIG_KEY = 'thought-canvas-config'

export interface AppConfig {
  theme: 'dark' | 'light'
  showTasks: boolean
  taskViewMode: 'panel' | 'overlay'
  filters: {
    tag: string | null
    hideCompleted: boolean
    dateFilter: string
  }
}

const DEFAULT_CONFIG: AppConfig = {
  theme: 'light',
  showTasks: true,
  taskViewMode: 'panel',
  filters: {
    tag: null,
    hideCompleted: false,
    dateFilter: 'all'
  }
}

export function loadConfig(): AppConfig {
  // Check if mobile viewport - don't show tasks panel by default on mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768

  try {
    const stored = localStorage.getItem(CONFIG_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        theme: parsed.theme === 'light' ? 'light' : 'dark',
        showTasks: isMobile ? false : (parsed.showTasks ?? true),
        taskViewMode: parsed.taskViewMode === 'overlay' ? 'overlay' : 'panel',
        filters: {
          tag: parsed.filters?.tag ?? null,
          hideCompleted: parsed.filters?.hideCompleted ?? false,
          dateFilter: parsed.filters?.dateFilter ?? 'all'
        }
      }
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_CONFIG, showTasks: isMobile ? false : DEFAULT_CONFIG.showTasks }
}

export function saveConfig(updates: Partial<AppConfig>) {
  try {
    const current = loadConfig()
    const merged = {
      ...current,
      ...updates,
      filters: {
        ...current.filters,
        ...(updates.filters || {})
      }
    }
    localStorage.setItem(CONFIG_KEY, JSON.stringify(merged))
  } catch { /* ignore */ }
}
