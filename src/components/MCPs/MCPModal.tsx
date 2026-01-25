import React, { useState, useEffect } from 'react';
import {
  useMCPs,
  MCPServer,
  CredentialProviderType,
  CredentialLocation,
  CredentialProviderConfig,
} from '../../contexts/MCPsContext';
import { OAuthProviderSection } from './OAuthProviderSection';

type ServerType = 'gateway-target' | 'mcp-wrapper';
type McpAuthType = 'bearer' | 'url_embedded';
type McpAuthMode = 'shared' | 'per_user';
type McpSource = 'external' | 'internal';

interface MCPModalProps {
  server: MCPServer | null;
  onClose: () => void;
}

// Icons
const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);

const ServerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="2" width="20" height="8" rx="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" />
    <circle cx="6" cy="6" r="1" fill="currentColor" />
    <circle cx="6" cy="18" r="1" fill="currentColor" />
  </svg>
);

const CpuIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <rect x="9" y="9" width="6" height="6" />
    <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

const KeyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

export function MCPModal({ server, onClose }: MCPModalProps) {
  const { createServer, updateServer, oauthProviders, tenantSlug, createApiKeyProvider } = useMCPs();
  const isEditing = !!server;

  // Server type
  const [serverType, setServerType] = useState<ServerType>('gateway-target');

  // Common fields
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [description, setDescription] = useState('');

  // Gateway Target Authentication fields
  const [credentialProviderType, setCredentialProviderType] = useState<CredentialProviderType>('NONE');
  const [selectedOAuthProviderId, setSelectedOAuthProviderId] = useState<string | null>(null);
  const [oauthScopes, setOauthScopes] = useState('');
  const [apiKeyProviderArn, setApiKeyProviderArn] = useState('');
  const [apiKeyLocation, setApiKeyLocation] = useState<CredentialLocation>('HEADER');
  const [apiKeyParameterName, setApiKeyParameterName] = useState('');
  const [apiKeyPrefix, setApiKeyPrefix] = useState('');

  // MCP Wrapper fields
  const [mcpAuthType, setMcpAuthType] = useState<McpAuthType>('bearer');
  const [mcpAuthMode, setMcpAuthMode] = useState<McpAuthMode>('shared');
  const [mcpSource, setMcpSource] = useState<McpSource>('external');
  const [credentialProviderName, setCredentialProviderName] = useState('');
  const [sharedApiKey, setSharedApiKey] = useState(''); // New: API key for shared auth mode
  const [mcpOauthScopes, setMcpOauthScopes] = useState('');
  const [internalLambdaArn, setInternalLambdaArn] = useState('');
  const [token, setToken] = useState(''); // Legacy support
  const [createGatewayTarget, setCreateGatewayTarget] = useState(true);
  const [enabled, setEnabled] = useState(true);

  // Form state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (server) {
      setServerType(server.type || 'gateway-target');
      setName(server.name);
      setEndpoint(server.endpoint);
      setDescription(server.description || '');

      if (server.type === 'gateway-target') {
        // Parse existing credential provider config
        const cp = server.credentialProvider?.[0];
        if (cp) {
          setCredentialProviderType(cp.type || 'NONE');
          if (cp.oauth) {
            // Find matching OAuth provider by ARN
            const matchingProvider = oauthProviders.find(p => p.provider_arn === cp.oauth?.providerArn);
            setSelectedOAuthProviderId(matchingProvider?.id || null);
            setOauthScopes(cp.oauth.scopes?.join(', ') || '');
          }
          if (cp.apiKey) {
            setApiKeyProviderArn(cp.apiKey.providerArn || '');
            setApiKeyLocation(cp.apiKey.credentialLocation || 'HEADER');
            setApiKeyParameterName(cp.apiKey.credentialParameterName || '');
            setApiKeyPrefix(cp.apiKey.credentialPrefix || '');
          }
        } else {
          setCredentialProviderType('NONE');
        }
        // Load enabled state for Gateway Targets
        setEnabled(server.enabled);
      } else {
        // MCP Wrapper
        setMcpAuthType((server as any).authType || 'bearer');
        setToken('');
        setEnabled(server.enabled);
      }
    } else {
      resetForm();
    }
    setError(null);
  }, [server]);

  function resetForm() {
    setServerType('gateway-target');
    setName('');
    setEndpoint('');
    setDescription('');
    setCredentialProviderType('NONE');
    setSelectedOAuthProviderId(null);
    setOauthScopes('');
    setApiKeyProviderArn('');
    setApiKeyLocation('HEADER');
    setApiKeyParameterName('');
    setApiKeyPrefix('');
    setMcpAuthType('bearer');
    setMcpAuthMode('shared');
    setMcpSource('external');
    setCredentialProviderName('');
    setSharedApiKey('');
    setMcpOauthScopes('');
    setInternalLambdaArn('');
    setToken('');
    setCreateGatewayTarget(true);
    setEnabled(true);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate required fields
      if (!name.trim()) {
        throw new Error('Name is required');
      }
      // Validate endpoint/ARN based on server type and source
      if (serverType === 'gateway-target') {
        if (!endpoint.trim()) {
          throw new Error('Endpoint URL is required');
        }
      } else if (mcpSource === 'internal') {
        if (!internalLambdaArn.trim()) {
          throw new Error('Internal Lambda ARN is required');
        }
      } else {
        // External MCP Wrapper
        if (!endpoint.trim()) {
          throw new Error('MCP Server URL is required');
        }
      }

      if (serverType === 'gateway-target') {
        await submitGatewayTarget();
      } else {
        await submitMcpWrapper();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save MCP server');
    } finally {
      setIsSubmitting(false);
    }
  };

  async function submitGatewayTarget() {
    // Build credential provider config
    let credentialProvider: CredentialProviderConfig | undefined;
    if (credentialProviderType !== 'NONE') {
      credentialProvider = { type: credentialProviderType };

      if (credentialProviderType === 'OAUTH') {
        // Get the selected OAuth provider
        const selectedProvider = oauthProviders.find(p => p.id === selectedOAuthProviderId);
        if (!selectedProvider || !selectedProvider.provider_arn) {
          throw new Error('Please select an OAuth provider with a valid ARN');
        }

        // Use scopes from the provider if not overridden
        const scopes = oauthScopes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const finalScopes = scopes.length > 0 ? scopes : selectedProvider.scopes;

        if (finalScopes.length === 0) {
          throw new Error('At least one OAuth scope is required');
        }

        credentialProvider.oauth = {
          providerArn: selectedProvider.provider_arn,
          scopes: finalScopes,
        };
      } else if (credentialProviderType === 'API_KEY') {
        if (!apiKeyProviderArn.trim()) {
          throw new Error('API Key Provider ARN is required');
        }
        credentialProvider.apiKey = {
          providerArn: apiKeyProviderArn.trim(),
          credentialLocation: apiKeyLocation,
          credentialParameterName: apiKeyParameterName.trim() || undefined,
          credentialPrefix: apiKeyPrefix.trim() || undefined,
        };
      }
    }

    if (isEditing) {
      // Update description and enabled state
      const success = await updateServer(server!.id, {
        description: description.trim(),
        enabled,
      });
      if (success) {
        onClose();
      }
    } else {
      const result = await createServer({
        name: name.trim(),
        endpoint: endpoint.trim(),
        description: description.trim() || undefined,
        credentialProvider,
      });

      if (result) {
        onClose();
      }
    }
  }

  async function submitMcpWrapper() {
    // Validate required fields for new MCP Wrapper
    if (!isEditing) {
      if (!credentialProviderName.trim()) {
        throw new Error('Credential provider name is required');
      }
      // For shared auth mode, require API key to create the provider
      if (mcpAuthMode === 'shared' && !sharedApiKey.trim()) {
        throw new Error('API Key is required for shared authentication');
      }
      if (mcpSource === 'internal' && !internalLambdaArn.trim()) {
        throw new Error('Internal Lambda ARN is required for internal MCP source');
      }
      if (mcpSource === 'external' && !endpoint.trim()) {
        throw new Error('MCP URL is required for external MCP source');
      }
    }

    if (isEditing) {
      // Update existing server
      const updateData: Record<string, unknown> = {
        description: description.trim() || undefined,
        enabled,
        endpoint: endpoint.trim(),
        authType: mcpAuthType,
      };

      // Only include token if changed (legacy support)
      if (token.trim()) {
        updateData.token = token.trim();
      }

      const success = await updateServer(server!.id, updateData);
      if (success) {
        onClose();
      }
    } else {
      // For shared auth mode, first create the API Key Provider in AgentCore Identity
      if (mcpAuthMode === 'shared' && sharedApiKey.trim()) {
        const providerResult = await createApiKeyProvider({
          name: credentialProviderName.trim(),
          apiKey: sharedApiKey.trim(),
          displayName: name.trim(),
        });

        if (!providerResult) {
          // Error already set by the context
          return;
        }
      }

      // Parse OAuth scopes
      const scopesArray = mcpOauthScopes
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      // Create new server with AgentCore Identity config
      const result = await createServer({
        name: name.trim(),
        endpoint: mcpSource === 'external' ? endpoint.trim() : '',
        description: description.trim() || undefined,
        // MCP Wrapper specific fields
        serverType: 'mcp-wrapper',
        authType: mcpAuthType,
        // New AgentCore Identity fields
        authMode: mcpAuthMode,
        mcpSource,
        credentialProviderName: credentialProviderName.trim(),
        oauthScopes: mcpAuthMode === 'per_user' && scopesArray.length > 0 ? scopesArray : undefined,
        internalLambdaArn: mcpSource === 'internal' ? internalLambdaArn.trim() : undefined,
        createGatewayTarget,
        // Legacy token support (optional)
        token: token.trim() || undefined,
      });

      if (result) {
        onClose();
      }
    }
  }

  return (
    <div className="maven-modal-overlay" onClick={onClose}>
      <div className="maven-modal maven-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="maven-modal-header">
          <h3>{isEditing ? 'Edit MCP Server' : 'Add MCP Server'}</h3>
          <button className="maven-modal-close" onClick={onClose}>
            <XIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="maven-modal-form">
          {error && (
            <div className="maven-admin-error">
              <AlertIcon />
              <span>{error}</span>
            </div>
          )}

          {/* Server Type Selector (only for new servers) */}
          {!isEditing && (
            <div className="maven-modal-field">
              <label>Server Type</label>
              <div className="maven-modal-type-tabs">
                <button
                  type="button"
                  className={`maven-modal-type-tab ${serverType === 'gateway-target' ? 'active' : ''}`}
                  onClick={() => setServerType('gateway-target')}
                >
                  <ServerIcon />
                  <div>
                    <span className="maven-modal-tab-title">Gateway Target</span>
                    <span className="maven-modal-tab-desc">Direct MCP endpoint</span>
                  </div>
                </button>
                <button
                  type="button"
                  className={`maven-modal-type-tab ${serverType === 'mcp-wrapper' ? 'active' : ''}`}
                  onClick={() => setServerType('mcp-wrapper')}
                >
                  <CpuIcon />
                  <div>
                    <span className="maven-modal-tab-title">MCP Wrapper</span>
                    <span className="maven-modal-tab-desc">Lambda proxy</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Name */}
          <div className="maven-modal-field">
            <label htmlFor="mcp-name">
              Name <span className="maven-modal-required">*</span>
            </label>
            <input
              id="mcp-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isEditing}
              placeholder={serverType === 'mcp-wrapper' ? 'slack' : 'my-mcp-server'}
              required
            />
            <span className="maven-modal-field-hint">
              Unique identifier for this MCP server
            </span>
          </div>

          {/* Endpoint - only for Gateway Target (MCP Wrapper shows URL in MCP Source section) */}
          {serverType === 'gateway-target' && (
            <div className="maven-modal-field">
              <label htmlFor="mcp-endpoint">
                Endpoint URL <span className="maven-modal-required">*</span>
              </label>
              <input
                id="mcp-endpoint"
                type="url"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://mcp.example.com/mcp"
                required
              />
              <span className="maven-modal-field-hint">
                HTTPS endpoint of the MCP server
              </span>
            </div>
          )}

          {/* Description */}
          <div className="maven-modal-field">
            <label htmlFor="mcp-description">
              Description <span className="maven-modal-optional">(optional)</span>
            </label>
            <textarea
              id="mcp-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of this MCP server"
              rows={2}
            />
          </div>

          {/* Gateway Target Enable/Disable Toggle */}
          {serverType === 'gateway-target' && isEditing && (
            <div className="maven-modal-field">
              <div className="maven-modal-checkbox-box maven-modal-toggle-box">
                <div>
                  <label htmlFor="mcp-enabled">Server Status</label>
                  <span className="maven-modal-field-hint">
                    Enable or disable this MCP server
                  </span>
                </div>
                <button
                  type="button"
                  id="mcp-enabled"
                  role="switch"
                  aria-checked={enabled}
                  onClick={() => setEnabled(!enabled)}
                  className={`maven-modal-toggle ${enabled ? 'active' : ''}`}
                >
                  <span className="maven-modal-toggle-knob" />
                </button>
              </div>
            </div>
          )}

          {/* Gateway Target Authentication */}
          {serverType === 'gateway-target' && !isEditing && (
            <div className="maven-modal-section">
              <div className="maven-modal-section-header">
                <ShieldIcon />
                <span>Authentication</span>
              </div>

              {/* Credential Provider Type */}
              <div className="maven-modal-field">
                <label htmlFor="mcp-credential-type">
                  Credential Provider Type
                </label>
                <select
                  id="mcp-credential-type"
                  value={credentialProviderType}
                  onChange={(e) => setCredentialProviderType(e.target.value as CredentialProviderType)}
                >
                  <option value="NONE">None</option>
                  <option value="GATEWAY_IAM_ROLE">Gateway IAM Role</option>
                  <option value="OAUTH">OAuth 2.0</option>
                  <option value="API_KEY">API Key</option>
                </select>
              </div>

              {/* Gateway IAM Role Info */}
              {credentialProviderType === 'GATEWAY_IAM_ROLE' && (
                <div className="maven-modal-info-box">
                  <LockIcon />
                  <p>
                    The Gateway will use its configured IAM role to authenticate with this MCP server.
                    No additional configuration required.
                  </p>
                </div>
              )}

              {/* OAuth Fields */}
              {credentialProviderType === 'OAUTH' && (
                <div className="maven-modal-auth-fields">
                  <OAuthProviderSection
                    selectedProviderId={selectedOAuthProviderId}
                    onSelect={setSelectedOAuthProviderId}
                  />
                  <div className="maven-modal-field">
                    <label htmlFor="mcp-oauth-scopes">
                      Scopes Override <span className="maven-modal-optional">(optional, comma-separated)</span>
                    </label>
                    <input
                      id="mcp-oauth-scopes"
                      type="text"
                      value={oauthScopes}
                      onChange={(e) => setOauthScopes(e.target.value)}
                      placeholder="Leave empty to use provider defaults"
                    />
                    <span className="maven-modal-field-hint">
                      Override the scopes from the OAuth provider (optional)
                    </span>
                  </div>
                </div>
              )}

              {/* API Key Fields */}
              {credentialProviderType === 'API_KEY' && (
                <div className="maven-modal-auth-fields">
                  <div className="maven-modal-field">
                    <label htmlFor="mcp-apikey-arn">
                      API Key Provider ARN <span className="maven-modal-required">*</span>
                    </label>
                    <input
                      id="mcp-apikey-arn"
                      type="text"
                      value={apiKeyProviderArn}
                      onChange={(e) => setApiKeyProviderArn(e.target.value)}
                      placeholder="arn:aws:bedrock:us-east-1:123456789:api-key-credential-provider/..."
                      className="maven-modal-input-mono"
                    />
                    <span className="maven-modal-field-hint">
                      Create API Key providers in AWS Bedrock AgentCore console
                    </span>
                  </div>

                  <div className="maven-modal-field">
                    <label htmlFor="mcp-apikey-location">
                      Credential Location <span className="maven-modal-required">*</span>
                    </label>
                    <select
                      id="mcp-apikey-location"
                      value={apiKeyLocation}
                      onChange={(e) => setApiKeyLocation(e.target.value as CredentialLocation)}
                    >
                      <option value="HEADER">Header</option>
                      <option value="QUERY_PARAMETER">Query Parameter</option>
                    </select>
                  </div>

                  <div className="maven-modal-field">
                    <label htmlFor="mcp-apikey-param">
                      Parameter Name <span className="maven-modal-optional">(optional)</span>
                    </label>
                    <input
                      id="mcp-apikey-param"
                      type="text"
                      value={apiKeyParameterName}
                      onChange={(e) => setApiKeyParameterName(e.target.value)}
                      placeholder="Authorization"
                    />
                    <span className="maven-modal-field-hint">
                      Header or query parameter name for the credential
                    </span>
                  </div>

                  <div className="maven-modal-field">
                    <label htmlFor="mcp-apikey-prefix">
                      Credential Prefix <span className="maven-modal-optional">(optional)</span>
                    </label>
                    <input
                      id="mcp-apikey-prefix"
                      type="text"
                      value={apiKeyPrefix}
                      onChange={(e) => setApiKeyPrefix(e.target.value)}
                      placeholder="Bearer "
                    />
                    <span className="maven-modal-field-hint">
                      Prefix added before the credential value (e.g., "Bearer ")
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MCP Wrapper Configuration */}
          {serverType === 'mcp-wrapper' && (
            <>
              {/* MCP Source */}
              {!isEditing && (
                <div className="maven-modal-section">
                  <div className="maven-modal-section-header">
                    <ServerIcon />
                    <span>MCP Source</span>
                  </div>

                  <div className="maven-modal-field">
                    <label htmlFor="mcp-source">
                      MCP Server Location
                    </label>
                    <select
                      id="mcp-source"
                      value={mcpSource}
                      onChange={(e) => setMcpSource(e.target.value as McpSource)}
                    >
                      <option value="external">External (Third-party MCP server)</option>
                      <option value="internal">Internal (Lambda-hosted MCP server)</option>
                    </select>
                    <span className="maven-modal-field-hint">
                      {mcpSource === 'external'
                        ? 'Connect to an external MCP server (e.g., mcp.example.com)'
                        : 'Use an internal Lambda-based MCP server (e.g., Notion MCP)'}
                    </span>
                  </div>

                  {mcpSource === 'internal' && (
                    <div className="maven-modal-field">
                      <label htmlFor="mcp-lambda-arn">
                        Internal Lambda ARN <span className="maven-modal-required">*</span>
                      </label>
                      <input
                        id="mcp-lambda-arn"
                        type="text"
                        value={internalLambdaArn}
                        onChange={(e) => setInternalLambdaArn(e.target.value)}
                        placeholder="arn:aws:lambda:us-east-1:123456789:function:mcp-notion-dev"
                        className="maven-modal-input-mono"
                      />
                      <span className="maven-modal-field-hint">
                        ARN of the internal MCP Lambda (deploy from mcp-servers/)
                      </span>
                    </div>
                  )}

                  {mcpSource === 'external' && (
                    <div className="maven-modal-field">
                      <label htmlFor="mcp-endpoint">
                        MCP Server URL <span className="maven-modal-required">*</span>
                      </label>
                      <input
                        id="mcp-endpoint"
                        type="url"
                        value={endpoint}
                        onChange={(e) => setEndpoint(e.target.value)}
                        placeholder={
                          mcpAuthType === 'url_embedded'
                            ? 'https://mcp.firecrawl.dev/{API_KEY}/v2/mcp'
                            : 'https://mcp.example.com/mcp'
                        }
                        required
                      />
                      <span className="maven-modal-field-hint">
                        {mcpAuthType === 'url_embedded'
                          ? 'Use {API_KEY} as placeholder for the token in the URL'
                          : 'HTTPS endpoint of the MCP server'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Authentication */}
              <div className="maven-modal-section">
                <div className="maven-modal-section-header">
                  <KeyIcon />
                  <span>Authentication</span>
                </div>

                {/* Auth Mode */}
                {!isEditing && (
                  <div className="maven-modal-field">
                    <label htmlFor="mcp-auth-mode">
                      Authentication Mode <span className="maven-modal-required">*</span>
                    </label>
                    <select
                      id="mcp-auth-mode"
                      value={mcpAuthMode}
                      onChange={(e) => setMcpAuthMode(e.target.value as McpAuthMode)}
                    >
                      <option value="shared">Shared API Key (all users use same credentials)</option>
                      <option value="per_user">Per-User OAuth (each user authenticates)</option>
                    </select>
                    <span className="maven-modal-field-hint">
                      {mcpAuthMode === 'shared'
                        ? 'Single API key shared across all users (from AgentCore API Key Provider)'
                        : 'Each user authenticates via OAuth (from AgentCore Token Vault)'}
                    </span>
                  </div>
                )}

                {/* Credential Provider Name */}
                {!isEditing && (
                  <div className="maven-modal-field">
                    <label htmlFor="mcp-credential-provider">
                      Credential Provider Name <span className="maven-modal-required">*</span>
                    </label>
                    <div className="maven-modal-input-prefixed">
                      <span className="maven-modal-input-prefix">{tenantSlug}-</span>
                      <input
                        id="mcp-credential-provider"
                        type="text"
                        value={credentialProviderName}
                        onChange={(e) => setCredentialProviderName(e.target.value)}
                        placeholder={mcpAuthMode === 'shared' ? 'slack-api-key' : 'notion-oauth'}
                      />
                    </div>
                    <span className="maven-modal-field-hint">
                      Full name: <code>{tenantSlug}-{credentialProviderName || (mcpAuthMode === 'shared' ? 'slack-api-key' : 'notion-oauth')}</code>
                    </span>
                  </div>
                )}

                {/* API Key (for shared auth mode) */}
                {!isEditing && mcpAuthMode === 'shared' && (
                  <div className="maven-modal-field">
                    <label htmlFor="mcp-shared-api-key">
                      API Key <span className="maven-modal-required">*</span>
                    </label>
                    <input
                      id="mcp-shared-api-key"
                      type="password"
                      value={sharedApiKey}
                      onChange={(e) => setSharedApiKey(e.target.value)}
                      placeholder="sk-xxx... or your API token"
                      autoComplete="off"
                    />
                    <span className="maven-modal-field-hint">
                      This key will be stored in AgentCore Identity and used for all requests to this MCP server
                    </span>
                  </div>
                )}

                {/* OAuth Scopes (for per_user mode) */}
                {!isEditing && mcpAuthMode === 'per_user' && (
                  <div className="maven-modal-field">
                    <label htmlFor="mcp-oauth-scopes-wrapper">
                      OAuth Scopes <span className="maven-modal-optional">(comma-separated)</span>
                    </label>
                    <input
                      id="mcp-oauth-scopes-wrapper"
                      type="text"
                      value={mcpOauthScopes}
                      onChange={(e) => setMcpOauthScopes(e.target.value)}
                      placeholder="read_content, insert_content"
                    />
                    <span className="maven-modal-field-hint">
                      OAuth scopes to request from the provider
                    </span>
                  </div>
                )}

                {/* Auth Type (for external MCP) */}
                {mcpSource === 'external' && (
                  <div className="maven-modal-field">
                    <label htmlFor="mcp-auth-type">
                      Token Delivery Method
                    </label>
                    <select
                      id="mcp-auth-type"
                      value={mcpAuthType}
                      onChange={(e) => setMcpAuthType(e.target.value as McpAuthType)}
                    >
                      <option value="bearer">Bearer Token (Authorization header)</option>
                      <option value="url_embedded">URL Embedded (API key in URL)</option>
                    </select>
                    <span className="maven-modal-field-hint">
                      {mcpAuthType === 'bearer'
                        ? 'Token sent as Authorization: Bearer {token} header'
                        : 'Token replaces {API_KEY} in the URL'}
                    </span>
                  </div>
                )}

                {/* Enabled Toggle - only when editing */}
                {isEditing && (
                  <div className="maven-modal-checkbox-box maven-modal-toggle-box">
                    <div>
                      <label htmlFor="mcp-enabled">Server Status</label>
                      <span className="maven-modal-field-hint">
                        Enable or disable this MCP server
                      </span>
                    </div>
                    <button
                      type="button"
                      id="mcp-enabled"
                      role="switch"
                      aria-checked={enabled}
                      onClick={() => setEnabled(!enabled)}
                      className={`maven-modal-toggle ${enabled ? 'active' : ''}`}
                    >
                      <span className="maven-modal-toggle-knob" />
                    </button>
                  </div>
                )}

                {/* Create Gateway Target checkbox - only when creating */}
                {!isEditing && (
                  <div className="maven-modal-checkbox-box">
                    <input
                      type="checkbox"
                      id="mcp-create-gateway"
                      checked={createGatewayTarget}
                      onChange={(e) => setCreateGatewayTarget(e.target.checked)}
                    />
                    <div>
                      <label htmlFor="mcp-create-gateway">
                        Create Gateway Target
                      </label>
                      <span className="maven-modal-field-hint">
                        Automatically create a Lambda ARN target in the Gateway
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Actions */}
          <div className="maven-modal-form-actions">
            <button
              type="submit"
              className="maven-admin-btn maven-admin-btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? (isEditing ? 'Updating...' : 'Creating...')
                : (isEditing ? 'Update Server' : 'Create Server')}
            </button>
            <button
              type="button"
              className="maven-admin-btn maven-admin-btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
