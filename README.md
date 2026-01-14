# Thought Canvas

A spatial, infinite-canvas note-taking application that reimagines how you capture, organize, and explore your thoughts. Instead of rigid folders and lists, your ideas flow freely across a boundless digital workspace, intelligently grouped by date with tagging and priority systems.

## Features

### Infinite Canvas Workspace
- **Boundless canvas** - Pan and place sticky notes anywhere in space
- **Automatic day grouping** - Notes organize themselves by creation date
- **Grid snapping** - 16px grid keeps layouts clean and aligned
- **Card colors** - Choose from default, blue, green, yellow, or rose backgrounds
- **Dark/Light themes** - Comfortable viewing in any environment

### Rich Text Editing (Tiptap)
Full rich text editing powered by Tiptap with support for:
- **Task lists** - Checkable todo items with nested subtasks (Tab to indent)
- **Bullet lists** - Unordered list items
- **Headings** - H1 and H2 support
- **Tags** - `#tagname` for categorization and filtering
- **Priority markers** - `!` (low), `!!` (medium), `!!!` (high), `!!!!` (critical)

### Slash Commands
Type `/` in the editor to access quick formatting:
- `/todo` - Insert a todo item
- `/bullet` - Insert a bullet point
- `/h1`, `/h2` - Insert headings
- `/turn` - Convert all bullets to todos

### Rich Interactions
- **Double-click canvas** to create new notes
- **Single click note** to select and edit
- **Cmd/Ctrl+Click** for multi-select
- **Drag notes** with collision detection and smart spacing
- **Drag day headers** to move entire date groups
- **Click "Arrange" on day headers** to compact notes in a group

### Task Views
Two ways to view and manage your todos:

**Panel Mode** - Side panel listing all tasks
- Filter by tags or date range (today, yesterday, this week)
- Toggle completed visibility
- Click any task to jump to its source note

**Overlay Mode** - Tasks as draggable cards on the canvas
- Each todo becomes its own mini-card
- Bidirectional sync with source notes
- Drag to reposition, arrange to compact

### Data Management
- **Auto-save** to localStorage
- **Undo/Redo** with 50-action history
- **Export** all notes as JSON
- **Import** with replace or merge options

## Tech Stack

- **React 19** + **TypeScript**
- **Vite 7** for development and builds
- **Tailwind CSS 4** for styling
- **Tiptap** for rich text editing
- **Lucide React** for icons

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd thought-canvas

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Available Scripts

```bash
pnpm dev      # Start development server
pnpm build    # Build for production
pnpm preview  # Preview production build
pnpm lint     # Run ESLint
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
2. The note opens in edit mode - start typing
3. Use `/` to open the slash command menu for quick formatting
4. Add `#tags` inline for categorization
5. Use `!`, `!!`, `!!!`, or `!!!!` to set priority levels

### Organizing Notes
- Drag notes to reposition them
- Notes automatically group by creation date
- Click the day group header to select all notes in that group
- Drag the header to move the entire group
- Click "Arrange" to compact notes within a group

### Managing Todos
- Click the Tasks button in the bottom toolbar
- Choose between Panel (sidebar) or Overlay (canvas cards) view
- Filter by tag, date range, or completion status
- Click any todo to jump to its source note

### Keyboard Shortcuts

**In Editor:**
- **Cmd+Enter** - Toggle todo on current line
- **Cmd+Shift+C** - Toggle task list (checkbox)
- **Cmd+Shift+B** - Toggle bullet list
- **Cmd+Shift+1/2** - Toggle heading level 1/2
- **Cmd+Shift+0** - Convert to plain paragraph
- **Tab** - Indent nested task
- **Shift+Tab** - Outdent nested task
- **Backspace** (empty line) - Exit list or delete note

**On Canvas:**
- **Cmd+Z** - Undo
- **Cmd+Shift+Z** - Redo
- **Delete/Backspace** (card selected, not editing) - Delete selected cards
- **?** - Toggle help overlay
- **Alt+Drag** - Pan canvas

## Design Philosophy

**Spatial-Temporal Hybrid**: Combines the freedom of spatial organization with automatic date-based grouping. Your thoughts exist in both space and time.

**Rich Text First**: Tiptap-powered editing provides a modern, intuitive writing experience with slash commands and inline formatting.

**Local-First**: All data persists in localStorage. No backend, no accounts, no data leaving your device.

**Grid-Based Order**: 16px grid snapping and collision detection ensure your canvas stays organized without manual effort.

## License

MIT
