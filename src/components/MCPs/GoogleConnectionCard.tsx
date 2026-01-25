import React, { useState, useEffect, useCallback } from 'react';
import { useMCPs, OAuthProvider } from '../../contexts/MCPsContext';

// Icons
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const CheckCircleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const AlertTriangleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const LoaderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="maven-google-spinner">
    <circle cx="12" cy="12" r="10" opacity="0.25" />
    <path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
);

const GmailIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16">
    <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
  </svg>
);

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16">
    <path fill="#4285F4" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
  </svg>
);

const DriveIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16">
    <path fill="#4285F4" d="M7.71 3.5L1.15 15l3.43 5.75 6.56-11.5z"/>
    <path fill="#0F9D58" d="M22.85 15L16.29 3.5H9.14l6.57 11.5z"/>
    <path fill="#FFCD40" d="M12.57 15l-3.43 5.75h13.71L19.42 15z"/>
  </svg>
);

export type GoogleConnectionStatus = 'loading' | 'not_configured' | 'pending' | 'connected' | 'expired' | 'error';

interface GoogleConnectionCardProps {
  /** Show compact card (for sidebar) or full card (for settings) */
  variant?: 'compact' | 'full';
  /** Called when user initiates connection */
  onConnect?: () => void;
  /** Called when connection status changes */
  onStatusChange?: (status: GoogleConnectionStatus) => void;
}

/**
 * Google Workspace connection card for end users.
 *
 * Shows the current connection status and allows users to connect
 * their Google account for Gmail, Calendar, and Drive access.
 */
export function GoogleConnectionCard({
  variant = 'full',
  onConnect,
  onStatusChange,
}: GoogleConnectionCardProps) {
  const { oauthProviders, loadOAuthProviders, tenantSlug, adminApiUrl, getToken } = useMCPs();

  const [status, setStatus] = useState<GoogleConnectionStatus>('loading');
  const [googleProvider, setGoogleProvider] = useState<OAuthProvider | null>(null);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Find Google OAuth provider
  useEffect(() => {
    const provider = oauthProviders.find(
      (p) => p.vendor.toLowerCase() === 'google'
    );
    setGoogleProvider(provider || null);

    if (!provider) {
      setStatus('not_configured');
    }
  }, [oauthProviders]);

  // Check connection status
  const checkConnectionStatus = useCallback(async () => {
    if (!googleProvider) {
      setStatus('not_configured');
      return;
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (getToken) {
        const token = await getToken();
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Check connection status via the API
      const response = await fetch(`${adminApiUrl}/api/widget/${tenantSlug}/google-status`, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.connected) {
          setStatus('connected');
          setConnectedEmail(data.email || null);
        } else if (data.expired) {
          setStatus('expired');
        } else {
          setStatus('pending');
        }
      } else if (response.status === 404) {
        // Endpoint not found - fall back to pending status
        setStatus('pending');
      } else {
        setStatus('error');
        setError('Failed to check connection status');
      }
    } catch (err) {
      console.error('[GoogleConnectionCard] Error checking status:', err);
      // On error, assume pending (user can try to connect)
      setStatus('pending');
    }
  }, [googleProvider, adminApiUrl, tenantSlug, getToken]);

  // Load providers and check status on mount
  useEffect(() => {
    loadOAuthProviders().then(() => {
      checkConnectionStatus();
    });
  }, [loadOAuthProviders, checkConnectionStatus]);

  // Notify parent of status changes
  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  // Handle connect button click
  const handleConnect = async () => {
    if (!googleProvider) return;

    setIsConnecting(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (getToken) {
        const token = await getToken();
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Request authorization URL from Token Vault
      const response = await fetch(`${adminApiUrl}/api/widget/${tenantSlug}/agent`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'oauth',
          operation: 'get_authorization_url',
          provider_id: googleProvider.id,
        }),
      });

      if (response.ok) {
        const text = await response.text();
        // Parse SSE response
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.authorization_url) {
              // Open Google consent screen in new window
              window.open(data.authorization_url, '_blank', 'noopener,noreferrer,width=600,height=700');
              onConnect?.();

              // Poll for completion
              pollForConnection();
              return;
            }
          }
        }
      }

      setError('Failed to start authorization. Please try again.');
    } catch (err) {
      console.error('[GoogleConnectionCard] Error initiating OAuth:', err);
      setError('Failed to connect. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Poll for connection completion
  const pollForConnection = useCallback(() => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    const poll = setInterval(async () => {
      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(poll);
        return;
      }

      await checkConnectionStatus();
      if (status === 'connected') {
        clearInterval(poll);
      }
    }, 5000);

    // Cleanup on unmount
    return () => clearInterval(poll);
  }, [checkConnectionStatus, status]);

  const isConnected = status === 'connected';
  const needsReconnect = status === 'expired';
  const isCompact = variant === 'compact';

  // Compact variant for sidebar
  if (isCompact) {
    return (
      <div className={`maven-google-card-compact ${isConnected ? 'connected' : ''}`}>
        <div className="maven-google-card-compact-icon">
          <GoogleIcon />
        </div>
        <div className="maven-google-card-compact-content">
          <span className="maven-google-card-compact-label">Google</span>
          {isConnected ? (
            <span className="maven-google-card-compact-status connected">
              <CheckCircleIcon /> Connected
            </span>
          ) : status === 'not_configured' ? (
            <span className="maven-google-card-compact-status">Not available</span>
          ) : (
            <button
              type="button"
              className="maven-google-card-compact-btn"
              onClick={handleConnect}
              disabled={isConnecting}
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Full card variant
  return (
    <div className={`maven-google-connection-card ${isConnected ? 'connected' : ''} ${needsReconnect ? 'expired' : ''}`}>
      {/* Header */}
      <div className="maven-google-card-header">
        <div className="maven-google-card-icon">
          <GoogleIcon />
        </div>
        <div className="maven-google-card-title">
          <h4>Google Workspace</h4>
          <p>Access Gmail, Calendar, and Drive</p>
        </div>
        <div className="maven-google-card-status">
          {status === 'loading' && <LoaderIcon />}
          {isConnected && (
            <span className="maven-status-badge connected">
              <CheckCircleIcon /> Connected
            </span>
          )}
          {status === 'pending' && (
            <span className="maven-status-badge pending">Not Connected</span>
          )}
          {needsReconnect && (
            <span className="maven-status-badge expired">
              <AlertTriangleIcon /> Expired
            </span>
          )}
          {status === 'not_configured' && (
            <span className="maven-status-badge disabled">Not Available</span>
          )}
        </div>
      </div>

      {/* Services */}
      <div className="maven-google-card-services">
        <div className="maven-google-service">
          <GmailIcon />
          <span>Gmail</span>
        </div>
        <div className="maven-google-service">
          <CalendarIcon />
          <span>Calendar</span>
        </div>
        <div className="maven-google-service">
          <DriveIcon />
          <span>Drive</span>
        </div>
      </div>

      {/* Connected Info */}
      {isConnected && connectedEmail && (
        <div className="maven-google-card-connected">
          <span>Connected as</span>
          <strong>{connectedEmail}</strong>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="maven-google-card-error">
          {error}
        </div>
      )}

      {/* Action */}
      <div className="maven-google-card-action">
        {status === 'not_configured' ? (
          <p className="maven-google-card-hint">
            Contact your administrator to enable Google Workspace integration.
          </p>
        ) : !isConnected ? (
          <button
            type="button"
            className="maven-admin-btn maven-admin-btn-primary maven-google-connect-btn"
            onClick={handleConnect}
            disabled={isConnecting || status === 'loading'}
          >
            {isConnecting ? (
              <>
                <LoaderIcon />
                <span>Connecting...</span>
              </>
            ) : needsReconnect ? (
              <>
                <GoogleIcon />
                <span>Reconnect Google Account</span>
              </>
            ) : (
              <>
                <GoogleIcon />
                <span>Connect Google Account</span>
              </>
            )}
          </button>
        ) : (
          <p className="maven-google-card-hint">
            Your Google account is connected. The assistant can help you with emails, calendar events, and files.
          </p>
        )}
      </div>
    </div>
  );
}
