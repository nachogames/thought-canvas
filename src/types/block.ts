export type BlockType = 'text' | 'todo' | 'bullet' | 'heading'

export interface Block {
  id: string
  type: BlockType
  content: string
  checked?: boolean // for todo blocks
}
