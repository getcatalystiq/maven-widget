import React, { useEffect, useRef, useState, useMemo, memo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { Message, FileReference, WidgetData } from '../types';
import { LoadingIndicator } from './LoadingIndicator';
import { OAuthConnectButton } from './OAuthConnectButton';
import { MCPWidgetRenderer } from './MCPWidgetRenderer';

// Memoized markdown rendering with LRU-like cache
// Cache prevents re-parsing on every render (30-40% CPU savings during streaming)
const markdownCache = new Map<string, string>();
const MAX_CACHE_SIZE = 100;

// Simple check for markdown syntax - avoids full parsing for plain text
function containsMarkdown(content: string): boolean {
  // Quick regex check for common markdown patterns
  return /[*_`#\[\]!>-]|\n/.test(content);
}

// Escape HTML for plain text content (fast path)
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}

function renderMarkdownCached(content: string): string {
  // Check cache first
  const cached = markdownCache.get(content);
  if (cached !== undefined) {
    return cached;
  }

  let result: string;

  // Fast path: if no markdown syntax detected, just escape HTML
  // This saves ~90KB of marked parsing for simple messages
  if (!containsMarkdown(content)) {
    result = escapeHtml(content);
  } else {
    // Strip out markdown images pointing to local /tmp/ paths (from agent's container)
    const cleanedContent = content.replace(/!\[[^\]]*\]\(\/tmp\/[^)]+\)/g, '');
    const rawHtml = marked(cleanedContent, { breaks: true }) as string;
    result = DOMPurify.sanitize(rawHtml);
  }

  // Add to cache (with size limit to prevent memory leaks)
  if (markdownCache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entry (first key)
    const firstKey = markdownCache.keys().next().value;
    if (firstKey) markdownCache.delete(firstKey);
  }
  markdownCache.set(content, result);

  return result;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  progressStatus?: string;
  elapsedTime: number;
  avatar?: string;
  showScrollButton: boolean;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  onScrollToBottom: () => void;
  agentUrl?: string;  // Agent URL for OAuth (agent has workload token)
  getToken?: () => Promise<string | null>;
  apiUrl?: string;  // Admin API URL for MCP widget resources
  tenantSlug?: string;  // Tenant slug for MCP widget resources
}

// Format file size for display
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// File download link component (for non-image files)
function FileDownloadLink({
  file,
}: {
  file: FileReference;
}) {
  const [error, setError] = useState<string | null>(null);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);

    if (file.downloadUrl) {
      // Open pre-signed S3 URL directly
      window.open(file.downloadUrl, '_blank');
    } else {
      setError('Download URL not available');
      console.error('[Maven Widget] No download URL for file:', file.filename);
    }
  };

  return (
    <button
      className={`maven-file-download ${error ? 'error' : ''}`}
      onClick={handleDownload}
      disabled={!file.downloadUrl}
      title={error || `Download ${file.filename}`}
    >
      <svg className="maven-download-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      <span className="maven-file-name">{file.filename}</span>
      <span className="maven-file-size">({formatFileSize(file.sizeBytes)})</span>
    </button>
  );
}

// Image display with download overlay (for image files)
function ImageDisplay({ file }: { file: FileReference }) {
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (file.downloadUrl) {
      const link = document.createElement('a');
      link.href = file.downloadUrl;
      link.download = file.filename;
      link.click();
    }
  };

  return (
    <div className="maven-image-display">
      <img
        src={file.downloadUrl}
        alt={file.filename}
        className="maven-image-content"
        loading="lazy"
      />
      <button
        className="maven-image-download-btn"
        onClick={handleDownload}
        title={`Download ${file.filename}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>
    </div>
  );
}

export function MessageList({
  messages,
  isLoading,
  progressStatus,
  elapsedTime,
  avatar,
  showScrollButton,
  onScroll,
  onScrollToBottom,
  agentUrl,
  getToken,
  apiUrl,
  tenantSlug,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (!showScrollButton) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, showScrollButton]);

  const handleCopy = async (message: Message) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleMessageClick = (messageId: string) => {
    // Only toggle active state if user is not selecting text
    // This prevents interfering with copy/paste on desktop
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return; // User is selecting text, don't toggle
    }
    // Toggle active state for mobile tap-to-show-copy-button
    setActiveMessageId(prev => prev === messageId ? null : messageId);
  };

  // Close active message when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveMessageId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="maven-messages-container" ref={containerRef} onScroll={onScroll}>
      <div className="maven-messages">
        {messages
          .filter((message) => {
            // Always show messages with skills
            if (message.skill) {
              return true;
            }
            // For non-skill messages, only show if they have content
            return message.content && message.content.trim() !== '';
          })
          .map((message) => (
          <div
            key={message.id}
            className={`maven-message ${message.role} ${activeMessageId === message.id ? 'active' : ''} ${message.skill ? 'skill-message' : ''}`}
            onClick={() => message.role === 'assistant' && handleMessageClick(message.id)}
          >
            {message.skill ? (
              <div className="maven-skill-message-wrapper">
                <div className="maven-skill-message-header">
                  <span className="maven-skill-message-emoji">{message.skill.emoji || '⚡'}</span>
                  <span className="maven-skill-message-name">{message.skill.name}</span>
                  {message.skill.parameters && Object.keys(message.skill.parameters).length > 0 && (
                    <span className="maven-skill-message-params-count">
                      {Object.keys(message.skill.parameters).length} param{Object.keys(message.skill.parameters).length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {(message.skill.parameters && Object.keys(message.skill.parameters).length > 0) || message.skill.description ? (
                  <div className="maven-skill-message-details">
                    {message.skill.parameters && Object.keys(message.skill.parameters).length > 0 && (
                      <div className="maven-skill-message-parameters">
                        {Object.entries(message.skill.parameters).map(([key, value]) => (
                          <div key={key} className="maven-skill-parameter">
                            <span className="maven-skill-parameter-key">{key}:</span>
                            <span className="maven-skill-parameter-value">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {message.skill.description && (
                      <div className="maven-skill-message-description">{message.skill.description}</div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : message.content && message.content.trim() ? (
              <div
                className="maven-message-content"
                dangerouslySetInnerHTML={{ __html: renderMarkdownCached(message.content) }}
              />
            ) : null}
            {/* OAuth Connect button when authorization is required */}
            {message.oauthRequired && agentUrl && (
              <OAuthConnectButton
                requirement={{ ...message.oauthRequired, oauth_required: true }}
                agentUrl={agentUrl}
                getToken={getToken}
              />
            )}
            {/* File attachments - images inline, others as download links */}
            {message.files && message.files.length > 0 && (
              <div className="maven-file-attachments">
                {message.files.map((file) => {
                  const isImage = file.mimeType?.startsWith('image/');
                  return isImage && file.downloadUrl ? (
                    <ImageDisplay key={file.fileRefId} file={file} />
                  ) : (
                    <FileDownloadLink key={file.fileRefId} file={file} />
                  );
                })}
              </div>
            )}
            {/* MCP Widgets - render at bottom of message */}
            {message.widgets && message.widgets.length > 0 && apiUrl && tenantSlug && (
              <div className="maven-mcp-widgets">
                {message.widgets.map((widget, index) => (
                  <MCPWidgetRenderer
                    key={`${widget.mcpName}-${widget.templateUri}-${index}`}
                    widget={widget}
                    apiUrl={apiUrl}
                    tenantSlug={tenantSlug}
                    getToken={getToken}
                  />
                ))}
              </div>
            )}
            {message.role === 'assistant' && (
              <button
                className={`maven-copy-button ${copiedId === message.id ? 'copied' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy(message);
                }}
                aria-label="Copy message"
                title="Copy message"
              >
                {copiedId === message.id ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="maven-message assistant">
            <div className="maven-message-content">
              <LoadingIndicator
                elapsedTime={elapsedTime}
                progressStatus={progressStatus}
                avatar={avatar}
              />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {showScrollButton && (
        <button
          className="maven-scroll-to-bottom"
          onClick={onScrollToBottom}
          aria-label="Scroll to bottom"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </button>
      )}
    </div>
  );
}
