import React from 'react';

interface TitleBarProps {
  mode: 'manager' | 'tasks';
  onModeChange: (mode: 'manager' | 'tasks') => void;
  onClose: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onSkillsClick?: () => void;
  onSchedulesClick?: () => void;
  onConnectorsClick?: () => void;
  showSkills?: boolean;
  showSchedules?: boolean;
  showConnectors?: boolean;
}

export function TitleBar({
  mode,
  onModeChange,
  onClose,
  isFullscreen,
  onToggleFullscreen,
  onSkillsClick,
  onSchedulesClick,
  onConnectorsClick,
  showSkills,
  showSchedules,
  showConnectors,
}: TitleBarProps) {
  return (
    <div className="maven-title-bar">
      {/* Window Controls (macOS style) - Left */}
      <div className="maven-title-bar-controls">
        <button
          className="maven-title-bar-btn maven-title-bar-close"
          onClick={onClose}
          title="Close"
        >
          <svg viewBox="0 0 12 12" fill="currentColor">
            <path d="M6 4.586L2.707 1.293 1.293 2.707 4.586 6 1.293 9.293l1.414 1.414L6 7.414l3.293 3.293 1.414-1.414L7.414 6l3.293-3.293-1.414-1.414L6 4.586z" />
          </svg>
        </button>
        <button
          className="maven-title-bar-btn maven-title-bar-expand"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <svg viewBox="0 0 12 12" fill="currentColor">
              <path d="M2 8h2v2H2V8zm6-6h2v2H8V2zM2 2h2v2H2V2zm6 6h2v2H8V8z" />
            </svg>
          ) : (
            <svg viewBox="0 0 12 12" fill="currentColor">
              <path d="M1 1h4v2H3v2H1V1zm6 0h4v4h-2V3H7V1zM1 7h2v2h2v2H1V7zm8 2V7h2v4H7V9h2z" />
            </svg>
          )}
        </button>
      </div>

      {/* Mode Switcher - Next to window controls */}
      <div className="maven-title-bar-mode">
        <button
          className={`maven-title-bar-mode-btn ${mode === 'manager' && !showSkills && !showSchedules && !showConnectors ? 'active' : ''}`}
          onClick={() => onModeChange('manager')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <span>Apps</span>
        </button>
        <button
          className={`maven-title-bar-mode-btn ${mode === 'tasks' && !showSkills && !showSchedules && !showConnectors ? 'active' : ''}`}
          onClick={() => onModeChange('tasks')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>Tasks</span>
        </button>
        <button
          className={`maven-title-bar-mode-btn ${showSkills ? 'active' : ''}`}
          onClick={onSkillsClick}
          title="Skills"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
          <span>Skills</span>
        </button>
        <button
          className={`maven-title-bar-mode-btn ${showSchedules ? 'active' : ''}`}
          onClick={onSchedulesClick}
          title="Schedules"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>Schedules</span>
        </button>
        <button
          className={`maven-title-bar-mode-btn ${showConnectors ? 'active' : ''}`}
          onClick={onConnectorsClick}
          title="Connectors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22v-5" />
            <path d="M9 8V2" />
            <path d="M15 8V2" />
            <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
          </svg>
          <span>Connectors</span>
        </button>
      </div>

      {/* Spacer fills remaining space */}
      <div className="maven-title-bar-spacer" />
    </div>
  );
}
