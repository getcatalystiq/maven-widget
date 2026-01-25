import React from 'react';
import type { SessionSummary } from '../types';

interface SessionPanelProps {
  isOpen: boolean;
  sessions: SessionSummary[];
  currentSessionId: string | null;
  isLoading: boolean;
  isLoadingSession: string | null; // Session ID being loaded
  error: string | null;
  onClose: () => void;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
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

/**
 * Group sessions by date
 */
function groupSessionsByDate(sessions: SessionSummary[]): Map<string, SessionSummary[]> {
  const groups = new Map<string, SessionSummary[]>();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const lastWeek = new Date(today.getTime() - 7 * 86400000);

  for (const session of sessions) {
    const date = new Date(session.updatedAt);
    const sessionDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    let group: string;
    if (sessionDate.getTime() >= today.getTime()) {
      group = 'Today';
    } else if (sessionDate.getTime() >= yesterday.getTime()) {
      group = 'Yesterday';
    } else if (sessionDate.getTime() >= lastWeek.getTime()) {
      group = 'This Week';
    } else {
      group = 'Earlier';
    }

    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(session);
  }

  return groups;
}

export function SessionPanel({
  isOpen,
  sessions,
  currentSessionId,
  isLoading,
  isLoadingSession,
  error,
  onClose,
  onSessionSelect,
  onNewSession,
}: SessionPanelProps) {
  if (!isOpen) return null;

  const groupedSessions = groupSessionsByDate(sessions);

  return (
    <div className="maven-session-panel-overlay" onClick={onClose}>
      <div className="maven-session-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="maven-session-panel-header">
          <h4 className="maven-session-panel-title">Conversations</h4>
          <button
            className="maven-session-panel-close"
            onClick={onClose}
            aria-label="Close panel"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Session List */}
        <div className="maven-session-list">
          {isLoading && (
            <div className="maven-session-loading">
              <div className="maven-session-skeleton" />
              <div className="maven-session-skeleton" />
              <div className="maven-session-skeleton" />
            </div>
          )}

          {error && (
            <div className="maven-session-error">
              <p className="maven-session-error-message">{error}</p>
            </div>
          )}

          {!isLoading && !error && sessions.length === 0 && (
            <div className="maven-session-empty">
              <svg className="maven-session-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p className="maven-session-empty-title">No conversations yet</p>
              <p className="maven-session-empty-description">
                Start a new conversation to see it here
              </p>
            </div>
          )}

          {!isLoading && !error && sessions.length > 0 && (
            <>
              {Array.from(groupedSessions.entries()).map(([group, groupSessions]) => (
                <div key={group} className="maven-session-group">
                  <div className="maven-session-group-label">{group}</div>
                  {groupSessions.map((session) => (
                    <button
                      key={session.sessionId}
                      className={`maven-session-item ${
                        session.sessionId === currentSessionId ? 'active' : ''
                      } ${isLoadingSession === session.sessionId ? 'loading' : ''}`}
                      onClick={() => onSessionSelect(session.sessionId)}
                      disabled={isLoadingSession !== null}
                    >
                      <span className="maven-session-item-preview">
                        {session.lastMessage || 'New conversation'}
                      </span>
                      <span className="maven-session-item-meta">
                        <span className="maven-session-item-time">
                          {formatTimeAgo(session.updatedAt)}
                        </span>
                        <span className="maven-session-item-count">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                          {session.messageCount}
                        </span>
                      </span>
                      {isLoadingSession === session.sessionId && (
                        <span className="maven-session-item-spinner" />
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>

        {/* New Session Button */}
        <button className="maven-session-new-button" onClick={onNewSession}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Conversation
        </button>
      </div>
    </div>
  );
}
