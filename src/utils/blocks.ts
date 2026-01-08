import { nanoid } from 'nanoid'
import type { Block, BlockType } from '@/types'

/**
 * Create a new block with a unique ID
 */
export function createBlock(type: BlockType, content: string, checked?: boolean): Block {
  return {
    id: nanoid(8),
    type,
    content,
    ...(type === 'todo' && { checked: checked ?? false })
  }
}

/**
 * Parse legacy content string into blocks array
 * Handles: todos, bullets, regular text, empty lines
 */
export function parseContentToBlocks(content: string): Block[] {
  if (!content) {
    return [createBlock('text', '')]
  }

  const lines = content.split('\n')
  return lines.map(line => {
    // Todo line: - [ ] or - [x]
    const todoMatch = line.match(/^(\s*)-\s*\[([ x])\]\s*(.*)$/)
    if (todoMatch) {
      return createBlock('todo', todoMatch[3], todoMatch[2] === 'x')
    }

    // Bullet line: - text
    const bulletMatch = line.match(/^(\s*)-\s+(.*)$/)
    if (bulletMatch) {
      return createBlock('bullet', bulletMatch[2])
    }

    // Heading line: # text
    const headingMatch = line.match(/^#+\s+(.*)$/)
    if (headingMatch) {
      return createBlock('heading', headingMatch[1])
    }

    // Regular text line (including empty)
    return createBlock('text', line)
  })
}

/**
 * Convert blocks array back to legacy content string
 * Used for storage compatibility and export
 */
export function blocksToContent(blocks: Block[]): string {
  return blocks.map(block => {
    switch (block.type) {
      case 'todo':
        return `- [${block.checked ? 'x' : ' '}] ${block.content}`
      case 'bullet':
        return `- ${block.content}`
      case 'heading':
        return `# ${block.content}`
      case 'text':
      default:
        return block.content
    }
  }).join('\n')
}

/**
 * Toggle a todo block's checked state
 */
export function toggleBlockTodo(blocks: Block[], blockId: string): Block[] {
  return blocks.map(block =>
    block.id === blockId && block.type === 'todo'
      ? { ...block, checked: !block.checked }
      : block
  )
}

/**
 * Update a block's content
 */
export function updateBlockContent(blocks: Block[], blockId: string, content: string): Block[] {
  return blocks.map(block =>
    block.id === blockId
      ? { ...block, content }
      : block
  )
}

/**
 * Insert a new block after the specified block
 */
export function insertBlockAfter(blocks: Block[], afterId: string, newBlock: Block): Block[] {
  const index = blocks.findIndex(b => b.id === afterId)
  if (index === -1) return [...blocks, newBlock]

  const result = [...blocks]
  result.splice(index + 1, 0, newBlock)
  return result
}

/**
 * Remove a block by ID
 */
export function removeBlock(blocks: Block[], blockId: string): Block[] {
  const filtered = blocks.filter(b => b.id !== blockId)
  // Always keep at least one empty block
  return filtered.length > 0 ? filtered : [createBlock('text', '')]
}

/**
 * Merge a block with the previous block (for backspace at start)
 */
export function mergeWithPrevious(blocks: Block[], blockId: string): { blocks: Block[], cursorPosition: number } {
  const index = blocks.findIndex(b => b.id === blockId)
  if (index <= 0) return { blocks, cursorPosition: 0 }

  const prevBlock = blocks[index - 1]
  const currentBlock = blocks[index]
  const cursorPosition = prevBlock.content.length

  const result = [...blocks]
  result[index - 1] = {
    ...prevBlock,
    content: prevBlock.content + currentBlock.content
  }
  result.splice(index, 1)

  return { blocks: result, cursorPosition }
}
