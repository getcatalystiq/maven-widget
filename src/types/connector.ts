/**
 * Connector types for the widget.
 * Matches the API response from GET /tenants/{id}/connectors/user-status
 */

export interface Connector {
  id: string;
  name: string;
  slug: string;
  description?: string;
  mcp_server_url: string;
  /** True if connector has client_id configured (requires OAuth) */
  requires_oauth: boolean;
  /** True if this connector is an OpenAI app with visual components */
  show_in_widget?: boolean;
  /** Icon for the connector (emoji or Lucide icon name) */
  icon?: string;
  /** True if user has a valid token for this connector */
  connected: boolean;
  /** Token expiration timestamp (ISO format) */
  expires_at?: string;
  /** When user connected (ISO format) */
  connected_at?: string;
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
