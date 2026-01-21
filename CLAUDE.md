# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

#IMPORTANT
NEVER GIT COMMIT or GIT PUSH WITHOUT EXPLICT APPROVAL FROM USER

## Commands

```bash
# Development
pnpm dev          # Start dev server (Vite)
pnpm build        # TypeScript check + Vite build
pnpm lint         # ESLint
pnpm preview      # Preview production build
```

## Architecture

Thought Canvas is a React 19 + TypeScript canvas-based sticky notes application with Tiptap rich text editing.

### Core Data Model

**Sticky** (`src/types/sticky.ts`): The primary entity representing a note card on the canvas.
- `content`: Tiptap HTML string (legacy markdown also supported for backwards compat)
- `x`, `y`: Grid-snapped position (20px grid)
- `date`: ISO date string for grouping (YYYY-MM-DD)
- `isTask`, `sourceId`, `sourceLineIndex`: Task stickies reference todo items in source stickies

**Block** (`src/types/block.ts`): Alternative content model (text, todo, bullet, heading) - not fully adopted yet.

### State Management

**StickiesContext** (`src/context/StickiesContext.tsx`): Central state provider (~1300 lines).
- All sticky CRUD operations, drag/drop, pan/zoom
- Undo/redo history (50 states max)
- Task sticky sync: Parses todos from regular stickies and creates virtual task stickies for overlay mode
- localStorage persistence: `thought-canvas-stickies`, `thought-canvas-tasks-group`, `thought-canvas-task-positions`

**ThemeContext** (`src/context/ThemeContext.tsx`): Dark/light theme management.

### Component Hierarchy

```
App
└── ThemeProvider → StickiesProvider → CanvasLayout
    ├── Canvas (infinite pan/zoom, renders stickies and day groups)
    │   ├── DayGroup (visual grouping by date with drag-all/arrange)
    │   └── Sticky (individual card with TiptapEditor)
    ├── TodoPane (panel mode: side panel listing tasks)
    └── Toolbar (top bar controls)
```

### Key Patterns

**Grid System**: All positions snap to 16px grid (`GRID_SIZE`). Stickies use 256px width (`STICKY_WIDTH`), 16px gap (`STICKY_GAP`).

**Collision Detection**:
- `findNonOverlappingPosition()`: Places new stickies avoiding overlaps
- `resolveCollisions()` in `src/utils/grid.ts`: Handles drag-drop collision resolution
- Uses half-gap expansion for symmetric spacing (10px each side = 20px total)

**Todo Parsing** (`src/utils/parseContent.ts`): Extracts tasks from Tiptap HTML, supports priority markers (!!, !!!, ^), tags (#tag).

**Task Views**: Two modes for viewing todos:
- Panel mode: TodoPane sidebar lists all tasks
- Overlay mode: Virtual task stickies rendered on canvas (synced bidirectionally with source)

### Path Aliases

`@/*` → `src/*` (configured in tsconfig.app.json and vite.config.ts)
