import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useSkillBuilder } from '../context/SkillBuilderContext';

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py':
      return 'python';
    case 'js':
      return 'javascript';
    case 'ts':
      return 'typescript';
    case 'jsx':
      return 'javascript';
    case 'tsx':
      return 'typescript';
    case 'md':
      return 'markdown';
    case 'json':
      return 'json';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'sql':
      return 'sql';
    default:
      return 'plaintext';
  }
}

// Monaco editor HTML that runs in iframe (outside Shadow DOM)
const MONACO_IFRAME_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; overflow: hidden; background: #1e1e1e; }
    #editor { height: 100%; width: 100%; }
  </style>
</head>
<body>
  <div id="editor"></div>
  <script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js"></script>
  <script>
    let editor = null;
    let currentLanguage = 'plaintext';
    let ignoreNextChange = false;

    require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });

    require(['vs/editor/editor.main'], function () {
      editor = monaco.editor.create(document.getElementById('editor'), {
        value: '',
        language: 'plaintext',
        theme: 'vs-dark',
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, Consolas, monospace',
        wordWrap: 'on',
        lineNumbers: 'on',
        tabSize: 2,
        insertSpaces: true,
        bracketPairColorization: { enabled: true },
        formatOnPaste: true,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 12 },
        renderWhitespace: 'selection',
        occurrencesHighlight: 'off',
      });

      // Listen for content changes
      editor.onDidChangeModelContent(() => {
        if (ignoreNextChange) {
          ignoreNextChange = false;
          return;
        }
        window.parent.postMessage({
          type: 'monaco-content-changed',
          content: editor.getValue()
        }, '*');
      });

      // Add Cmd/Ctrl+S keybinding
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        window.parent.postMessage({ type: 'monaco-save' }, '*');
      });

      // Notify parent that editor is ready
      window.parent.postMessage({ type: 'monaco-ready' }, '*');
    });

    // Listen for messages from parent
    window.addEventListener('message', (event) => {
      if (!editor) return;

      const { type, content, language } = event.data;

      if (type === 'set-content') {
        ignoreNextChange = true;
        editor.setValue(content || '');
      } else if (type === 'set-language') {
        const model = editor.getModel();
        if (model && language !== currentLanguage) {
          monaco.editor.setModelLanguage(model, language);
          currentLanguage = language;
        }
      } else if (type === 'focus') {
        editor.focus();
      }
    });
  </script>
</body>
</html>
`;

export function SkillCodeEditor() {
  const { state, dispatch, saveFile } = useSkillBuilder();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const lastSentContent = useRef<string>('');
  const lastSentLanguage = useRef<string>('');
  // Track if the last content change came from Monaco (to avoid echoing it back)
  const contentFromMonaco = useRef<boolean>(false);

  // Create blob URL for iframe
  const iframeSrc = useRef<string>(
    URL.createObjectURL(new Blob([MONACO_IFRAME_HTML], { type: 'text/html' }))
  );

  // Clean up blob URL on unmount
  useEffect(() => {
    const url = iframeSrc.current;
    return () => URL.revokeObjectURL(url);
  }, []);

  // Handle messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, content } = event.data;

      if (type === 'monaco-ready') {
        setIsReady(true);
      } else if (type === 'monaco-content-changed' && state.selectedFile) {
        // Mark that this content change came from Monaco (to avoid echoing it back)
        contentFromMonaco.current = true;
        dispatch({
          type: 'SET_FILE_CONTENT',
          payload: { path: state.selectedFile, content },
        });
        dispatch({ type: 'MARK_UNSAVED', payload: state.selectedFile });
      } else if (type === 'monaco-save' && state.selectedFile) {
        saveFile(state.selectedFile);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [state.selectedFile, dispatch, saveFile]);

  // Send content to iframe when file changes
  const currentContent = state.selectedFile
    ? state.fileContents[state.selectedFile] ?? ''
    : '';

  const currentLanguage = state.selectedFile
    ? getLanguageFromPath(state.selectedFile)
    : 'plaintext';

  // Track the last reload version we processed
  const lastReloadVersion = useRef<number>(0);

  useEffect(() => {
    if (!isReady || !iframeRef.current?.contentWindow) return;

    // Check if we need to force-refresh due to a reload operation
    const forceRefresh = state.reloadVersion > lastReloadVersion.current;
    if (forceRefresh) {
      lastReloadVersion.current = state.reloadVersion;
    }

    // Only send content if it changed AND the change didn't come from Monaco itself
    // (to avoid echoing user keystrokes back and resetting cursor position)
    // OR if we need to force refresh after a reload
    if (currentContent !== lastSentContent.current || forceRefresh) {
      if (contentFromMonaco.current && !forceRefresh) {
        // Content came from Monaco typing - just update our tracking, don't echo back
        contentFromMonaco.current = false;
        lastSentContent.current = currentContent;
      } else {
        // Content came from file switch, reload, etc. - send to Monaco
        iframeRef.current.contentWindow.postMessage(
          { type: 'set-content', content: currentContent },
          '*'
        );
        lastSentContent.current = currentContent;
        contentFromMonaco.current = false;
      }
    }

    if (currentLanguage !== lastSentLanguage.current) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'set-language', language: currentLanguage },
        '*'
      );
      lastSentLanguage.current = currentLanguage;
    }
  }, [isReady, currentContent, currentLanguage, state.reloadVersion]);

  const handleCloseTab = useCallback((path: string, e?: React.MouseEvent) => {
    e?.stopPropagation();

    if (state.unsavedChanges.has(path)) {
      if (!confirm('Discard unsaved changes?')) {
        return;
      }
    }
    dispatch({ type: 'CLOSE_TAB', payload: path });
  }, [state.unsavedChanges, dispatch]);

  const handleSelectTab = useCallback((path: string) => {
    dispatch({ type: 'SELECT_FILE', payload: path });
  }, [dispatch]);

  if (state.openTabs.length === 0) {
    return (
      <div className="maven-code-editor">
        <div className="maven-code-editor-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10,9 9,9 8,9" />
          </svg>
          <p>Select a file to edit</p>
        </div>
      </div>
    );
  }

  return (
    <div className="maven-code-editor">
      {/* Tabs */}
      <div className="maven-code-editor-tabs">
        {state.openTabs.map((path) => {
          const fileName = path.split('/').pop() || path;
          const isActive = path === state.selectedFile;
          const isUnsaved = state.unsavedChanges.has(path);

          return (
            <div
              key={path}
              className={`maven-code-editor-tab ${isActive ? 'active' : ''}`}
              onClick={() => handleSelectTab(path)}
            >
              <span className="maven-code-editor-tab-name">
                {fileName}
                {isUnsaved && <span className="maven-code-editor-tab-unsaved">*</span>}
              </span>
              <button
                className="maven-code-editor-tab-close"
                onClick={(e) => handleCloseTab(path, e)}
                title="Close tab"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* Editor in iframe (outside Shadow DOM) */}
      <div className="maven-code-editor-content">
        <iframe
          ref={iframeRef}
          src={iframeSrc.current}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
          title="Code Editor"
        />
      </div>
    </div>
  );
}
