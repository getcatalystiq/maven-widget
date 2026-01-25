import React, { useEffect, useState, lazy, Suspense } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useSkillBuilder } from '../context/SkillBuilderContext';
import { SkillFileBrowser } from './SkillFileBrowser';
import { SkillsList } from './SkillsList';

// Lazy load Monaco editor to reduce initial bundle size
const SkillCodeEditor = lazy(() => import('./SkillCodeEditor').then(m => ({ default: m.SkillCodeEditor })));
const SkillChatPanel = lazy(() => import('./SkillChatPanel').then(m => ({ default: m.SkillChatPanel })));

interface SkillBuilderViewProps {
  onClose?: () => void;
  onBack?: () => void;
  onExport?: (skillId: string, skillSlug: string) => void;
  showChat?: boolean;
}

export function SkillBuilderView({ onClose, onBack, onExport, showChat = true }: SkillBuilderViewProps) {
  const { state, loadFiles, saveAllFiles, publishSkill } = useSkillBuilder();
  const [showSkillsList, setShowSkillsList] = useState(!state.skillId);

  // Load files when skill is selected
  useEffect(() => {
    if (state.skillId) {
      loadFiles();
      setShowSkillsList(false);
    }
  }, [state.skillId, loadFiles]);

  // Default onClose handler if not provided
  const handleClose = onClose || (() => {});

  // If no skill selected, show skills list
  if (showSkillsList || !state.skillId) {
    return (
      <div className="maven-skill-builder">
        <SkillsList onSkillSelect={() => setShowSkillsList(false)} onClose={handleClose} />
      </div>
    );
  }

  return (
    <div className="maven-skill-builder">
      <SkillBuilderHeader
        onClose={handleClose}
        showBackButton={true}
        onBack={onBack || (() => setShowSkillsList(true))}
        skillName={state.skillName}
        skillId={state.skillId || undefined}
        skillSlug={state.skillSlug}
        draftStatus={state.draftStatus}
        hasUnsavedChanges={state.unsavedChanges.size > 0}
        isSaving={state.isSaving}
        isPublishing={state.isPublishing}
        onSave={saveAllFiles}
        onPublish={publishSkill}
        onExport={onExport}
      />

      <div className="maven-skill-builder-content">
        <PanelGroup direction="horizontal" className="maven-skill-builder-panels">
          {/* File Browser Panel */}
          <Panel defaultSize={showChat ? 20 : 25} minSize={15} maxSize={35}>
            <SkillFileBrowser />
          </Panel>

          <PanelResizeHandle className="maven-panel-resize-handle" />

          {/* Code Editor Panel */}
          <Panel defaultSize={showChat ? 50 : 75} minSize={30}>
            <Suspense fallback={<EditorLoading />}>
              <SkillCodeEditor />
            </Suspense>
          </Panel>

          {/* Chat Panel (optional) */}
          {showChat && (
            <>
              <PanelResizeHandle className="maven-panel-resize-handle" />
              <Panel defaultSize={30} minSize={20} maxSize={50}>
                <Suspense fallback={<ChatLoading />}>
                  <SkillChatPanel />
                </Suspense>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      {state.publishError && (
        <div className="maven-skill-builder-error">
          {state.publishError}
        </div>
      )}
    </div>
  );
}

// Header component
interface SkillBuilderHeaderProps {
  onClose: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
  skillName?: string;
  skillId?: string;
  skillSlug?: string;
  draftStatus?: 'draft' | 'published';
  hasUnsavedChanges?: boolean;
  isSaving?: boolean;
  isPublishing?: boolean;
  onSave?: () => void;
  onPublish?: () => void;
  onExport?: (skillId: string, skillSlug: string) => void;
}

function SkillBuilderHeader({
  onClose,
  showBackButton,
  onBack,
  skillName,
  skillId,
  skillSlug,
  draftStatus,
  hasUnsavedChanges,
  isSaving,
  isPublishing,
  onSave,
  onPublish,
  onExport,
}: SkillBuilderHeaderProps) {
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = async () => {
    if (!onExport || !skillId || !skillSlug) return;
    setIsExporting(true);
    try {
      await onExport(skillId, skillSlug);
    } finally {
      setIsExporting(false);
    }
  };
  return (
    <div className="maven-skill-builder-header">
      <div className="maven-skill-builder-header-left">
        {showBackButton && (
          <button
            className="maven-skill-builder-back"
            onClick={onBack}
            title="Back to skills"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h2 className="maven-skill-builder-title">
          {skillName || 'Skills'}
        </h2>
        {draftStatus && (
          <span className={`maven-skill-builder-status maven-skill-builder-status-${draftStatus}`}>
            {draftStatus}
          </span>
        )}
      </div>

      <div className="maven-skill-builder-header-right">
        {onExport && skillId && skillSlug && (
          <button
            className="maven-admin-btn maven-admin-btn-secondary"
            onClick={handleExport}
            disabled={isExporting}
            title="Export skill as ZIP"
          >
            {isExporting ? (
              <>
                <LoadingSpinner />
                Exporting...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px', marginRight: '4px' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Export
              </>
            )}
          </button>
        )}
        {onSave && (
          <button
            className="maven-admin-btn maven-admin-btn-secondary"
            onClick={onSave}
            disabled={!hasUnsavedChanges || isSaving}
          >
            {isSaving ? (
              <>
                <LoadingSpinner />
                Saving...
              </>
            ) : (
              <>Save{hasUnsavedChanges ? '*' : ''}</>
            )}
          </button>
        )}
        {onPublish && (
          <button
            className="maven-admin-btn maven-admin-btn-primary"
            onClick={onPublish}
            disabled={isSaving || isPublishing}
          >
            {isPublishing ? (
              <>
                <LoadingSpinner />
                Publishing...
              </>
            ) : (
              'Publish'
            )}
          </button>
        )}
        <button
          className="maven-skill-builder-close"
          onClick={onClose}
          title="Close skill builder"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Loading states
function LoadingSpinner() {
  return (
    <svg className="maven-skill-builder-spinner" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EditorLoading() {
  return (
    <div className="maven-skill-builder-loading">
      <LoadingSpinner />
      <span>Loading editor...</span>
    </div>
  );
}

function ChatLoading() {
  return (
    <div className="maven-skill-builder-loading">
      <LoadingSpinner />
      <span>Loading chat...</span>
    </div>
  );
}
