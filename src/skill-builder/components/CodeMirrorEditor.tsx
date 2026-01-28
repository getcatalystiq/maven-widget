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

// Custom theme settings for dark mode
const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--maven-bg-secondary, #1a1a2e)',
    color: 'var(--maven-text-primary, #e0e0e0)',
  },
  '.cm-content': {
    caretColor: 'var(--maven-accent, #6366f1)',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    fontSize: '14px',
    lineHeight: '1.6',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--maven-accent, #6366f1)',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--maven-accent-light, rgba(99, 102, 241, 0.3)) !important',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--maven-bg-tertiary, #12121f)',
    color: 'var(--maven-text-muted, #6b7280)',
    border: 'none',
    borderRight: '1px solid var(--maven-border, #2a2a4a)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--maven-bg-hover, #252540)',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--maven-bg-hover, rgba(37, 37, 64, 0.5))',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--maven-bg-tertiary, #12121f)',
    border: 'none',
    color: 'var(--maven-text-muted, #6b7280)',
  },
}, { dark: true });

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
        darkTheme,
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
