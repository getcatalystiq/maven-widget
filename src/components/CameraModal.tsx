import React from 'react';

interface CameraModalProps {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  facingMode: 'user' | 'environment';
  onCapture: () => void;
  onClose: () => void;
  onFlip: () => void;
}

export function CameraModal({
  isOpen,
  isLoading,
  error,
  videoRef,
  canvasRef,
  facingMode,
  onCapture,
  onClose,
  onFlip,
}: CameraModalProps) {
  if (!isOpen && !isLoading && !error) {
    return null;
  }

  return (
    <div className="maven-camera-modal">
      <div className="maven-camera-container">
        {/* Header */}
        <div className="maven-camera-header">
          <button
            className="maven-camera-close"
            onClick={onClose}
            aria-label="Close camera"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <span className="maven-camera-title">Take Photo</span>
          <button
            className="maven-camera-flip"
            onClick={onFlip}
            aria-label="Flip camera"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 0 0-9-9m9 9v-3m0 3h-3M3 12a9 9 0 0 0 9 9m-9-9v3m0-3h3" />
            </svg>
          </button>
        </div>

        {/* Video Preview */}
        <div className="maven-camera-preview-wrapper">
          {isLoading && (
            <div className="maven-camera-loading">
              <svg className="maven-spinner" viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray="62.83"
                  strokeDashoffset="15"
                />
              </svg>
              <span>Starting camera...</span>
            </div>
          )}

          {error && (
            <div className="maven-camera-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
              <button onClick={onClose} className="maven-camera-error-close">
                Close
              </button>
            </div>
          )}

          <video
            ref={videoRef}
            className={`maven-camera-video ${facingMode === 'user' ? 'mirrored' : ''}`}
            autoPlay
            playsInline
            muted
          />

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        {/* Capture Button */}
        {!isLoading && !error && (
          <div className="maven-camera-controls">
            <button
              className="maven-camera-shutter"
              onClick={onCapture}
              aria-label="Take photo"
            >
              <span className="maven-camera-shutter-inner" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
