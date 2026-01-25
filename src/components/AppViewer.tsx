import React, { useRef, useEffect, useState, useCallback } from 'react';
import DOMPurify from 'dompurify';
import type { App, AppManifest } from '../types';

interface AppViewerProps {
  app: App;
  tenantId: string;
  tenantSlug: string;
  apiUrl: string;
  agentUrl?: string;  // Agent URL for skill execution
  userId?: string;    // User ID for MCP tool authentication
  getToken?: () => Promise<string>;
  onClose?: () => void;
  onNavigateToConnectors?: () => void;  // Navigate to Connectors panel when OAuth needed
}

// Iframe HTML template with React + Tailwind + Shadcn + Recharts
const IFRAME_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/react-is@18/umd/react-is.production.min.js"></script>
  <script src="https://unpkg.com/prop-types@15/prop-types.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/recharts@1.8.6/umd/Recharts.min.js"></script>
  <script src="https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js"></script>
  <script>
    // Create lucideReact shim from lucide icons
    window.lucideReact = {};
    if (window.lucide) {
      Object.keys(window.lucide.icons || {}).forEach(function(name) {
        var iconData = window.lucide.icons[name];
        window.lucideReact[name] = function(props) {
          props = props || {};
          var size = props.size || props.width || 24;
          var className = props.className || '';
          var svgProps = {
            width: size,
            height: size,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: props.strokeWidth || 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            className: className
          };
          return React.createElement('svg', svgProps,
            iconData[2].map(function(child, i) {
              return React.createElement(child[0], Object.assign({ key: i }, child[1]));
            })
          );
        };
      });
    }
  </script>
  <style>
    body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; min-height: 100vh; }
    * { box-sizing: border-box; }
    #root { min-height: 100vh; }
    .maven-app-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      color: #666;
    }
    .maven-app-error {
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
    <div class="maven-app-loading">Loading app...</div>
  </div>
  <script>
    // MavenBridge - API for apps to interact with parent widget
    window.MavenBridge = {
      _pending: {},
      _nextId: 1,
      _parentOrigin: null,  // Set during init for secure postMessage
      tenantApiUrl: null,

      // Storage API (proxied via postMessage)
      storage: {
        async get(key, scope = 'personal') {
          return window.MavenBridge._call('storage.get', { key, scope });
        },
        async set(key, value, scope = 'personal') {
          return window.MavenBridge._call('storage.set', { key, value, scope });
        },
        async delete(key, scope = 'personal') {
          return window.MavenBridge._call('storage.delete', { key, scope });
        },
        async list(scope = 'personal') {
          return window.MavenBridge._call('storage.list', { scope });
        }
      },

      // Admin API proxy (includes user JWT)
      async adminApi(endpoint, options = {}) {
        return window.MavenBridge._call('adminApi', { endpoint, options });
      },

      // Tenant API proxy (calls tenant's API with user JWT)
      async tenantApi(endpoint, options = {}) {
        return window.MavenBridge._call('tenantApi', { endpoint, options });
      },

      // Skills API - invoke backend skills from apps
      skills: {
        /**
         * Execute a skill with streaming output
         * @param {string} slug - Skill slug
         * @param {string} input - User input for the skill
         * @param {Object} params - Skill parameters
         * @param {Function} onChunk - Callback for each text chunk (optional)
         * @returns {Promise<string>} Full output when complete
         */
        async execute(slug, input, params = {}, onChunk) {
          return new Promise((resolve, reject) => {
            const id = window.MavenBridge._nextId++;
            window.MavenBridge._pending[id] = { resolve, reject, onChunk, output: '' };
            const targetOrigin = window.MavenBridge._parentOrigin || '*';
            window.parent.postMessage({
              type: 'maven_skill_execute',
              id,
              skill: slug,
              input,
              params,
            }, targetOrigin);

            // Timeout after 5 minutes for long-running skills
            setTimeout(() => {
              if (window.MavenBridge._pending[id]) {
                delete window.MavenBridge._pending[id];
                reject(new Error('Skill execution timeout'));
              }
            }, 300000);
          });
        }
      },

      // Host DOM API - manipulate parent page DOM
      hostDom: {
        async insertBefore(targetSelector, html, options = {}) {
          return window.MavenBridge._call('hostDom.insertBefore', {
            targetSelector, html, ...options
          });
        },
        async insertAfter(targetSelector, html, options = {}) {
          return window.MavenBridge._call('hostDom.insertAfter', {
            targetSelector, html, ...options
          });
        },
        async remove(id) {
          return window.MavenBridge._call('hostDom.remove', { id });
        },
        async update(id, html) {
          return window.MavenBridge._call('hostDom.update', { id, html });
        }
      },

      // Internal: postMessage RPC
      _call(method, params) {
        return new Promise((resolve, reject) => {
          const id = this._nextId++;
          this._pending[id] = { resolve, reject };
          const targetOrigin = this._parentOrigin || '*';
          window.parent.postMessage({
            type: 'maven_app_call',
            id,
            method,
            params
          }, targetOrigin);

          // Timeout after 30s
          setTimeout(() => {
            if (this._pending[id]) {
              delete this._pending[id];
              reject(new Error('Request timeout'));
            }
          }, 30000);
        });
      },

      // Handle responses from parent
      _handleResponse(data) {
        const pending = this._pending[data.id];
        if (pending) {
          delete this._pending[data.id];
          if (data.error) {
            pending.reject(new Error(data.error));
          } else {
            pending.resolve(data.result);
          }
        }
      }
    };

    window.addEventListener('message', (event) => {
      const { data } = event;

      // Validate origin for all messages except init (which sets the origin)
      if (data?.type !== 'maven_app_init' && window.MavenBridge._parentOrigin) {
        if (event.origin !== window.MavenBridge._parentOrigin) {
          console.warn('[MavenBridge] Rejected message from unauthorized origin:', event.origin);
          return;
        }
      }

      if (data?.type === 'maven_app_response') {
        window.MavenBridge._handleResponse(data);
      }

      // Handle skill execution chunks
      if (data?.type === 'maven_skill_chunk') {
        const pending = window.MavenBridge._pending[data.id];
        if (pending) {
          pending.output = (pending.output || '') + data.text;
          if (pending.onChunk) {
            pending.onChunk(data.text);
          }
        }
      }

      // Handle skill execution complete
      if (data?.type === 'maven_skill_done') {
        const pending = window.MavenBridge._pending[data.id];
        if (pending) {
          delete window.MavenBridge._pending[data.id];
          pending.resolve(pending.output || '');
        }
      }

      // Handle skill execution error
      if (data?.type === 'maven_skill_error') {
        const pending = window.MavenBridge._pending[data.id];
        if (pending) {
          delete window.MavenBridge._pending[data.id];
          pending.reject(new Error(data.error || 'Skill execution failed'));
        }
      }

      if (data?.type === 'maven_app_init') {
        // Store parent origin for secure postMessage (CRITICAL: must be set before any postMessage calls)
        window.MavenBridge._parentOrigin = event.origin;
        // Set tenant API URL
        window.MavenBridge.tenantApiUrl = data.tenantApiUrl;

        // Execute the app code (transpile JSX with Babel)
        try {
          const transpiledCode = Babel.transform(data.code, {
            presets: ['react'],
            filename: 'app.tsx'
          }).code;
          const script = document.createElement('script');
          script.textContent = transpiledCode;
          document.body.appendChild(script);
        } catch (e) {
          showError('Transpilation Error', e.message, e.stack);
        }
      }
    });

    // Global error handler
    window.onerror = function(msg, url, line, col, error) {
      showError('Runtime Error', msg, error?.stack || 'Line ' + line);
      return true;
    };

    function showError(title, message, stack) {
      document.getElementById('root').innerHTML =
        '<div class="maven-app-error">' +
        '<h2>' + title + '</h2>' +
        '<p>' + message + '</p>' +
        (stack ? '<pre style="font-size:11px;overflow:auto;max-height:200px;background:#fee;padding:8px;border-radius:4px;text-align:left;">' + stack + '</pre>' : '') +
        '</div>';
      // Also notify parent (use stored origin or '*' if not yet initialized)
      const targetOrigin = window.MavenBridge._parentOrigin || '*';
      window.parent.postMessage({ type: 'maven_app_error', error: { title: title, message: message } }, targetOrigin);
    }

    // Wait for all dependencies to load before signaling ready
    // Note: maven_app_ready is sent with '*' because parent origin is not yet known
    // This is safe because it only signals readiness, no sensitive data is sent
    function waitForDeps() {
      if (typeof React !== 'undefined' &&
          typeof ReactDOM !== 'undefined' &&
          typeof Babel !== 'undefined' &&
          typeof Recharts !== 'undefined' &&
          typeof lucideReact !== 'undefined' &&
          Object.keys(lucideReact).length > 0) {
        window.parent.postMessage({ type: 'maven_app_ready' }, '*');
      } else {
        setTimeout(waitForDeps, 50);
      }
    }
    waitForDeps();
  </script>
</body>
</html>
`;

export function AppViewer({
  app,
  tenantId,
  tenantSlug,
  apiUrl,
  agentUrl,
  userId,
  getToken,
  onClose,
  onNavigateToConnectors,
}: AppViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const tenantApiUrlRef = useRef<string | null>(null);
  const injectedElements = useRef<Map<string, HTMLElement>>(new Map());
  // For srcDoc iframes, the origin is 'null' (string literal)
  // We validate by checking event.source matches our iframe
  // NOTE: When sending postMessage to srcDoc iframes, we must use '*' as target origin
  // because 'null' (string) is not a valid targetOrigin value
  const iframeOriginRef = useRef<string>('*');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsOAuthConnection, setNeedsOAuthConnection] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Cleanup injected DOM elements on unmount
  useEffect(() => {
    return () => {
      injectedElements.current.forEach(el => el.remove());
      injectedElements.current.clear();
    };
  }, []);

  // Handle messages from iframe
  const handleMessage = useCallback(async (event: MessageEvent) => {
    // SECURITY: Validate message source is our iframe
    // For srcDoc iframes, origin is 'null' (string), so we validate by source window
    if (event.source !== iframeRef.current?.contentWindow) {
      return; // Ignore messages from other sources
    }

    const { data } = event;

    if (data?.type === 'maven_app_ready') {
      // Iframe is ready
      try {
        const token = getToken ? await getToken() : null;
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // Check if this is an external app (has URL) vs inline app
        if (app.url) {
          // EXTERNAL APP: Send auth context to the external webapp
          const tenantApiUrl = app.config?.tenantApiUrl || null;
          tenantApiUrlRef.current = tenantApiUrl;

          // Store the external app's origin for secure postMessage targeting
          iframeOriginRef.current = event.origin;

          // If app has a connectorSlug, fetch the connector OAuth token
          let connectorToken: string | null = null;
          if (app.connectorSlug && token) {
            try {
              const tokenResponse = await fetch(
                `${apiUrl}/widget/${tenantSlug}/connectors/${app.connectorSlug}/token`,
                {
                  headers: { 'Authorization': `Bearer ${token}` },
                  credentials: 'include',
                }
              );
              if (tokenResponse.ok) {
                const tokenData = await tokenResponse.json();
                connectorToken = tokenData.access_token;
              } else {
                const errorData = await tokenResponse.json();
                if (errorData.needs_oauth) {
                  // Token expired/missing - user needs to connect via Connectors
                  setNeedsOAuthConnection(true);
                  setError(`Connect your ${app.connectorSlug} account to use this app`);
                  setIsLoading(false);
                  return;
                }
              }
            } catch (e) {
              console.error('Failed to fetch connector token:', e);
            }
          }

          // Send auth context to external app using its actual origin
          iframeRef.current?.contentWindow?.postMessage({
            type: 'maven_app_init',
            token: connectorToken || token,  // Prefer connector token if available
            connectorToken,  // Also send separately for clarity
            tenantId,
            tenantSlug,
            userId,
            tenantApiUrl,
            apiUrl,
            agentUrl,
          }, event.origin);

          setIsLoading(false);
        } else {
          // INLINE APP: Fetch and inject app code (existing behavior)
          // Fetch manifest to get entry file and tenant API URL
          // Use widget endpoint for public access with CORS
          const manifestResponse = await fetch(
            `${apiUrl}/widget/${tenantSlug}/apps/${app.id}/files?mode=published&file=manifest.json`,
            { headers, credentials: 'include' }
          );

          let manifest: AppManifest | null = null;
          if (manifestResponse.ok) {
            const manifestData = await manifestResponse.json();
            manifest = JSON.parse(manifestData.content);
          }

          // Fetch entry file (default to index.tsx)
          const entryFile = manifest?.entry || 'index.tsx';
          const codeResponse = await fetch(
            `${apiUrl}/widget/${tenantSlug}/apps/${app.id}/files?mode=published&file=${entryFile}`,
            { headers, credentials: 'include' }
          );

          if (!codeResponse.ok) {
            throw new Error('Failed to load app code');
          }

          const codeData = await codeResponse.json();

          // Determine tenant API URL from manifest or app config
          const tenantApiUrl = manifest?.tenantApiUrl || app.config?.tenantApiUrl || null;
          tenantApiUrlRef.current = tenantApiUrl;

          // Send code to iframe
          iframeRef.current?.contentWindow?.postMessage({
            type: 'maven_app_init',
            code: codeData.content,
            tenantApiUrl,
          }, '*');

          setIsLoading(false);
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to load app';
        setError(errorMessage);
        setIsLoading(false);
      }
    }

    if (data?.type === 'maven_app_call') {
      // Handle bridge calls from iframe
      const { id, method, params } = data;
      try {
        let result;
        const token = getToken ? await getToken() : null;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        if (method.startsWith('storage.')) {
          // Storage operations - use widget endpoint for CORS
          const action = method.split('.')[1];
          const isRead = action === 'get' || action === 'list';

          let url = `${apiUrl}/widget/${tenantSlug}/apps/${app.id}/data?scope=${params.scope || 'personal'}`;
          if (params.key && isRead) {
            url += `&key=${encodeURIComponent(params.key)}`;
          }

          const response = await fetch(url, {
            method: isRead ? 'GET' : (action === 'delete' ? 'DELETE' : 'POST'),
            headers,
            credentials: 'include',
            body: isRead ? undefined : JSON.stringify({
              scope: params.scope,
              key: params.key,
              value: params.value,
            }),
          });

          const responseData = await response.json();
          result = responseData;
        } else if (method === 'adminApi') {
          // Admin API proxy
          const { endpoint, options } = params;
          const response = await fetch(`${apiUrl}${endpoint}`, {
            ...options,
            headers: { ...headers, ...(options?.headers || {}) },
          });
          result = await response.json();
        } else if (method === 'tenantApi') {
          // Tenant API proxy (calls tenant's own API with user JWT)
          if (!tenantApiUrlRef.current) {
            throw new Error('Tenant API URL not configured');
          }
          const { endpoint, options } = params;
          const response = await fetch(`${tenantApiUrlRef.current}${endpoint}`, {
            ...options,
            headers: { ...headers, ...(options?.headers || {}) },
            credentials: 'include',
          });
          result = await response.json();
        } else if (method.startsWith('hostDom.')) {
          // Host DOM manipulation - widget runs on host page, so document IS EasyCarnet DOM
          const action = method.split('.')[1];

          // SECURITY: Sanitize HTML to prevent XSS attacks
          const sanitizeHtml = (html: string): string => {
            return DOMPurify.sanitize(html, {
              ALLOWED_TAGS: ['div', 'span', 'p', 'b', 'i', 'em', 'strong', 'a', 'img', 'ul', 'ol', 'li', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'pre', 'code', 'blockquote'],
              ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'style', 'id', 'target', 'rel', 'title', 'width', 'height'],
              FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea'],
              FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'onblur', 'onsubmit', 'onchange'],
              ALLOW_DATA_ATTR: false,
            });
          };

          if (action === 'insertBefore' || action === 'insertAfter') {
            const { targetSelector, html, id: elemId = `maven-${Date.now()}` } = params;
            const target = document.querySelector(targetSelector);
            if (!target) {
              throw new Error(`Target not found: ${targetSelector}`);
            }

            const wrapper = document.createElement('div');
            wrapper.id = elemId;
            wrapper.innerHTML = sanitizeHtml(html);
            wrapper.dataset.mavenInjected = 'true';

            if (action === 'insertBefore') {
              target.parentNode?.insertBefore(wrapper, target);
            } else {
              target.parentNode?.insertBefore(wrapper, target.nextSibling);
            }

            injectedElements.current.set(elemId, wrapper);
            result = { id: elemId };
          } else if (action === 'remove') {
            const el = injectedElements.current.get(params.id);
            if (el) {
              el.remove();
              injectedElements.current.delete(params.id);
            }
            result = { success: true };
          } else if (action === 'update') {
            const el = injectedElements.current.get(params.id);
            if (el) {
              el.innerHTML = sanitizeHtml(params.html);
            }
            result = { success: true };
          } else {
            throw new Error(`Unknown hostDom action: ${action}`);
          }
        }

        iframeRef.current?.contentWindow?.postMessage({
          type: 'maven_app_response',
          id,
          result
        }, iframeOriginRef.current || '*');
      } catch (e) {
        iframeRef.current?.contentWindow?.postMessage({
          type: 'maven_app_response',
          id,
          error: e instanceof Error ? e.message : 'Unknown error'
        }, iframeOriginRef.current || '*');
      }
    }

    // Handle skill execution from iframe
    if (data?.type === 'maven_skill_execute') {
      const { id, skill, input, params } = data;

      if (!agentUrl) {
        iframeRef.current?.contentWindow?.postMessage({
          type: 'maven_skill_error',
          id,
          error: 'Agent URL not available'
        }, iframeOriginRef.current || '*');
        return;
      }

      try {
        const token = getToken ? await getToken() : null;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          // AgentCore-specific headers for MCP tool authentication
          headers['X-Amzn-Bedrock-AgentCore-Runtime-Custom-Authorization'] = `Bearer ${token}`;
        }
        if (userId) {
          // User ID for per-user MCP tool token binding
          headers['X-Amzn-Bedrock-AgentCore-Runtime-User-Id'] = userId;
        }

        // Call agent with skillMode flag
        const response = await fetch(agentUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            skillMode: true,
            skillSlug: skill,
            skillParams: params,
            message: input,
            sessionId: crypto.randomUUID(),  // Must be valid UUID for Claude CLI
            userId: userId,  // Include userId in body for MCP tool auth
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        // Parse SSE stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const eventData = JSON.parse(line.slice(6));
                if (eventData.type === 'chunk' && eventData.data?.text) {
                  iframeRef.current?.contentWindow?.postMessage({
                    type: 'maven_skill_chunk',
                    id,
                    text: eventData.data.text,
                  }, iframeOriginRef.current || '*');
                } else if (eventData.type === 'done') {
                  iframeRef.current?.contentWindow?.postMessage({
                    type: 'maven_skill_done',
                    id,
                  }, iframeOriginRef.current || '*');
                } else if (eventData.type === 'error') {
                  iframeRef.current?.contentWindow?.postMessage({
                    type: 'maven_skill_error',
                    id,
                    error: eventData.data?.message || 'Skill execution failed',
                  }, iframeOriginRef.current || '*');
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }

        // Send done if not already sent
        iframeRef.current?.contentWindow?.postMessage({
          type: 'maven_skill_done',
          id,
        }, iframeOriginRef.current || '*');

      } catch (e) {
        iframeRef.current?.contentWindow?.postMessage({
          type: 'maven_skill_error',
          id,
          error: e instanceof Error ? e.message : 'Skill execution failed'
        }, iframeOriginRef.current || '*');
      }
    }
  }, [app.id, app.url, app.config, tenantId, tenantSlug, apiUrl, agentUrl, userId, getToken]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Close settings menu when clicking outside
  useEffect(() => {
    if (!showSettingsMenu) return;
    const handleClickOutside = () => setShowSettingsMenu(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showSettingsMenu]);

  // Handle app deletion
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const token = getToken ? await getToken() : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${apiUrl}/widget/${tenantSlug}/apps/${app.id}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });

      if (response.ok) {
        onClose?.(); // Return to apps list
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete app');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete app');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="maven-app-viewer">
      <div className="maven-app-header">
        <div className="maven-app-header-left">
          {onClose && (
            <button onClick={onClose} className="maven-app-back" aria-label="Back to apps">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <span className="maven-app-name">{app.name}</span>
        </div>
        <div className="maven-app-header-right">
          {/* Only show settings for custom apps (not built-in apps with url) */}
          {!app.url && (
            <>
              <button
                className="maven-app-settings"
                onClick={(e) => { e.stopPropagation(); setShowSettingsMenu(!showSettingsMenu); }}
                aria-label="App settings"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
              {showSettingsMenu && (
                <div className="maven-app-menu" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="maven-app-menu-item maven-app-menu-item-danger"
                    onClick={() => { setShowSettingsMenu(false); setShowDeleteConfirm(true); }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Delete
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="maven-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="maven-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="maven-modal-title">Delete App</h3>
            <p className="maven-modal-text">
              Are you sure you want to delete "{app.name}"? This action cannot be undone.
            </p>
            <div className="maven-modal-actions">
              <button
                className="maven-modal-btn maven-modal-btn-secondary"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="maven-modal-btn maven-modal-btn-danger"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="maven-app-loading">
          <div className="maven-app-spinner" />
          <span>Loading {app.name}...</span>
        </div>
      )}

      {error && (
        <div className="maven-app-error">
          {needsOAuthConnection ? (
            <>
              <span>{error}</span>
              {onNavigateToConnectors && (
                <button onClick={onNavigateToConnectors} className="maven-app-connect">
                  Go to Connectors
                </button>
              )}
            </>
          ) : (
            <>
              <span>Failed to load app: {error}</span>
              <button onClick={() => window.location.reload()} className="maven-app-retry">
                Retry
              </button>
            </>
          )}
        </div>
      )}

      <iframe
        ref={iframeRef}
        {...(app.url
          ? {
              // External app: load from URL, allow same-origin for API calls
              src: app.url,
              sandbox: 'allow-scripts allow-forms allow-popups allow-modals allow-same-origin',
            }
          : {
              // Inline app: inject code via srcDoc template
              srcDoc: IFRAME_TEMPLATE,
              sandbox: 'allow-scripts allow-forms allow-popups allow-modals',
            })}
        className="maven-app-iframe"
        title={app.name}
        style={{ display: isLoading || error ? 'none' : 'block' }}
      />
    </div>
  );
}
