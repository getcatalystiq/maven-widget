export interface MavenWidgetConfig {
  tenantId?: string;  // UUID for admin API calls (returned from config endpoint)
  tenantSlug: string;
  apiUrl?: string;
  agentUrl?: string; // Direct agent URL (bypasses discovery, useful for local dev)
  themeMode?: 'light' | 'dark' | 'auto'; // Color scheme: 'light', 'dark', or 'auto' (follows system preference)
  theme?: {
    primaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
  };
  greeting?: string;
  placeholder?: string;
  avatar?: string;
  title?: string;
  subtitle?: string;
  skills?: Skill[];
  autoOpenDelay?: number;
  userId?: string;
  userName?: string;  // Display name for the authenticated user
  role?: string;
  pagePattern?: string;
  token?: string; // Deprecated: use getToken instead
  getToken?: () => Promise<string>;
  enableVoiceInput?: boolean; // Requires host site to allow microphone via Permissions-Policy
  enableCameraInput?: boolean; // Requires host site to allow camera via Permissions-Policy

  // Built-in authentication options (uses maven-core auth endpoints)
  useBuiltinAuth?: boolean;      // Enable maven-core login flow instead of external auth
  controlPlaneUrl?: string;      // Auth API URL (required when useBuiltinAuth is true)
}

export interface Skill {
  id: string;
  name: string;
  slug: string;
  category: string;
  emoji?: string;
  icon?: string;
  description?: string;
  url_patterns?: string[];
  variables?: SkillVariable[];
  prompt?: string;
}

export interface SkillVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'select';
  label: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

export interface FileReference {
  fileRefId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  source: 'claude_code' | 'code_interpreter';
  createdAt: string;
  downloadUrl?: string;  // Pre-signed S3 URL (10 min expiry)
}

// User-uploaded file attachment (for input)
export interface FileAttachment {
  id: string;
  file: File;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  previewUrl?: string;           // Data URL for image preview
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'error';
  uploadProgress: number;        // 0-100
  s3Key?: string;                // S3 key after successful upload
  error?: string;                // Error message if upload failed
}

// Reference sent to agent after upload complete
export interface FileAttachmentRef {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  s3Key: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
  progressStatus?: string;
  files?: FileReference[];  // Files available for download (from assistant)
  attachments?: FileAttachmentRef[];  // User-uploaded attachments
  skill?: {
    id: string;
    name: string;
    slug: string;
    emoji?: string;
    description?: string;
    prompt?: string;
    parameters?: Record<string, any>;
  };
  oauthRequired?: {  // OAuth authorization required for MCP tool
    provider_name: string;
    scopes: string[];
    tenant_slug: string;
    mcp_name: string;
    display_name?: string;
  };
  widgets?: WidgetData[];  // Widgets to render from MCP connectors
}

export interface ChatState {
  messages: Message[];
  isOpen: boolean;
  isLoading: boolean;
  sessionId: string | null;
  selectedSkills: string[];
  context: PageContext | null;
  error: string | null;
  sidebarWidth: number;
  showScrollButton: boolean;
  browserSession: BrowserSession | null;
  isBrowserViewerOpen: boolean;
  isBrowserViewerExpanded: boolean;
  todos: TodoItem[];
}

export interface PageContext {
  url: string;
  title: string;
  path: string;              // URL path for pattern matching
  text: string;              // Full visible text (up to 50k chars)
  textSample: string;        // First 1000 chars for prompt
  metadata: Record<string, any>;
}

export interface SSEEvent {
  event: 'session' | 'chunk' | 'progress' | 'done' | 'error' | 'cancelled' | 'browser_session' | 'browser_frame' | 'file_available' | 'session_title' | 'oauth_required' | 'todos' | 'widget';
  data: any;
}

// Widget data from MCP connectors (e.g., Envoy)
export interface WidgetData {
  templateUri: string;  // URI of widget template (e.g., "ui://widget/target-list.html")
  mcpName: string;      // Name of MCP server (e.g., "envoy")
  structuredContent: Record<string, any>;  // Data for widget
}

export interface BrowserSession {
  browser_id: string;
  session_id: string;
}

export interface TodoItem {
  content: string;
  activeForm: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface BrowserFrame {
  image: string;  // base64-encoded PNG
  format: 'png' | 'jpeg';
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
  context?: PageContext;
  userId?: string;
  tenantSlug: string;
  role?: string;
  pagePattern?: string;
  attachments?: FileAttachmentRef[];  // User-uploaded files
  // Skill execution mode (for apps calling skills via MavenBridge.skills.execute)
  skillMode?: boolean;
  skillSlug?: string;  // Skill slug for skillMode execution
  skillParams?: Record<string, any>;
}

export interface ChatResponse {
  success: boolean;
  sessionId?: string;
  error?: string;
}

// Session switcher types
export interface SessionSummary {
  sessionId: string;
  title?: string;  // AI-generated session title for sidebar display
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage: string;
  totalCostUsd: number;
  status: 'active';
}

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface SessionListResponse {
  sessions: SessionSummary[];
  count: number;
  error?: string;
}

export interface HistoryResponse {
  sessionId: string;
  messages: HistoryMessage[];
  error?: string;
}

// Apps types
export interface App {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description?: string;
  icon: string;  // Lucide icon name
  visibility: 'personal' | 'shared';
  created_by_user_id?: string;
  status: 'draft' | 'published' | 'archived';
  published_at?: string;
  published_version: number;
  config: AppConfig;
  created_at: string;
  updated_at: string;
  // External app URL - if set, app is loaded from this URL instead of inline code
  url?: string;
  // Connector slug for OAuth token lookup (e.g., 'envoy' for Envoy connector)
  connectorSlug?: string;
}

export interface AppConfig {
  tenantApiUrl?: string;  // External API URL for tenant (e.g., EasyCarnet API)
  [key: string]: any;
}

export interface AppFile {
  path: string;
  size: number;
  last_modified: string;
}

export interface AppManifest {
  name: string;
  slug: string;
  description?: string;
  icon: string;
  version: string;
  entry: string;  // Entry file (e.g., "index.tsx")
  tenantApiUrl?: string;
}
