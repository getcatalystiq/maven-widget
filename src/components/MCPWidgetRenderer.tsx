import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import DOMPurify from 'dompurify';
import type { WidgetData } from '../types';

interface MCPWidgetRendererProps {
  widget: WidgetData;
  apiUrl: string;
  tenantSlug: string;
  getToken?: () => Promise<string | null>;
  theme?: 'light' | 'dark';
}

// Create the iframe template with window.openai API
const createIframeTemplate = (): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
    * { box-sizing: border-box; }
    #root { min-height: 100%; }
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100px;
      color: #666;
    }
    .error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100px;
      color: #dc2626;
      padding: 12px;
      text-align: center;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div id="root">
    <div class="loading">Loading widget...</div>
  </div>
  <script>
    (function() {
      'use strict';

      // State
      let _parentOrigin = null;
      let _toolOutput = null;
      let _theme = 'light';
      let _initialized = false;

      // window.openai API for widget compatibility
      window.openai = {
        getContext: function() {
          return { theme: _theme };
        },
        getToolOutput: function() {
          return _toolOutput;
        },
        setWidgetHeight: function(height) {
          window.parent.postMessage({ type: 'mcp_widget_height', height: height }, '*');
        }
      };

      // Event listeners for widget data updates
      var _dataListeners = [];

      // Handle messages from parent
      window.addEventListener('message', function(event) {
        const data = event.data;

        if (data?.type === 'mcp_widget_init') {
          _parentOrigin = event.origin;
          _toolOutput = data.structuredContent;
          _theme = data.theme || 'light';
          _initialized = true;

          // Inject widget HTML - handle full HTML documents properly
          if (data.widgetHtml) {
            try {
              var html = data.widgetHtml;

              // Extract styles from head and inject them
              var styleMatch = html.match(/<style[^>]*>([\\s\\S]*?)<\\/style>/gi);
              if (styleMatch) {
                styleMatch.forEach(function(styleTag) {
                  var styleContent = styleTag.replace(/<\\/?style[^>]*>/gi, '');
                  var styleEl = document.createElement('style');
                  styleEl.textContent = styleContent;
                  document.head.appendChild(styleEl);
                });
              }

              // Extract body content
              var bodyMatch = html.match(/<body[^>]*>([\\s\\S]*?)<\\/body>/i);
              var bodyContent = bodyMatch ? bodyMatch[1] : html;

              // If no body tag, check if it's just the content (no html structure)
              if (!bodyMatch && !html.includes('<html')) {
                bodyContent = html;
              }

              document.getElementById('root').innerHTML = bodyContent;

              // Execute scripts
              var scripts = document.getElementById('root').querySelectorAll('script');
              scripts.forEach(function(script) {
                var newScript = document.createElement('script');
                if (script.src) {
                  newScript.src = script.src;
                } else {
                  newScript.textContent = script.textContent;
                }
                script.parentNode.replaceChild(newScript, script);
              });
            } catch (e) {
              document.getElementById('root').innerHTML =
                '<div class="error">Widget Error: ' + e.message + '</div>';
            }
          }
        } else if (data?.type === 'mcp_widget_data') {
          // Data received from parent (response to action)
          _dataListeners.forEach(function(listener) {
            try {
              listener({ action: data.action, data: data.data });
            } catch (e) {
              console.error('Data listener error:', e);
            }
          });
        } else if (data?.type === 'mcp_widget_error') {
          // Error received from parent
          _dataListeners.forEach(function(listener) {
            try {
              listener({ action: data.action, error: data.error });
            } catch (e) {
              console.error('Data listener error:', e);
            }
          });
        }
      });

      // Extend window.openai API with data listener support
      window.openai.onData = function(callback) {
        _dataListeners.push(callback);
        return function() {
          var idx = _dataListeners.indexOf(callback);
          if (idx > -1) _dataListeners.splice(idx, 1);
        };
      };

      // Handle global errors
      window.onerror = function(msg, url, line) {
        document.getElementById('root').innerHTML =
          '<div class="error">Error: ' + msg + ' (line ' + line + ')</div>';
        return true;
      };

      // Signal ready
      window.parent.postMessage({ type: 'mcp_widget_ready' }, '*');
    })();
  </script>
</body>
</html>
`;

export function MCPWidgetRenderer({
  widget,
  apiUrl,
  tenantSlug,
  getToken,
  theme = 'light',
}: MCPWidgetRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [height, setHeight] = useState(200);

  const iframeTemplate = useMemo(() => createIframeTemplate(), []);

  // Call MCP proxy endpoint
  const callMcpProxy = useCallback(async (method: string, params: Record<string, unknown>): Promise<unknown> => {
    const token = getToken ? await getToken() : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${apiUrl}/api/widget/${tenantSlug}/mcp/${widget.mcpName}`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`MCP request failed: ${response.status}`);
    }

    const result = await response.json();
    if (result.error) {
      throw new Error(result.error.message || 'MCP error');
    }

    return result.result;
  }, [apiUrl, tenantSlug, widget.mcpName, getToken]);

  // Fetch widget HTML from MCP resources/read endpoint
  const fetchWidgetHtml = useCallback(async (): Promise<string | null> => {
    try {
      const result = await callMcpProxy('resources/read', { uri: widget.templateUri }) as { contents?: Array<{ text?: string }> };
      const contents = result?.contents;
      if (contents && contents.length > 0) {
        return contents[0].text || null;
      }
      return null;
    } catch (e) {
      console.error('[MCPWidgetRenderer] Failed to fetch widget HTML:', e);
      return null;
    }
  }, [callMcpProxy, widget.templateUri]);

  // Call MCP tool and return result
  const callMcpTool = useCallback(async (toolName: string, args: Record<string, unknown> = {}): Promise<unknown> => {
    try {
      console.log(`[MCPWidgetRenderer] Calling tool: ${toolName}`, args);
      const result = await callMcpProxy('tools/call', { name: toolName, arguments: args });
      console.log(`[MCPWidgetRenderer] Tool result:`, result);
      return result;
    } catch (e) {
      console.error(`[MCPWidgetRenderer] Tool call failed: ${toolName}`, e);
      throw e;
    }
  }, [callMcpProxy]);

  // Handle messages from iframe
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Check if message is from our iframe (use a more lenient check for sandboxed iframes)
      const isFromOurIframe = event.source === iframeRef.current?.contentWindow ||
        (event.data?.type?.startsWith('mcp_widget_') && iframeRef.current);

      if (!isFromOurIframe) {
        return;
      }

      const data = event.data;

      if (data?.type === 'mcp_widget_ready') {
        // Iframe is ready, fetch widget HTML and send init
        try {
          const widgetHtml = await fetchWidgetHtml();

          // Sanitize HTML before sending to iframe to prevent XSS
          const sanitizedHtml = widgetHtml
            ? DOMPurify.sanitize(widgetHtml, {
                FORBID_TAGS: ['script'],
                FORBID_ATTR: ['onerror', 'onclick', 'onload'],
              })
            : null;

          iframeRef.current?.contentWindow?.postMessage({
            type: 'mcp_widget_init',
            widgetHtml: sanitizedHtml || '<div class="error">Widget not found</div>',
            structuredContent: widget.structuredContent,
            theme,
          }, '*');

          setIsLoading(false);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to load widget');
          setIsLoading(false);
        }
      } else if (data?.type === 'mcp_widget_height') {
        setHeight(Math.min(Math.max(data.height, 100), 600));
      } else if (data?.type === 'mcp_widget_action') {
        // Handle widget action requests (e.g., View Campaigns, View Leads)
        const action = data.action;
        const toolName = data.payload;

        if (toolName) {
          try {
            const result = await callMcpTool(toolName) as { structuredContent?: unknown };
            // Send the result back to the widget
            iframeRef.current?.contentWindow?.postMessage({
              type: 'mcp_widget_data',
              action,
              data: result?.structuredContent || result,
            }, '*');
          } catch (e) {
            console.error('[MCPWidgetRenderer] Action failed:', action, e);
            iframeRef.current?.contentWindow?.postMessage({
              type: 'mcp_widget_error',
              action,
              error: e instanceof Error ? e.message : 'Action failed',
            }, '*');
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchWidgetHtml, widget.structuredContent, theme, callMcpTool]);

  if (error) {
    return (
      <div className="maven-mcp-widget-error">
        Failed to load widget: {error}
      </div>
    );
  }

  return (
    <div className="maven-mcp-widget">
      {isLoading && (
        <div className="maven-mcp-widget-loading">
          Loading widget...
        </div>
      )}
      <iframe
        ref={iframeRef}
        srcDoc={iframeTemplate}
        sandbox="allow-scripts allow-same-origin"
        className="maven-mcp-widget-iframe"
        title="MCP Widget"
        style={{
          display: isLoading ? 'none' : 'block',
          width: '100%',
          height: `${height}px`,
          border: 'none',
          borderRadius: '8px',
          background: theme === 'dark' ? '#1a1a1a' : '#f8f9fa',
        }}
      />
    </div>
  );
}
