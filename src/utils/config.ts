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
  theme: 'dark',
  showTasks: false,
  taskViewMode: 'panel',
  filters: {
    tag: null,
    hideCompleted: false,
    dateFilter: 'all'
  }
}

export function loadConfig(): AppConfig {
  try {
    const stored = localStorage.getItem(CONFIG_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        theme: parsed.theme === 'light' ? 'light' : 'dark',
        showTasks: parsed.showTasks ?? false,
        taskViewMode: parsed.taskViewMode === 'overlay' ? 'overlay' : 'panel',
        filters: {
          tag: parsed.filters?.tag ?? null,
          hideCompleted: parsed.filters?.hideCompleted ?? false,
          dateFilter: parsed.filters?.dateFilter ?? 'all'
        }
      }
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_CONFIG }
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
