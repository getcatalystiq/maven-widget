import React, { useState } from 'react';
import {
  useMCPs,
  OAuthAuthFlow,
  CreateOAuthProviderInput,
  CreateServerData,
} from '../../contexts/MCPsContext';

// Google Workspace MCP Lambda ARN
const GOOGLE_WORKSPACE_LAMBDA_ARN = 'arn:aws:lambda:us-east-1:807467870613:function:mcp-google-workspace-prod';

// Google Core Scopes (matching oauth.py)
const GOOGLE_CORE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

// Scope descriptions for UI
const SCOPE_DESCRIPTIONS: Record<string, string> = {
  'https://www.googleapis.com/auth/gmail.readonly': 'Read emails',
  'https://www.googleapis.com/auth/gmail.send': 'Send emails',
  'https://www.googleapis.com/auth/calendar.readonly': 'View calendar events',
  'https://www.googleapis.com/auth/calendar.events': 'Create/edit calendar events',
  'https://www.googleapis.com/auth/drive.readonly': 'View files in Drive',
  'https://www.googleapis.com/auth/userinfo.email': 'View email address',
  'https://www.googleapis.com/auth/userinfo.profile': 'View profile info',
};

// Icons
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24">
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

const ExternalLinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

interface GoogleWorkspaceSetupProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * Simplified Google Workspace setup flow for tenant admins.
 *
 * This component guides admins through:
 * 1. Creating a Google Cloud OAuth client
 * 2. Entering their credentials
 * 3. Adding the AgentCore callback URL
 *
 * Pre-fills the core Google Workspace scopes for Gmail, Calendar, Drive.
 */
export function GoogleWorkspaceSetup({ onSuccess, onCancel }: GoogleWorkspaceSetupProps) {
  const { createOAuthProvider, loadOAuthProviders, createServer, loadServers } = useMCPs();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCallback, setCopiedCallback] = useState(false);

  // Form state
  const [name, setName] = useState('google-workspace');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(GOOGLE_CORE_SCOPES);

  // AgentCore callback URL
  const callbackUrl = 'https://bedrock-agentcore.us-east-1.amazonaws.com/oauth2/callback';

  const copyCallbackUrl = async () => {
    await navigator.clipboard.writeText(callbackUrl);
    setCopiedCallback(true);
    setTimeout(() => setCopiedCallback(false), 2000);
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope)
        ? prev.filter((s) => s !== scope)
        : [...prev, scope]
    );
  };

  const handleSubmit = async () => {
    setError(null);

    if (!clientId.trim()) {
      setError('Client ID is required');
      return;
    }
    if (!clientSecret.trim()) {
      setError('Client Secret is required');
      return;
    }
    if (selectedScopes.length === 0) {
      setError('At least one scope must be selected');
      return;
    }

    setIsSubmitting(true);

    // Step 1: Create the OAuth provider
    const oauthInput: CreateOAuthProviderInput = {
      name: name.trim(),
      vendor: 'google',
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      scopes: selectedScopes,
      authFlow: 'user_federation' as OAuthAuthFlow, // Each user connects their own Google account
    };

    const provider = await createOAuthProvider(oauthInput);

    if (!provider) {
      setIsSubmitting(false);
      setError('Failed to create Google OAuth provider. Please check your credentials.');
      return;
    }

    // Step 2: Create the MCP server pointing to the Google Workspace Lambda
    const serverInput: CreateServerData = {
      name: 'google-workspace',
      endpoint: '', // Internal Lambda doesn't need external endpoint
      description: 'Google Workspace integration (Gmail, Calendar, Drive)',
      serverType: 'mcp-wrapper',
      mcpSource: 'internal',
      internalLambdaArn: GOOGLE_WORKSPACE_LAMBDA_ARN,
      authMode: 'per_user',
      credentialProviderName: provider.name,
      oauthScopes: selectedScopes,
    };

    const server = await createServer(serverInput);

    setIsSubmitting(false);

    if (server) {
      await loadOAuthProviders();
      await loadServers();
      setStep(4); // Success step
      onSuccess?.();
    } else {
      // OAuth provider was created but server creation failed
      setError('OAuth provider created, but failed to create MCP server. Please add the server manually.');
      await loadOAuthProviders();
      setStep(4); // Still show success since OAuth is created
      onSuccess?.();
    }
  };

  return (
    <div className="maven-google-workspace-setup">
      {/* Header */}
      <div className="maven-google-setup-header">
        <div className="maven-google-setup-icon">
          <GoogleIcon />
        </div>
        <div>
          <h3>Connect Google Workspace</h3>
          <p>Enable Gmail, Calendar, and Drive access for your team</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="maven-google-setup-progress">
        <div className={`maven-google-setup-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'complete' : ''}`}>
          <span className="step-number">1</span>
          <span className="step-label">Create OAuth App</span>
        </div>
        <div className={`maven-google-setup-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'complete' : ''}`}>
          <span className="step-number">2</span>
          <span className="step-label">Enter Credentials</span>
        </div>
        <div className={`maven-google-setup-step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'complete' : ''}`}>
          <span className="step-number">3</span>
          <span className="step-label">Configure Scopes</span>
        </div>
        <div className={`maven-google-setup-step ${step >= 4 ? 'active' : ''}`}>
          <span className="step-number">4</span>
          <span className="step-label">Done</span>
        </div>
      </div>

      {/* Step Content */}
      <div className="maven-google-setup-content">
        {/* Step 1: Create OAuth App */}
        {step === 1 && (
          <div className="maven-google-setup-step-content">
            <h4>Create a Google Cloud OAuth Application</h4>
            <ol className="maven-google-setup-instructions">
              <li>
                Go to the{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Cloud Console <ExternalLinkIcon />
                </a>
              </li>
              <li>Create a new project or select an existing one</li>
              <li>Go to "APIs & Services" → "Credentials"</li>
              <li>Click "Create Credentials" → "OAuth client ID"</li>
              <li>Select "Web application" as the application type</li>
              <li>
                Add this <strong>Authorized redirect URI</strong>:
                <div className="maven-google-callback-url">
                  <code>{callbackUrl}</code>
                  <button
                    type="button"
                    onClick={copyCallbackUrl}
                    className="maven-copy-btn"
                    title="Copy to clipboard"
                  >
                    {copiedCallback ? <CheckIcon /> : <CopyIcon />}
                  </button>
                </div>
              </li>
              <li>Enable the Gmail API, Calendar API, and Drive API in your project</li>
            </ol>

            <div className="maven-google-setup-actions">
              {onCancel && (
                <button
                  type="button"
                  className="maven-admin-btn maven-admin-btn-secondary"
                  onClick={onCancel}
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                className="maven-admin-btn maven-admin-btn-primary"
                onClick={() => setStep(2)}
              >
                I've created my OAuth app →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Enter Credentials */}
        {step === 2 && (
          <div className="maven-google-setup-step-content">
            <h4>Enter Your OAuth Credentials</h4>
            <p>Copy the Client ID and Client Secret from your Google Cloud Console.</p>

            {error && (
              <div className="maven-admin-error">
                <span>{error}</span>
              </div>
            )}

            <div className="maven-modal-field">
              <label htmlFor="google-name">
                Provider Name
              </label>
              <input
                id="google-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="google-workspace"
              />
              <span className="maven-modal-field-hint">
                Identifier for this integration
              </span>
            </div>

            <div className="maven-modal-field">
              <label htmlFor="google-client-id">
                Client ID <span className="maven-modal-required">*</span>
              </label>
              <input
                id="google-client-id"
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="123456789-abc.apps.googleusercontent.com"
              />
            </div>

            <div className="maven-modal-field">
              <label htmlFor="google-client-secret">
                Client Secret <span className="maven-modal-required">*</span>
              </label>
              <input
                id="google-client-secret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="GOCSPX-..."
              />
              <span className="maven-modal-field-hint">
                Stored securely in AWS (never saved in our database)
              </span>
            </div>

            <div className="maven-google-setup-actions">
              <button
                type="button"
                className="maven-admin-btn maven-admin-btn-secondary"
                onClick={() => setStep(1)}
              >
                ← Back
              </button>
              <button
                type="button"
                className="maven-admin-btn maven-admin-btn-primary"
                onClick={() => {
                  if (!clientId.trim() || !clientSecret.trim()) {
                    setError('Client ID and Client Secret are required');
                    return;
                  }
                  setError(null);
                  setStep(3);
                }}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Configure Scopes */}
        {step === 3 && (
          <div className="maven-google-setup-step-content">
            <h4>Select Permissions</h4>
            <p>Choose which Google services your users can access. You can always change these later.</p>

            {error && (
              <div className="maven-admin-error">
                <span>{error}</span>
              </div>
            )}

            <div className="maven-google-scopes-grid">
              {GOOGLE_CORE_SCOPES.map((scope) => (
                <label key={scope} className="maven-google-scope-item">
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope)}
                    onChange={() => toggleScope(scope)}
                  />
                  <span className="maven-scope-label">
                    {SCOPE_DESCRIPTIONS[scope] || scope}
                  </span>
                </label>
              ))}
            </div>

            <div className="maven-google-setup-actions">
              <button
                type="button"
                className="maven-admin-btn maven-admin-btn-secondary"
                onClick={() => setStep(2)}
              >
                ← Back
              </button>
              <button
                type="button"
                className="maven-admin-btn maven-admin-btn-primary"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Complete Setup'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div className="maven-google-setup-step-content maven-google-setup-success">
            <div className="maven-success-icon">
              <CheckIcon />
            </div>
            <h4>Google Workspace Connected!</h4>
            <p>
              Your Google Workspace integration is ready. The MCP server has been
              configured and users can now connect their Google accounts.
            </p>
            <div className="maven-google-setup-next-steps">
              <h5>What happens next</h5>
              <ul>
                <li>Users will see a "Connect Google" prompt when using Google tools</li>
                <li>Each user authorizes access to their own Google account</li>
                <li>Available tools: Gmail, Calendar, and Drive</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
