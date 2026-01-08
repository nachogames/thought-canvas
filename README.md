# Thought Canvas

A spatial, infinite-canvas note-taking application that reimagines how you capture, organize, and explore your thoughts. Instead of rigid folders and lists, your ideas flow freely across a boundless digital workspace, intelligently grouped by date with tagging and priority systems.

## Features

### Infinite Canvas Workspace
- **Boundless canvas** - Pan and place sticky notes anywhere in space
- **Automatic day grouping** - Notes organize themselves by creation date
- **Grid snapping** - 16px grid keeps layouts clean and aligned
- **Dark/Light themes** - Comfortable viewing in any environment

### Block-Based Content
Each sticky note supports multiple content blocks:

| Block Type | Syntax | Description |
|------------|--------|-------------|
| Text | (plain text) | Free-form thoughts |
| Todo | `- [ ]` / `- [x]` | Checkable task items |
| Bullet | `- ` | Unordered list items |
| Heading | `# ` | Section headers |

**Inline formatting:**
- **Tags**: `#tagname` for categorization and filtering
- **Priority**: `!` to `!!!!` for importance levels (1-4)

### Slash Commands
Type `/` to access quick formatting:
- `/todo` or `/t` - Convert block to todo
- `/bullet` or `/b` - Convert block to bullet
- `/turn` or `/convert` - Transform all text blocks to todos

### Rich Interactions
- **Double-click canvas** to create new notes
- **Double-click note** to edit
- **Cmd/Ctrl+Click** for multi-select
- **Drag notes** with collision detection and smart spacing
- **Drag day headers** to move entire date groups

### Todo Pane
- Aggregates all todos across notes
- Filter by tags
- Sort by priority
- Toggle completed visibility
- Click to jump to source note

### State Management
- Auto-save to localStorage
- Undo/Redo with 50-action history
- Automatic recovery on refresh

## Tech Stack

- **React 19** + **TypeScript**
- **Vite 7** for development and builds
- **Tailwind CSS 4** for styling
- **TipTap** for rich text editing
- **Lucide React** for icons

## Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd thought-canvas

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## Project Structure

```
src/
├── components/
│   ├── atoms/        # Basic UI elements (Button, Input, Tag, etc.)
│   ├── molecules/    # Composite components (TiptapEditor, FilterControls)
│   ├── organisms/    # Complex components (Canvas, Sticky, TodoPane)
│   └── templates/    # Page layouts
├── context/          # React context (StickiesContext, ThemeContext)
├── hooks/            # Custom React hooks
├── constants/        # Configuration (colors, layout, commands)
├── utils/            # Helper functions (parsing, grid, date)
├── types/            # TypeScript definitions
└── styles/           # Global CSS
```

## Usage

### Creating Notes
1. Double-click anywhere on the canvas to create a new sticky note
2. Start typing to add content
3. Use markdown-style syntax for formatting:
   - `- [ ]` for todos
   - `- ` for bullets
   - `# ` for headings
   - `#tag` for tags
   - `!` to `!!!!` for priority

### Organizing Notes
- Drag notes to reposition them
- Notes automatically group by creation date
- Use the day group header to move all notes from that day together

### Managing Todos
- Open the Todo Pane from the toolbar
- Filter todos by tag using the dropdown
- Toggle "Show completed" to hide finished items
- Click any todo to jump to its source note

### Keyboard Shortcuts
- **Enter** - Create new block
- **Backspace** (empty block) - Delete block and merge up
- **Arrow Up/Down** - Navigate between blocks
- **Cmd+Enter** - Toggle block type
- **Cmd+Z** - Undo
- **Cmd+Shift+Z** - Redo

## Design Philosophy

**Spatial-Temporal Hybrid**: Combines the freedom of spatial organization with automatic date-based grouping. Your thoughts exist in both space and time.

**Block-Based Architecture**: Each note contains multiple content blocks, enabling mixed content types and future extensibility.

**Local-First**: All data persists in localStorage. No backend, no accounts, no data leaving your device.

**Grid-Based Order**: 16px grid snapping and collision detection ensure your canvas stays organized without manual effort.

## License

MIT
