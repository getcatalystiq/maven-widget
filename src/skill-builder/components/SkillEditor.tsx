/**
 * Skill Editor Component
 *
 * Lazy-loads CodeMirror for SKILL.md editing with preload on hover.
 */

import React, { lazy, Suspense } from 'react';

const CodeMirrorEditor = lazy(() => import('./CodeMirrorEditor'));

interface SkillEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

/**
 * Loading skeleton for the editor
 */
function EditorSkeleton() {
  return (
    <div className="maven-skill-editor-skeleton">
      <div className="maven-skill-editor-skeleton-gutter">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="maven-skill-editor-skeleton-line-number" />
        ))}
      </div>
      <div className="maven-skill-editor-skeleton-content">
        <div className="maven-skill-editor-skeleton-line" style={{ width: '60%' }} />
        <div className="maven-skill-editor-skeleton-line" style={{ width: '40%' }} />
        <div className="maven-skill-editor-skeleton-line" style={{ width: '80%' }} />
        <div className="maven-skill-editor-skeleton-line" style={{ width: '55%' }} />
        <div className="maven-skill-editor-skeleton-line" style={{ width: '70%' }} />
        <div className="maven-skill-editor-skeleton-line" style={{ width: '45%' }} />
        <div className="maven-skill-editor-skeleton-line" style={{ width: '65%' }} />
        <div className="maven-skill-editor-skeleton-line" style={{ width: '50%' }} />
      </div>
    </div>
  );
}

/**
 * Preload the CodeMirror editor module.
 * Call this on hover over elements that will open the editor.
 */
export function preloadEditor(): void {
  import('./CodeMirrorEditor');
}

/**
 * Skill editor with lazy-loaded CodeMirror
 */
export function SkillEditor({ value, onChange, readOnly }: SkillEditorProps) {
  return (
    <div className="maven-skill-editor">
      <Suspense fallback={<EditorSkeleton />}>
        <CodeMirrorEditor
          value={value}
          onChange={onChange}
          readOnly={readOnly}
        />
      </Suspense>
    </div>
  );
}
