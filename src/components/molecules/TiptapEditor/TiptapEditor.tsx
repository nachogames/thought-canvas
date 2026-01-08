import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { SlashCommands } from './SlashCommands'
import { useEffect } from 'react'

interface TiptapEditorProps {
  content: string
  onChange: (html: string) => void
  onBlur?: () => void
  placeholder?: string
  autoFocus?: boolean
  editable?: boolean
  focusCoords?: { x: number; y: number } | null
}

export function TiptapEditor({
  content,
  onChange,
  onBlur,
  placeholder = "Type '/' for commands...",
  autoFocus = false,
  editable = true,
  focusCoords = null,
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable unused extensions for smaller bundle
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        code: false,
      }),
      TaskList,
      TaskItem.configure({
        nested: false,
        HTMLAttributes: {
          class: 'flex items-start gap-2',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      SlashCommands,
    ],
    content,
    editable,
    autofocus: autoFocus ? 'end' : false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    onBlur: () => {
      onBlur?.()
    },
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[60px] text-sm',
      },
      // Keyboard shortcuts for block transformations
      handleKeyDown: (_view, event) => {
        const isMod = event.metaKey || event.ctrlKey

        // Cmd+Enter: Toggle todo on current line
        if (isMod && event.key === 'Enter') {
          event.preventDefault()
          editor?.chain().focus().toggleTaskList().run()
          return true
        }

        // Cmd+Shift+C: Toggle task list (checkbox)
        if (isMod && event.shiftKey && event.key === 'c') {
          event.preventDefault()
          editor?.chain().focus().toggleTaskList().run()
          return true
        }

        // Cmd+Shift+B: Toggle bullet list
        if (isMod && event.shiftKey && event.key === 'b') {
          event.preventDefault()
          editor?.chain().focus().toggleBulletList().run()
          return true
        }

        // Cmd+Shift+1: Heading 1
        if (isMod && event.shiftKey && event.key === '1') {
          event.preventDefault()
          editor?.chain().focus().toggleHeading({ level: 1 }).run()
          return true
        }

        // Cmd+Shift+2: Heading 2
        if (isMod && event.shiftKey && event.key === '2') {
          event.preventDefault()
          editor?.chain().focus().toggleHeading({ level: 2 }).run()
          return true
        }

        // Cmd+Shift+0: Plain paragraph
        if (isMod && event.shiftKey && event.key === '0') {
          event.preventDefault()
          editor?.chain().focus().setParagraph().run()
          return true
        }

        return false
      },
    },
  })

  // Sync content from outside
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  // Sync editable state and focus when becoming editable
  useEffect(() => {
    if (!editor) return
    editor.setEditable(editable)
    if (editable) {
      // Focus the editor when it becomes editable
      if (focusCoords) {
        // Try to position cursor at click location
        const pos = editor.view.posAtCoords({ left: focusCoords.x, top: focusCoords.y })
        if (pos) {
          editor.commands.focus()
          editor.commands.setTextSelection(pos.pos)
        } else {
          editor.commands.focus('end')
        }
      } else {
        editor.commands.focus('end')
      }
    }
  }, [editable, editor, focusCoords])

  return <EditorContent editor={editor} />
}
