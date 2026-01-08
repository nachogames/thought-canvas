import { Extension } from '@tiptap/core'

/**
 * TwoStepBackspace Extension
 *
 * Modifies backspace behavior for todo items and bullet lists:
 * - First backspace at start of list item: Removes list formatting (converts to paragraph)
 * - Second backspace: Merges paragraph with previous block
 *
 * This provides more granular control and prevents accidental content merging.
 */
export const TwoStepBackspace = Extension.create({
  name: 'twoStepBackspace',

  // Higher priority than ListKeymap (100) to intercept first
  priority: 150,

  addStorage() {
    return {
      // Track if we just lifted a list item (converted to paragraph)
      justLifted: false,
    }
  },

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { state } = editor
        const { selection } = state
        const { $from } = selection

        // Only handle collapsed selection (no text selected)
        if (!selection.empty) return false

        // Only handle when cursor is at the very start of the text block
        if ($from.parentOffset !== 0) return false

        // Check if we're in a task item or list item
        const taskItemType = state.schema.nodes.taskItem
        const listItemType = state.schema.nodes.listItem

        // Find if we're in a list item by walking up the node tree
        let isTaskItem = false
        let isListItem = false

        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d)
          if (taskItemType && node.type === taskItemType) {
            isTaskItem = true
            break
          }
          if (listItemType && node.type === listItemType) {
            isListItem = true
            break
          }
        }

        if (isTaskItem || isListItem) {
          // We're in a list item at the start - lift it out
          const itemName = isTaskItem ? 'taskItem' : 'listItem'
          const lifted = editor.commands.liftListItem(itemName)

          if (lifted) {
            // Mark that we just lifted - next backspace should merge
            this.storage.justLifted = true
          }

          return lifted
        }

        // If we just lifted and this is the second backspace, allow merge
        if (this.storage.justLifted) {
          // Reset the flag
          this.storage.justLifted = false
          // Return false to let the default backspace handler merge the paragraph
          return false
        }

        // Not our case - let other handlers deal with it
        return false
      },
    }
  },

  // Reset state when selection changes (user clicked/arrowed elsewhere)
  onSelectionUpdate() {
    this.storage.justLifted = false
  },
})
