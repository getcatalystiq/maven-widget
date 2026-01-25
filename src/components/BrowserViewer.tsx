import React, { useCallback, useState, useRef, useEffect } from 'react';
import type { BrowserSession } from '../types';

interface BrowserViewerProps {
  session: BrowserSession;
  currentFrame: string | null;  // base64-encoded image
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
  widgetRect?: DOMRect | null;  // Widget position for initial placement
}

interface Position {
  x: number;
  y: number;
}

export function BrowserViewer({
  session,
  currentFrame,
  isExpanded,
  onToggleExpand,
  onClose,
  widgetRect,
}: BrowserViewerProps) {
  const [position, setPosition] = useState<Position | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasUserMoved, setHasUserMoved] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  const hasFrame = !!currentFrame;

  // Calculate initial position (to the left of widget, vertically centered)
  // Only recalculate if user hasn't manually moved the viewer
  useEffect(() => {
    if (hasUserMoved) return; // User dragged it, don't reposition

    const viewerWidth = isExpanded ? 640 : 280;
    const viewerHeight = isExpanded ? 480 : 200;

    if (widgetRect) {
      // Position to the left of the widget with 16px gap
      const x = widgetRect.left - viewerWidth - 16;

      // Align to bottom of screen with 16px margin
      const y = window.innerHeight - viewerHeight - 16;

      // Ensure it stays within viewport
      const clampedX = Math.max(16, Math.min(x, window.innerWidth - viewerWidth - 16));
      const clampedY = Math.max(16, Math.min(y, window.innerHeight - viewerHeight - 16));

      setPosition({ x: clampedX, y: clampedY });
    } else {
      // Fallback: position in center-left area
      setPosition({
        x: 24,
        y: (window.innerHeight - viewerHeight) / 2,
      });
    }
  }, [widgetRect, isExpanded, hasUserMoved]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!position) return;

    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position]);

  // Handle drag move
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;

      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      const viewerWidth = isExpanded ? 640 : 280;
      const viewerHeight = isExpanded ? 480 : 200;

      // Calculate new position with bounds checking
      const newX = Math.max(0, Math.min(
        dragStartRef.current.posX + deltaX,
        window.innerWidth - viewerWidth
      ));
      const newY = Math.max(0, Math.min(
        dragStartRef.current.posY + deltaY,
        window.innerHeight - viewerHeight
      ));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setHasUserMoved(true); // Mark that user has manually positioned the viewer
      dragStartRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isExpanded]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Calculate style with position
  const style: React.CSSProperties = position ? {
    left: `${position.x}px`,
    top: `${position.y}px`,
    right: 'auto',
    bottom: 'auto',
  } : {};

  return (
    <div
      ref={viewerRef}
      className={`maven-browser-viewer ${isExpanded ? 'expanded' : 'collapsed'} ${isDragging ? 'dragging' : ''}`}
      style={style}
    >
      {/* Header - Drag Handle */}
      <div
        className="maven-browser-viewer-header"
        onMouseDown={handleDragStart}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div className="maven-browser-viewer-title">
          <span className={`maven-browser-viewer-status ${hasFrame ? 'connected' : 'disconnected'}`} />
          <span>Browser View</span>
          {hasFrame && <span className="maven-browser-viewer-live">LIVE</span>}
        </div>
        <div className="maven-browser-viewer-controls" onMouseDown={(e) => e.stopPropagation()}>
          <button
            onClick={onToggleExpand}
            className="maven-browser-viewer-btn"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            )}
          </button>
          <button
            onClick={handleClose}
            className="maven-browser-viewer-btn"
            aria-label="Close browser view"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="maven-browser-viewer-content">
        {currentFrame ? (
          <img
            src={`data:image/png;base64,${currentFrame}`}
            alt="Browser view"
            className="maven-browser-viewer-frame"
          />
        ) : (
          <div className="maven-browser-viewer-loading">
            <div className="maven-browser-viewer-spinner" />
            <span>Waiting for browser...</span>
          </div>
        )}
      </div>

      {/* Footer with session info */}
      <div className="maven-browser-viewer-footer">
        <span>Session: {session.session_id?.slice(0, 8)}...</span>
        <span className="maven-browser-viewer-drag-hint">Drag header to move</span>
      </div>
    </div>
  );
}
