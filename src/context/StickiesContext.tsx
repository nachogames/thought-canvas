import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from 'react'
import type { Sticky, DragState, PanState, TodoFilters, ThoughtCanvasExport, ImportMode, TasksGroupState } from '@/types'
import { GRID_SIZE, STICKY_WIDTH, STICKY_GAP, MIN_STICKY_HEIGHT, GROUP_PADDING } from '@/constants'
import { getStickyHeight, resolveCollisions, createExportData, generateNewIds, offsetPositions, parseContent } from '@/utils'
import type { GroupObstacle } from '@/utils/grid'

import { loadConfig, saveConfig } from '@/utils'

const STORAGE_KEY = 'thought-canvas-stickies'
const TASKS_GROUP_KEY = 'thought-canvas-tasks-group'
const TASK_POSITIONS_KEY = 'thought-canvas-task-positions'
const MAX_HISTORY = 50
const TASKS_GROUP_DATE = '__tasks__'

const DEFAULT_TASKS_GROUP: TasksGroupState = {
  position: { x: 50, y: 50 },
  expanded: true
}

interface StickiesContextValue {
  // State
  stickies: Sticky[]
  selectedIds: Set<string>
  editingId: string | null
  drag: DragState | null
  offset: PanState
  panning: boolean
  panStart: PanState | null
  filters: TodoFilters
  showTasks: boolean
  taskViewMode: 'panel' | 'overlay'
  canUndo: boolean
  canRedo: boolean

  // Sticky operations
  createSticky: (x: number, y: number) => void
  updateSticky: (id: string, updates: Partial<Sticky>) => void
  deleteSticky: (id: string) => void
  deleteSelectedStickies: () => void
  selectSticky: (id: string | null, addToSelection?: boolean) => void
  clearAllStickies: () => void
  setEditingId: (id: string | null) => void

  // Drag operations
  startDrag: (id: string, e: React.MouseEvent | React.TouchEvent) => void
  startGroupDrag: (date: string, e: React.MouseEvent | React.TouchEvent) => void
  updateDrag: (e: MouseEvent | TouchEvent) => void
  endDrag: () => void
  arrangeGroup: (date: string, visibleIds?: Set<string>) => void

  // Pan operations
  startPan: (e: React.MouseEvent | React.TouchEvent) => void
  updatePan: (e: MouseEvent | TouchEvent) => void
  endPan: () => void
  setOffset: React.Dispatch<React.SetStateAction<PanState>>
  centerOnToday: () => void

  // Todo operations
  toggleTodo: (stickyId: string, lineIndex: number) => void
  toggleTaskTodo: (taskStickyId: string) => void
  updateTaskStickyContent: (taskStickyId: string, content: string) => void
  panToSticky: (stickyId: string) => void

  // History operations
  undo: () => void
  redo: () => void

  // Filters
  setFilters: React.Dispatch<React.SetStateAction<TodoFilters>>

  // Tasks View
  setShowTasks: React.Dispatch<React.SetStateAction<boolean>>
  setTaskViewMode: React.Dispatch<React.SetStateAction<'panel' | 'overlay'>>

  // Tasks Group (for overlay mode)
  tasksGroup: TasksGroupState
  taskCardPositions: Record<string, { x: number; y: number }>
  updateTasksGroupPosition: (x: number, y: number) => void
  setTasksGroupExpanded: (expanded: boolean) => void
  updateTaskCardPosition: (todoKey: string, x: number, y: number) => void
  createTaskInGroup: (x: number, y: number) => void

  // Helpers
  getStickyHeight: (content: string, measuredHeight?: number) => number

  // Export/Import
  exportData: () => ThoughtCanvasExport
  importData: (data: ThoughtCanvasExport, mode: ImportMode) => void
}

const StickiesContext = createContext<StickiesContextValue | null>(null)

// Helper to snap value to grid
const snap = (v: number) => Math.round(v / GRID_SIZE) * GRID_SIZE

// Half gap for symmetric expansion (10px each side = 20px total gap)
const HALF_GAP = STICKY_GAP / 2

// Label height above group box (-top-8 = 32px)
const GROUP_LABEL_HEIGHT = 32

// Get sticky rect expanded by half gap on all sides
// When two expanded rects just touch, actual gap = 10 + 10 = 20px
const getExpandedRect = (x: number, y: number, w: number, h: number) => ({
  l: x - HALF_GAP,
  t: y - HALF_GAP,
  r: x + w + HALF_GAP,
  b: y + h + HALF_GAP
})

// Calculate group bounds from stickies with the same date
// Bounds are snapped to grid for consistent gaps
const calculateGroupBounds = (stickies: Sticky[]): GroupObstacle[] => {
  const groupsByDate: Record<string, Sticky[]> = {}

  // Group stickies by date
  stickies.forEach(s => {
    if (!groupsByDate[s.date]) {
      groupsByDate[s.date] = []
    }
    groupsByDate[s.date].push(s)
  })

  // Calculate bounds for each group (only groups with 1+ stickies)
  return Object.entries(groupsByDate)
    .filter(([, groupStickies]) => groupStickies.length > 0)
    .map(([date, groupStickies]) => {
      let minX = Infinity, minY = Infinity
      let maxX = -Infinity, maxY = -Infinity

      groupStickies.forEach(s => {
        const height = getStickyHeight(s.content, s.measuredHeight)
        minX = Math.min(minX, s.x)
        minY = Math.min(minY, s.y)
        maxX = Math.max(maxX, s.x + STICKY_WIDTH)
        maxY = Math.max(maxY, s.y + height)
      })

      // Snap bounds to grid for consistent gaps
      // Floor for min (expand outward), ceil for max (expand outward)
      const snappedMinX = Math.floor(minX / GRID_SIZE) * GRID_SIZE
      const snappedMinY = Math.floor(minY / GRID_SIZE) * GRID_SIZE
      const snappedMaxX = Math.ceil(maxX / GRID_SIZE) * GRID_SIZE
      const snappedMaxY = Math.ceil(maxY / GRID_SIZE) * GRID_SIZE

      return {
        date,
        bounds: {
          x: snappedMinX,
          y: snappedMinY,
          width: snappedMaxX - snappedMinX,
          height: snappedMaxY - snappedMinY
        }
      }
    })
}

interface StickiesProviderProps {
  children: ReactNode
}

// Get date string for N days ago
const getDateString = (daysAgo: number): string => {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString().split('T')[0]
}

// Generate example stickies for first-time visitors
const generateExampleStickies = (): Sticky[] => {
  const today = getDateString(0)
  const yesterday = getDateString(1)
  const twoDaysAgo = getDateString(2)

  // Pre-calculated heights based on content (header 20px + content + padding 32px, snapped to 16px grid)
  return [
    // 2 days ago - Project planning (top-left)
    {
      id: 'example-1',
      content: `<p><strong>Project Ideas</strong></p>
<ul>
  <li><p>Build a personal dashboard</p></li>
  <li><p>Learn a new framework</p></li>
  <li><p>Contribute to open source</p></li>
</ul>`,
      x: 96,
      y: 96,
      date: twoDaysAgo,
      zIndex: 1,
      color: 'blue' as const,
      measuredHeight: 160
    },
    {
      id: 'example-2',
      content: `<p>#planning</p>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox"></label><div><p>Research tech stack</p></div></li>
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox"></label><div><p>Set up dev environment</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Create wireframes !!</p></div></li>
</ul>`,
      x: 368,
      y: 96,
      date: twoDaysAgo,
      zIndex: 2,
      measuredHeight: 160
    },

    // Yesterday - Active work (top-right, with gap from 2-days-ago group)
    {
      id: 'example-3',
      content: `<p><strong>Meeting Notes</strong></p>
<ul>
  <li><p>Discussed timeline for Q1</p></li>
  <li><p>Need to follow up with design team</p></li>
  <li><p>Budget approved for new tools</p></li>
</ul>`,
      x: 720,
      y: 96,
      date: yesterday,
      zIndex: 3,
      color: 'green' as const,
      measuredHeight: 176
    },
    {
      id: 'example-4',
      content: `<p>!! #work</p>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox"></label><div><p>Send project update email</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Review pull requests #code</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Update documentation !!!</p></div></li>
</ul>`,
      x: 992,
      y: 96,
      date: yesterday,
      zIndex: 4,
      measuredHeight: 160
    },

    // Today - Getting started (bottom-left)
    {
      id: 'example-5',
      content: `<p><strong>Welcome to Thought Canvas!</strong></p>
<ul>
  <li><p>Double-click anywhere to create notes</p></li>
  <li><p>Drag notes to organize them</p></li>
  <li><p>Type / for quick commands</p></li>
  <li><p>Use #tags to categorize</p></li>
</ul>`,
      x: 96,
      y: 368,
      date: today,
      zIndex: 5,
      color: 'yellow' as const,
      measuredHeight: 192
    },
    {
      id: 'example-6',
      content: `<p>!!! #today</p>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Try creating a new note</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Open the Tasks panel</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Try priority: add ! or !! to a todo</p></div></li>
</ul>`,
      x: 368,
      y: 368,
      date: today,
      zIndex: 6,
      measuredHeight: 160
    }
  ]
}

// Load stickies from localStorage
const loadStickies = (): Sticky[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
    // Key exists but is empty or invalid - check if it's first visit
    // If the key doesn't exist at all, it's a first-time visitor
    if (stored === null) {
      return generateExampleStickies()
    }
  } catch (e) {
    console.error('Failed to load stickies from localStorage:', e)
  }
  // Key exists but empty/invalid - return minimal default
  return generateExampleStickies()
}

export function StickiesProvider({ children }: StickiesProviderProps) {
  const [stickies, setStickies] = useState<Sticky[]>(loadStickies)

  // History for undo/redo
  const historyRef = useRef<Sticky[][]>([])
  const historyIndexRef = useRef(-1)
  const isUndoRedoRef = useRef(false)

  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [offset, setOffset] = useState<PanState>({ x: 0, y: 0 })
  const [panning, setPanning] = useState(false)
  // Use ref instead of state for panStart to avoid re-render delays between touch events
  const panStartRef = useRef<PanState | null>(null)
  // Momentum tracking for natural panning
  const velocityRef = useRef({ x: 0, y: 0 })
  const lastMoveTimeRef = useRef(0)
  // Load config from shared localStorage key
  const initialConfig = loadConfig()
  const [filters, setFilters] = useState<TodoFilters>({
    tag: initialConfig.filters.tag,
    hideCompleted: initialConfig.filters.hideCompleted,
    dateFilter: initialConfig.filters.dateFilter as TodoFilters['dateFilter']
  })
  const [showTasks, setShowTasks] = useState(initialConfig.showTasks)
  const wasOverlayOpenRef = useRef(false)
  const [taskViewMode, setTaskViewMode] = useState<'panel' | 'overlay'>(initialConfig.taskViewMode)
  const [tasksGroup, setTasksGroup] = useState<TasksGroupState>(() => {
    try {
      const stored = localStorage.getItem(TASKS_GROUP_KEY)
      if (stored) return JSON.parse(stored)
    } catch (e) {
      console.error('Failed to load tasks group state:', e)
    }
    return DEFAULT_TASKS_GROUP
  })
  const [taskCardPositions, setTaskCardPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    try {
      const stored = localStorage.getItem(TASK_POSITIONS_KEY)
      if (stored) return JSON.parse(stored)
    } catch (e) {
      console.error('Failed to load task card positions:', e)
    }
    return {}
  })

  // Day navigation state
  const [focusedDayIndex, setFocusedDayIndex] = useState<number | null>(null)

  // Get sorted unique days (oldest to newest), excluding task group
  const sortedDays = useMemo(() => {
    const days = new Set(stickies
      .filter(s => s.date !== TASKS_GROUP_DATE)
      .map(s => s.date))
    return Array.from(days).sort()
  }, [stickies])

  // Save to localStorage whenever stickies change (excluding task stickies)
  useEffect(() => {
    try {
      // Filter out task stickies - they're generated from todos, not persisted
      const regularStickies = stickies.filter(s => s.date !== TASKS_GROUP_DATE)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(regularStickies))
    } catch (e) {
      console.error('Failed to save stickies to localStorage:', e)
    }
  }, [stickies])

  // Save tasks group state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(TASKS_GROUP_KEY, JSON.stringify(tasksGroup))
    } catch (e) {
      console.error('Failed to save tasks group state:', e)
    }
  }, [tasksGroup])

  // Save task card positions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(TASK_POSITIONS_KEY, JSON.stringify(taskCardPositions))
    } catch (e) {
      console.error('Failed to save task card positions:', e)
    }
  }, [taskCardPositions])

  // Save config to shared localStorage key (theme is handled by ThemeContext)
  useEffect(() => {
    saveConfig({
      showTasks,
      taskViewMode,
      filters: {
        tag: filters.tag,
        hideCompleted: filters.hideCompleted,
        dateFilter: typeof filters.dateFilter === 'string' ? filters.dateFilter : 'all'
      }
    })
  }, [showTasks, taskViewMode, filters])

  // Push to history stack (debounced for drag operations)
  const pushHistory = useCallback((newStickies: Sticky[]) => {
    // Skip if this is a state restoration from undo/redo
    if (isUndoRedoRef.current) {
      return
    }

    // Truncate any redo history
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)

    // Add new state
    historyRef.current.push(JSON.parse(JSON.stringify(newStickies)))

    // Limit history size
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift()
    } else {
      historyIndexRef.current++
    }

    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(false)
  }, [])

  // Undo
  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--
      isUndoRedoRef.current = true
      const restoredState = historyRef.current[historyIndexRef.current]
      setStickies(JSON.parse(JSON.stringify(restoredState)))
      // Clear flag after state update is queued
      queueMicrotask(() => { isUndoRedoRef.current = false })
      setCanUndo(historyIndexRef.current > 0)
      setCanRedo(true)
    }
  }, [])

  // Redo
  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++
      isUndoRedoRef.current = true
      const restoredState = historyRef.current[historyIndexRef.current]
      setStickies(JSON.parse(JSON.stringify(restoredState)))
      // Clear flag after state update is queued
      queueMicrotask(() => { isUndoRedoRef.current = false })
      setCanUndo(true)
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
    }
  }, [])

  // Initialize history with current state
  useEffect(() => {
    if (historyRef.current.length === 0) {
      historyRef.current.push(JSON.parse(JSON.stringify(stickies)))
      historyIndexRef.current = 0
    }
  }, [])

  // Sync task stickies from todos in regular stickies (only in overlay mode)
  useEffect(() => {
    if (!showTasks || taskViewMode !== 'overlay') return
    if (drag) return // Don't sync while dragging

    // Get regular stickies (not task stickies)
    const regularStickies = stickies.filter(s => s.date !== TASKS_GROUP_DATE)
    const existingTaskStickies = stickies.filter(s => s.date === TASKS_GROUP_DATE)

    // Parse todos from regular stickies and build task stickies with collision-free positioning
    const newTaskStickies: Sticky[] = []

    // Helper to find non-overlapping position for a task sticky
    const findTaskPosition = (content: string, placedStickies: Sticky[]): { x: number; y: number } => {
      let posX = 0
      let posY = 0

      // Get the height of the new sticky based on its content
      const newHeight = getStickyHeight(content)

      const overlaps = () => {
        const newRect = getExpandedRect(posX, posY, STICKY_WIDTH, newHeight)
        return placedStickies.some(s => {
          const h = getStickyHeight(s.content, s.measuredHeight)
          const sr = getExpandedRect(s.x, s.y, STICKY_WIDTH, h)
          return !(newRect.r <= sr.l || newRect.l >= sr.r || newRect.b <= sr.t || newRect.t >= sr.b)
        })
      }

      // Find max Y of stickies in each column to know where to place next
      let iter = 0
      while (overlaps() && iter++ < 50) {
        // Move right first, then down
        posX = snap(posX + STICKY_WIDTH + STICKY_GAP)
        if (posX > (STICKY_WIDTH + STICKY_GAP) * 2) {
          posX = 0
          // Find the lowest point of all placed stickies to start new row
          const maxY = placedStickies.reduce((max, s) => {
            const h = getStickyHeight(s.content, s.measuredHeight)
            return Math.max(max, s.y + h)
          }, 0)
          posY = snap(maxY + STICKY_GAP)
        }
      }

      return { x: posX, y: posY }
    }

    // Helper to check if a sticky's date matches the filter
    const matchesDateFilter = (stickyDate: string): boolean => {
      if (filters.dateFilter === 'all') return true
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const [year, month, day] = stickyDate.split('-').map(Number)
      const date = new Date(year, month - 1, day)

      if (filters.dateFilter === 'today') return date.getTime() === today.getTime()
      if (filters.dateFilter === 'yesterday') {
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        return date.getTime() === yesterday.getTime()
      }
      if (filters.dateFilter === 'week') {
        const weekAgo = new Date(today)
        weekAgo.setDate(weekAgo.getDate() - 7)
        return date >= weekAgo && date <= today
      }
      return true
    }

    regularStickies.forEach(sticky => {
      // Apply date filter at the sticky level
      if (!matchesDateFilter(sticky.date)) return

      const { todos, noteTags } = parseContent(sticky.content)
      todos.forEach((todo, lineIndex) => {
        if (!todo.cleanText) return
        // Apply hideCompleted filter
        if (filters.hideCompleted && todo.checked) return

        const taskId = `task-${sticky.id}-${lineIndex}`
        const existingTask = existingTaskStickies.find(t => t.id === taskId)
        const storedPos = taskCardPositions[`${sticky.id}-${lineIndex}`]

        let x: number, y: number

        if (existingTask) {
          // Keep existing position
          x = existingTask.x
          y = existingTask.y
        } else if (storedPos) {
          // Use stored position
          x = storedPos.x
          y = storedPos.y
        } else {
          // Find non-overlapping position based on content
          const taskContent = `<p>${todo.cleanText}</p>`
          const pos = findTaskPosition(taskContent, newTaskStickies)
          x = pos.x
          y = pos.y
        }

        // Task gets its own tags + note-level tags (tags outside any task item)
        newTaskStickies.push({
          id: taskId,
          content: `<p>${todo.cleanText}</p>`,
          x,
          y,
          date: TASKS_GROUP_DATE,
          zIndex: 1,
          isTask: true,
          sourceId: sticky.id,
          sourceLineIndex: lineIndex,
          taskChecked: todo.checked,
          taskPriority: todo.priority,
          taskTags: [...todo.tags, ...noteTags],
        })
      })
    })

    // Only update if task stickies changed
    const existingIds = new Set(existingTaskStickies.map(s => s.id))
    const newIds = new Set(newTaskStickies.map(s => s.id))
    const hasChanges =
      existingTaskStickies.length !== newTaskStickies.length ||
      [...existingIds].some(id => !newIds.has(id)) ||
      [...newIds].some(id => !existingIds.has(id)) ||
      existingTaskStickies.some(existing => {
        const newTask = newTaskStickies.find(t => t.id === existing.id)
        return newTask && (
          newTask.content !== existing.content ||
          newTask.taskChecked !== existing.taskChecked
        )
      })

    if (hasChanges) {
      // Replace task stickies while keeping regular stickies unchanged
      setStickies([...regularStickies, ...newTaskStickies])
    }
  }, [showTasks, taskViewMode, stickies, taskCardPositions, drag, filters])

  // Track content before editing for history
  const editingContentRef = useRef<{ id: string; content: string } | null>(null)

  // Sticky operations
  const createSticky = useCallback((x: number, y: number) => {
    const rawX = x - offset.x
    const rawY = y - offset.y
    const todayDate = new Date().toISOString().split('T')[0]

    const newSticky: Sticky = {
      id: Date.now().toString(),
      content: '',
      x: snap(rawX),
      y: snap(rawY),
      date: todayDate,
      zIndex: stickies.length + 1
    }

    const newStickies = [...stickies, newSticky]
    pushHistory(newStickies)
    setStickies(newStickies)
    setSelectedIds(new Set([newSticky.id]))
    // Track content for history when editing ends
    editingContentRef.current = { id: newSticky.id, content: '' }
    setEditingId(newSticky.id)
  }, [offset, stickies, pushHistory])

  // When editing starts, capture the original content
  const setEditingIdWithHistory = useCallback((id: string | null) => {
    // If we're ending editing and content changed, push to history
    if (editingContentRef.current && editingContentRef.current.id && id !== editingContentRef.current.id) {
      const sticky = stickies.find(s => s.id === editingContentRef.current!.id)
      if (sticky && sticky.content !== editingContentRef.current.content) {
        // Content changed - this will be handled by the current state already being in place
        // We just need to make sure history reflects the change
        pushHistory(stickies)
      }
      editingContentRef.current = null
    }

    // If starting to edit a new sticky, capture its content
    if (id) {
      const sticky = stickies.find(s => s.id === id)
      if (sticky) {
        editingContentRef.current = { id, content: sticky.content }
      }
    }

    setEditingId(id)
  }, [stickies, pushHistory])

  const updateSticky = useCallback((id: string, updates: Partial<Sticky>) => {
    const newStickies = stickies.map(s => s.id === id ? { ...s, ...updates } : s)

    // Skip history for internal updates (measuredHeight) and content updates during editing
    // Content history is handled when editing ends via setEditingIdWithHistory
    const keys = Object.keys(updates)
    const isInternalUpdate = keys.every(key => key === 'measuredHeight')
    const isContentUpdate = keys.includes('content')

    if (!isInternalUpdate && !isContentUpdate) {
      pushHistory(newStickies)
    }

    setStickies(newStickies)
  }, [stickies, pushHistory])

  const deleteSticky = useCallback((id: string) => {
    const newStickies = stickies.filter(s => s.id !== id)
    pushHistory(newStickies)
    setStickies(newStickies)
    if (selectedIds.has(id)) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
    if (editingId === id) setEditingId(null)
  }, [stickies, selectedIds, editingId, pushHistory])

  const deleteSelectedStickies = useCallback(() => {
    if (selectedIds.size === 0 || editingId) return
    const newStickies = stickies.filter(s => !selectedIds.has(s.id))
    pushHistory(newStickies)
    setStickies(newStickies)
    setSelectedIds(new Set())
  }, [stickies, selectedIds, editingId, pushHistory])

  const selectSticky = useCallback((id: string | null, addToSelection = false) => {
    if (id === null) {
      setSelectedIds(new Set())
    } else if (addToSelection) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })
    } else {
      setSelectedIds(new Set([id]))
    }
  }, [])

  const clearAllStickies = useCallback(() => {
    pushHistory([])
    setStickies([])
    setSelectedIds(new Set())
    setEditingId(null)
  }, [pushHistory])

  // Helper to extract coordinates from mouse or touch event
  const getEventCoords = useCallback((e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    if ('changedTouches' in e && e.changedTouches.length > 0) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
    }
    return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY }
  }, [])

  // Drag operations
  const startDrag = useCallback((id: string, e: React.MouseEvent | React.TouchEvent) => {
    // Determine which stickies to drag:
    // If clicked sticky is in selection AND selection has multiple -> drag ALL selected
    // Otherwise -> drag just the clicked sticky
    const idsToDrag = selectedIds.has(id) && selectedIds.size > 1
      ? Array.from(selectedIds)
      : [id]

    // Capture original positions of all stickies being dragged
    const draggedStickies = idsToDrag
      .map(stickyId => stickies.find(s => s.id === stickyId))
      .filter((s): s is Sticky => s !== undefined)
      .map(s => ({ id: s.id, origX: s.x, origY: s.y }))

    if (draggedStickies.length > 0) {
      const coords = getEventCoords(e)
      setDrag({
        leaderId: id,
        startX: coords.x,
        startY: coords.y,
        stickies: draggedStickies
      })
    }
  }, [stickies, selectedIds, getEventCoords])

  // Start dragging all stickies in a date group
  const startGroupDrag = useCallback((date: string, e: React.MouseEvent | React.TouchEvent) => {
    // Find all stickies with this date
    const groupStickies = stickies.filter(s => s.date === date)

    // Select all stickies in the group (or clear if empty)
    setSelectedIds(new Set(groupStickies.map(s => s.id)))

    // Capture original positions
    const draggedStickies = groupStickies.map(s => ({
      id: s.id,
      origX: s.x,
      origY: s.y
    }))

    // Set drag state even for empty groups (prevents text selection, shows drag cursor)
    const coords = getEventCoords(e)
    setDrag({
      leaderId: groupStickies[0]?.id ?? '',
      startX: coords.x,
      startY: coords.y,
      stickies: draggedStickies
    })
  }, [stickies, getEventCoords])

  // Compact all stickies in a group - slide each card towards top-left with minimum movement
  // Optional visibleIds param: if provided, only arrange those IDs (for filtered views)
  const arrangeGroup = useCallback((date: string, visibleIds?: Set<string>) => {
    let groupStickies = stickies.filter(s => s.date === date)
    // If visibleIds provided, only arrange those stickies
    if (visibleIds) {
      groupStickies = groupStickies.filter(s => visibleIds.has(s.id))
    }
    if (groupStickies.length <= 1) return

    // Create working copy with heights
    const cards = groupStickies.map(s => ({
      id: s.id,
      x: s.x,
      y: s.y,
      h: getStickyHeight(s.content, s.measuredHeight)
    }))

    // Helper to check if two cards overlap
    const cardsOverlap = (a: typeof cards[0], b: typeof cards[0]) => {
      const aRect = getExpandedRect(a.x, a.y, STICKY_WIDTH, a.h)
      const bRect = getExpandedRect(b.x, b.y, STICKY_WIDTH, b.h)
      return !(aRect.r <= bRect.l || bRect.r <= aRect.l ||
               aRect.b <= bRect.t || bRect.b <= aRect.t)
    }

    // Phase 1: Resolve overlaps by pushing cards apart
    // Sort cards by position (top-left first) so we push later cards outward
    cards.sort((a, b) => (a.y + a.x) - (b.y + b.x))

    let resolveIterations = 0
    const maxResolveIterations = 50
    let hasOverlap = true

    while (hasOverlap && resolveIterations < maxResolveIterations) {
      hasOverlap = false
      resolveIterations++

      for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) {
          if (cardsOverlap(cards[i], cards[j])) {
            hasOverlap = true
            // Push card j (the later one) to the right or down
            const cardI = cards[i]
            const cardJ = cards[j]

            // Calculate how much we need to move to clear the overlap
            const pushRight = snap(cardI.x + STICKY_WIDTH + STICKY_GAP) - cardJ.x
            const pushDown = snap(cardI.y + cardI.h + STICKY_GAP) - cardJ.y

            // Choose the smaller push (prefer moving right if equal)
            if (pushRight <= pushDown && pushRight > 0) {
              cardJ.x = snap(cardI.x + STICKY_WIDTH + STICKY_GAP)
            } else if (pushDown > 0) {
              cardJ.y = snap(cardI.y + cardI.h + STICKY_GAP)
            } else {
              // Both pushes are negative/zero, card j is already clear in that direction
              // Push right as fallback
              cardJ.x = snap(cardI.x + STICKY_WIDTH + STICKY_GAP)
            }
          }
        }
      }
    }

    // Find anchor point (top-left corner) after resolving overlaps
    const anchorX = Math.min(...cards.map(c => c.x))
    const anchorY = Math.min(...cards.map(c => c.y))

    // Phase 2: Iteratively slide cards towards anchor until nothing moves
    let moved = true
    let iterations = 0
    const maxIterations = 100

    while (moved && iterations < maxIterations) {
      moved = false
      iterations++

      for (const card of cards) {
        // Try to move left - find the blocking X
        let targetX = anchorX
        for (const other of cards) {
          if (other.id === card.id) continue

          // Does this card overlap vertically with other?
          const vertOverlap = !(card.y + card.h + STICKY_GAP <= other.y ||
                                other.y + other.h + STICKY_GAP <= card.y)

          if (vertOverlap && other.x < card.x) {
            // Other card is to the left and overlaps vertically - it blocks us
            targetX = Math.max(targetX, snap(other.x + STICKY_WIDTH + STICKY_GAP))
          }
        }

        // Try to move up - find the blocking Y
        let targetY = anchorY
        for (const other of cards) {
          if (other.id === card.id) continue

          // Does this card overlap horizontally with other?
          const horzOverlap = !(card.x + STICKY_WIDTH + STICKY_GAP <= other.x ||
                                other.x + STICKY_WIDTH + STICKY_GAP <= card.x)

          if (horzOverlap && other.y < card.y) {
            // Other card is above and overlaps horizontally - it blocks us
            targetY = Math.max(targetY, snap(other.y + other.h + STICKY_GAP))
          }
        }

        // Only move towards anchor (don't move away)
        const newX = Math.min(card.x, targetX)
        const newY = Math.min(card.y, targetY)

        // Apply movement if changed
        if (newX !== card.x || newY !== card.y) {
          // But make sure new position doesn't overlap anything
          const wouldOverlap = cards.some(other => {
            if (other.id === card.id) return false
            const cardRect = getExpandedRect(newX, newY, STICKY_WIDTH, card.h)
            const otherRect = getExpandedRect(other.x, other.y, STICKY_WIDTH, other.h)
            return !(cardRect.r <= otherRect.l || otherRect.r <= cardRect.l ||
                     cardRect.b <= otherRect.t || otherRect.b <= cardRect.t)
          })

          if (!wouldOverlap) {
            card.x = newX
            card.y = newY
            moved = true
          }
        }
      }
    }

    // Update stickies with new positions
    const newStickies = stickies.map(s => {
      const c = cards.find(c => c.id === s.id)
      return c ? { ...s, x: c.x, y: c.y } : s
    })

    pushHistory(newStickies)
    setStickies(newStickies)
  }, [stickies, pushHistory])

  // Center viewport on stickies for a specific day
  const centerOnDay = useCallback((date: string) => {
    const dayStickies = stickies.filter(s => s.date === date && s.date !== TASKS_GROUP_DATE)

    if (dayStickies.length === 0) return

    // Calculate center of the day's stickies
    const minX = Math.min(...dayStickies.map(s => s.x))
    const maxX = Math.max(...dayStickies.map(s => s.x)) + STICKY_WIDTH
    const minY = Math.min(...dayStickies.map(s => s.y))
    const maxY = Math.max(...dayStickies.map(s => s.y + (s.measuredHeight || MIN_STICKY_HEIGHT)))

    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    // Pan to center
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    setOffset({
      x: -centerX + viewportWidth / 2,
      y: -centerY + viewportHeight / 2
    })
  }, [stickies, setOffset])

  // Center viewport on today's stickies and reset day navigation
  const centerOnToday = useCallback(() => {
    const today = new Date().toISOString().split('T')[0]
    const todayIndex = sortedDays.indexOf(today)
    setFocusedDayIndex(todayIndex >= 0 ? todayIndex : null)
    centerOnDay(today)
  }, [centerOnDay, sortedDays])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo/redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }

      // Cmd+Shift+G: Arrange today's group into grid
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'g') {
        e.preventDefault()
        const todayDate = new Date().toISOString().split('T')[0]
        arrangeGroup(todayDate)
        return
      }

      // Delete selected (only if not editing)
      if ((e.key === 'Backspace' || e.key === 'Delete') && !editingId && selectedIds.size > 0) {
        e.preventDefault()
        deleteSelectedStickies()
        return
      }

      // Enter to edit single selected card
      if (e.key === 'Enter' && selectedIds.size === 1 && !editingId) {
        e.preventDefault()
        const stickyId = [...selectedIds][0]
        const sticky = stickies.find(s => s.id === stickyId)
        if (sticky) {
          editingContentRef.current = { id: stickyId, content: sticky.content }
        }
        setEditingId(stickyId)
        return
      }

      // 0: Center on today's stickies (only if not editing)
      if (e.key === '0' && !editingId && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault()
        centerOnToday()
        return
      }

      // Arrow keys: Navigate between days (only if not editing)
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !editingId && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()

        if (sortedDays.length === 0) return

        // Initialize to today's index if not set
        let currentIndex = focusedDayIndex
        if (currentIndex === null) {
          const today = new Date().toISOString().split('T')[0]
          currentIndex = sortedDays.indexOf(today)
          if (currentIndex === -1) {
            // Find closest day to today
            currentIndex = sortedDays.findIndex(d => d >= today)
            if (currentIndex === -1) currentIndex = sortedDays.length - 1
          }
        }

        // Navigate with wrapping
        const today = new Date().toISOString().split('T')[0]
        const todayIndex = sortedDays.indexOf(today)
        const effectiveTodayIndex = todayIndex >= 0 ? todayIndex : sortedDays.length - 1

        if (e.key === 'ArrowLeft') {
          // At oldest (index 0), wrap to today
          currentIndex = currentIndex === 0 ? effectiveTodayIndex : currentIndex - 1
        } else {
          // At today (or end), wrap to oldest
          currentIndex = currentIndex >= effectiveTodayIndex ? 0 : currentIndex + 1
        }

        setFocusedDayIndex(currentIndex)
        centerOnDay(sortedDays[currentIndex])
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, editingId, selectedIds, deleteSelectedStickies, arrangeGroup, centerOnToday, sortedDays, focusedDayIndex, centerOnDay])

  // Auto-arrange task stickies when overlay first opens
  useEffect(() => {
    const isOverlayOpen = showTasks && taskViewMode === 'overlay'
    const wasOpen = wasOverlayOpenRef.current
    wasOverlayOpenRef.current = isOverlayOpen // Update ref first

    if (isOverlayOpen && !wasOpen) {
      // Overlay just opened - arrange after a short delay to let sync complete
      const timer = setTimeout(() => {
        // Get filtered task sticky IDs
        const taskStickies = stickies.filter(s => s.date === TASKS_GROUP_DATE)
        const regularStickies = stickies.filter(s => s.date !== TASKS_GROUP_DATE)

        const filteredIds = new Set(
          taskStickies
            .filter(s => {
              if (filters.hideCompleted && s.taskChecked) return false
              if (filters.dateFilter !== 'all') {
                const sourceSticky = regularStickies.find(r => r.id === s.sourceId)
                if (sourceSticky) {
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  const [year, month, day] = sourceSticky.date.split('-').map(Number)
                  const date = new Date(year, month - 1, day)

                  if (filters.dateFilter === 'today' && date.getTime() !== today.getTime()) return false
                  if (filters.dateFilter === 'yesterday') {
                    const yesterday = new Date(today)
                    yesterday.setDate(yesterday.getDate() - 1)
                    if (date.getTime() !== yesterday.getTime()) return false
                  }
                  if (filters.dateFilter === 'week') {
                    const weekAgo = new Date(today)
                    weekAgo.setDate(weekAgo.getDate() - 7)
                    if (date < weekAgo || date > today) return false
                  }
                }
              }
              return true
            })
            .map(s => s.id)
        )

        arrangeGroup(TASKS_GROUP_DATE, filteredIds)
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [showTasks, taskViewMode, arrangeGroup, stickies, filters])

  const updateDrag = useCallback((e: MouseEvent | TouchEvent) => {
    if (!drag) return

    // Get coordinates from mouse or touch event
    const coords = getEventCoords(e)

    // Calculate movement delta
    const deltaX = coords.x - drag.startX
    const deltaY = coords.y - drag.startY

    // Calculate new positions for all dragged stickies (allow free movement)
    const newPositions = drag.stickies.map(ds => ({
      id: ds.id,
      x: snap(ds.origX + deltaX),
      y: snap(ds.origY + deltaY)
    }))

    // Check if any position actually changed
    const anyChange = newPositions.some(np => {
      const current = stickies.find(s => s.id === np.id)
      return current && (current.x !== np.x || current.y !== np.y)
    })

    if (anyChange) {
      // Apply new positions to all dragged stickies
      setStickies(prev => prev.map(s => {
        const newPos = newPositions.find(np => np.id === s.id)
        return newPos ? { ...s, x: newPos.x, y: newPos.y } : s
      }))
    }
  }, [drag, stickies, getEventCoords])

  const endDrag = useCallback(() => {
    if (drag) {
      // Check if any sticky actually moved (click vs drag detection)
      const hasMovement = drag.stickies.some(ds => {
        const current = stickies.find(s => s.id === ds.id)
        if (!current) return false
        return current.x !== ds.origX || current.y !== ds.origY
      })

      // If no movement, just clear drag state and keep selection
      if (!hasMovement) {
        setDrag(null)
        return
      }

      // Get current positions of all dragged stickies
      const movedStickies = drag.stickies.map(ds => {
        const sticky = stickies.find(s => s.id === ds.id)!
        return {
          id: ds.id,
          x: sticky.x,
          y: sticky.y,
          width: STICKY_WIDTH,
          height: getStickyHeight(sticky.content, sticky.measuredHeight),
          date: sticky.date
        }
      })

      // Calculate group bounds for collision detection
      const groups = calculateGroupBounds(stickies)

      // Get the date of the moving stickies
      const movingDate = movedStickies[0]?.date

      // Check if we're moving a whole group (all stickies share the same date)
      const allSameDate = movedStickies.every(s => s.date === movingDate)
      const isGroupDrag = allSameDate && movedStickies.length > 1

      let newStickies: Sticky[]

      if (isGroupDrag) {
        // GROUP DRAG: Move the entire group as a unit
        // Calculate the current bounding box of the dragged group
        let minX = Infinity, minY = Infinity
        let maxX = -Infinity, maxY = -Infinity
        movedStickies.forEach(s => {
          minX = Math.min(minX, s.x)
          minY = Math.min(minY, s.y)
          maxX = Math.max(maxX, s.x + s.width)
          maxY = Math.max(maxY, s.y + s.height)
        })

        const groupWidth = maxX - minX + GROUP_PADDING * 2
        const groupHeight = maxY - minY + GROUP_PADDING * 2
        const groupX = minX - GROUP_PADDING
        const groupY = minY - GROUP_PADDING

        // Find valid position for the entire group using spiral search
        const otherGroups = groups.filter(g => g.date !== movingDate)

        // Check if group overlaps any other group at a test position
        // Include label height in collision detection
        const groupOverlapsAt = (testX: number, testY: number): boolean => {
          const testRect = {
            l: testX - HALF_GAP,
            t: testY - HALF_GAP - GROUP_LABEL_HEIGHT,
            r: testX + groupWidth + HALF_GAP,
            b: testY + groupHeight + HALF_GAP
          }

          return otherGroups.some(other => {
            const ol = other.bounds.x - GROUP_PADDING - HALF_GAP
            const ot = other.bounds.y - GROUP_PADDING - HALF_GAP - GROUP_LABEL_HEIGHT
            const or = other.bounds.x + other.bounds.width + GROUP_PADDING + HALF_GAP
            const ob = other.bounds.y + other.bounds.height + GROUP_PADDING + HALF_GAP
            return !(testRect.r <= ol || testRect.l >= or || testRect.b <= ot || testRect.t >= ob)
          })
        }

        // Spiral search for valid group position using euclidean distance
        let finalGroupX = groupX
        let finalGroupY = groupY

        if (groupOverlapsAt(groupX, groupY)) {
          // Build list of offsets sorted by euclidean distance (nearest first)
          const searchRadius = 50
          const offsets: { x: number; y: number; dist: number }[] = []

          for (let dx = -searchRadius; dx <= searchRadius; dx++) {
            for (let dy = -searchRadius; dy <= searchRadius; dy++) {
              if (dx === 0 && dy === 0) continue
              const ox = dx * GRID_SIZE
              const oy = dy * GRID_SIZE
              offsets.push({ x: ox, y: oy, dist: ox * ox + oy * oy })
            }
          }

          // Sort by distance (nearest first)
          offsets.sort((a, b) => a.dist - b.dist)

          // Find nearest valid position
          for (const offset of offsets) {
            const testX = snap(groupX + offset.x)
            const testY = snap(groupY + offset.y)

            if (!groupOverlapsAt(testX, testY)) {
              finalGroupX = testX
              finalGroupY = testY
              break
            }
          }
        }

        // Calculate offset to apply to all stickies in the group
        const offsetX = finalGroupX - groupX
        const offsetY = finalGroupY - groupY

        // Apply same offset to all dragged stickies (preserves relative positions)
        newStickies = stickies.map(s => {
          if (movedStickies.some(ms => ms.id === s.id)) {
            return { ...s, x: s.x + offsetX, y: s.y + offsetY }
          }
          return s
        })
      } else {
        // SINGLE CARD DRAG: Resolve collisions individually
        const resolvedPositions = resolveCollisions(movedStickies, stickies, {
          intent: 'drag',
          groups,
          movingDate
        })

        newStickies = stickies.map(s =>
          resolvedPositions[s.id]
            ? { ...s, x: resolvedPositions[s.id].x, y: resolvedPositions[s.id].y }
            : s
        )
      }

      setStickies(newStickies)
      pushHistory(newStickies)
    }
    setDrag(null)
  }, [drag, stickies, pushHistory])

  // Pan operations
  const startPan = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const coords = getEventCoords(e)
    setPanning(true)
    panStartRef.current = coords
    velocityRef.current = { x: 0, y: 0 }
    lastMoveTimeRef.current = performance.now()
  }, [getEventCoords])

  const updatePan = useCallback((e: MouseEvent | TouchEvent) => {
    if (!panning || !panStartRef.current) return

    const coords = getEventCoords(e)
    const dx = coords.x - panStartRef.current.x
    const dy = coords.y - panStartRef.current.y

    // Update offset
    setOffset(prev => ({
      x: prev.x + dx,
      y: prev.y + dy
    }))

    // Track velocity for momentum
    const now = performance.now()
    const dt = now - lastMoveTimeRef.current
    if (dt > 0 && dt < 100) {
      // Smooth velocity calculation
      const newVx = dx / dt * 16 // Normalize to ~60fps frame time
      const newVy = dy / dt * 16
      // Blend with previous velocity for smoother momentum
      velocityRef.current = {
        x: velocityRef.current.x * 0.5 + newVx * 0.5,
        y: velocityRef.current.y * 0.5 + newVy * 0.5
      }
    }
    lastMoveTimeRef.current = now
    panStartRef.current = coords
  }, [panning, getEventCoords])

  const endPan = useCallback(() => {
    setPanning(false)
    panStartRef.current = null

    // Apply momentum if there's significant velocity
    const velocity = velocityRef.current
    if (Math.abs(velocity.x) > 0.5 || Math.abs(velocity.y) > 0.5) {
      let vx = velocity.x
      let vy = velocity.y
      const friction = 0.95

      const animate = () => {
        if (Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) return

        setOffset(prev => ({
          x: prev.x + vx,
          y: prev.y + vy
        }))

        vx *= friction
        vy *= friction
        requestAnimationFrame(animate)
      }
      requestAnimationFrame(animate)
    }
    velocityRef.current = { x: 0, y: 0 }
  }, [])

  // Todo toggle - works with Tiptap HTML and legacy markdown
  const toggleTodo = useCallback((stickyId: string, lineIndex: number) => {
    const newStickies = stickies.map(s => {
      if (s.id !== stickyId) return s

      // Check if content is Tiptap HTML
      if (s.content.includes('data-type="taskItem"')) {
        // Parse HTML and toggle the task at lineIndex
        const parser = new DOMParser()
        const doc = parser.parseFromString(s.content, 'text/html')
        const taskItems = doc.querySelectorAll('li[data-type="taskItem"]')

        if (taskItems[lineIndex]) {
          const currentChecked = taskItems[lineIndex].getAttribute('data-checked') === 'true'
          taskItems[lineIndex].setAttribute('data-checked', String(!currentChecked))

          // Serialize back to HTML (just the body content)
          const newContent = doc.body.innerHTML
          return { ...s, content: newContent }
        }
        return s
      }

      // Legacy markdown toggle
      const lines = s.content.split('\n')
      if (lines[lineIndex]) {
        lines[lineIndex] = lines[lineIndex].includes('[ ]')
          ? lines[lineIndex].replace('[ ]', '[x]')
          : lines[lineIndex].replace('[x]', '[ ]')
        return { ...s, content: lines.join('\n') }
      }

      return s
    })

    pushHistory(newStickies)
    setStickies(newStickies)
  }, [stickies, pushHistory])

  // Toggle todo checkbox on a task sticky (updates source sticky)
  const toggleTaskTodo = useCallback((taskStickyId: string) => {
    const taskSticky = stickies.find(s => s.id === taskStickyId)
    if (!taskSticky || !taskSticky.sourceId || taskSticky.sourceLineIndex === undefined) return

    // Toggle the todo in the source sticky
    toggleTodo(taskSticky.sourceId, taskSticky.sourceLineIndex)
  }, [stickies, toggleTodo])

  // Update task sticky content and sync back to source sticky
  const updateTaskStickyContent = useCallback((taskStickyId: string, newContent: string) => {
    const taskSticky = stickies.find(s => s.id === taskStickyId)
    if (!taskSticky || !taskSticky.sourceId || taskSticky.sourceLineIndex === undefined) return

    const sourceSticky = stickies.find(s => s.id === taskSticky.sourceId)
    if (!sourceSticky) return

    // Extract plain text from new content (strip HTML)
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = newContent
    const newText = tempDiv.textContent || ''

    // Update the source sticky's todo line
    if (sourceSticky.content.includes('data-type="taskItem"')) {
      // Tiptap HTML format
      const parser = new DOMParser()
      const doc = parser.parseFromString(sourceSticky.content, 'text/html')
      const taskItems = doc.querySelectorAll('li[data-type="taskItem"]')

      if (taskItems[taskSticky.sourceLineIndex]) {
        // Find the paragraph inside the task item and update its text
        const p = taskItems[taskSticky.sourceLineIndex].querySelector('p')
        if (p) {
          p.textContent = newText
        } else {
          // Create a p if it doesn't exist
          const newP = doc.createElement('p')
          newP.textContent = newText
          taskItems[taskSticky.sourceLineIndex].innerHTML = ''
          taskItems[taskSticky.sourceLineIndex].appendChild(newP)
        }

        const newSourceContent = doc.body.innerHTML
        const newStickies = stickies.map(s =>
          s.id === sourceSticky.id ? { ...s, content: newSourceContent } : s
        )
        pushHistory(newStickies)
        setStickies(newStickies)
      }
    } else {
      // Legacy markdown format
      const lines = sourceSticky.content.split('\n')
      if (lines[taskSticky.sourceLineIndex]) {
        // Preserve the checkbox prefix
        const line = lines[taskSticky.sourceLineIndex]
        const checkboxMatch = line.match(/^(\s*-\s*\[[x ]\]\s*)/)
        if (checkboxMatch) {
          lines[taskSticky.sourceLineIndex] = checkboxMatch[1] + newText
        } else {
          lines[taskSticky.sourceLineIndex] = newText
        }

        const newSourceContent = lines.join('\n')
        const newStickies = stickies.map(s =>
          s.id === sourceSticky.id ? { ...s, content: newSourceContent } : s
        )
        pushHistory(newStickies)
        setStickies(newStickies)
      }
    }
  }, [stickies, pushHistory])

  // Pan to center a sticky in the viewport
  const panToSticky = useCallback((stickyId: string) => {
    const sticky = stickies.find(s => s.id === stickyId)
    if (!sticky) return

    // Calculate offset to center sticky in viewport
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Account for sidebar width (~320px for todo pane when visible in panel mode)
    const sidebarWidth = showTasks && taskViewMode === 'panel' ? 320 : 0
    const availableWidth = viewportWidth - sidebarWidth

    setOffset({
      x: -(sticky.x - availableWidth / 2 + STICKY_WIDTH / 2),
      y: -(sticky.y - viewportHeight / 2 + MIN_STICKY_HEIGHT / 2)
    })

    // Also select the sticky
    setSelectedIds(new Set([stickyId]))
  }, [stickies, showTasks, taskViewMode])

  // Export data
  const exportData = useCallback((): ThoughtCanvasExport => {
    return createExportData(stickies)
  }, [stickies])

  // Import data
  const importData = useCallback((data: ThoughtCanvasExport, mode: ImportMode) => {
    if (mode === 'replace') {
      // Replace all - push current state to history for undo
      pushHistory(data.stickies)
      setStickies(data.stickies)
      setSelectedIds(new Set())
      setEditingId(null)
    } else {
      // Merge - generate new IDs and offset positions
      const newStickies = offsetPositions(generateNewIds(data.stickies), 100)
      const merged = [...stickies, ...newStickies]
      pushHistory(merged)
      setStickies(merged)
      // Select the newly imported stickies
      setSelectedIds(new Set(newStickies.map(s => s.id)))
    }
  }, [stickies, pushHistory])

  // Tasks group operations
  const updateTasksGroupPosition = useCallback((x: number, y: number) => {
    setTasksGroup(prev => ({ ...prev, position: { x, y } }))
  }, [])

  const setTasksGroupExpanded = useCallback((expanded: boolean) => {
    setTasksGroup(prev => ({ ...prev, expanded }))
  }, [])

  const updateTaskCardPosition = useCallback((todoKey: string, x: number, y: number) => {
    setTaskCardPositions(prev => ({ ...prev, [todoKey]: { x, y } }))
  }, [])

  // Create a new task (sticky with an empty todo) - used when double-clicking in tasks group
  const createTaskInGroup = useCallback((_x: number, _y: number) => {
    // Find or create a sticky for today to add the task to
    const todayDate = new Date().toISOString().split('T')[0]
    const todaySticky = stickies.find(s => s.date === todayDate)

    if (todaySticky) {
      // Add an empty task to existing today sticky
      const newContent = todaySticky.content.includes('data-type="taskList"')
        ? todaySticky.content.replace(
            /<\/ul>\s*$/,
            `<li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li></ul>`
          )
        : todaySticky.content + `<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li></ul>`

      const newStickies = stickies.map(s =>
        s.id === todaySticky.id ? { ...s, content: newContent } : s
      )
      pushHistory(newStickies)
      setStickies(newStickies)
      // Focus the sticky for editing
      editingContentRef.current = { id: todaySticky.id, content: newContent }
      setEditingId(todaySticky.id)
      setSelectedIds(new Set([todaySticky.id]))
    } else {
      // Create a new sticky for today with an empty task
      const newSticky: Sticky = {
        id: Date.now().toString(),
        content: `<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li></ul>`,
        x: snap(100),
        y: snap(100),
        date: todayDate,
        zIndex: stickies.length + 1
      }
      const newStickies = [...stickies, newSticky]
      pushHistory(newStickies)
      setStickies(newStickies)
      editingContentRef.current = { id: newSticky.id, content: newSticky.content }
      setEditingId(newSticky.id)
      setSelectedIds(new Set([newSticky.id]))
    }
  }, [stickies, pushHistory])

  const value: StickiesContextValue = {
    stickies,
    selectedIds,
    editingId,
    drag,
    offset,
    panning,
    panStart: panStartRef.current,
    filters,
    showTasks,
    taskViewMode,
    canUndo,
    canRedo,
    createSticky,
    updateSticky,
    deleteSticky,
    deleteSelectedStickies,
    selectSticky,
    setEditingId: setEditingIdWithHistory,
    clearAllStickies,
    startDrag,
    startGroupDrag,
    updateDrag,
    endDrag,
    arrangeGroup,
    startPan,
    updatePan,
    endPan,
    setOffset,
    centerOnToday,
    toggleTodo,
    toggleTaskTodo,
    updateTaskStickyContent,
    panToSticky,
    undo,
    redo,
    setFilters,
    setShowTasks,
    setTaskViewMode,
    tasksGroup,
    taskCardPositions,
    updateTasksGroupPosition,
    setTasksGroupExpanded,
    updateTaskCardPosition,
    createTaskInGroup,
    getStickyHeight,
    exportData,
    importData,
  }

  return (
    <StickiesContext.Provider value={value}>
      {children}
    </StickiesContext.Provider>
  )
}

export function useStickies() {
  const context = useContext(StickiesContext)
  if (!context) {
    throw new Error('useStickies must be used within a StickiesProvider')
  }
  return context
}
