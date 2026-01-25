# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev        # Watch mode with sourcemaps and live rebuild
npm run build      # Production build (minified, no sourcemaps)
npm run typecheck  # Type validation without emitting files
```

The build generates a single self-contained `dist/widget.js` bundle. CSS is embedded at build time via `__WIDGET_CSS__` define. Production builds output bundle size and top 10 largest modules.

## Architecture Overview

This is a React-based AI chat widget that renders as a Web Component (`<maven-widget>`). The widget uses Shadow DOM for style isolation.

### Entry Point & Web Component

`src/index.tsx` defines the `MavenWidget` custom element which:
- Attaches Shadow DOM and injects CSS at render time
- Parses configuration from HTML attributes
- Optionally fetches dynamic config from `{apiUrl}/api/widget/{tenantSlug}/config`
- Renders the React app via `createRoot()` into shadow DOM
- Handles theme (light/dark/auto) with system preference and host page class detection

### Communication Patterns

**Streaming HTTP** (`src/utils/sseClient.ts`): Uses `fetch()` POST with streaming response body (`response.body.getReader()`), parsing SSE-formatted data (`data: {...}`, `\n\n` separators). Event types include `session`, `chunk`, `progress`, `done`, `file_available`, `widget`, `oauth_required`, `browser_session`, `todos`, `session_title`.

**PostMessage API** (`src/types/postMessage.ts`): Bidirectional iframe communication for embedded apps using typed `OpenAIAppToParentMessage` / `ParentToOpenAIAppMessage` protocol.

**File Upload** (`src/utils/uploadService.ts`): S3 integration for file attachments with presigned URLs.

### State Management

- React useState with localStorage persistence for sessions
- Context providers in `src/contexts/`:
  - `MCPsContext` - MCP server management
  - `ConnectorsContext` - OAuth connector state (reducer pattern)
  - `CronJobsContext` - Scheduled job management

### Key Components

- `ChatWidget.tsx` - Main orchestrator (~1000 lines), manages chat state, SSE streaming, and panel layout
- `MessageList.tsx` - Renders messages with markdown (marked) and sanitization (DOMPurify)
- `InputArea.tsx` - User input with file upload, voice input, camera capture
- `skill-builder/` - In-widget skill editor with Monaco, has its own context (`SkillBuilderContext.tsx`)

### Configuration

Widget accepts HTML attributes that map to `MavenWidgetConfig` interface in `src/types.ts`:

```html
<maven-widget
  tenant-slug="..."
  api-url="..."
  agent-url="..."
  user-id="..."
  token="..."
  theme-mode="auto"
  theme='{"primaryColor": "#000"}'
/>
```

For dynamic token refresh, set `window.getClerkToken` function before widget loads.

### Theming

CSS custom properties (`--maven-*`) in `src/styles/widget.css`. Theme mode supports:
- `light` / `dark` - Fixed theme
- `auto` - Follows system preference and detects host page's `dark`/`light` class on `<html>` (next-themes compatible)
