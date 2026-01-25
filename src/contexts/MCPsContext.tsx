import React, { createContext, useContext, useReducer, useCallback, ReactNode, useState } from 'react';

// Types
export type CredentialProviderType = 'NONE' | 'GATEWAY_IAM_ROLE' | 'OAUTH' | 'API_KEY';
export type CredentialLocation = 'HEADER' | 'QUERY_PARAMETER';
export type OAuthAuthFlow = 'tenant' | 'user_federation';

export interface CredentialProviderConfig {
  type: CredentialProviderType;
  oauth?: {
    providerArn: string;
    scopes: string[];
  };
  apiKey?: {
    providerArn: string;
    credentialLocation: CredentialLocation;
    credentialParameterName?: string;
    credentialPrefix?: string;
  };
}

export interface CreateServerData {
  name: string;
  endpoint: string;
  description?: string;
  credentialProvider?: CredentialProviderConfig;
  serverType?: 'gateway-target' | 'mcp-wrapper';
  authType?: 'bearer' | 'url_embedded';
  token?: string;
  createGatewayTarget?: boolean;
  authMode?: 'shared' | 'per_user';
  mcpSource?: 'external' | 'internal';
  credentialProviderName?: string;
  providerArn?: string;
  oauthScopes?: string[];
  internalLambdaArn?: string;
}

export interface MCPServer {
  id: string;
  name: string;
  type: 'gateway-target' | 'mcp-wrapper';
  endpoint: string;
  status: string;
  enabled: boolean;
  description?: string;
  targetId?: string;
  gatewayId?: string;
  credentialProvider?: CredentialProviderConfig[];
  connectionKey?: string;
  authType?: 'bearer' | 'url_embedded';
  schemaSynced?: boolean;
  toolsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface MCPsState {
  servers: MCPServer[];
  selectedServer: MCPServer | null;
  isLoading: boolean;
  error: string | null;
}

type MCPsAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SERVERS'; payload: MCPServer[] }
  | { type: 'SET_SELECTED_SERVER'; payload: MCPServer | null }
  | { type: 'ADD_SERVER'; payload: MCPServer }
  | { type: 'UPDATE_SERVER'; payload: MCPServer }
  | { type: 'REMOVE_SERVER'; payload: string };

interface SyncResult {
  id: string;
  name: string;
  success: boolean;
  toolsCount: number;
}

// OAuth Provider types
export interface OAuthProvider {
  id: string;
  tenant_id: string;
  name: string;
  display_name?: string;
  displayName?: string;
  vendor: string;
  provider_arn?: string;
  callback_url?: string;
  client_id: string;
  authorization_url?: string;
  token_url?: string;
  scopes: string[];
  auth_flow: OAuthAuthFlow;
  created_at?: string;
  updated_at?: string;
}

export interface ApiKeyProvider {
  name: string;
  display_name?: string;
  provider_arn?: string;
  provider_type: string;
  fullName?: string;
  mcp_name?: string;
}

export interface CreateApiKeyProviderInput {
  name: string;
  apiKey: string;
  displayName?: string;
}

export interface OAuthVendor {
  value: string;
  label: string;
}

export interface CreateOAuthProviderInput {
  name: string;
  vendor: string;
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  authFlow?: OAuthAuthFlow;
  displayName?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  microsoftTenantId?: string;
}

interface MCPsContextValue {
  state: MCPsState;
  tenantSlug: string;
  adminApiUrl: string;
  getToken?: () => Promise<string>;
  loadServers: () => Promise<void>;
  createServer: (data: CreateServerData) => Promise<MCPServer | null>;
  updateServer: (id: string, data: {
    description?: string;
    enabled?: boolean;
    endpoint?: string;
    authType?: string;
    token?: string;
  }) => Promise<boolean>;
  deleteServer: (id: string) => Promise<boolean>;
  syncServer: (id: string, name?: string) => Promise<SyncResult | null>;
  selectServer: (server: MCPServer | null) => void;

  oauthProviders: OAuthProvider[];
  oauthVendors: OAuthVendor[];
  loadOAuthProviders: () => Promise<void>;
  loadOAuthVendors: () => Promise<void>;
  createOAuthProvider: (input: CreateOAuthProviderInput) => Promise<OAuthProvider | null>;
  deleteOAuthProvider: (id: string) => Promise<boolean>;
  oauthProvidersLoading: boolean;

  apiKeyProviders: ApiKeyProvider[];
  loadApiKeyProviders: () => Promise<void>;
  createApiKeyProvider: (input: CreateApiKeyProviderInput) => Promise<ApiKeyProvider | null>;
  deleteApiKeyProvider: (name: string) => Promise<boolean>;
  apiKeyProvidersLoading: boolean;
}

const MCPsContext = createContext<MCPsContextValue | null>(null);

const initialState: MCPsState = {
  servers: [],
  selectedServer: null,
  isLoading: false,
  error: null,
};

function mcpsReducer(state: MCPsState, action: MCPsAction): MCPsState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_SERVERS':
      return { ...state, servers: action.payload };
    case 'SET_SELECTED_SERVER':
      return { ...state, selectedServer: action.payload };
    case 'ADD_SERVER':
      return { ...state, servers: [action.payload, ...state.servers] };
    case 'UPDATE_SERVER':
      return {
        ...state,
        servers: state.servers.map((s) => (s.id === action.payload.id ? action.payload : s)),
        selectedServer: state.selectedServer?.id === action.payload.id ? action.payload : state.selectedServer,
      };
    case 'REMOVE_SERVER':
      return {
        ...state,
        servers: state.servers.filter((s) => s.id !== action.payload),
        selectedServer: state.selectedServer?.id === action.payload ? null : state.selectedServer,
      };
    default:
      return state;
  }
}

interface MCPsProviderProps {
  children: ReactNode;
  tenantId: string;
  tenantSlug: string;
  adminApiUrl: string;
  getToken?: () => Promise<string>;
}

/**
 * MCPsProvider - uses Admin API for all MCP operations.
 * Widget calls admin API directly, no longer goes through agent.
 *
 * Note: Admin API endpoints for MCPs need to be implemented:
 * - GET /tenants/{id}/mcps
 * - POST /tenants/{id}/mcps
 * - PUT /tenants/{id}/mcps/{server_id}
 * - DELETE /tenants/{id}/mcps/{server_id}
 * - POST /tenants/{id}/mcps/{server_id}/sync
 * - GET/POST/DELETE /tenants/{id}/oauth-providers
 * - GET /tenants/{id}/oauth-vendors
 * - GET/POST/DELETE /tenants/{id}/api-key-providers
 */
export function MCPsProvider({
  children,
  tenantId,
  tenantSlug,
  adminApiUrl,
  getToken,
}: MCPsProviderProps) {
  const [state, dispatch] = useReducer(mcpsReducer, initialState);

  // OAuth state
  const [oauthProviders, setOAuthProviders] = useState<OAuthProvider[]>([]);
  const [oauthVendors, setOAuthVendors] = useState<OAuthVendor[]>([]);
  const [oauthProvidersLoading, setOAuthProvidersLoading] = useState(false);

  // API Key Provider state
  const [apiKeyProviders, setApiKeyProviders] = useState<ApiKeyProvider[]>([]);
  const [apiKeyProvidersLoading, setApiKeyProvidersLoading] = useState(false);

  // Helper to make authenticated requests to admin API
  const callAdminApi = useCallback(
    async <T,>(method: string, path: string, body?: object): Promise<T> => {
      const url = `${adminApiUrl}/tenants/${tenantId}${path}`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (getToken) {
        const token = await getToken();
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Request failed');
      }

      return data;
    },
    [adminApiUrl, tenantId, getToken]
  );

  // MCP Server operations
  const loadServers = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const data = await callAdminApi<{ servers: MCPServer[] }>('GET', '/mcps');
      dispatch({ type: 'SET_SERVERS', payload: data.servers || [] });
    } catch (error) {
      console.error('[MCPs] Error loading servers:', error);
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [callAdminApi]);

  const createServer = useCallback(async (data: CreateServerData): Promise<MCPServer | null> => {
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const result = await callAdminApi<MCPServer>('POST', '/mcps', data);
      if (result) {
        dispatch({ type: 'ADD_SERVER', payload: result });
        return result;
      }
      return null;
    } catch (error) {
      console.error('[MCPs] Error creating server:', error);
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
      return null;
    }
  }, [callAdminApi]);

  const updateServer = useCallback(async (id: string, data: {
    description?: string;
    enabled?: boolean;
    endpoint?: string;
    authType?: string;
    token?: string;
  }): Promise<boolean> => {
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const result = await callAdminApi<MCPServer>('PUT', `/mcps/${id}`, data);
      if (result) {
        dispatch({ type: 'UPDATE_SERVER', payload: result });
        return true;
      }
      return false;
    } catch (error) {
      console.error('[MCPs] Error updating server:', error);
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
      return false;
    }
  }, [callAdminApi]);

  const deleteServer = useCallback(async (id: string): Promise<boolean> => {
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      await callAdminApi<{ deleted: boolean }>('DELETE', `/mcps/${id}`);
      dispatch({ type: 'REMOVE_SERVER', payload: id });
      return true;
    } catch (error) {
      console.error('[MCPs] Error deleting server:', error);
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
      return false;
    }
  }, [callAdminApi]);

  const syncServer = useCallback(async (id: string, name?: string): Promise<SyncResult | null> => {
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const result = await callAdminApi<SyncResult>('POST', `/mcps/${id}/sync`, { name });
      if (result) {
        // Reload servers to get updated schema info
        await loadServers();
        return result;
      }
      return null;
    } catch (error) {
      console.error('[MCPs] Error syncing server:', error);
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
      return null;
    }
  }, [callAdminApi, loadServers]);

  const selectServer = useCallback((server: MCPServer | null) => {
    dispatch({ type: 'SET_SELECTED_SERVER', payload: server });
  }, []);

  // OAuth Provider operations
  const loadOAuthProviders = useCallback(async () => {
    setOAuthProvidersLoading(true);
    try {
      const data = await callAdminApi<{ providers: OAuthProvider[] }>('GET', '/oauth-providers');
      setOAuthProviders(data.providers || []);
    } catch (error) {
      console.error('[MCPs] Error loading OAuth providers:', error);
    } finally {
      setOAuthProvidersLoading(false);
    }
  }, [callAdminApi]);

  const loadOAuthVendors = useCallback(async () => {
    try {
      const data = await callAdminApi<{ vendors: OAuthVendor[] }>('GET', '/oauth-vendors');
      setOAuthVendors(data.vendors || []);
    } catch (error) {
      console.error('[MCPs] Error loading OAuth vendors:', error);
    }
  }, [callAdminApi]);

  const createOAuthProvider = useCallback(async (input: CreateOAuthProviderInput): Promise<OAuthProvider | null> => {
    try {
      const result = await callAdminApi<OAuthProvider>('POST', '/oauth-providers', input);
      if (result) {
        await loadOAuthProviders();
        return result;
      }
      return null;
    } catch (error) {
      console.error('[MCPs] Error creating OAuth provider:', error);
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
      return null;
    }
  }, [callAdminApi, loadOAuthProviders]);

  const deleteOAuthProvider = useCallback(async (id: string): Promise<boolean> => {
    try {
      await callAdminApi<{ deleted: boolean }>('DELETE', `/oauth-providers/${id}`);
      await loadOAuthProviders();
      return true;
    } catch (error) {
      console.error('[MCPs] Error deleting OAuth provider:', error);
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
      return false;
    }
  }, [callAdminApi, loadOAuthProviders]);

  // API Key Provider operations
  const loadApiKeyProviders = useCallback(async () => {
    setApiKeyProvidersLoading(true);
    try {
      const data = await callAdminApi<{ providers: ApiKeyProvider[] }>('GET', '/api-key-providers');
      setApiKeyProviders(data.providers || []);
    } catch (error) {
      console.error('[MCPs] Error loading API key providers:', error);
    } finally {
      setApiKeyProvidersLoading(false);
    }
  }, [callAdminApi]);

  const createApiKeyProvider = useCallback(async (input: CreateApiKeyProviderInput): Promise<ApiKeyProvider | null> => {
    try {
      const result = await callAdminApi<ApiKeyProvider>('POST', '/api-key-providers', input);
      if (result) {
        await loadApiKeyProviders();
        return result;
      }
      return null;
    } catch (error) {
      console.error('[MCPs] Error creating API key provider:', error);
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
      return null;
    }
  }, [callAdminApi, loadApiKeyProviders]);

  const deleteApiKeyProvider = useCallback(async (name: string): Promise<boolean> => {
    try {
      await callAdminApi<{ deleted: boolean }>('DELETE', `/api-key-providers/${encodeURIComponent(name)}`);
      await loadApiKeyProviders();
      return true;
    } catch (error) {
      console.error('[MCPs] Error deleting API key provider:', error);
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
      return false;
    }
  }, [callAdminApi, loadApiKeyProviders]);

  const value: MCPsContextValue = {
    state,
    tenantSlug,
    adminApiUrl,
    getToken,
    loadServers,
    createServer,
    updateServer,
    deleteServer,
    syncServer,
    selectServer,

    oauthProviders,
    oauthVendors,
    loadOAuthProviders,
    loadOAuthVendors,
    createOAuthProvider,
    deleteOAuthProvider,
    oauthProvidersLoading,

    apiKeyProviders,
    loadApiKeyProviders,
    createApiKeyProvider,
    deleteApiKeyProvider,
    apiKeyProvidersLoading,
  };

  return <MCPsContext.Provider value={value}>{children}</MCPsContext.Provider>;
}

export function useMCPs() {
  const context = useContext(MCPsContext);
  if (!context) {
    throw new Error('useMCPs must be used within MCPsProvider');
  }
  return context;
}
