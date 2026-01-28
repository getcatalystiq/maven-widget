/**
 * Connector types for the widget.
 * Matches the API response from GET /widget/connectors
 */

export interface Connector {
  id: string;
  name: string;
  description: string | null;
  mcpServerUrl: string | null;
  /** True if connector has oauthClientId configured (requires OAuth) */
  requiresOauth: boolean;
  /** True if user has a valid token for this connector */
  connected: boolean;
  /** Token expiration timestamp (ISO format) */
  expiresAt: string | null;
}

export interface ConnectorsState {
  connectors: Connector[];
  loading: boolean;
  error: string | null;
  /** ID of connector currently being connected */
  connectingId: string | null;
  /** ID of connector currently being disconnected */
  disconnectingId: string | null;
}

export type ConnectorsAction =
  | { type: 'LOADING' }
  | { type: 'LOADED'; connectors: Connector[] }
  | { type: 'ERROR'; error: string }
  | { type: 'CONNECTING'; connectorId: string }
  | { type: 'CONNECT_SUCCESS'; connectorId: string }
  | { type: 'CONNECT_ERROR'; connectorId: string; error: string }
  | { type: 'DISCONNECTING'; connectorId: string }
  | { type: 'DISCONNECT_SUCCESS'; connectorId: string }
  | { type: 'DISCONNECT_ERROR'; connectorId: string; error: string };
