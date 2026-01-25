export interface SkillFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: string;
  contentType?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface SkillSummary {
  id: string;
  name: string;
  slug: string;
  description?: string;
  emoji?: string;
  category?: string;
  url_patterns?: string[];
  variables?: string[];
  enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  draft_status?: 'draft' | 'published';
}

export interface SkillBuilderState {
  // Skill identity
  skillId: string | null;
  skillName: string;
  skillSlug: string;
  tenantId: string | null;

  // Skills list
  skills: SkillSummary[];
  isLoadingSkills: boolean;

  // File management
  files: SkillFile[];
  selectedFile: string | null;
  openTabs: string[];
  fileContents: Record<string, string>;
  unsavedChanges: Set<string>;

  // Chat
  chatSessionId: string | null;
  chatMessages: ChatMessage[];
  isChatLoading: boolean;

  // Activity indicator (shows current tool being used)
  currentActivity: {
    tool: string;
    filePath?: string;
  } | null;

  // UI state
  isFilesLoading: boolean;
  isSaving: boolean;
  isPublishing: boolean;

  // Draft status
  draftStatus: 'draft' | 'published';
  publishError: string | null;

  // Reload trigger - increments to force editor to refresh from state
  reloadVersion: number;
}

export type SkillBuilderAction =
  | { type: 'SET_SKILLS'; payload: SkillSummary[] }
  | { type: 'SET_LOADING_SKILLS'; payload: boolean }
  | { type: 'SET_SKILL'; payload: { skillId: string; skillName: string; skillSlug: string; tenantId: string; draftStatus: 'draft' | 'published'; chatSessionId?: string | null } }
  | { type: 'SET_FILES'; payload: SkillFile[] }
  | { type: 'SET_FILES_LOADING'; payload: boolean }
  | { type: 'SELECT_FILE'; payload: string | null }
  | { type: 'OPEN_TAB'; payload: string }
  | { type: 'CLOSE_TAB'; payload: string }
  | { type: 'SET_FILE_CONTENT'; payload: { path: string; content: string } }
  | { type: 'MARK_UNSAVED'; payload: string }
  | { type: 'MARK_SAVED'; payload: string }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'ADD_CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'UPDATE_CHAT_MESSAGE'; payload: { id: string; content: string } }
  | { type: 'SET_CHAT_LOADING'; payload: boolean }
  | { type: 'SET_CHAT_SESSION'; payload: string | null }
  | { type: 'SET_ACTIVITY'; payload: { tool: string; filePath?: string } | null }
  | { type: 'SET_PUBLISHING'; payload: boolean }
  | { type: 'SET_DRAFT_STATUS'; payload: 'draft' | 'published' }
  | { type: 'SET_PUBLISH_ERROR'; payload: string | null }
  | { type: 'INCREMENT_RELOAD_VERSION' }
  | { type: 'RESET' };
