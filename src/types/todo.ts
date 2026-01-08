export interface ParsedTodo {
  lineIndex: number
  checked: boolean
  text: string
  cleanText: string // Text with tags and priority markers removed
  tags: Set<string>
  priority: number // 0-4 (0 = no priority, 4 = !!!!)
}

export interface ParsedContent {
  todos: ParsedTodo[]
  tags: Set<string>
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
  | { start: string; end: string }

export interface TodoFilters {
  tag: string | null
  hideCompleted: boolean
  dateFilter: DateFilterValue
}
