import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { SlashCommands } from './SlashCommands'
import { TwoStepBackspace } from './TwoStepBackspace'
import { useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'

/**
 * Count task items before a given position to get the lineIndex
 * This matches the indexing used in parseContent.ts
 */
function getTaskItemIndexAtPosition(editor: Editor): number | null {
  const { $from } = editor.state.selection

  // Walk up to find the task item containing the cursor
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (node.type.name === 'taskItem') {
      // Found the task item - now count how many task items come before it
      let count = 0
      const targetPos = $from.before(depth)

      // Walk through the document and count task items
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'taskItem' && pos < targetPos) {
          count++
        }
      })

      return count
    }
  }

  return null // Not in a task item
}

interface TiptapEditorProps {
  content: string
  onChange: (html: string) => void
  onBlur?: () => void
  onDeleteEmpty?: () => void  // Called when backspace on empty content
  onCursorMove?: (lineIndex: number | null) => void  // Called when cursor moves to/from a task item
  placeholder?: string
  editable?: boolean
  focusCoords?: { x: number; y: number } | null
  toggleTaskIndex?: number | null  // Index of task to toggle on mount (for view-mode checkbox clicks)
  focusTaskIndex?: number | null  // Index of task to focus cursor on (without toggling, for edit-mode checkbox clicks)
}

export function TiptapEditor({
  content,
  onChange,
  onBlur,
  onDeleteEmpty,
  onCursorMove,
  placeholder = "Type '/' for commands...",
  editable = true,
  focusCoords = null,
  toggleTaskIndex = null,
  focusTaskIndex = null,
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
        class: 'outline-none text-sm',
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

  // Sync content from outside - only when editor is NOT focused
  // When the editor has focus, content flows outward via onChange only
  // This prevents cursor jumping when typing
  useEffect(() => {
    if (editor && !editor.isFocused) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  // Sync editable state and focus when becoming editable
  useEffect(() => {
    if (!editor) return
    editor.setEditable(editable)
    if (editable) {
      // If we have a toggleTaskIndex, the toggle effect will handle focus/cursor
      if (toggleTaskIndex !== null) return

      // Use requestAnimationFrame to ensure DOM is ready before positioning cursor
      requestAnimationFrame(() => {
        try {
          if (focusCoords) {
            // Try to position cursor at click location
            const pos = editor.view.posAtCoords({ left: focusCoords.x, top: focusCoords.y })
            if (pos && pos.pos > 0) {
              // Validate that the position is in a text node before setting selection
              const $pos = editor.state.doc.resolve(pos.pos)
              const node = $pos.node()

              // Check if we're in a node that supports text selection
              if (node.isTextblock || node.type.name === 'text') {
                editor.commands.focus()
                editor.commands.setTextSelection(pos.pos)
              } else {
                // Find the nearest valid text position
                editor.commands.focus('end')
              }
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
  }, [editable, editor, focusCoords, toggleTaskIndex])

  // Track last processed toggle to prevent double execution (React StrictMode or multiple renders)
  const lastProcessedToggleRef = useRef<number | null>(null)

  // Toggle a task item when entering edit mode via checkbox click
  useEffect(() => {
    // Reset the ref when toggleTaskIndex becomes null (allows same index to be toggled again later)
    if (toggleTaskIndex === null) {
      lastProcessedToggleRef.current = null
      return
    }

    if (!editor || !editable) return

    // Prevent double execution - check if we already processed this exact toggle
    if (lastProcessedToggleRef.current === toggleTaskIndex) {
      return
    }
    lastProcessedToggleRef.current = toggleTaskIndex

    // Use requestAnimationFrame to ensure DOM and editor are fully ready
    requestAnimationFrame(() => {
      // Find and toggle the task at the given index
      let taskCount = 0
      let targetPos: number | null = null

      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'taskItem') {
          if (taskCount === toggleTaskIndex) {
            targetPos = pos
          }
          taskCount++
        }
      })

      if (targetPos !== null) {
        // Toggle the task's checked state
        const node = editor.state.doc.nodeAt(targetPos)
        if (node && node.type.name === 'taskItem') {
          const newChecked = !node.attrs.checked

          // Find the end of the first paragraph inside the task item
          // TaskItem structure: taskItem > paragraph > text
          let textEndPos = targetPos + 1 // Start after taskItem opening
          node.forEach((child, offset) => {
            if (child.type.name === 'paragraph') {
              // Position at end of paragraph content (before closing)
              textEndPos = targetPos! + 1 + offset + child.nodeSize - 1
              return false // Stop after first paragraph
            }
          })

          editor.chain()
            .focus()
            .command(({ tr }) => {
              tr.setNodeMarkup(targetPos!, undefined, {
                ...node.attrs,
                checked: newChecked,
              })
              return true
            })
            .setTextSelection(textEndPos)
            .run()
        }
      }
    })
  }, [editor, toggleTaskIndex, editable])

  // Focus cursor on a task item (without toggling) when clicking checkbox in edit mode
  useEffect(() => {
    if (!editor || focusTaskIndex === null || !editable) return

    // Find the task at the given index
    let taskCount = 0
    let targetPos: number | null = null

    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'taskItem') {
        if (taskCount === focusTaskIndex) {
          targetPos = pos
        }
        taskCount++
      }
    })

    if (targetPos !== null) {
      const node = editor.state.doc.nodeAt(targetPos)
      if (node && node.type.name === 'taskItem') {
        // Find the end of the first paragraph inside the task item
        let textEndPos = targetPos + 1
        node.forEach((child, offset) => {
          if (child.type.name === 'paragraph') {
            textEndPos = targetPos! + 1 + offset + child.nodeSize - 1
            return false
          }
        })

        // Just position cursor, don't toggle
        editor.chain()
          .focus()
          .setTextSelection(textEndPos)
          .run()
      }
    }
  }, [editor, focusTaskIndex, editable])

  // Track cursor position for scroll-on-focus feature
  useEffect(() => {
    if (!editor || !onCursorMove) return

    const handleSelectionUpdate = () => {
      const lineIndex = getTaskItemIndexAtPosition(editor)
      onCursorMove(lineIndex)
    }

    // Also fire on initial focus
    handleSelectionUpdate()

    editor.on('selectionUpdate', handleSelectionUpdate)
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate)
    }
  }, [editor, onCursorMove])

  // Handle checkbox clicks - move cursor to end of that task's text
  useEffect(() => {
    if (!editor) return

    const editorEl = editor.view.dom

    const handleCheckboxClick = (e: Event) => {
      const target = e.target as HTMLElement

      if (target.tagName === 'INPUT' && target.getAttribute('type') === 'checkbox') {
        // TipTap TaskItem uses li[data-checked] not li[data-type="taskItem"]
        const taskItem = target.closest('li[data-checked]')
        if (taskItem) {
          // Get all task items (li elements with data-checked attribute)
          const allTaskItems = Array.from(editorEl.querySelectorAll('li[data-checked]'))
          const taskIndex = allTaskItems.indexOf(taskItem as Element)

          if (taskIndex !== -1) {
            // Find this task in the document
            let taskCount = 0
            let targetPos: number | null = null

            editor.state.doc.descendants((node, nodePos) => {
              if (node.type.name === 'taskItem') {
                if (taskCount === taskIndex) {
                  targetPos = nodePos
                }
                taskCount++
              }
            })

            if (targetPos !== null) {
              const node = editor.state.doc.nodeAt(targetPos)
              if (node && node.type.name === 'taskItem') {
                // Find the end of the first paragraph
                let textEndPos = targetPos + 1
                node.forEach((child, offset) => {
                  if (child.type.name === 'paragraph') {
                    textEndPos = targetPos! + 1 + offset + child.nodeSize - 1
                    return false
                  }
                })

                // Position cursor after TipTap handles the toggle
                setTimeout(() => {
                  editor.chain()
                    .focus()
                    .setTextSelection(textEndPos)
                    .run()
                }, 10)
              }
            }
          }
        }
      }
    }

    editorEl.addEventListener('click', handleCheckboxClick, true) // Use capture phase
    return () => {
      editorEl.removeEventListener('click', handleCheckboxClick, true)
    }
  }, [editor])

  return <EditorContent editor={editor} />
}
