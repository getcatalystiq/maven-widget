/**
 * CodeMirror-based editor for SKILL.md files
 *
 * Uses CodeMirror 6 for smaller bundle size (~200KB vs ~2MB Monaco)
 * with YAML frontmatter and Markdown support.
 */

import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { yaml } from '@codemirror/lang-yaml';
import { EditorView } from '@codemirror/view';

interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  height?: string;
}

// Custom theme settings that work with Maven design system
const editorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--maven-bg, #ffffff)',
    color: 'var(--maven-text, #1a1a1a)',
  },
  '.cm-content': {
    caretColor: 'var(--maven-accent, #6366f1)',
    fontFamily: 'var(--maven-font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace)',
    fontSize: '14px',
    lineHeight: '1.6',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--maven-accent, #6366f1)',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(99, 102, 241, 0.2) !important',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--maven-bg-surface, #f5f5f5)',
    color: 'var(--maven-text-muted, #9ca3af)',
    border: 'none',
    borderRight: '1px solid var(--maven-border, #e5e5e5)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--maven-bg-hover, #f0f0f0)',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--maven-bg-hover, rgba(0, 0, 0, 0.03))',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--maven-bg-surface, #f5f5f5)',
    border: 'none',
    color: 'var(--maven-text-muted, #9ca3af)',
  },
  // Markdown syntax highlighting
  '.cm-header': {
    color: 'var(--maven-text, #1a1a1a)',
    fontWeight: '600',
  },
  '.cm-strong': {
    fontWeight: '600',
  },
  '.cm-emphasis': {
    fontStyle: 'italic',
  },
  '.cm-link': {
    color: 'var(--maven-primary, #3b82f6)',
    textDecoration: 'underline',
  },
  '.cm-url': {
    color: 'var(--maven-text-secondary, #666)',
  },
  '.cm-comment': {
    color: 'var(--maven-text-muted, #9ca3af)',
  },
  // YAML frontmatter
  '.cm-atom': {
    color: 'var(--maven-primary, #3b82f6)',
  },
  '.cm-string': {
    color: 'var(--maven-success, #22c55e)',
  },
  '.cm-meta': {
    color: 'var(--maven-warning, #f59e0b)',
  },
});

export default function CodeMirrorEditor({
  value,
  onChange,
  readOnly = false,
  height = '100%',
}: CodeMirrorEditorProps) {
  return (
    <CodeMirror
      value={value}
      height={height}
      extensions={[
        markdown(),
        yaml(),
        editorTheme,
        EditorView.lineWrapping,
      ]}
      onChange={onChange}
      readOnly={readOnly}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLineGutter: true,
        highlightActiveLine: true,
        foldGutter: true,
        dropCursor: true,
        allowMultipleSelections: true,
        indentOnInput: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: false,
        rectangularSelection: true,
        crosshairCursor: false,
        highlightSelectionMatches: true,
        searchKeymap: true,
        tabSize: 2,
      }}
      className="maven-codemirror-editor"
    />
  );
}
