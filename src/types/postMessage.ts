/**
 * PostMessage types for iframe-parent communication
 * Type-safe discriminated unions for all message types
 */

// ============================================================================
// OpenAI App Widget Messages (iframe -> parent)
// ============================================================================

export type OpenAIAppToParentMessage =
  | OpenAIAppReadyMessage
  | OpenAIAppErrorMessage
  | OpenAIAppCallToolMessage
  | OpenAIAppSetStateMessage
  | OpenAIAppUploadFileMessage
  | OpenAIAppGetFileUrlMessage
  | OpenAIAppFollowUpMessage
  | OpenAIAppDisplayModeMessage
  | OpenAIAppModalMessage
  | OpenAIAppHeightMessage;

export interface OpenAIAppReadyMessage {
  type: 'openai_app_ready';
}

export interface OpenAIAppErrorMessage {
  type: 'openai_app_error';
  error: {
    title: string;
    message: string;
    stack?: string;
  };
}

export interface OpenAIAppCallToolMessage {
  type: 'openai_app_call_tool';
  id: number;
  name: string;
  args: unknown;
}

export interface OpenAIAppSetStateMessage {
  type: 'openai_app_set_state';
  id: number;
  state: unknown;
}

export interface OpenAIAppUploadFileMessage {
  type: 'openai_app_upload_file';
  id: number;
  file: {
    name: string;
    type: string;
    size: number;
    data: string;  // Base64-encoded file data
  };
}

export interface OpenAIAppGetFileUrlMessage {
  type: 'openai_app_get_file_url';
  id: number;
  fileId: string;
}

export interface OpenAIAppFollowUpMessage {
  type: 'openai_app_follow_up';
  id: number;
  prompt: string;
}

export interface OpenAIAppDisplayModeMessage {
  type: 'openai_app_display_mode';
  id: number;
  mode: 'inline' | 'fullscreen' | 'pip';
}

export interface OpenAIAppModalMessage {
  type: 'openai_app_modal';
  id: number;
  options: {
    title?: string;
    content?: string;
    buttons?: Array<{ label: string; value: string }>;
  };
}

export interface OpenAIAppHeightMessage {
  type: 'openai_app_height';
  height: number;
}

// ============================================================================
// OpenAI App Widget Messages (parent -> iframe)
// ============================================================================

export type ParentToOpenAIAppMessage =
  | OpenAIAppInitMessage
  | OpenAIAppResultMessage
  | OpenAIAppStateAckMessage
  | OpenAIAppThemeChangeMessage
  | OpenAIAppLocaleChangeMessage;

export interface OpenAIAppInitMessage {
  type: 'openai_app_init';
  toolOutput: unknown;
  toolInput: unknown;
  toolResponseMetadata: unknown;
  widgetState: Record<string, unknown>;
  theme: 'light' | 'dark';
  locale: string;
  maxHeight: number;
  safeArea: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export interface OpenAIAppResultMessage {
  type: 'openai_app_result';
  id: number;
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface OpenAIAppStateAckMessage {
  type: 'openai_app_state_ack';
  id: number;
}

export interface OpenAIAppThemeChangeMessage {
  type: 'openai_app_theme_change';
  theme: 'light' | 'dark';
}

export interface OpenAIAppLocaleChangeMessage {
  type: 'openai_app_locale_change';
  locale: string;
}

// ============================================================================
// Legacy Maven App Messages (for backward compatibility)
// ============================================================================

export type MavenAppToParentMessage =
  | { type: 'maven_app_ready' }
  | { type: 'maven_app_error'; error: { title: string; message: string } }
  | { type: 'maven_app_call'; id: number; method: string; params: unknown }
  | { type: 'maven_skill_execute'; id: number; skill: string; input: string; params: unknown };

export type ParentToMavenAppMessage =
  | { type: 'maven_app_init'; code: string; tenantApiUrl: string | null }
  | { type: 'maven_app_response'; id: number; result?: unknown; error?: string }
  | { type: 'maven_skill_chunk'; id: number; text: string }
  | { type: 'maven_skill_done'; id: number }
  | { type: 'maven_skill_error'; id: number; error: string };

// ============================================================================
// Combined Message Types
// ============================================================================

export type IframeToParentMessage = OpenAIAppToParentMessage | MavenAppToParentMessage;
export type ParentToIframeMessage = ParentToOpenAIAppMessage | ParentToMavenAppMessage;

// ============================================================================
// Type Guards
// ============================================================================

export function isOpenAIAppMessage(data: unknown): data is OpenAIAppToParentMessage {
  if (typeof data !== 'object' || data === null) return false;
  const msg = data as { type?: unknown };
  return typeof msg.type === 'string' && msg.type.startsWith('openai_app_');
}

export function isMavenAppMessage(data: unknown): data is MavenAppToParentMessage {
  if (typeof data !== 'object' || data === null) return false;
  const msg = data as { type?: unknown };
  return typeof msg.type === 'string' && (
    msg.type.startsWith('maven_app_') ||
    msg.type.startsWith('maven_skill_')
  );
}

export function isIframeMessage(data: unknown): data is IframeToParentMessage {
  return isOpenAIAppMessage(data) || isMavenAppMessage(data);
}

// ============================================================================
// window.openai API Types (for widget runtime)
// ============================================================================

export interface OpenAIWidgetAPI {
  // State & Data APIs (read-only)
  readonly toolOutput: unknown;
  readonly toolInput: unknown;
  readonly toolResponseMetadata: unknown;
  readonly widgetState: Record<string, unknown>;

  // Context/Environment APIs (read-only)
  readonly theme: 'light' | 'dark';
  readonly locale: string;
  readonly maxHeight: number;
  readonly safeArea: {
    readonly top: number;
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
  };

  // Widget Runtime APIs
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  setWidgetState(state: Record<string, unknown>): void;
  uploadFile(file: File): Promise<{ fileId: string }>;
  getFileDownloadUrl(opts: { fileId: string }): Promise<string>;
  sendFollowUpMessage(opts: { prompt: string }): Promise<void>;
  requestDisplayMode(mode: 'inline' | 'fullscreen' | 'pip'): Promise<void>;
  requestModal(opts: ModalOptions): Promise<ModalResult>;
  notifyIntrinsicHeight(height: number): void;
}

export interface ModalOptions {
  title?: string;
  content?: string;
  buttons?: Array<{ label: string; value: string }>;
}

export interface ModalResult {
  dismissed: boolean;
  value?: string;
}

// Extend Window interface
declare global {
  interface Window {
    openai?: OpenAIWidgetAPI;
  }
}
