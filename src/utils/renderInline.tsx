import type { ReactNode } from 'react'

interface InlinePart {
  type: 'text' | 'tag' | 'priority'
  content: string
  level?: number // for priority
}

/**
 * Parse text into parts (text, tags, priority markers)
 */
export function parseInlineParts(text: string): InlinePart[] {
  if (!text) return []

  const parts: InlinePart[] = []
  const regex = /(#\w+|!{1,4}(?!\w))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text))) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      })
    }

    // Add match
    if (match[0].startsWith('#')) {
      parts.push({
        type: 'tag',
        content: match[0]
      })
    } else {
      parts.push({
        type: 'priority',
        content: match[0],
        level: match[0].length
      })
    }

    lastIndex = regex.lastIndex
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex)
    })
  }

  return parts
}

/**
 * Render inline text with tags and priority markers as React elements
 */
export function renderInline(text: string): ReactNode {
  if (!text) return null

  const parts = parseInlineParts(text)
  if (parts.length === 0) return text

  return parts.map((part, idx) => {
    if (part.type === 'tag') {
      return (
        <span
          key={idx}
          className="inline-flex px-2 py-0.5 rounded text-xs font-mono bg-accent-muted text-accent-light mx-0.5"
        >
          {part.content}
        </span>
      )
    }

    if (part.type === 'priority') {
      const priorityClasses: Record<number, string> = {
        1: 'opacity-60',
        2: 'text-yellow-500',
        3: 'text-orange-500',
        4: 'text-red-500 font-semibold'
      }
      return (
        <span key={idx} className={priorityClasses[part.level || 1]}>
          {part.content}
        </span>
      )
    }

    return <span key={idx}>{part.content}</span>
  })
}
