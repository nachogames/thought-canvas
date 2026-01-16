export interface ParsedTodo {
  lineIndex: number
  checked: boolean
  text: string
  cleanText: string // Text with tags and priority markers removed
  htmlContent?: string // Inner HTML content for rich rendering in TodoPane
  tags: Set<string>
  priority: number // 0-4 (0 = no priority, 4 = !!!!)
  completedAt?: string // ISO timestamp when task was completed
  // Subtask promotion fields (for nested todos with -> marker)
  isPromoted?: boolean // Has -> marker, should appear as standalone task
  parentText?: string // Parent task text (for display context)
  parentLineIndex?: number // Parent's index in the todos array
  depth?: number // Nesting level (0 = top-level, 1 = first nested, etc.)
}

export interface ParsedContent {
  todos: ParsedTodo[]
  tags: Set<string>        // All tags in the note (for backwards compat)
  noteTags: Set<string>    // Tags outside task items (apply to all tasks)
  priority: number
}

export interface TodoWithContext extends ParsedTodo {
  stickyId: string
  allTags: Set<string>
  date: string
}

export type DateFilterValue =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'week'
  | 'completed-today'
  | 'completed-yesterday'
  | 'completed-week'
  | { start: string; end: string }

export interface TodoFilters {
  tag: string | null
  hideCompleted: boolean
  dateFilter: DateFilterValue
}

export interface TasksGroupState {
  position: { x: number; y: number }
  expanded: boolean
}

export interface TaskCardPosition {
  x: number
  y: number
}
