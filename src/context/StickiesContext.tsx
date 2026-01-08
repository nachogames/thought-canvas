import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
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
  startDrag: (id: string, e: React.MouseEvent) => void
  startGroupDrag: (date: string, e: React.MouseEvent) => void
  updateDrag: (e: MouseEvent) => void
  endDrag: () => void
  arrangeGroup: (date: string, visibleIds?: Set<string>) => void

  // Pan operations
  startPan: (e: React.MouseEvent) => void
  updatePan: (e: MouseEvent) => void
  endPan: () => void
  setOffset: React.Dispatch<React.SetStateAction<PanState>>

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

// Check if a rect overlaps any group (excluding a specific date)
const overlapsGroup = (
  rect: { l: number; t: number; r: number; b: number },
  groups: GroupObstacle[],
  excludeDate?: string
): boolean => {
  return groups.some(group => {
    if (excludeDate && group.date === excludeDate) return false

    // Group bounds with padding
    const gl = group.bounds.x - GROUP_PADDING - HALF_GAP
    const gt = group.bounds.y - GROUP_PADDING - HALF_GAP
    const gr = group.bounds.x + group.bounds.width + GROUP_PADDING + HALF_GAP
    const gb = group.bounds.y + group.bounds.height + GROUP_PADDING + HALF_GAP

    // Standard AABB overlap check
    return !(rect.r <= gl || rect.l >= gr || rect.b <= gt || rect.t >= gb)
  })
}

// Find non-overlapping position for new sticky
// Uses symmetric half-gap expansion: both rects expand by 10px = 20px total gap
// Also avoids existing groups (new card is for today's date)
const findNonOverlappingPosition = (
  x: number,
  y: number,
  existingStickies: Sticky[],
  todayDate: string
): { x: number; y: number } => {
  let posX = snap(x)
  let posY = snap(y)

  // Calculate all existing groups
  const groups = calculateGroupBounds(existingStickies)

  // Check if new card (expanded) overlaps any existing card (expanded) OR any group
  const overlaps = () => {
    const newRect = getExpandedRect(posX, posY, STICKY_WIDTH, MIN_STICKY_HEIGHT)

    // Check sticky overlap
    const stickyOverlap = existingStickies.some(s => {
      const h = getStickyHeight(s.content, s.measuredHeight)
      const sr = getExpandedRect(s.x, s.y, STICKY_WIDTH, h)
      // Standard AABB overlap: NOT (fully left OR fully right OR fully above OR fully below)
      return !(newRect.r <= sr.l || newRect.l >= sr.r || newRect.b <= sr.t || newRect.t >= sr.b)
    })

    if (stickyOverlap) return true

    // Check group overlap (exclude today's group since we're adding to it)
    return overlapsGroup(newRect, groups, todayDate)
  }

  let iter = 0
  while (overlaps() && iter++ < 20) {
    posY = snap(posY + GRID_SIZE * 2)
    if (posY > 1000) {
      posY = snap(y)
      posX = snap(posX + STICKY_WIDTH + STICKY_GAP)
    }
  }

  return { x: posX, y: posY }
}

interface StickiesProviderProps {
  children: ReactNode
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
  } catch (e) {
    console.error('Failed to load stickies from localStorage:', e)
  }
  // Return default sticky with Tiptap HTML format
  return [{
    id: '1',
    content: `<p>Welcome to Thought Canvas</p>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Create todos with checkboxes</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Add tags like #project</p></div></li>
</ul>
<ul>
  <li><p>Use bullets for notes</p></li>
  <li><p>Press / for more options</p></li>
</ul>`,
    x: 100,
    y: 100,
    date: new Date().toISOString().split('T')[0],
    zIndex: 1
  }]
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
  const [panStart, setPanStart] = useState<PanState | null>(null)
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
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false
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
      setStickies(JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current])))
      setCanUndo(historyIndexRef.current > 0)
      setCanRedo(true)
    }
  }, [])

  // Redo
  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++
      isUndoRedoRef.current = true
      setStickies(JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current])))
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

      // Delete selected (only if not editing)
      if ((e.key === 'Backspace' || e.key === 'Delete') && !editingId && selectedIds.size > 0) {
        e.preventDefault()
        const newStickies = stickies.filter(s => !selectedIds.has(s.id))
        pushHistory(newStickies)
        setStickies(newStickies)
        setSelectedIds(new Set())
        return
      }

      // Enter to edit single selected card
      if (e.key === 'Enter' && selectedIds.size === 1 && !editingId) {
        e.preventDefault()
        setEditingId([...selectedIds][0])
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, editingId, selectedIds, stickies, pushHistory])

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

      const { todos } = parseContent(sticky.content)
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
          taskTags: [...todo.tags],
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

  // Sticky operations
  const createSticky = useCallback((x: number, y: number) => {
    const rawX = x - offset.x
    const rawY = y - offset.y
    const todayDate = new Date().toISOString().split('T')[0]
    const pos = findNonOverlappingPosition(rawX, rawY, stickies, todayDate)

    const newSticky: Sticky = {
      id: Date.now().toString(),
      content: '',
      x: pos.x,
      y: pos.y,
      date: todayDate,
      zIndex: stickies.length + 1
    }

    const newStickies = [...stickies, newSticky]
    pushHistory(newStickies)
    setStickies(newStickies)
    setSelectedIds(new Set([newSticky.id]))
    setEditingId(newSticky.id)
  }, [offset, stickies, pushHistory])

  const updateSticky = useCallback((id: string, updates: Partial<Sticky>) => {
    const newStickies = stickies.map(s => s.id === id ? { ...s, ...updates } : s)
    pushHistory(newStickies)
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

  // Drag operations
  const startDrag = useCallback((id: string, e: React.MouseEvent) => {
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
      setDrag({
        leaderId: id,
        startX: e.clientX,
        startY: e.clientY,
        stickies: draggedStickies
      })
    }
  }, [stickies, selectedIds])

  // Start dragging all stickies in a date group
  const startGroupDrag = useCallback((date: string, e: React.MouseEvent) => {
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
    setDrag({
      leaderId: groupStickies[0]?.id ?? '',
      startX: e.clientX,
      startY: e.clientY,
      stickies: draggedStickies
    })
  }, [stickies])

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

    // Find anchor point (top-left corner)
    const anchorX = Math.min(...cards.map(c => c.x))
    const anchorY = Math.min(...cards.map(c => c.y))

    // Iteratively slide cards towards anchor until nothing moves
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

  const updateDrag = useCallback((e: MouseEvent) => {
    if (!drag) return

    // Calculate movement delta
    const deltaX = e.clientX - drag.startX
    const deltaY = e.clientY - drag.startY

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
  }, [drag, stickies])

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
  const startPan = useCallback((e: React.MouseEvent) => {
    setPanning(true)
    setPanStart({ x: e.clientX, y: e.clientY })
  }, [])

  const updatePan = useCallback((e: MouseEvent) => {
    if (!panning || !panStart) return

    setOffset(prev => ({
      x: prev.x + e.clientX - panStart.x,
      y: prev.y + e.clientY - panStart.y
    }))
    setPanStart({ x: e.clientX, y: e.clientY })
  }, [panning, panStart])

  const endPan = useCallback(() => {
    setPanning(false)
    setPanStart(null)
  }, [])

  // Todo toggle - works with Tiptap HTML and legacy markdown
  const toggleTodo = useCallback((stickyId: string, lineIndex: number) => {
    setStickies(prev => prev.map(s => {
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
    }))
  }, [])

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
      setEditingId(todaySticky.id)
      setSelectedIds(new Set([todaySticky.id]))
    } else {
      // Create a new sticky for today with an empty task
      const pos = findNonOverlappingPosition(100, 100, stickies, todayDate)
      const newSticky: Sticky = {
        id: Date.now().toString(),
        content: `<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li></ul>`,
        x: pos.x,
        y: pos.y,
        date: todayDate,
        zIndex: stickies.length + 1
      }
      const newStickies = [...stickies, newSticky]
      pushHistory(newStickies)
      setStickies(newStickies)
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
    panStart,
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
    setEditingId,
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
