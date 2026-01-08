import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import type { Sticky, DragState, PanState, TodoFilters, ThoughtCanvasExport, ImportMode } from '@/types'
import { GRID_SIZE, STICKY_WIDTH, STICKY_GAP, MIN_STICKY_HEIGHT, GROUP_PADDING } from '@/constants'
import { getStickyHeight, resolveCollisions, createExportData, generateNewIds, offsetPositions } from '@/utils'
import type { GroupObstacle } from '@/utils/grid'

const STORAGE_KEY = 'thought-canvas-stickies'
const MAX_HISTORY = 50

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
  showPane: boolean
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

  // Pan operations
  startPan: (e: React.MouseEvent) => void
  updatePan: (e: MouseEvent) => void
  endPan: () => void
  setOffset: React.Dispatch<React.SetStateAction<PanState>>

  // Todo operations
  toggleTodo: (stickyId: string, lineIndex: number) => void
  panToSticky: (stickyId: string) => void

  // History operations
  undo: () => void
  redo: () => void

  // Filters
  setFilters: React.Dispatch<React.SetStateAction<TodoFilters>>
  setShowPane: React.Dispatch<React.SetStateAction<boolean>>

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
  const [filters, setFilters] = useState<TodoFilters>({ tag: null, hideCompleted: false, dateFilter: 'all' })
  const [showPane, setShowPane] = useState(true)

  // Save to localStorage whenever stickies change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stickies))
    } catch (e) {
      console.error('Failed to save stickies to localStorage:', e)
    }
  }, [stickies])

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
    if (groupStickies.length === 0) return

    // Select all stickies in the group
    setSelectedIds(new Set(groupStickies.map(s => s.id)))

    // Capture original positions
    const draggedStickies = groupStickies.map(s => ({
      id: s.id,
      origX: s.x,
      origY: s.y
    }))

    setDrag({
      leaderId: groupStickies[0].id,
      startX: e.clientX,
      startY: e.clientY,
      stickies: draggedStickies
    })
  }, [stickies])

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
        const groupOverlapsAt = (testX: number, testY: number): boolean => {
          const testRect = {
            l: testX - HALF_GAP,
            t: testY - HALF_GAP,
            r: testX + groupWidth + HALF_GAP,
            b: testY + groupHeight + HALF_GAP
          }

          return otherGroups.some(other => {
            const ol = other.bounds.x - GROUP_PADDING - HALF_GAP
            const ot = other.bounds.y - GROUP_PADDING - HALF_GAP
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

  // Pan to center a sticky in the viewport
  const panToSticky = useCallback((stickyId: string) => {
    const sticky = stickies.find(s => s.id === stickyId)
    if (!sticky) return

    // Calculate offset to center sticky in viewport
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Account for sidebar width (~320px for todo pane when visible)
    const sidebarWidth = showPane ? 320 : 0
    const availableWidth = viewportWidth - sidebarWidth

    setOffset({
      x: -(sticky.x - availableWidth / 2 + STICKY_WIDTH / 2),
      y: -(sticky.y - viewportHeight / 2 + MIN_STICKY_HEIGHT / 2)
    })

    // Also select the sticky
    setSelectedIds(new Set([stickyId]))
  }, [stickies, showPane])

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

  const value: StickiesContextValue = {
    stickies,
    selectedIds,
    editingId,
    drag,
    offset,
    panning,
    panStart,
    filters,
    showPane,
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
    startPan,
    updatePan,
    endPan,
    setOffset,
    toggleTodo,
    panToSticky,
    undo,
    redo,
    setFilters,
    setShowPane,
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
