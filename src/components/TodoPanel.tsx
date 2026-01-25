import React, { useState, useEffect } from 'react';
import type { TodoItem } from '../types';

interface TodoPanelProps {
  todos: TodoItem[];
  isLoading: boolean;
}

export function TodoPanel({ todos, isLoading }: TodoPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-expand when todos change
  useEffect(() => {
    if (todos.length > 0) {
      setIsCollapsed(false);
    }
  }, [todos]);

  // Don't render if no todos
  if (todos.length === 0) {
    return null;
  }

  const completedCount = todos.filter((t) => t.status === 'completed').length;
  const inProgressItem = todos.find((t) => t.status === 'in_progress');
  const progress = todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0;

  return (
    <div className={`maven-todo-panel ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Header with collapse toggle */}
      <div className="maven-todo-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <div className="maven-todo-title">
          <svg
            className="maven-todo-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <span>Tasks</span>
          <span className="maven-todo-count">
            {completedCount}/{todos.length}
          </span>
        </div>
        <div className="maven-todo-controls">
          {/* Progress bar */}
          <div className="maven-todo-progress-bar">
            <div className="maven-todo-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          {/* Collapse chevron */}
          <svg
            className={`maven-todo-chevron ${isCollapsed ? 'collapsed' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>

      {/* Todo items list */}
      {!isCollapsed && (
        <div className="maven-todo-list">
          {todos.map((todo, index) => (
            <div key={index} className={`maven-todo-item ${todo.status}`}>
              {/* Status indicator */}
              <div className="maven-todo-status">
                {todo.status === 'completed' ? (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                ) : todo.status === 'in_progress' ? (
                  <div className="maven-todo-spinner" />
                ) : (
                  <div className="maven-todo-pending" />
                )}
              </div>
              {/* Task text - show activeForm for in_progress, content otherwise */}
              <span className="maven-todo-text">
                {todo.status === 'in_progress' ? todo.activeForm : todo.content}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Current action indicator when collapsed */}
      {inProgressItem && isCollapsed && (
        <div className="maven-todo-current">{inProgressItem.activeForm}...</div>
      )}
    </div>
  );
}
