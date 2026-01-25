import React, { useState } from 'react';
import { OAuthProvider } from '../../contexts/MCPsContext';

// Icons
const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
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
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="maven-oauth-spinner">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
);

interface OAuthConnectPromptProps {
  provider: OAuthProvider;
  connectionStatus?: 'pending' | 'connected' | 'expired' | 'revoked';
  consentUrl?: string;
  onConnect: () => void;
  onDisconnect?: () => void;
  isLoading?: boolean;
}

/**
 * Component to prompt users to connect their OAuth account.
 *
 * Used for User Federation (3LO) flows where each user needs to
 * authorize access to their personal account.
 */
export function OAuthConnectPrompt({
  provider,
  connectionStatus = 'pending',
  consentUrl,
  onConnect,
  onDisconnect,
  isLoading = false,
}: OAuthConnectPromptProps) {
  const [showDetails, setShowDetails] = useState(false);

  const displayName = provider.displayName || provider.display_name || provider.name;
  const vendorDisplay = provider.vendor.charAt(0).toUpperCase() + provider.vendor.slice(1);

  const isConnected = connectionStatus === 'connected';
  const needsReconnect = connectionStatus === 'expired' || connectionStatus === 'revoked';

  const handleConnect = () => {
    if (consentUrl) {
      // Open in new tab/window for cross-origin compatibility
      window.open(consentUrl, '_blank', 'noopener,noreferrer');
    }
    onConnect();
  };

  return (
    <div className={`maven-oauth-connect-prompt ${isConnected ? 'connected' : ''} ${needsReconnect ? 'needs-reconnect' : ''}`}>
      <div className="maven-oauth-connect-header">
        <div className="maven-oauth-connect-icon">
          {isConnected ? <CheckCircleIcon /> : needsReconnect ? <AlertTriangleIcon /> : <LinkIcon />}
        </div>
        <div className="maven-oauth-connect-info">
          <h4>{displayName}</h4>
          <span className="maven-oauth-connect-vendor">{vendorDisplay}</span>
        </div>
        <div className="maven-oauth-connect-status">
          {isConnected && <span className="maven-oauth-status-badge connected">Connected</span>}
          {connectionStatus === 'pending' && <span className="maven-oauth-status-badge pending">Not Connected</span>}
          {connectionStatus === 'expired' && <span className="maven-oauth-status-badge expired">Expired</span>}
          {connectionStatus === 'revoked' && <span className="maven-oauth-status-badge revoked">Revoked</span>}
        </div>
      </div>

      <div className="maven-oauth-connect-body">
        {!isConnected && (
          <p className="maven-oauth-connect-description">
            {needsReconnect
              ? `Your ${vendorDisplay} connection needs to be renewed. Please reconnect to continue using this integration.`
              : `Connect your ${vendorDisplay} account to enable this integration.`}
          </p>
        )}

        {isConnected && (
          <p className="maven-oauth-connect-description">
            Your {vendorDisplay} account is connected and ready to use.
          </p>
        )}

        {provider.scopes && provider.scopes.length > 0 && (
          <button
            type="button"
            className="maven-oauth-details-toggle"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Hide permissions' : 'View required permissions'}
          </button>
        )}

        {showDetails && provider.scopes && (
          <div className="maven-oauth-scopes-list">
            <p>This integration will request access to:</p>
            <ul>
              {provider.scopes.map((scope, index) => (
                <li key={index}>{scope}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="maven-oauth-connect-actions">
        {!isConnected && (
          <button
            type="button"
            className="maven-admin-btn maven-admin-btn-primary maven-oauth-connect-btn"
            onClick={handleConnect}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <LoaderIcon />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <LinkIcon />
                <span>{needsReconnect ? 'Reconnect' : 'Connect'} {vendorDisplay}</span>
              </>
            )}
          </button>
        )}

        {isConnected && onDisconnect && (
          <button
            type="button"
            className="maven-admin-btn maven-admin-btn-secondary maven-oauth-disconnect-btn"
            onClick={onDisconnect}
            disabled={isLoading}
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}
