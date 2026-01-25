import React from 'react';
import type { SessionSummary } from '../types';

interface SessionSidebarProps {
  sessions: SessionSummary[];
  currentSessionId: string | null;
  isLoading: boolean;
  isLoadingSession: string | null;
  collapsed: boolean;
  onCollapseToggle: () => void;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
  userRole?: string;
  onSkillsClick?: () => void;
  onCronJobsClick?: () => void;
  onConnectorsClick?: () => void;
}

/**
 * Format a timestamp as relative time (e.g., "2h ago", "Yesterday")
 */
function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function SessionSidebar({
  sessions,
  currentSessionId,
  isLoading,
  isLoadingSession,
  collapsed,
  onCollapseToggle,
  onSessionSelect,
  onNewSession,
  userRole,
  onSkillsClick,
  onCronJobsClick,
  onConnectorsClick,
}: SessionSidebarProps) {
  return (
    <div className={`maven-session-sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo Header */}
      <div className="maven-sidebar-header">
        <div className="maven-sidebar-controls">
          <button
            className="maven-sidebar-add"
            onClick={onNewSession}
            title="New conversation"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <div className="maven-sidebar-spacer" />
          <button
            className="maven-sidebar-toggle"
            onClick={onCollapseToggle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
              <line x1="8" y1="4" x2="8" y2="20" />
              {/* Arrow indicator */}
              {collapsed ? (
                <polyline points="13,9 17,12 13,15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <polyline points="17,9 13,12 17,15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Sessions List */}
      {!collapsed && (
        <div className="maven-sidebar-sessions">
          <div className="maven-sidebar-section-header">
            <span className="maven-sidebar-section-label">Recent</span>
            <button className="maven-sidebar-search-btn" title="Search">
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85a1.007 1.007 0 00-.115-.1zM12 6.5a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z"/>
              </svg>
            </button>
          </div>

          <div className="maven-sidebar-session-list">
            {isLoading && (
              <div className="maven-sidebar-loading">
                <div className="maven-sidebar-skeleton" />
                <div className="maven-sidebar-skeleton" />
                <div className="maven-sidebar-skeleton" />
              </div>
            )}

            {!isLoading && sessions.length === 0 && (
              <div className="maven-sidebar-empty">
                <p>No conversations yet</p>
              </div>
            )}

            {!isLoading && sessions.map((session) => (
              <button
                key={session.sessionId}
                onClick={() => onSessionSelect(session.sessionId)}
                className={`maven-sidebar-session-item ${
                  currentSessionId === session.sessionId ? 'active' : ''
                } ${isLoadingSession === session.sessionId ? 'loading' : ''}`}
                disabled={isLoadingSession !== null}
              >
                <div className="maven-sidebar-session-content">
                  <span className="maven-sidebar-session-preview">
                    {session.title || session.lastMessage || 'New conversation'}
                  </span>
                  <span className="maven-sidebar-session-time">
                    {formatTimeAgo(session.updatedAt)}
                  </span>
                </div>
                {isLoadingSession === session.sessionId && (
                  <span className="maven-sidebar-session-spinner" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
