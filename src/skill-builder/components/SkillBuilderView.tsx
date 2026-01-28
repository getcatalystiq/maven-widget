import React, { useEffect, useState } from 'react';
import { useSkillBuilder } from '../context/SkillBuilderContext';
import { SkillsList } from './SkillsList';
import { SkillEditor } from './SkillEditor';

interface SkillBuilderViewProps {
  onClose?: () => void;
  onBack?: () => void;
}

export function SkillBuilderView({ onClose, onBack }: SkillBuilderViewProps) {
  const { state, saveSkill, deselectSkill, updateDraftContent, hasUnsavedChanges } = useSkillBuilder();
  const [showSkillsList, setShowSkillsList] = useState(state.selected.status === 'none');

  // Show skills list when no skill is selected
  useEffect(() => {
    if (state.selected.status === 'none') {
      setShowSkillsList(true);
    }
  }, [state.selected.status]);

  // Default onClose handler if not provided
  const handleClose = onClose || (() => {});

  // Handle back navigation
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      deselectSkill();
      setShowSkillsList(true);
    }
  };

  // If showing skills list, render that
  if (showSkillsList || state.selected.status === 'none') {
    return (
      <div className="maven-skill-builder">
        <SkillsList
          onSkillSelect={() => setShowSkillsList(false)}
          onClose={handleClose}
        />
      </div>
    );
  }

  // Get skill data for display
  const skillName = state.selected.status === 'loaded' ? state.selected.skill.name : '';
  const content = state.selected.status === 'loaded' ? state.selected.draftContent : '';
  const isLoading = state.selected.status === 'loading';
  const isSaving = state.save.status === 'saving';
  const saveError = state.save.status === 'error' ? state.save.error : null;

  return (
    <div className="maven-skill-builder">
      <SkillBuilderHeader
        onClose={handleClose}
        showBackButton={true}
        onBack={handleBack}
        skillName={skillName}
        hasUnsavedChanges={hasUnsavedChanges}
        isSaving={isSaving}
        onSave={saveSkill}
      />

      <div className="maven-skill-builder-content">
        {isLoading ? (
          <div className="maven-skill-builder-loading">
            <LoadingSpinner />
            <span>Loading skill...</span>
          </div>
        ) : state.selected.status === 'error' ? (
          <div className="maven-skill-builder-error-container">
            <div className="maven-skill-builder-error">
              Failed to load skill: {state.selected.error.message}
            </div>
            <button
              className="maven-admin-btn maven-admin-btn-secondary"
              onClick={handleBack}
            >
              Back to Skills
            </button>
          </div>
        ) : state.selected.status === 'loaded' ? (
          <div className="maven-skill-builder-editor-container">
            <SkillEditor
              value={content}
              onChange={updateDraftContent}
            />
          </div>
        ) : null}
      </div>

      {saveError && (
        <div className="maven-skill-builder-error">
          Save failed: {saveError.message}
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
  hasUnsavedChanges?: boolean;
  isSaving?: boolean;
  onSave?: () => void;
}

function SkillBuilderHeader({
  onClose,
  showBackButton,
  onBack,
  skillName,
  hasUnsavedChanges,
  isSaving,
  onSave,
}: SkillBuilderHeaderProps) {
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
        {hasUnsavedChanges && (
          <span className="maven-skill-builder-unsaved-indicator">
            (unsaved)
          </span>
        )}
      </div>

      <div className="maven-skill-builder-header-right">
        {onSave && (
          <button
            className="maven-admin-btn maven-admin-btn-primary"
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

// Loading spinner
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
