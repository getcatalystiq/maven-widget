/**
 * MCP (Model Context Protocol) type definitions
 * Based on MCP Specification and TypeScript SDK
 * @see https://modelcontextprotocol.io/specification
 */

// ============================================================================
// JSON-RPC 2.0 Base Types
// ============================================================================

export interface MCPRequest<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: T;
}

export interface MCPSuccessResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  result: T;
}

export interface MCPErrorResponse {
  jsonrpc: '2.0';
  id: string | number;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Discriminated union - use everywhere, never MCPResponse<any>
export type MCPResponse<T = unknown> = MCPSuccessResponse<T> | MCPErrorResponse;

// Type guard - mandatory for safe narrowing
export function isMCPError(response: MCPResponse): response is MCPErrorResponse {
  return 'error' in response;
}

export function isMCPSuccess<T>(response: MCPResponse<T>): response is MCPSuccessResponse<T> {
  return 'result' in response;
}

// ============================================================================
// MCP Error Codes (JSON-RPC + MCP-specific)
// ============================================================================

export const MCPErrorCodes = {
  // Standard JSON-RPC errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // MCP-specific errors
  CONNECTION_CLOSED: -32000,
  REQUEST_TIMEOUT: -32001,
  NOT_INITIALIZED: -32002,
} as const;

export type MCPErrorCode = typeof MCPErrorCodes[keyof typeof MCPErrorCodes];

// ============================================================================
// MCP Tool Types
// ============================================================================

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: MCPToolInputSchema;
}

export interface MCPToolInputSchema {
  type: 'object';
  properties?: Record<string, MCPPropertySchema>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface MCPPropertySchema {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: (string | number)[];
  items?: MCPPropertySchema;
  properties?: Record<string, MCPPropertySchema>;
  required?: string[];
  default?: unknown;
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResult {
  content: MCPContent[];
  isError?: boolean;
  _meta?: Record<string, unknown>;  // Private metadata, not visible to model
}

// ============================================================================
// MCP Content Types
// ============================================================================

export type MCPContent = MCPTextContent | MCPImageContent | MCPResourceContent;

export interface MCPTextContent {
  type: 'text';
  text: string;
}

export interface MCPImageContent {
  type: 'image';
  data: string;  // Base64-encoded image data
  mimeType: string;
}

export interface MCPResourceContent {
  type: 'resource';
  resource: MCPResource;
}

// ============================================================================
// MCP Resource Types
// ============================================================================

export interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface MCPResourceTemplate {
  uriTemplate: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface MCPResourceContents {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;  // Base64-encoded binary data
}

// ============================================================================
// MCP Capabilities
// ============================================================================

export interface MCPServerCapabilities {
  tools?: MCPToolCapability;
  resources?: MCPResourceCapability;
  prompts?: MCPPromptCapability;
  logging?: Record<string, never>;  // Empty object indicates support
  experimental?: Record<string, unknown>;
}

export interface MCPToolCapability {
  listChanged?: boolean;  // Server supports tools/listChanged notifications
}

export interface MCPResourceCapability {
  subscribe?: boolean;  // Server supports resource subscriptions
  listChanged?: boolean;
}

export interface MCPPromptCapability {
  listChanged?: boolean;
}

export interface MCPClientCapabilities {
  roots?: {
    listChanged?: boolean;
  };
  sampling?: Record<string, never>;
  experimental?: Record<string, unknown>;
}

// ============================================================================
// MCP Initialize Types
// ============================================================================

export interface MCPInitializeRequest {
  protocolVersion: string;
  capabilities: MCPClientCapabilities;
  clientInfo: {
    name: string;
    version: string;
  };
}

export interface MCPInitializeResponse {
  protocolVersion: string;
  capabilities: MCPServerCapabilities;
  serverInfo: {
    name: string;
    version: string;
  };
  instructions?: string;
}

// ============================================================================
// MCP List Types
// ============================================================================

export interface MCPListToolsResponse {
  tools: MCPTool[];
  nextCursor?: string;
}

export interface MCPListResourcesResponse {
  resources: MCPResource[];
  nextCursor?: string;
}

export interface MCPListResourceTemplatesResponse {
  resourceTemplates: MCPResourceTemplate[];
  nextCursor?: string;
}

// ============================================================================
// MCP Connection State
// ============================================================================

export type MCPConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'auth_required';

export interface MCPConnectionState {
  status: MCPConnectionStatus;
  serverUrl: string;
  serverInfo?: {
    name: string;
    version: string;
  };
  capabilities?: MCPServerCapabilities;
  error?: string;
  lastConnected?: Date;
}

// ============================================================================
// OAuth Types for MCP
// ============================================================================

export interface MCPOAuthConfig {
  serverUrl: string;
  clientId: string;
  redirectUri: string;
  scopes?: string[];
}

export interface MCPOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt?: Date;
  scope?: string;
  resourceUri: string;  // RFC 8707 resource binding
}

export interface MCPResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported?: string[];
}

export interface MCPAuthServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  token_endpoint_auth_methods_supported?: string[];
  code_challenge_methods_supported?: string[];
  scopes_supported?: string[];
}
