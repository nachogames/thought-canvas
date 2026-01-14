import type { ParsedContent, ParsedTodo } from '@/types'

/**
 * Priority regex: must have space (or start) before !, nothing directly after except space/end
 * ✅ "task !" or "task !!" → priority
 * ❌ "don't" or "!task" or "task!important" → not priority
 */
const PRIORITY_REGEX = /(?:^|\s)(!{1,4})(?:\s|$)/

/**
 * Remove tags and priority markers from text for display
 */
export function cleanText(text: string): string {
  return text
    .replace(/#\w+/g, '')                    // Remove #tags
    .replace(/(?:^|\s)!{1,4}(?:\s|$)/g, ' ') // Remove priority markers
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
 * Parse Tiptap HTML content to extract todos, tags, and priority
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

  // Find all task items
  const taskItems = doc.querySelectorAll('li[data-type="taskItem"]')

  taskItems.forEach((item, idx) => {
    const checked = item.getAttribute('data-checked') === 'true'
    // Get only direct text content, excluding nested task lists
    const text = getDirectTextContent(item)

    // Extract tags from this todo
    const todoTags = new Set<string>()
    const todoTagMatches = text.match(/#(\w+)/g)
    if (todoTagMatches) {
      todoTagMatches.forEach(t => {
        const tag = t.slice(1)
        todoTags.add(tag)
        allTaskTags.add(tag) // Track all tags that appear on task lines
      })
    }

    // Extract priority from this todo (falls back to card-level priority)
    const todoPriorityMatch = text.match(PRIORITY_REGEX)
    const todoPriority = todoPriorityMatch ? todoPriorityMatch[1].length : priority

    todos.push({
      lineIndex: idx,
      checked,
      text,
      cleanText: cleanText(text),
      tags: todoTags,
      priority: todoPriority
    })
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
