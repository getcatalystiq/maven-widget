import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Skill, FileAttachment, FileAttachmentRef } from '../types';
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

interface NewSessionModalProps {
  isOpen: boolean;
  skills?: Skill[];
  onConfirm: (selectedSkill?: Skill, initialMessage?: string, attachments?: FileAttachmentRef[]) => void;
  onCancel: () => void;
  // File handling - passed from parent
  attachments?: FileAttachment[];
  onAddFiles?: (files: File[]) => void;
  onRemoveFile?: (id: string) => void;
}

export function NewSessionModal({
  isOpen,
  skills = [],
  onConfirm,
  onCancel,
  attachments = [],
  onAddFiles,
  onRemoveFile,
}: NewSessionModalProps) {
  const [message, setMessage] = useState('');
  const [showSkillMenu, setShowSkillMenu] = useState(false);
  const [filteredSkills, setFilteredSkills] = useState<Skill[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice input
  const {
    transcript,
    interimTranscript,
    isListening,
    isSupported: isVoiceSupported,
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

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    // Reset state when modal opens
    if (isOpen) {
      setMessage('');
      setShowSkillMenu(false);
      setFilteredSkills([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle @ mentions for skills
  useEffect(() => {
    const atIndex = message.lastIndexOf('@');
    if (atIndex !== -1) {
      const query = message.slice(atIndex + 1).toLowerCase();
      const matches = skills.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.slug.toLowerCase().includes(query)
      );
      setFilteredSkills(matches);
      setShowSkillMenu(matches.length > 0);
      setSelectedIndex(0);
    } else {
      setShowSkillMenu(false);
    }
  }, [message, skills]);

  // Auto-scroll input to show latest text while dictating
  useEffect(() => {
    if (isListening && inputRef.current) {
      inputRef.current.scrollLeft = inputRef.current.scrollWidth;
    }
  }, [isListening, message, interimTranscript]);

  if (!isOpen) return null;

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

  const isUploading = attachments.some((a) => a.uploadStatus === 'uploading');
  const canSend = !isUploading && (message.trim() || uploadedAttachments.length > 0);

  const handleSubmit = () => {
    if (!canSend) return;

    // Check if message starts with @ skill reference
    const atMatch = message.match(/^@(\S+)\s*(.*)/);
    if (atMatch) {
      const skillRef = atMatch[1].toLowerCase();
      const skill = skills.find(
        (s) => s.slug.toLowerCase() === skillRef || s.name.toLowerCase() === skillRef
      );
      if (skill) {
        onConfirm(skill, atMatch[2] || undefined, uploadedAttachments.length > 0 ? uploadedAttachments : undefined);
        setMessage('');
        return;
      }
    }

    onConfirm(undefined, message.trim() || undefined, uploadedAttachments.length > 0 ? uploadedAttachments : undefined);
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSkillMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredSkills.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectSkill(filteredSkills[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowSkillMenu(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const selectSkill = (skill: Skill) => {
    const atIndex = message.lastIndexOf('@');
    const newMessage = message.slice(0, atIndex) + `@${skill.slug} `;
    setMessage(newMessage);
    setShowSkillMenu(false);
    inputRef.current?.focus();
  };

  const handleCancel = () => {
    setMessage('');
    setShowSkillMenu(false);
    if (isListening) stopListening();
    onCancel();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && onAddFiles) {
      const fileArray = Array.from(e.target.files).slice(0, 5);
      onAddFiles(fileArray);
      e.target.value = '';
    }
  };

  // Display value for input (show interim transcript while listening)
  const displayValue = isListening && interimTranscript
    ? `${message} ${interimTranscript}`.trim()
    : message;

  return (
    <div className="maven-command-overlay" onClick={handleCancel}>
      <div className="maven-command-container" onClick={(e) => e.stopPropagation()}>
        {/* File previews above the input */}
        {attachments.length > 0 && onRemoveFile && (
          <div className="maven-command-attachments">
            <FilePreviewList attachments={attachments} onRemove={onRemoveFile} />
          </div>
        )}

        <div className="maven-command-palette">
          {/* Attachment button */}
          {onAddFiles && (
            <div className="maven-command-icon" title="Attach file">
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
          {onAddFiles && (
            <button
              className={`maven-command-icon ${!isCameraSupported ? 'unsupported' : ''}`}
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

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            className={`maven-command-input ${isListening ? 'listening' : ''}`}
            placeholder={isListening ? 'Listening...' : 'Ask anything...'}
            value={displayValue}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            readOnly={isListening}
          />

          {/* Voice input button */}
          <button
            className={`maven-command-icon ${isListening ? 'recording' : ''} ${!isVoiceSupported ? 'unsupported' : ''}`}
            onClick={() => isListening ? stopListening() : startListening()}
            disabled={!isVoiceSupported}
            title={!isVoiceSupported ? 'Voice not supported' : isListening ? 'Stop recording' : 'Voice input'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
            </svg>
          </button>

          {/* Keyboard shortcut */}
          <div className="maven-command-shortcut">
            <span>⌘</span>K
          </div>

          {/* Skill autocomplete menu */}
          {showSkillMenu && (
            <div className="maven-command-skill-menu">
              {filteredSkills.map((skill, index) => (
                <button
                  key={skill.id}
                  className={`maven-command-skill-item ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => selectSkill(skill)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className="maven-command-skill-emoji">{skill.emoji || '✨'}</span>
                  <span className="maven-command-skill-name">{skill.name}</span>
                  <span className="maven-command-skill-slug">@{skill.slug}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Camera Modal */}
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
      </div>
    </div>
  );
}
