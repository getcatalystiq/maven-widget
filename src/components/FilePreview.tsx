/**
 * FilePreview Component
 *
 * Displays a pending file attachment with:
 * - Image thumbnail or file type icon
 * - Filename and size
 * - Upload progress bar
 * - Error state
 * - Remove button
 */

import React from 'react';
import type { FileAttachment } from '../types';
import { formatFileSize, getFileIcon, isImageFile } from '../utils/uploadService';

interface FilePreviewProps {
  attachment: FileAttachment;
  onRemove: (id: string) => void;
}

export function FilePreview({ attachment, onRemove }: FilePreviewProps) {
  const isImage = isImageFile(attachment.mimeType);
  const hasError = attachment.uploadStatus === 'error';
  const isUploading = attachment.uploadStatus === 'uploading';
  const isUploaded = attachment.uploadStatus === 'uploaded';

  return (
    <div
      className={`maven-file-preview ${attachment.uploadStatus}`}
      title={attachment.filename}
    >
      {/* Thumbnail or icon */}
      <div className="maven-file-preview-thumb">
        {isImage && attachment.previewUrl ? (
          <img
            src={attachment.previewUrl}
            alt={attachment.filename}
            className="maven-file-preview-image"
          />
        ) : (
          <span className="maven-file-preview-icon">{getFileIcon(attachment.mimeType)}</span>
        )}

        {/* Upload status overlay */}
        {isUploading && (
          <div className="maven-file-preview-overlay">
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
          </div>
        )}

        {isUploaded && (
          <div className="maven-file-preview-overlay maven-file-preview-success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}

        {hasError && (
          <div className="maven-file-preview-overlay maven-file-preview-error-overlay">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
        )}
      </div>

      {/* File info */}
      <div className="maven-file-preview-info">
        <span className="maven-file-preview-name">
          {attachment.filename.length > 20
            ? `${attachment.filename.slice(0, 17)}...`
            : attachment.filename}
        </span>
        <span className="maven-file-preview-size">
          {formatFileSize(attachment.sizeBytes)}
        </span>
        {hasError && attachment.error && (
          <span className="maven-file-preview-error-text">{attachment.error}</span>
        )}
      </div>

      {/* Progress bar */}
      {isUploading && (
        <div className="maven-upload-progress">
          <div
            className="maven-upload-progress-bar"
            style={{ width: `${attachment.uploadProgress}%` }}
          />
        </div>
      )}

      {/* Remove button */}
      <button
        type="button"
        className="maven-file-preview-remove"
        onClick={() => onRemove(attachment.id)}
        aria-label={`Remove ${attachment.filename}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Container for multiple file previews
 */
interface FilePreviewListProps {
  attachments: FileAttachment[];
  onRemove: (id: string) => void;
}

export function FilePreviewList({ attachments, onRemove }: FilePreviewListProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="maven-attachments-container">
      {attachments.map((attachment) => (
        <FilePreview
          key={attachment.id}
          attachment={attachment}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
