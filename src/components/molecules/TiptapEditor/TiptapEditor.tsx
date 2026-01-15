import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { SlashCommands } from './SlashCommands'
import { TwoStepBackspace } from './TwoStepBackspace'
import { useEffect } from 'react'

interface TiptapEditorProps {
  content: string
  onChange: (html: string) => void
  onBlur?: () => void
  onDeleteEmpty?: () => void  // Called when backspace on empty content
  placeholder?: string
  editable?: boolean
  focusCoords?: { x: number; y: number } | null
}

export function TiptapEditor({
  content,
  onChange,
  onBlur,
  onDeleteEmpty,
  placeholder = "Type '/' for commands...",
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
        // Disable built-in link - we use our own configured Link extension
        link: false,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
      Link.configure({
        openOnClick: false, // Don't open links while editing
        autolink: true, // Auto-detect URLs as you type
        linkOnPaste: true, // Convert pasted URLs to links
        HTMLAttributes: {
          class: 'text-accent underline cursor-pointer',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      SlashCommands,
      TwoStepBackspace,
    ],
    content,
    editable,
    autofocus: false,
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
        // Backspace on empty content - delete the note
        if (event.key === 'Backspace' && onDeleteEmpty) {
          const isEmpty = editor?.isEmpty || editor?.getText().trim() === ''
          if (isEmpty) {
            event.preventDefault()
            onDeleteEmpty()
            return true
          }
        }

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

        // Cmd+K: Add/edit link
        if (isMod && event.key === 'k') {
          event.preventDefault()
          const previousUrl = editor?.getAttributes('link').href || ''
          const url = window.prompt('Enter URL:', previousUrl)

          if (url === null) {
            // User cancelled
            return true
          }

          if (url === '') {
            // Remove link
            editor?.chain().focus().unsetLink().run()
          } else {
            // Set link
            editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
          }
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
      // Use requestAnimationFrame to ensure DOM is ready before positioning cursor
      requestAnimationFrame(() => {
        try {
          if (focusCoords) {
            // Try to position cursor at click location
            const pos = editor.view.posAtCoords({ left: focusCoords.x, top: focusCoords.y })
            if (pos && pos.pos > 0) {
              editor.commands.focus()
              editor.commands.setTextSelection(pos.pos)
            } else {
              editor.commands.focus('end')
            }
          } else {
            editor.commands.focus('end')
          }
        } catch {
          // Fallback if text selection fails (e.g., empty document)
          editor.commands.focus('end')
        }
      })
    }
  }, [editable, editor, focusCoords])

  return <EditorContent editor={editor} />
}
