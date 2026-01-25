import React, { useState, useRef, KeyboardEvent, DragEvent, useCallback, useEffect } from 'react';
import type { PageContext, FileAttachment, FileAttachmentRef } from '../types';
import { FilePreviewList } from './FilePreview';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useCameraCapture } from '../hooks/useCameraCapture';
import { CameraModal } from './CameraModal';

// Accept filter for file input
const ACCEPT_FILE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/csv',
  'text/plain',
  '.xls',
  '.xlsx',
].join(',');

interface InputAreaProps {
  onSend: (message: string, attachments?: FileAttachmentRef[]) => void;
  disabled: boolean;
  placeholder: string;
  context: PageContext | null;
  lastUserMessage: string | null;
  // File upload props
  attachments?: FileAttachment[];
  onAddFiles?: (files: File[]) => void;
  onRemoveFile?: (id: string) => void;
  // Voice input (requires host site to allow microphone)
  enableVoiceInput?: boolean;
  // Camera input (requires host site to allow camera)
  enableCameraInput?: boolean;
}

export function InputArea({
  onSend,
  disabled,
  placeholder,
  context,
  lastUserMessage,
  attachments = [],
  onAddFiles,
  onRemoveFile,
  enableVoiceInput = true,
  enableCameraInput = true,
}: InputAreaProps) {
  const [message, setMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice input
  const {
    transcript,
    interimTranscript,
    isListening,
    isSupported: isVoiceSupported,
    error: voiceError,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  // Camera input
  const {
    isSupported: isCameraSupported,
    isOpen: isCameraOpen,
    isLoading: isCameraLoading,
    error: cameraError,
    videoRef,
    canvasRef,
    facingMode,
    openCamera,
    capturePhoto,
    closeCamera,
    flipCamera,
  } = useCameraCapture();

  // Handle camera capture
  const handleCameraCapture = useCallback(() => {
    const file = capturePhoto();
    if (file && onAddFiles) {
      onAddFiles([file]);
      closeCamera();
    }
  }, [capturePhoto, onAddFiles, closeCamera]);

  // Update message when voice transcript changes
  useEffect(() => {
    if (transcript) {
      setMessage((prev) => prev ? `${prev} ${transcript}` : transcript);
      resetTranscript();
    }
  }, [transcript, resetTranscript]);

  // Auto-scroll input to show latest text while dictating
  useEffect(() => {
    if (isListening && inputRef.current) {
      // Scroll the input field to the end to show the latest dictated text
      inputRef.current.scrollLeft = inputRef.current.scrollWidth;
    }
  }, [isListening, message, interimTranscript]);

  // Get uploaded attachments ready to send
  const uploadedAttachments = attachments
    .filter((a) => a.uploadStatus === 'uploaded' && a.s3Key)
    .map((a) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      s3Key: a.s3Key!,
    }));

  // Check if any attachments are still uploading
  const isUploading = attachments.some((a) => a.uploadStatus === 'uploading');

  // Can send if we have a message OR uploaded attachments (and not uploading)
  const canSend = !disabled && !isUploading && (message.trim() || uploadedAttachments.length > 0);

  const handleSend = () => {
    if (!canSend) return;

    const trimmed = message.trim();
    // Send with attachments (even if message is empty but has attachments)
    if (trimmed || uploadedAttachments.length > 0) {
      onSend(trimmed || '(attached files)', uploadedAttachments.length > 0 ? uploadedAttachments : undefined);
      setMessage('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'ArrowUp' && !message && lastUserMessage) {
      // Load last user message when arrow up is pressed with empty input
      e.preventDefault();
      setMessage(lastUserMessage);
    }
  };

  // File handling
  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      if (!onAddFiles) return;

      const fileArray = Array.from(files).slice(0, 5); // Max 5 files
      if (fileArray.length > 0) {
        onAddFiles(fileArray);
      }
    },
    [onAddFiles]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
      e.target.value = ''; // Reset input
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAddFiles) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (onAddFiles && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Display value for input (show interim transcript while listening)
  const displayValue = isListening && interimTranscript
    ? `${message} ${interimTranscript}`.trim()
    : message;

  return (
    <div
      className={`maven-input-area ${isDragOver ? 'maven-drag-over' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="maven-drag-overlay">
          <div className="maven-drag-overlay-content">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Drop files here</span>
          </div>
        </div>
      )}

      {context && (
        <div className="maven-context-indicator">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>Using page context</span>
        </div>
      )}

      {/* File previews */}
      {attachments.length > 0 && onRemoveFile && (
        <FilePreviewList attachments={attachments} onRemove={onRemoveFile} />
      )}

      {/* Command palette style input bar */}
      <div className={`maven-input-bar ${disabled ? 'disabled' : ''}`}>
        {/* Attachment button */}
        {onAddFiles && (
          <div className="maven-input-icon" title="Attach file">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPT_FILE_TYPES}
              onChange={handleFileInputChange}
              className="maven-file-input-overlay"
              aria-label="Attach file"
            />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
          </div>
        )}

        {/* Camera button */}
        {enableCameraInput && onAddFiles && (
          <button
            className={`maven-input-icon ${!isCameraSupported ? 'unsupported' : ''}`}
            onClick={openCamera}
            disabled={!isCameraSupported}
            title={!isCameraSupported ? 'Camera not supported' : 'Take photo'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </button>
        )}

        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          className={`maven-input-field ${isListening ? 'listening' : ''}`}
          placeholder={
            isListening
              ? 'Listening...'
              : attachments.length > 0
                ? 'Add a message or press Enter to send...'
                : placeholder
          }
          value={displayValue}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          readOnly={isListening}
        />

        {/* Voice input button */}
        {enableVoiceInput && (
          <button
            className={`maven-input-icon ${isListening ? 'recording' : ''} ${!isVoiceSupported ? 'unsupported' : ''}`}
            onClick={() => isListening ? stopListening() : startListening()}
            disabled={!isVoiceSupported}
            title={!isVoiceSupported ? 'Voice not supported' : isListening ? 'Stop recording' : 'Voice input'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
            </svg>
          </button>
        )}

        {/* Send button */}
        <button
          className="maven-input-send"
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
        >
          {isUploading ? (
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
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </div>

      {/* Voice error tooltip */}
      {voiceError && (
        <div className="maven-voice-error">{voiceError}</div>
      )}

      {/* Camera Modal */}
      {enableCameraInput && (
        <CameraModal
          isOpen={isCameraOpen}
          isLoading={isCameraLoading}
          error={cameraError}
          videoRef={videoRef}
          canvasRef={canvasRef}
          facingMode={facingMode}
          onCapture={handleCameraCapture}
          onClose={closeCamera}
          onFlip={flipCamera}
        />
      )}
    </div>
  );
}
