# Thought Canvas

A fluid, spatial note-taking application that transforms how you capture, organize, and explore your thoughts. Instead of confining ideas to rigid folders and lists, Thought Canvas provides an infinite canvas where notes flow freely in space, organized by date, and connected through intelligent tagging and prioritization systems.

## Core Concept

Thought Canvas reimagines the note-taking experience by combining:
- **Spatial freedom**: Place notes anywhere on an infinite canvas
- **Temporal organization**: Automatic grouping by date for natural context
- **Rich formatting**: Support for todos, bullets, headings, and inline formatting
- **Intelligent filtering**: Find what matters with tags and priority levels
- **Block editing**: Real-time multi-block editing with slash commands

---

## Features

### 1. Infinite Canvas Workspace

The foundation of Thought Canvas is a boundless digital canvas where your thoughts come to life without constraints.

- **Spatial Positioning**: Place sticky notes anywhere on a pan-able canvas
- **Day-based Grouping**: Notes automatically organize into visual groups by date
- **Grid Snapping**: Precise 16px grid alignment for organized layouts
- **Dark/Light Themes**: Toggle between dark and light modes for comfortable viewing

### 2. Block Types & Content Structure

Each sticky note can contain multiple blocks of different types, enabling rich, mixed-content expression.

**Supported Block Types:**
| Type | Format | Description |
|------|--------|-------------|
| Text | Plain text | Regular paragraph text for free-form thoughts |
| Todo | `- [ ]` / `- [x]` | Checkable task items for action tracking |
| Bullet | `- ` | Unordered list items for structured notes |
| Heading | `# ` | Section headers for organizing content |

**Inline Formatting:**
| Element | Syntax | Description |
|---------|--------|-------------|
| Tags | `#tagname` | Categorize and filter content |
| Priority | `!` to `!!!!` | Mark importance (1-4 levels) |

### 3. Note Interactions

#### Creating & Editing
- **Double-click canvas**: Create a new sticky note at cursor location
- **Double-click note**: Enter edit mode on existing note
- **Click**: Select or toggle selection
- **Cmd/Ctrl+Click**: Multi-select multiple notes
- **Escape**: Exit editing mode

#### Block-Level Editing
- **Enter**: Create new block below current
- **Backspace at line start**: Merge with previous block
- **Arrow keys**: Navigate between blocks
- **Cmd+Enter**: Toggle between text and todo
- **Shift+Enter**: Line break within block

### 4. Slash Command System

Type `/` in any block to access the command menu for quick formatting.

| Command | Aliases | Action |
|---------|---------|--------|
| `/todo` | `/t` | Convert block to todo type |
| `/bullet` | `/b` | Convert block to bullet type |
| `/turn` | `/convert` | Transform all text blocks to todos |

**Navigation:**
- Arrow up/down to navigate options
- Enter, Tab, or Space to select
- Escape to dismiss menu

### 5. Canvas Navigation

Move around your infinite workspace with multiple intuitive methods.

| Method | Action |
|--------|--------|
| Left-click + Drag on empty space | Pan canvas |
| Middle mouse + Drag | Universal pan |
| Scroll wheel | Pan up/down and left/right |
| Recenter button (bottom-right) | Reset view to origin |

### 6. Sticky Note Dragging & Grouping

Move notes spatially with sophisticated multi-select dragging.

**Drag Operations:**
- **Single note**: Click and drag any note to move it
- **Multi-note**: When multiple notes selected, dragging one drags all
- **Day group header**: Drag the date label to move all notes in that group
- **Collision detection**: Smart spacing prevents notes from overlapping
- **Grid snapping**: All positions snap to 16px grid

**Day Groups:**
- Visual container showing all notes from a specific date
- Dashed border (accent color for today, muted for other dates)
- Date label at top for easy identification
- Draggable by header for repositioning entire group

### 7. Todo Pane & Filtering

A dedicated sidebar for comprehensive todo management.

**Features:**
- Aggregated list of all todos from all notes
- Completion tracking (completed/total count)
- Priority sorting (highest first, then newest)

**Filtering:**
| Filter | Description |
|--------|-------------|
| Tag dropdown | Filter todos by specific tag |
| Completed toggle | Hide/show completed todos |

**Todo Items:**
- Interactive checkbox to toggle completion
- Visual strikethrough when completed
- Click to jump to source sticky note

### 8. Visual Styling

Content is rendered with inline parsing for rich visual feedback.

**Priority Colors:**
| Level | Syntax | Color |
|-------|--------|-------|
| Low | `!` | Yellow (60% opacity) |
| Medium | `!!` | Yellow |
| High | `!!!` | Orange |
| Critical | `!!!!` | Red (bold) |

**Other Styling:**
- Tags rendered as styled badges with accent background
- Checked todos show strikethrough with muted color
- Headings use larger font (18px) with semibold weight

### 9. State Management

Your work is automatically saved and recovers gracefully.

- **Auto-save**: Real-time localStorage sync as you work
- **Recovery**: Automatic state restoration on page refresh
- **History**: Undo/redo with 50-action limit

### 10. Toolbar & Controls

Quick-access controls for common operations.

| Button | Action |
|--------|--------|
| New Note | Create sticky at canvas center |
| Todos | Toggle todo pane visibility |
| Undo/Redo | Navigate action history |
| Clear All | Remove all notes (with confirmation) |
| Theme | Switch between light and dark |

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Undo | `Cmd+Z` |
| Redo | `Cmd+Shift+Z` |
| Toggle Todo | `Cmd+Enter` |
| Exit Editing | `Escape` |
| New Block | `Enter` |
| Navigate Blocks | `Arrow Up/Down` |

---

## Workflows

### Quick Note Capture
1. Double-click canvas to create sticky
2. Type your thought
3. Use `/` for formatting shortcuts
4. Click elsewhere or press Escape to finish

### Organizing Daily Tasks
1. Create todo items using `/todo`
2. Add tags like `#work` or `#personal`
3. Mark priority with `!` markers
4. Open Todo Pane and filter by tag
5. Check off items as completed

### Spatial Organization
1. Create multiple stickies across canvas
2. Drag stickies to organize by concept
3. Group related stickies near each other
4. Use day groups as visual containers
5. Pan and explore your organized thoughts

---

## Technical Stack

- React 19 with TypeScript
- Vite for development and builds
- Tailwind CSS 4 for styling
- Lucide React for icons

---

## Use Cases

- **Brainstorming**: Spatial organization helps explore ideas from multiple angles
- **Daily Planning**: Temporal grouping keeps today's tasks at a glance
- **Project Notes**: Mix todos, bullets, and text for comprehensive documentation
- **Journaling**: Free-form spatial capture with tagging for reflection
- **Study Notes**: Organize topics spatially, link with tags for learning
- **Meeting Notes**: Capture action items as todos, organize by date
