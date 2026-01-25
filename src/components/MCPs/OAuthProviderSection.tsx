import React, { useState, useEffect } from 'react';
import {
  useMCPs,
  OAuthProvider,
  OAuthVendor,
  CreateOAuthProviderInput,
  OAuthAuthFlow,
} from '../../contexts/MCPsContext';

// Icons
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 15l-6-6-6 6" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

interface OAuthProviderSectionProps {
  selectedProviderId: string | null;
  onSelect: (providerId: string | null) => void;
  onProviderCreated?: (provider: OAuthProvider) => void;
}

export function OAuthProviderSection({
  selectedProviderId,
  onSelect,
  onProviderCreated,
}: OAuthProviderSectionProps) {
  const {
    oauthProviders,
    oauthVendors,
    loadOAuthProviders,
    loadOAuthVendors,
    createOAuthProvider,
    deleteOAuthProvider,
    oauthProvidersLoading,
  } = useMCPs();

  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [vendor, setVendor] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [scopes, setScopes] = useState('');
  const [authFlow, setAuthFlow] = useState<OAuthAuthFlow>('tenant');
  const [authorizationUrl, setAuthorizationUrl] = useState('');
  const [tokenUrl, setTokenUrl] = useState('');
  const [microsoftTenantId, setMicrosoftTenantId] = useState('');

  // Load providers and vendors on mount
  useEffect(() => {
    loadOAuthProviders();
    loadOAuthVendors();
  }, [loadOAuthProviders, loadOAuthVendors]);

  const resetForm = () => {
    setName('');
    setVendor('');
    setClientId('');
    setClientSecret('');
    setScopes('');
    setAuthFlow('tenant');
    setAuthorizationUrl('');
    setTokenUrl('');
    setMicrosoftTenantId('');
    setError(null);
  };

  const handleCreate = async () => {
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!vendor) {
      setError('Vendor is required');
      return;
    }
    if (!clientId.trim()) {
      setError('Client ID is required');
      return;
    }
    if (!clientSecret.trim()) {
      setError('Client Secret is required');
      return;
    }
    if (vendor === 'custom' && (!authorizationUrl.trim() || !tokenUrl.trim())) {
      setError('Authorization URL and Token URL are required for custom OAuth');
      return;
    }

    setIsSubmitting(true);

    const input: CreateOAuthProviderInput = {
      name: name.trim(),
      vendor,
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      scopes: scopes.split(',').map(s => s.trim()).filter(Boolean),
      authFlow,
    };

    if (vendor === 'custom') {
      input.authorizationUrl = authorizationUrl.trim();
      input.tokenUrl = tokenUrl.trim();
    }

    if (vendor === 'microsoft' && microsoftTenantId.trim()) {
      input.microsoftTenantId = microsoftTenantId.trim();
    }

    const provider = await createOAuthProvider(input);

    setIsSubmitting(false);

    if (provider) {
      resetForm();
      setIsCreating(false);
      onProviderCreated?.(provider);
    } else {
      setError('Failed to create OAuth provider');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this OAuth provider?')) {
      return;
    }

    const success = await deleteOAuthProvider(id);
    if (success && selectedProviderId === id) {
      onSelect(null);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isCustomVendor = vendor === 'custom';
  const isMicrosoftVendor = vendor === 'microsoft';

  return (
    <div className="maven-oauth-section">
      {/* Provider Selector */}
      <div className="maven-modal-field">
        <label>OAuth Provider</label>
        <select
          value={selectedProviderId || ''}
          onChange={(e) => onSelect(e.target.value || null)}
          disabled={oauthProvidersLoading}
        >
          <option value="">Select an OAuth provider...</option>
          {oauthProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.displayName || provider.display_name || provider.name} ({provider.vendor})
            </option>
          ))}
        </select>
      </div>

      {/* Selected Provider Details */}
      {selectedProviderId && (
        <div className="maven-oauth-provider-details">
          {(() => {
            const provider = oauthProviders.find(p => p.id === selectedProviderId);
            if (!provider) return null;

            return (
              <>
                <div className="maven-oauth-detail-row">
                  <span className="maven-oauth-detail-label">ARN:</span>
                  <code className="maven-oauth-detail-value">{provider.provider_arn || 'Pending...'}</code>
                </div>
                {provider.callback_url && (
                  <div className="maven-oauth-detail-row">
                    <span className="maven-oauth-detail-label">Callback URL:</span>
                    <div className="maven-oauth-callback-url">
                      <code>{provider.callback_url}</code>
                      <button
                        type="button"
                        className="maven-oauth-copy-btn"
                        onClick={() => copyToClipboard(provider.callback_url!, provider.id)}
                        title="Copy to clipboard"
                      >
                        {copiedId === provider.id ? <CheckIcon /> : <CopyIcon />}
                      </button>
                    </div>
                    <span className="maven-modal-field-hint">
                      Add this URL to your OAuth app's redirect URIs
                    </span>
                  </div>
                )}
                <div className="maven-oauth-detail-row">
                  <span className="maven-oauth-detail-label">Auth Flow:</span>
                  <span className="maven-oauth-detail-value">
                    {provider.auth_flow === 'user_federation' ? 'User Federation (per-user)' : 'Tenant-level'}
                  </span>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Create New Toggle */}
      <button
        type="button"
        className="maven-oauth-toggle-create"
        onClick={() => {
          setIsCreating(!isCreating);
          if (!isCreating) resetForm();
        }}
      >
        {isCreating ? (
          <>
            <ChevronUpIcon />
            <span>Cancel</span>
          </>
        ) : (
          <>
            <PlusIcon />
            <span>Create New OAuth Provider</span>
          </>
        )}
      </button>

      {/* Create Form */}
      {isCreating && (
        <div className="maven-oauth-create-form">
          {error && (
            <div className="maven-admin-error">
              <span>{error}</span>
            </div>
          )}

          <div className="maven-modal-field">
            <label htmlFor="oauth-name">
              Name <span className="maven-modal-required">*</span>
            </label>
            <input
              id="oauth-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-google-oauth"
            />
            <span className="maven-modal-field-hint">
              Unique identifier for this OAuth provider
            </span>
          </div>

          <div className="maven-modal-field">
            <label htmlFor="oauth-vendor">
              Vendor <span className="maven-modal-required">*</span>
            </label>
            <select
              id="oauth-vendor"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
            >
              <option value="">Select a vendor...</option>
              {oauthVendors.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <div className="maven-modal-field">
            <label htmlFor="oauth-client-id">
              Client ID <span className="maven-modal-required">*</span>
            </label>
            <input
              id="oauth-client-id"
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="your-client-id"
            />
          </div>

          <div className="maven-modal-field">
            <label htmlFor="oauth-client-secret">
              Client Secret <span className="maven-modal-required">*</span>
            </label>
            <input
              id="oauth-client-secret"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="your-client-secret"
            />
            <span className="maven-modal-field-hint">
              Stored securely in AWS (never saved in our database)
            </span>
          </div>

          {/* Microsoft-specific field */}
          {isMicrosoftVendor && (
            <div className="maven-modal-field">
              <label htmlFor="oauth-ms-tenant">
                Microsoft Tenant ID <span className="maven-modal-optional">(optional)</span>
              </label>
              <input
                id="oauth-ms-tenant"
                type="text"
                value={microsoftTenantId}
                onChange={(e) => setMicrosoftTenantId(e.target.value)}
                placeholder="common"
              />
              <span className="maven-modal-field-hint">
                Leave empty for multi-tenant apps, or specify your Azure AD tenant ID
              </span>
            </div>
          )}

          {/* Custom OAuth fields */}
          {isCustomVendor && (
            <>
              <div className="maven-modal-field">
                <label htmlFor="oauth-auth-url">
                  Authorization URL <span className="maven-modal-required">*</span>
                </label>
                <input
                  id="oauth-auth-url"
                  type="url"
                  value={authorizationUrl}
                  onChange={(e) => setAuthorizationUrl(e.target.value)}
                  placeholder="https://provider.com/oauth/authorize"
                />
              </div>

              <div className="maven-modal-field">
                <label htmlFor="oauth-token-url">
                  Token URL <span className="maven-modal-required">*</span>
                </label>
                <input
                  id="oauth-token-url"
                  type="url"
                  value={tokenUrl}
                  onChange={(e) => setTokenUrl(e.target.value)}
                  placeholder="https://provider.com/oauth/token"
                />
              </div>
            </>
          )}

          <div className="maven-modal-field">
            <label htmlFor="oauth-scopes">
              Scopes <span className="maven-modal-optional">(comma-separated)</span>
            </label>
            <input
              id="oauth-scopes"
              type="text"
              value={scopes}
              onChange={(e) => setScopes(e.target.value)}
              placeholder="openid, profile, email"
            />
          </div>

          <div className="maven-modal-field">
            <label htmlFor="oauth-auth-flow">Auth Flow</label>
            <select
              id="oauth-auth-flow"
              value={authFlow}
              onChange={(e) => setAuthFlow(e.target.value as OAuthAuthFlow)}
            >
              <option value="tenant">Tenant-level (shared credentials)</option>
              <option value="user_federation">User Federation (per-user OAuth consent)</option>
            </select>
            <span className="maven-modal-field-hint">
              {authFlow === 'user_federation'
                ? 'Each user will authorize with their own account'
                : 'All users share the same OAuth credentials'}
            </span>
          </div>

          <div className="maven-oauth-form-actions">
            <button
              type="button"
              className="maven-admin-btn maven-admin-btn-primary"
              onClick={handleCreate}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Provider'}
            </button>
          </div>
        </div>
      )}

      {/* Existing Providers List */}
      {oauthProviders.length > 0 && (
        <div className="maven-oauth-providers-list">
          <h4>Existing Providers</h4>
          {oauthProviders.map((provider) => (
            <div
              key={provider.id}
              className={`maven-oauth-provider-item ${selectedProviderId === provider.id ? 'selected' : ''}`}
            >
              <div
                className="maven-oauth-provider-info"
                onClick={() => onSelect(provider.id)}
              >
                <span className="maven-oauth-provider-name">
                  {provider.displayName || provider.display_name || provider.name}
                </span>
                <span className="maven-oauth-provider-vendor">{provider.vendor}</span>
              </div>
              <button
                type="button"
                className="maven-oauth-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(provider.id);
                }}
                title="Delete provider"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
