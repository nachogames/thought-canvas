import type { ParsedContent, ParsedTodo } from '@/types'

/**
 * Priority regex: must have space (or start) before !, nothing directly after except space/end
 * ✅ "task !" or "task !!" → priority
 * ❌ "don't" or "!task" or "task!important" → not priority
 */
const PRIORITY_REGEX = /(?:^|\s)(!{1,4})(?:\s|$)/

/**
 * Promotion marker regex: -> at end of text (with optional trailing whitespace)
 * Only valid for subtasks (depth > 0)
 */
const PROMOTION_MARKER_REGEX = /->\s*$/

/**
 * Remove tags, priority markers, and promotion marker from text for display
 */
export function cleanText(text: string): string {
  return text
    .replace(/#\w+/g, '')                    // Remove #tags
    .replace(/(?:^|\s)!{1,4}(?:\s|$)/g, ' ') // Remove priority markers
    .replace(PROMOTION_MARKER_REGEX, '')     // Remove -> promotion marker
    .replace(/\s+/g, ' ')                    // Normalize whitespace
    .trim()
}

/**
 * Parse content to extract todos, tags, and priority.
 * Handles both Tiptap HTML format and legacy markdown format.
 */
export function parseContent(content: string): ParsedContent {
  const todos: ParsedTodo[] = []
  const tags = new Set<string>()
  let priority = 0

  // Check if content is HTML (from Tiptap)
  if (content.includes('data-type="taskList"') || content.includes('data-type="taskItem"')) {
    return parseHtmlContent(content)
  }

  // Legacy markdown parsing for backwards compatibility
  const lines = content.split('\n')
  const allTaskTags = new Set<string>()

  lines.forEach((line, idx) => {
    // Extract all tags from line
    const tagMatches = line.match(/#(\w+)/g)
    if (tagMatches) {
      tagMatches.forEach(t => tags.add(t.slice(1)))
    }

    // Extract priority (! to !!!!) - must have space before, nothing after
    const priorityMatch = line.match(PRIORITY_REGEX)
    if (priorityMatch) {
      priority = Math.max(priority, priorityMatch[1].length)
    }

    // Check for todo pattern: - [ ] or - [x]
    const todoMatch = line.match(/^(\s*)-\s*\[([ x])\]\s*(.*)$/)
    if (todoMatch) {
      const todoTags = new Set<string>()
      const todoTagMatches = todoMatch[3].match(/#(\w+)/g)
      if (todoTagMatches) {
        todoTagMatches.forEach(t => {
          const tag = t.slice(1)
          todoTags.add(tag)
          allTaskTags.add(tag) // Track all tags that appear on task lines
        })
      }

      const todoPriorityMatch = todoMatch[3].match(PRIORITY_REGEX)
      const todoPriority = todoPriorityMatch ? todoPriorityMatch[1].length : 0

      todos.push({
        lineIndex: idx,
        checked: todoMatch[2] === 'x',
        text: todoMatch[3],
        cleanText: cleanText(todoMatch[3]),
        tags: todoTags,
        priority: todoPriority
      })
    }
  })

  // Note-level tags are tags that appear outside of task items
  const noteTags = new Set([...tags].filter(t => !allTaskTags.has(t)))

  return { todos, tags, noteTags, priority }
}

/**
 * Get direct text content from a task item, excluding nested task lists
 */
function getDirectTextContent(element: Element): string {
  const parts: string[] = []

  element.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent || '')
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element
      // Skip nested task lists - they'll be parsed as separate items
      if (el.getAttribute('data-type') === 'taskList') {
        return
      }
      // Recurse into other elements (like <p>, <label>, etc.)
      parts.push(getDirectTextContent(el))
    }
  })

  return parts.join('').trim()
}

/**
 * Get HTML content from a task item for rich rendering in TodoPane.
 * Extracts only the text content with basic formatting (bold, italic, links, line breaks).
 * Excludes: nested task lists, checkboxes, labels, task item structure.
 */
function getTaskItemHtmlContent(element: Element): string {
  const parts: string[] = []

  function processNode(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent || '')
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element
      const tagName = el.tagName.toLowerCase()

      // Skip elements we don't want
      if (el.getAttribute('data-type') === 'taskList') return // Nested task lists
      if (el.getAttribute('data-type') === 'taskItem') return // Nested task items
      if (tagName === 'label') return // Checkbox labels
      if (tagName === 'input') return // Checkboxes

      // Preserve formatting elements with their HTML
      if (['strong', 'b', 'em', 'i', 'a', 'code', 'mark', 's', 'u'].includes(tagName)) {
        parts.push(el.outerHTML)
        return
      }

      // For block elements, add line breaks
      if (['p', 'div', 'br'].includes(tagName)) {
        if (parts.length > 0 && tagName !== 'br') {
          // Add line break before new block (except for first element)
          const lastPart = parts[parts.length - 1]
          if (lastPart && !lastPart.endsWith('<br>') && !lastPart.endsWith('\n')) {
            parts.push('<br>')
          }
        }
        // Process children
        el.childNodes.forEach(child => processNode(child))
        return
      }

      // For other elements, just process children
      el.childNodes.forEach(child => processNode(child))
    }
  }

  element.childNodes.forEach(child => processNode(child))

  // Clean up: remove leading/trailing breaks, collapse multiple breaks
  let result = parts.join('')
    .replace(/^(<br>|\s)+/, '') // Remove leading breaks/whitespace
    .replace(/(<br>|\s)+$/, '') // Remove trailing breaks/whitespace
    .replace(/(<br>){3,}/g, '<br><br>') // Collapse 3+ breaks to 2

  return result.trim()
}

/**
 * Get text content from DOM with proper spacing between block elements
 */
function getTextWithSpacing(element: Element): string {
  const parts: string[] = []

  element.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent || '')
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element
      const tagName = el.tagName.toLowerCase()
      // Add space before block elements
      if (['p', 'div', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        parts.push(' ')
      }
      parts.push(getTextWithSpacing(el))
      // Add space after block elements
      if (['p', 'div', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        parts.push(' ')
      }
    }
  })

  return parts.join('')
}

/**
 * Parse Tiptap HTML content to extract todos, tags, and priority.
 * Handles nested task lists and promotion markers (->).
 */
function parseHtmlContent(html: string): ParsedContent {
  const todos: ParsedTodo[] = []
  const tags = new Set<string>()
  const allTaskTags = new Set<string>()
  let priority = 0

  // Create a temporary DOM parser
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Extract all tags from entire content (with proper spacing to avoid merging across elements)
  const fullText = getTextWithSpacing(doc.body)
  const tagMatches = fullText.match(/#(\w+)/g)
  if (tagMatches) {
    tagMatches.forEach(t => tags.add(t.slice(1)))
  }

  // Extract card-level priority from entire content
  const priorityMatch = fullText.match(PRIORITY_REGEX)
  if (priorityMatch) {
    priority = priorityMatch[1].length
  }

  // Parse task items recursively to track depth and parent relationships
  let globalIndex = 0

  function parseTaskList(
    taskList: Element,
    depth: number,
    parentIndex: number | null,
    parentText: string | null,
    parentTags: Set<string> = new Set(),
    parentPriority: number = 0
  ) {
    const items = taskList.querySelectorAll(':scope > li[data-type="taskItem"]')

    items.forEach((item) => {
      const checked = item.getAttribute('data-checked') === 'true'
      const completedAt = item.getAttribute('data-completed-at') || undefined
      const text = getDirectTextContent(item)
      const htmlContent = getTaskItemHtmlContent(item)
      const currentIndex = globalIndex++

      // Extract tags from this todo
      const todoTags = new Set<string>()
      const todoTagMatches = text.match(/#(\w+)/g)
      if (todoTagMatches) {
        todoTagMatches.forEach(t => {
          const tag = t.slice(1)
          todoTags.add(tag)
          allTaskTags.add(tag)
        })
      }

      // Extract priority from this todo's text
      const todoPriorityMatch = text.match(PRIORITY_REGEX)
      // Priority inheritance: own priority > parent priority > card-level priority
      const ownPriority = todoPriorityMatch ? todoPriorityMatch[1].length : 0
      const todoPriority = ownPriority || parentPriority || priority

      // Inherit parent tags for subtasks
      const effectiveTags = depth > 0 ? new Set([...todoTags, ...parentTags]) : todoTags

      // Check for promotion marker (-> at end) - only valid for nested tasks
      const hasPromotionMarker = PROMOTION_MARKER_REGEX.test(text)
      const isPromoted = depth > 0 && hasPromotionMarker

      const todo: ParsedTodo = {
        lineIndex: currentIndex,
        checked,
        text,
        cleanText: cleanText(text),
        htmlContent,
        tags: effectiveTags,
        priority: todoPriority,
        completedAt,
        depth,
        // Always set parentLineIndex for subtasks so they can be grouped
        ...(depth > 0 && parentIndex !== null && {
          parentLineIndex: parentIndex,
        }),
        // Only set promotion-specific fields when promoted
        ...(isPromoted && {
          isPromoted: true,
          parentText: parentText || undefined,
        }),
      }

      todos.push(todo)

      // Parse nested task lists (they can be nested inside div elements within the li)
      const nestedTaskLists = item.querySelectorAll('ul[data-type="taskList"]')
      nestedTaskLists.forEach(nestedList => {
        // Make sure this nested list is directly inside this item (not in a deeper nested item)
        const parentItem = nestedList.closest('li[data-type="taskItem"]')
        if (parentItem === item) {
          // Pass down this task's tags and priority to children
          parseTaskList(nestedList, depth + 1, currentIndex, cleanText(text), effectiveTags, todoPriority)
        }
      })
    })
  }

  // Find top-level task lists and parse them
  const topLevelTaskLists = doc.querySelectorAll('ul[data-type="taskList"]')
  topLevelTaskLists.forEach(taskList => {
    // Only process if this is truly a top-level list (not nested inside another taskItem)
    const isNested = taskList.closest('li[data-type="taskItem"]')
    if (!isNested) {
      parseTaskList(taskList, 0, null, null)
    }
  })

  // Note-level tags are tags that appear outside of task items
  const noteTags = new Set([...tags].filter(t => !allTaskTags.has(t)))

  return { todos, tags, noteTags, priority }
}

/**
 * Check if a line is a todo item
 */
export function isTodoLine(line: string): boolean {
  return /^(\s*)-\s*\[([ x])\]\s*/.test(line)
}

/**
 * Check if a line is a bullet point
 */
export function isBulletLine(line: string): boolean {
  return /^(\s*)-\s+(?!\[)/.test(line)
}

/**
 * Get the text content from a todo line
 */
export function getTodoText(line: string): string | null {
  const match = line.match(/^(\s*)-\s*\[([ x])\]\s*(.*)$/)
  return match ? match[3] : null
}

/**
 * Get the text content from a bullet line
 */
export function getBulletText(line: string): string | null {
  const match = line.match(/^(\s*)-\s+(.*)$/)
  return match ? match[2] : null
}

/**
 * Check if a todo line is checked
 */
export function isTodoChecked(line: string): boolean {
  const match = line.match(/^(\s*)-\s*\[([ x])\]/)
  return match ? match[2] === 'x' : false
}

/**
 * Convert all bullets to todos in text
 */
export function convertBulletsToTodos(text: string): string {
  return text.replace(/^(\s*)-\s+(?!\[)/gm, '$1- [ ] ')
}
