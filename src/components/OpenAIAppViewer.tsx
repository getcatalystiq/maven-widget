import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import DOMPurify from 'dompurify';
import type { MCPToolResult } from '../types/mcp';
import type {
  OpenAIAppToParentMessage,
  ParentToOpenAIAppMessage,
  OpenAIWidgetAPI,
  ModalOptions,
  ModalResult,
} from '../types/postMessage';

// ============================================================================
// Types
// ============================================================================

export interface OpenAIAppConfig {
  id: string;
  name: string;
  slug: string;
  mcpServerUrl: string;
  description?: string;
  icon?: string;
  authType?: 'none' | 'oauth' | 'api_key';
}

export interface OpenAIAppViewerProps {
  app: OpenAIAppConfig;
  toolOutput?: unknown;
  toolInput?: unknown;
  toolResponseMetadata?: unknown;
  widgetState?: Record<string, unknown>;
  theme?: 'light' | 'dark';
  locale?: string;
  maxHeight?: number;
  safeArea?: { top: number; bottom: number; left: number; right: number };
  tenantSlug: string;
  apiUrl: string;
  getToken?: () => Promise<string>;
  onCallTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  onStateChange?: (state: Record<string, unknown>) => void;
  onFollowUp?: (prompt: string) => Promise<void>;
  onDisplayModeChange?: (mode: 'inline' | 'fullscreen' | 'pip') => void;
  onHeightChange?: (height: number) => void;
  onClose?: () => void;
  onError?: (error: { title: string; message: string }) => void;
}

// ============================================================================
// Iframe Template with window.openai API
// ============================================================================

const createIframeTemplate = (): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; min-height: 100vh; }
    * { box-sizing: border-box; }
    #root { min-height: 100vh; }
    .openai-app-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      color: #666;
    }
    .openai-app-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      color: #dc2626;
      padding: 20px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div id="root">
    <div class="openai-app-loading">Loading app...</div>
  </div>
  <script>
    // ========================================================================
    // window.openai API Implementation
    // Provides OpenAI Apps SDK compatibility layer
    // ========================================================================

    (function() {
      'use strict';

      // State
      let _parentOrigin = null;
      let _pendingRequests = new Map();
      let _nextId = 1;
      let _initialized = false;

      // Internal state (populated by init message)
      let _toolOutput = null;
      let _toolInput = null;
      let _toolResponseMetadata = null;
      let _widgetState = {};
      let _theme = 'light';
      let _locale = 'en-US';
      let _maxHeight = 600;
      let _safeArea = { top: 0, bottom: 0, left: 0, right: 0 };

      // Helper: Send message to parent with origin validation
      function sendToParent(message) {
        const targetOrigin = _parentOrigin || '*';
        window.parent.postMessage(message, targetOrigin);
      }

      // Helper: Create pending request promise
      function createRequest(type, payload) {
        return new Promise((resolve, reject) => {
          const id = _nextId++;
          const timeoutId = setTimeout(() => {
            _pendingRequests.delete(id);
            reject(new Error('Request timeout'));
          }, 30000);

          _pendingRequests.set(id, { resolve, reject, timeoutId });
          sendToParent({ type, id, ...payload });
        });
      }

      // Helper: Handle response from parent
      function handleResponse(data) {
        const pending = _pendingRequests.get(data.id);
        if (pending) {
          clearTimeout(pending.timeoutId);
          _pendingRequests.delete(data.id);

          if (data.success) {
            pending.resolve(data.result);
          } else {
            pending.reject(new Error(data.error || 'Request failed'));
          }
        }
      }

      // ======================================================================
      // window.openai API (16 APIs)
      // ======================================================================

      const openaiAPI = {
        // === State & Data APIs (read-only getters) ===
        get toolOutput() { return _toolOutput; },
        get toolInput() { return _toolInput; },
        get toolResponseMetadata() { return _toolResponseMetadata; },
        get widgetState() { return _widgetState; },

        // === Context/Environment APIs (read-only getters) ===
        get theme() { return _theme; },
        get locale() { return _locale; },
        get maxHeight() { return _maxHeight; },
        get safeArea() { return Object.freeze({ ..._safeArea }); },

        // === Widget Runtime APIs ===

        // Call an MCP tool
        callTool: function(name, args) {
          if (typeof name !== 'string') {
            return Promise.reject(new Error('Tool name must be a string'));
          }
          return createRequest('openai_app_call_tool', { name, args: args || {} });
        },

        // Persist widget state
        setWidgetState: function(state) {
          if (typeof state !== 'object' || state === null) {
            console.error('[openai] setWidgetState: state must be an object');
            return;
          }
          // Update local state immediately
          _widgetState = { ..._widgetState, ...state };
          // Notify parent (fire and forget for performance)
          const id = _nextId++;
          sendToParent({ type: 'openai_app_set_state', id, state });
        },

        // Upload a file (images only in MVP)
        uploadFile: function(file) {
          if (!(file instanceof File)) {
            return Promise.reject(new Error('Argument must be a File object'));
          }
          // Validate file type (images only in MVP)
          const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
          if (!allowedTypes.includes(file.type)) {
            return Promise.reject(new Error('Only image files are supported: ' + allowedTypes.join(', ')));
          }
          // Limit file size (10MB)
          if (file.size > 10 * 1024 * 1024) {
            return Promise.reject(new Error('File size must be less than 10MB'));
          }

          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = reader.result.split(',')[1];
              createRequest('openai_app_upload_file', {
                file: {
                  name: file.name,
                  type: file.type,
                  size: file.size,
                  data: base64,
                }
              }).then(resolve).catch(reject);
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
          });
        },

        // Get download URL for uploaded file
        getFileDownloadUrl: function(opts) {
          if (!opts || typeof opts.fileId !== 'string') {
            return Promise.reject(new Error('opts.fileId must be a string'));
          }
          return createRequest('openai_app_get_file_url', { fileId: opts.fileId });
        },

        // Send follow-up message to chat
        sendFollowUpMessage: function(opts) {
          if (!opts || typeof opts.prompt !== 'string') {
            return Promise.reject(new Error('opts.prompt must be a string'));
          }
          return createRequest('openai_app_follow_up', { prompt: opts.prompt });
        },

        // Request display mode change
        requestDisplayMode: function(mode) {
          const validModes = ['inline', 'fullscreen', 'pip'];
          if (!validModes.includes(mode)) {
            return Promise.reject(new Error('Invalid mode. Must be one of: ' + validModes.join(', ')));
          }
          return createRequest('openai_app_display_mode', { mode });
        },

        // Show modal dialog
        requestModal: function(opts) {
          if (typeof opts !== 'object' || opts === null) {
            return Promise.reject(new Error('opts must be an object'));
          }
          return createRequest('openai_app_modal', { options: opts });
        },

        // Notify parent of intrinsic height
        notifyIntrinsicHeight: function(height) {
          if (typeof height !== 'number' || height < 0) {
            console.error('[openai] notifyIntrinsicHeight: height must be a positive number');
            return;
          }
          sendToParent({ type: 'openai_app_height', height });
        },
      };

      // Freeze API to prevent tampering
      Object.freeze(openaiAPI);
      window.openai = openaiAPI;

      // ======================================================================
      // MavenBridge.mcp namespace (internal implementation)
      // This is the underlying API that window.openai delegates to
      // ======================================================================

      window.MavenBridge = window.MavenBridge || {};
      window.MavenBridge.mcp = {
        callTool: openaiAPI.callTool,
        setWidgetState: openaiAPI.setWidgetState,
        uploadFile: openaiAPI.uploadFile,
        getFileDownloadUrl: openaiAPI.getFileDownloadUrl,
        sendFollowUpMessage: openaiAPI.sendFollowUpMessage,
        requestDisplayMode: openaiAPI.requestDisplayMode,
        requestModal: openaiAPI.requestModal,
        notifyIntrinsicHeight: openaiAPI.notifyIntrinsicHeight,

        // Additional MavenBridge.mcp-specific APIs
        getConnectionStatus: function() {
          return _initialized ? 'connected' : 'disconnected';
        },
      };

      // ======================================================================
      // Message Handler
      // ======================================================================

      window.addEventListener('message', function(event) {
        const data = event.data;

        // Validate origin for all messages except init
        if (data?.type !== 'openai_app_init' && _parentOrigin) {
          if (event.origin !== _parentOrigin) {
            console.warn('[openai] Rejected message from unauthorized origin:', event.origin);
            return;
          }
        }

        // Handle init message
        if (data?.type === 'openai_app_init') {
          _parentOrigin = event.origin;
          _toolOutput = data.toolOutput;
          _toolInput = data.toolInput;
          _toolResponseMetadata = data.toolResponseMetadata;
          _widgetState = data.widgetState || {};
          _theme = data.theme || 'light';
          _locale = data.locale || 'en-US';
          _maxHeight = data.maxHeight || 600;
          _safeArea = data.safeArea || { top: 0, bottom: 0, left: 0, right: 0 };
          _initialized = true;

          // Execute widget code if provided
          if (data.widgetHtml) {
            try {
              document.getElementById('root').innerHTML = data.widgetHtml;
              // Execute any scripts in the HTML
              const scripts = document.getElementById('root').querySelectorAll('script');
              scripts.forEach(function(script) {
                const newScript = document.createElement('script');
                if (script.src) {
                  newScript.src = script.src;
                } else {
                  newScript.textContent = script.textContent;
                }
                script.parentNode.replaceChild(newScript, script);
              });
            } catch (e) {
              showError('Widget Error', e.message, e.stack);
            }
          }
        }

        // Handle result message
        if (data?.type === 'openai_app_result') {
          handleResponse(data);
        }

        // Handle state ack
        if (data?.type === 'openai_app_state_ack') {
          handleResponse({ ...data, success: true });
        }

        // Handle theme change
        if (data?.type === 'openai_app_theme_change') {
          _theme = data.theme;
          // Dispatch custom event for widgets to listen to
          window.dispatchEvent(new CustomEvent('openai-theme-change', { detail: { theme: data.theme } }));
        }

        // Handle locale change
        if (data?.type === 'openai_app_locale_change') {
          _locale = data.locale;
          window.dispatchEvent(new CustomEvent('openai-locale-change', { detail: { locale: data.locale } }));
        }
      });

      // ======================================================================
      // Error Handler
      // ======================================================================

      function showError(title, message, stack) {
        document.getElementById('root').innerHTML =
          '<div class="openai-app-error">' +
          '<h2>' + escapeHtml(title) + '</h2>' +
          '<p>' + escapeHtml(message) + '</p>' +
          (stack ? '<pre style="font-size:11px;overflow:auto;max-height:200px;background:#fee;padding:8px;border-radius:4px;text-align:left;">' + escapeHtml(stack) + '</pre>' : '') +
          '</div>';
        sendToParent({ type: 'openai_app_error', error: { title: title, message: message } });
      }

      function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
      }

      window.onerror = function(msg, url, line, col, error) {
        showError('Runtime Error', msg, error?.stack || 'Line ' + line);
        return true;
      };

      // Signal ready
      window.parent.postMessage({ type: 'openai_app_ready' }, '*');
    })();
  </script>
</body>
</html>
`;

// ============================================================================
// Component
// ============================================================================

export function OpenAIAppViewer({
  app,
  toolOutput,
  toolInput,
  toolResponseMetadata,
  widgetState = {},
  theme = 'light',
  locale = 'en-US',
  maxHeight = 600,
  safeArea = { top: 0, bottom: 0, left: 0, right: 0 },
  tenantSlug,
  apiUrl,
  getToken,
  onCallTool,
  onStateChange,
  onFollowUp,
  onDisplayModeChange,
  onHeightChange,
  onClose,
  onError,
}: OpenAIAppViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentHeight, setCurrentHeight] = useState(maxHeight);

  // Memoize the iframe template
  const iframeTemplate = useMemo(() => createIframeTemplate(), []);

  // Handle messages from iframe
  const handleMessage = useCallback(async (event: MessageEvent) => {
    // SECURITY: Validate message source is our iframe
    if (event.source !== iframeRef.current?.contentWindow) {
      return;
    }

    const data = event.data as OpenAIAppToParentMessage;
    if (!data?.type?.startsWith('openai_app_')) {
      return;
    }

    switch (data.type) {
      case 'openai_app_ready':
        // Iframe is ready, send init data
        try {
          // Fetch widget HTML from MCP server if needed
          // For now, just send the init data
          iframeRef.current?.contentWindow?.postMessage({
            type: 'openai_app_init',
            toolOutput,
            toolInput,
            toolResponseMetadata,
            widgetState,
            theme,
            locale,
            maxHeight,
            safeArea,
          } as ParentToOpenAIAppMessage, '*');

          setIsLoading(false);
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : 'Failed to initialize app';
          setError(errorMessage);
          setIsLoading(false);
        }
        break;

      case 'openai_app_error':
        setError(data.error.message);
        onError?.(data.error);
        break;

      case 'openai_app_call_tool':
        try {
          if (!onCallTool) {
            throw new Error('Tool calling not configured');
          }
          const result = await onCallTool(data.name, data.args as Record<string, unknown>);
          iframeRef.current?.contentWindow?.postMessage({
            type: 'openai_app_result',
            id: data.id,
            success: true,
            result,
          } as ParentToOpenAIAppMessage, '*');
        } catch (e) {
          iframeRef.current?.contentWindow?.postMessage({
            type: 'openai_app_result',
            id: data.id,
            success: false,
            error: e instanceof Error ? e.message : 'Tool call failed',
          } as ParentToOpenAIAppMessage, '*');
        }
        break;

      case 'openai_app_set_state':
        onStateChange?.(data.state as Record<string, unknown>);
        iframeRef.current?.contentWindow?.postMessage({
          type: 'openai_app_state_ack',
          id: data.id,
        } as ParentToOpenAIAppMessage, '*');
        break;

      case 'openai_app_upload_file':
        try {
          const token = getToken ? await getToken() : null;
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const response = await fetch(`${apiUrl}/widget/${tenantSlug}/files`, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({
              filename: data.file.name,
              mimeType: data.file.type,
              data: data.file.data,
            }),
          });

          if (!response.ok) {
            throw new Error('Upload failed');
          }

          const result = await response.json();
          iframeRef.current?.contentWindow?.postMessage({
            type: 'openai_app_result',
            id: data.id,
            success: true,
            result: { fileId: result.fileId },
          } as ParentToOpenAIAppMessage, '*');
        } catch (e) {
          iframeRef.current?.contentWindow?.postMessage({
            type: 'openai_app_result',
            id: data.id,
            success: false,
            error: e instanceof Error ? e.message : 'Upload failed',
          } as ParentToOpenAIAppMessage, '*');
        }
        break;

      case 'openai_app_get_file_url':
        try {
          const token = getToken ? await getToken() : null;
          const headers: Record<string, string> = {};
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const response = await fetch(
            `${apiUrl}/widget/${tenantSlug}/files/${data.fileId}/download`,
            { headers, credentials: 'include' }
          );

          if (!response.ok) {
            throw new Error('Failed to get download URL');
          }

          const result = await response.json();
          iframeRef.current?.contentWindow?.postMessage({
            type: 'openai_app_result',
            id: data.id,
            success: true,
            result: result.url,
          } as ParentToOpenAIAppMessage, '*');
        } catch (e) {
          iframeRef.current?.contentWindow?.postMessage({
            type: 'openai_app_result',
            id: data.id,
            success: false,
            error: e instanceof Error ? e.message : 'Failed to get URL',
          } as ParentToOpenAIAppMessage, '*');
        }
        break;

      case 'openai_app_follow_up':
        try {
          if (!onFollowUp) {
            throw new Error('Follow-up messaging not configured');
          }
          await onFollowUp(data.prompt);
          iframeRef.current?.contentWindow?.postMessage({
            type: 'openai_app_result',
            id: data.id,
            success: true,
          } as ParentToOpenAIAppMessage, '*');
        } catch (e) {
          iframeRef.current?.contentWindow?.postMessage({
            type: 'openai_app_result',
            id: data.id,
            success: false,
            error: e instanceof Error ? e.message : 'Follow-up failed',
          } as ParentToOpenAIAppMessage, '*');
        }
        break;

      case 'openai_app_display_mode':
        onDisplayModeChange?.(data.mode);
        iframeRef.current?.contentWindow?.postMessage({
          type: 'openai_app_result',
          id: data.id,
          success: true,
        } as ParentToOpenAIAppMessage, '*');
        break;

      case 'openai_app_modal':
        // For now, just acknowledge the modal request
        // Full modal implementation would require a portal
        iframeRef.current?.contentWindow?.postMessage({
          type: 'openai_app_result',
          id: data.id,
          success: true,
          result: { dismissed: true },
        } as ParentToOpenAIAppMessage, '*');
        break;

      case 'openai_app_height':
        setCurrentHeight(data.height);
        onHeightChange?.(data.height);
        break;
    }
  }, [
    toolOutput, toolInput, toolResponseMetadata, widgetState,
    theme, locale, maxHeight, safeArea,
    tenantSlug, apiUrl, getToken,
    onCallTool, onStateChange, onFollowUp, onDisplayModeChange, onHeightChange, onError,
  ]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Send theme changes to iframe
  useEffect(() => {
    if (!isLoading && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'openai_app_theme_change',
        theme,
      } as ParentToOpenAIAppMessage, '*');
    }
  }, [theme, isLoading]);

  // Send locale changes to iframe
  useEffect(() => {
    if (!isLoading && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'openai_app_locale_change',
        locale,
      } as ParentToOpenAIAppMessage, '*');
    }
  }, [locale, isLoading]);

  return (
    <div className="maven-openai-app-viewer">
      <div className="maven-openai-app-header">
        <div className="maven-openai-app-header-left">
          {onClose && (
            <button onClick={onClose} className="maven-openai-app-back" aria-label="Back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          {app.icon && <span className="maven-openai-app-icon">{app.icon}</span>}
          <span className="maven-openai-app-name">{app.name}</span>
        </div>
      </div>

      {isLoading && (
        <div className="maven-openai-app-loading">
          <div className="maven-openai-app-spinner" />
          <span>Loading {app.name}...</span>
        </div>
      )}

      {error && (
        <div className="maven-openai-app-error">
          <span>Failed to load app: {error}</span>
          <button onClick={() => window.location.reload()} className="maven-openai-app-retry">
            Retry
          </button>
        </div>
      )}

      <iframe
        ref={iframeRef}
        srcDoc={iframeTemplate}
        sandbox="allow-scripts allow-forms allow-popups allow-modals"
        className="maven-openai-app-iframe"
        title={app.name}
        style={{
          display: isLoading || error ? 'none' : 'block',
          height: `${currentHeight}px`,
        }}
      />
    </div>
  );
}
