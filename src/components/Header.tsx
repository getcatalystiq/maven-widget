import React from 'react';

interface HeaderProps {
  title: string;
  subtitle: string;
  avatar?: string;
  isReloading?: boolean;
  onClose: () => void;
  onClear: () => void;
  onOpenSessions: () => void;
  onReload: () => void;
}

export function Header({
  title,
  subtitle,
  avatar,
  isReloading,
  onClose,
  onClear,
  onOpenSessions,
  onReload,
}: HeaderProps) {
  return (
    <div className="maven-header">
      <div className="maven-header-content">
        <div className="maven-avatar">
          {avatar ? (
            <img src={avatar} alt={title} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
          ) : (
            title.charAt(0).toUpperCase()
          )}
        </div>
        <div className="maven-header-text">
          <h3>{title}</h3>
        </div>
      </div>
      <div className="maven-header-actions">
        <button
          className={`maven-action-icon-button ${isReloading ? 'spinning' : ''}`}
          onClick={onReload}
          aria-label="Reload session"
          title="Reload session"
          disabled={isReloading}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
        <button
          className="maven-action-icon-button"
          onClick={onClear}
          aria-label="New session"
          title="New session"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button
          className="maven-action-icon-button"
          onClick={onOpenSessions}
          aria-label="Session history"
          title="Session history"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <path d="M8 10h8M8 14h4" />
          </svg>
        </button>
        <button
          className="maven-close-button"
          onClick={onClose}
          aria-label="Close chat"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
