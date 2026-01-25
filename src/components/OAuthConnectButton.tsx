/**
 * OAuth Connect Button Component
 *
 * Renders when the agent indicates OAuth authorization is required for an MCP tool.
 * Clicking the button generates a fresh auth URL via the agent's oauth_start action.
 *
 * Flow:
 * 1. User clicks Connect
 * 2. Widget calls agent's oauth_start action
 * 3. Agent calls Admin API to build OAuth authorization URL
 * 4. Widget opens URL in popup
 * 5. User completes OAuth with provider
 * 6. Callback exchanges code for tokens, stores in Aurora
 * 7. Popup sends maven_oauth_complete message and closes
 * 8. Widget notifies success, user can retry tool
 */

import React, { useState, useCallback } from 'react';

export interface OAuthRequirement {
  oauth_required: true;
  provider_name: string;
  scopes: string[];
  tenant_slug: string;
  mcp_name: string;
  display_name?: string;
}

interface OAuthConnectButtonProps {
  requirement: OAuthRequirement;
  agentUrl: string;  // Agent URL for oauth_start action
  getToken?: () => Promise<string | null>;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function OAuthConnectButton({
  requirement,
  agentUrl,
  getToken,
  onSuccess,
  onError,
}: OAuthConnectButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Get auth token for agent request
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (getToken) {
        const token = await getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      // Call the agent's OAuth start action to get authorization URL
      const response = await fetch(agentUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'oauth_start',
          provider_name: requirement.provider_name,
          scopes: requirement.scopes,
          mcp_name: requirement.mcp_name,
          tenant_slug: requirement.tenant_slug,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to start authorization`);
      }

      // Parse SSE response from agent
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let authUrl: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const dataMatch = line.match(/^data: (.+)$/m);
          if (dataMatch) {
            const parsed = JSON.parse(dataMatch[1]);
            if (parsed.type === 'oauth_url' && parsed.data?.authorization_url) {
              authUrl = parsed.data.authorization_url;
            } else if (parsed.type === 'error') {
              throw new Error(parsed.data?.message || 'OAuth error');
            }
          }
        }
      }

      if (authUrl) {
        // Open the auth URL in a popup window
        // Note: We intentionally omit noopener/noreferrer so window.opener works for postMessage
        const popup = window.open(
          authUrl,
          'maven_oauth',
          'width=600,height=700,popup'
        );

        if (!popup) {
          throw new Error('Popup blocked by browser. Please allow popups for this site.');
        }

        // Wait for OAuth completion via postMessage from callback page
        // The callback handles token exchange and storage - no agent call needed
        await new Promise<void>((resolve, reject) => {
          const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'maven_oauth_complete') {
              window.removeEventListener('message', handleMessage);
              clearInterval(pollTimer);
              // Token is already stored in Aurora by the callback
              resolve();
            } else if (event.data?.type === 'maven_oauth_error') {
              window.removeEventListener('message', handleMessage);
              clearInterval(pollTimer);
              reject(new Error(event.data.error || 'Authorization failed'));
            }
          };

          window.addEventListener('message', handleMessage);

          // Also poll for popup closure
          const pollTimer = setInterval(() => {
            if (popup.closed) {
              clearInterval(pollTimer);
              window.removeEventListener('message', handleMessage);
              // Don't reject - user might have completed OAuth
              resolve();
            }
          }, 500);

          // Timeout after 5 minutes
          setTimeout(() => {
            clearInterval(pollTimer);
            window.removeEventListener('message', handleMessage);
            if (!popup.closed) {
              popup.close();
            }
            reject(new Error('Authorization timed out'));
          }, 5 * 60 * 1000);
        });

        onSuccess?.();
      } else {
        throw new Error('No authorization URL returned');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect';
      console.error('[OAuthConnectButton] Error:', err);
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  }, [requirement, agentUrl, getToken, onSuccess, onError]);

  const displayName = requirement.display_name || requirement.mcp_name || 'this service';

  return (
    <div className="maven-oauth-connect">
      <div className="maven-oauth-connect-content">
        <div className="maven-oauth-connect-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
        </div>
        <div className="maven-oauth-connect-text">
          <span className="maven-oauth-connect-title">
            Authorization required
          </span>
          <span className="maven-oauth-connect-subtitle">
            Connect to {displayName} to continue
          </span>
        </div>
      </div>
      <button
        className="maven-oauth-connect-button"
        onClick={handleConnect}
        disabled={isConnecting}
      >
        {isConnecting ? (
          <>
            <span className="maven-oauth-connect-spinner" />
            Connecting...
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Connect
          </>
        )}
      </button>
      {error && (
        <div className="maven-oauth-connect-error">
          {error}
        </div>
      )}
    </div>
  );
}

/**
 * Check if a value is an OAuth requirement object
 */
export function isOAuthRequirement(value: unknown): value is OAuthRequirement {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    obj.oauth_required === true &&
    typeof obj.provider_name === 'string' &&
    Array.isArray(obj.scopes) &&
    typeof obj.tenant_slug === 'string'
  );
}
