import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import type { Connector, ConnectorsState, ConnectorsAction } from '../types/connector';
import { useOAuthCallback } from '../hooks/useOAuthCallback';

interface ConnectorsContextValue extends ConnectorsState {
  connect: (connectorId: string) => Promise<void>;
  disconnect: (connectorId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const ConnectorsContext = createContext<ConnectorsContextValue | null>(null);

const initialState: ConnectorsState = {
  connectors: [],
  loading: false,
  error: null,
  connectingId: null,
  disconnectingId: null,
};

function connectorsReducer(state: ConnectorsState, action: ConnectorsAction): ConnectorsState {
  switch (action.type) {
    case 'LOADING':
      return { ...state, loading: true, error: null };
    case 'LOADED':
      return { ...state, loading: false, connectors: action.connectors };
    case 'ERROR':
      return { ...state, loading: false, error: action.error };
    case 'CONNECTING':
      return { ...state, connectingId: action.connectorId, error: null };
    case 'CONNECT_SUCCESS':
      return { ...state, connectingId: null };
    case 'CONNECT_ERROR':
      return { ...state, connectingId: null, error: action.error };
    case 'DISCONNECTING':
      return { ...state, disconnectingId: action.connectorId, error: null };
    case 'DISCONNECT_SUCCESS':
      return { ...state, disconnectingId: null };
    case 'DISCONNECT_ERROR':
      return { ...state, disconnectingId: null, error: action.error };
    default:
      return state;
  }
}

interface ConnectorsProviderProps {
  children: ReactNode;
  controlPlaneUrl: string;
  getToken?: () => Promise<string>;
}

export function ConnectorsProvider({
  children,
  controlPlaneUrl,
  getToken,
}: ConnectorsProviderProps) {
  const [state, dispatch] = useReducer(connectorsReducer, initialState);

  // Helper to make authenticated requests to control plane widget API
  const callApi = useCallback(
    async <T,>(method: string, path: string, body?: object): Promise<T> => {
      const url = `${controlPlaneUrl}/widget${path}`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (getToken) {
        const token = await getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
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
    [controlPlaneUrl, getToken]
  );

  // Fetch connectors with user connection status (userId from JWT)
  const refresh = useCallback(async () => {
    dispatch({ type: 'LOADING' });
    try {
      const data = await callApi<{ connectors: Connector[] }>(
        'GET',
        '/connectors'
      );
      dispatch({ type: 'LOADED', connectors: data.connectors || [] });
    } catch (error) {
      console.error('[Connectors] Error loading connectors:', error);
      dispatch({ type: 'ERROR', error: (error as Error).message });
    }
  }, [callApi]);

  // Connect user to a connector via OAuth
  const connect = useCallback(async (connectorId: string) => {
    dispatch({ type: 'CONNECTING', connectorId });
    try {
      // Build OAuth callback URL (same origin)
      const redirectUri = `${window.location.origin}/oauth/callback`;

      // Initiate OAuth flow to get authorization URL
      const data = await callApi<{ authorizationUrl: string }>(
        'POST',
        `/connectors/${connectorId}/oauth/initiate`,
        { redirectUri }
      );

      if (data.authorizationUrl) {
        // Open OAuth popup
        const popup = window.open(
          data.authorizationUrl,
          'maven_oauth',
          'width=600,height=700,popup'
        );

        if (!popup) {
          throw new Error('Popup blocked by browser. Please allow popups for this site.');
        }

        console.log('[Connectors] OAuth popup opened for connector:', connectorId);
        // The useOAuthCallback hook will handle the postMessage from the popup
      } else {
        throw new Error('No authorization URL returned');
      }
    } catch (error) {
      console.error('[Connectors] Error connecting:', error);
      dispatch({ type: 'CONNECT_ERROR', connectorId, error: (error as Error).message });
    }
  }, [callApi]);

  // Disconnect user from a connector (userId from JWT)
  const disconnect = useCallback(async (connectorId: string) => {
    dispatch({ type: 'DISCONNECTING', connectorId });
    try {
      await callApi<{ disconnected: boolean }>(
        'POST',
        `/connectors/${connectorId}/disconnect`
      );
      dispatch({ type: 'DISCONNECT_SUCCESS', connectorId });
      // Refresh to get updated status
      await refresh();
    } catch (error) {
      console.error('[Connectors] Error disconnecting:', error);
      dispatch({ type: 'DISCONNECT_ERROR', connectorId, error: (error as Error).message });
    }
  }, [callApi, refresh]);

  // Handle OAuth callback (success/error from popup)
  useOAuthCallback({
    onSuccess: () => {
      console.log('[Connectors] OAuth success, refreshing...');
      dispatch({ type: 'CONNECT_SUCCESS', connectorId: state.connectingId || '' });
      refresh();
    },
    onError: (result) => {
      console.error('[Connectors] OAuth error:', result.error);
      dispatch({
        type: 'CONNECT_ERROR',
        connectorId: state.connectingId || '',
        error: result.error || 'OAuth failed',
      });
    },
  });

  // Initial load
  useEffect(() => {
    refresh();
  }, []); // Only run once on mount

  // Refresh on window focus
  useEffect(() => {
    const handleFocus = () => {
      refresh();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refresh]);

  const value: ConnectorsContextValue = {
    ...state,
    connect,
    disconnect,
    refresh,
  };

  return (
    <ConnectorsContext.Provider value={value}>
      {children}
    </ConnectorsContext.Provider>
  );
}

export function useConnectors() {
  const context = useContext(ConnectorsContext);
  if (!context) {
    throw new Error('useConnectors must be used within ConnectorsProvider');
  }
  return context;
}
