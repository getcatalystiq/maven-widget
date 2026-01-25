import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { SkillBuilderState, SkillBuilderAction, SkillSummary, SkillFile } from '../types';
import { parseSSEResponse } from '../utils/sse';

const initialState: SkillBuilderState = {
  skillId: null,
  skillName: '',
  skillSlug: '',
  tenantId: null,
  skills: [],
  isLoadingSkills: false,
  files: [],
  selectedFile: null,
  openTabs: [],
  fileContents: {},
  unsavedChanges: new Set(),
  chatSessionId: null,
  chatMessages: [],
  isChatLoading: false,
  currentActivity: null,
  isFilesLoading: false,
  isSaving: false,
  isPublishing: false,
  draftStatus: 'draft',
  publishError: null,
  reloadVersion: 0,
};

function reducer(state: SkillBuilderState, action: SkillBuilderAction): SkillBuilderState {
  switch (action.type) {
    case 'SET_SKILLS':
      return { ...state, skills: action.payload, isLoadingSkills: false };

    case 'SET_LOADING_SKILLS':
      return { ...state, isLoadingSkills: action.payload };

    case 'SET_SKILL': {
      // Only reset file state when switching to a DIFFERENT skill
      const isSameSkill = state.skillId === action.payload.skillId;
      return {
        ...state,
        skillId: action.payload.skillId,
        skillName: action.payload.skillName,
        skillSlug: action.payload.skillSlug,
        tenantId: action.payload.tenantId,
        draftStatus: action.payload.draftStatus,
        chatSessionId: action.payload.chatSessionId || null,
        // Only reset if switching skills (not re-selecting same skill)
        ...(isSameSkill ? {} : {
          files: [],
          selectedFile: null,
          openTabs: [],
          fileContents: {},
          unsavedChanges: new Set(),
          chatMessages: [],
        }),
      };
    }

    case 'SET_FILES':
      return { ...state, files: action.payload, isFilesLoading: false };

    case 'SET_FILES_LOADING':
      return { ...state, isFilesLoading: action.payload };

    case 'SELECT_FILE':
      return { ...state, selectedFile: action.payload };

    case 'OPEN_TAB':
      if (state.openTabs.includes(action.payload)) {
        return { ...state, selectedFile: action.payload };
      }
      return {
        ...state,
        openTabs: [...state.openTabs, action.payload],
        selectedFile: action.payload,
      };

    case 'CLOSE_TAB': {
      const newTabs = state.openTabs.filter(t => t !== action.payload);
      const newSelected = state.selectedFile === action.payload
        ? newTabs[newTabs.length - 1] || null
        : state.selectedFile;
      const { [action.payload]: _, ...remainingContents } = state.fileContents;
      const newUnsaved = new Set(state.unsavedChanges);
      newUnsaved.delete(action.payload);
      return {
        ...state,
        openTabs: newTabs,
        selectedFile: newSelected,
        fileContents: remainingContents,
        unsavedChanges: newUnsaved,
      };
    }

    case 'SET_FILE_CONTENT':
      return {
        ...state,
        fileContents: {
          ...state.fileContents,
          [action.payload.path]: action.payload.content,
        },
      };

    case 'MARK_UNSAVED': {
      const newUnsaved = new Set(state.unsavedChanges);
      newUnsaved.add(action.payload);
      return { ...state, unsavedChanges: newUnsaved };
    }

    case 'MARK_SAVED': {
      const newUnsaved = new Set(state.unsavedChanges);
      newUnsaved.delete(action.payload);
      return { ...state, unsavedChanges: newUnsaved };
    }

    case 'SET_SAVING':
      return { ...state, isSaving: action.payload };

    case 'ADD_CHAT_MESSAGE':
      return {
        ...state,
        chatMessages: [...state.chatMessages, action.payload],
      };

    case 'UPDATE_CHAT_MESSAGE':
      return {
        ...state,
        chatMessages: state.chatMessages.map(m =>
          m.id === action.payload.id
            ? { ...m, content: action.payload.content }
            : m
        ),
      };

    case 'SET_CHAT_LOADING':
      return { ...state, isChatLoading: action.payload };

    case 'SET_CHAT_SESSION':
      return { ...state, chatSessionId: action.payload };

    case 'SET_ACTIVITY':
      return { ...state, currentActivity: action.payload };

    case 'SET_PUBLISHING':
      return { ...state, isPublishing: action.payload };

    case 'SET_DRAFT_STATUS':
      return { ...state, draftStatus: action.payload };

    case 'SET_PUBLISH_ERROR':
      return { ...state, publishError: action.payload };

    case 'INCREMENT_RELOAD_VERSION':
      return { ...state, reloadVersion: state.reloadVersion + 1 };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// Context
interface SkillBuilderContextValue {
  state: SkillBuilderState;
  dispatch: React.Dispatch<SkillBuilderAction>;
  // API connection
  apiUrl: string;
  tenantId: string;
  getToken: (() => Promise<string>) | null;
  // Direct AgentCore connection (for widget with JWT auth)
  agentUrl: string | null;
  userId: string | null;
  // Convenience methods
  loadSkills: () => Promise<void>;
  selectSkill: (skill: SkillSummary) => void;
  loadFiles: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  saveFile: (path: string) => Promise<void>;
  saveAllFiles: () => Promise<void>;
  createFile: (path: string, type: 'file' | 'directory') => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  publishSkill: () => Promise<void>;
  createSkill: (name: string) => Promise<SkillSummary | null>;
  updateSkill: (skillId: string, data: Partial<SkillSummary>) => Promise<boolean>;
  deleteSkill: (skillId: string) => Promise<boolean>;
}

const SkillBuilderContext = createContext<SkillBuilderContextValue | null>(null);

export interface SkillBuilderProviderProps {
  children: ReactNode;
  apiUrl: string;
  tenantId: string;
  getToken: (() => Promise<string>) | null;
  initialSkillId?: string;
  // Direct AgentCore connection (for widget with JWT auth)
  agentUrl?: string;
  userId?: string;
}

export function SkillBuilderProvider({
  children,
  apiUrl,
  tenantId,
  getToken,
  initialSkillId,
  agentUrl,
  userId,
}: SkillBuilderProviderProps) {
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    tenantId,
  });

  // Helper to make authenticated requests to admin API
  const callApi = useCallback(async (operation: string, payload: Record<string, unknown> = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (getToken) {
      const token = await getToken();
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${apiUrl}/tenants/${tenantId}/skill-builder`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operation,
        ...payload,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || error.message || 'Request failed');
    }

    return response;
  }, [apiUrl, getToken, tenantId]);

  const loadSkills = useCallback(async () => {
    dispatch({ type: 'SET_LOADING_SKILLS', payload: true });
    try {
      const response = await callApi('list_skills');
      const data = await parseSSEResponse(response, 'skills');
      dispatch({ type: 'SET_SKILLS', payload: (data.skills as SkillSummary[]) || [] });
    } catch (error) {
      console.error('Load skills error:', error);
      dispatch({ type: 'SET_LOADING_SKILLS', payload: false });
    }
  }, [callApi]);

  const selectSkill = useCallback((skill: SkillSummary) => {
    dispatch({
      type: 'SET_SKILL',
      payload: {
        skillId: skill.id,
        skillName: skill.name,
        skillSlug: skill.slug,
        tenantId: tenantId,
        draftStatus: skill.draft_status || 'draft',
      },
    });
  }, [tenantId]);

  const loadFiles = useCallback(async () => {
    if (!state.skillId) return;

    dispatch({ type: 'SET_FILES_LOADING', payload: true });
    try {
      const response = await callApi('list_files', {
        skillId: state.skillId,
        skillSlug: state.skillSlug,
        skillName: state.skillName,
      });
      const data = await parseSSEResponse(response, 'files');
      dispatch({ type: 'SET_FILES', payload: (data.files as SkillFile[]) || [] });
    } catch (error) {
      console.error('Load files error:', error);
      dispatch({ type: 'SET_FILES_LOADING', payload: false });
    }
  }, [state.skillId, state.skillSlug, state.skillName, callApi]);

  const openFile = useCallback(async (path: string) => {
    if (!state.skillId) return;

    try {
      const response = await callApi('read_file', {
        skillId: state.skillId,
        path,
      });
      const data = await parseSSEResponse(response, 'file_content');
      dispatch({ type: 'SET_FILE_CONTENT', payload: { path, content: data.content as string } });
      dispatch({ type: 'OPEN_TAB', payload: path });
      dispatch({ type: 'INCREMENT_RELOAD_VERSION' });
    } catch (error) {
      console.error('Open file error:', error);
    }
  }, [state.skillId, callApi]);

  const reloadFile = useCallback(async (path: string) => {
    if (!state.skillId) return;

    try {
      const response = await callApi('read_file', {
        skillId: state.skillId,
        path,
      });
      const data = await parseSSEResponse(response, 'file_content');
      dispatch({ type: 'SET_FILE_CONTENT', payload: { path, content: data.content as string } });
      dispatch({ type: 'INCREMENT_RELOAD_VERSION' });
    } catch (error) {
      console.error('Reload file error:', error);
    }
  }, [state.skillId, callApi]);

  const saveFile = useCallback(async (path: string) => {
    if (!state.skillId || state.fileContents[path] === undefined) return;

    dispatch({ type: 'SET_SAVING', payload: true });
    try {
      await callApi('write_file', {
        skillId: state.skillId,
        path,
        content: state.fileContents[path],
      });
      dispatch({ type: 'MARK_SAVED', payload: path });

      // Refresh FILES section after save
      await loadFiles();

      // Reload current file content from server
      await reloadFile(path);
    } catch (error) {
      console.error('Save file error:', error);
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false });
    }
  }, [state.skillId, state.fileContents, callApi, loadFiles, reloadFile]);

  const saveAllFiles = useCallback(async () => {
    const unsavedPaths = Array.from(state.unsavedChanges);
    for (const path of unsavedPaths) {
      await saveFile(path);
    }
  }, [state.unsavedChanges, saveFile]);

  const createFile = useCallback(async (path: string, type: 'file' | 'directory') => {
    if (!state.skillId) return;

    try {
      await callApi('create_file', {
        skillId: state.skillId,
        path,
        fileType: type,
      });

      await loadFiles();
      if (type === 'file') {
        await openFile(path);
      }
    } catch (error) {
      console.error('Create file error:', error);
      throw error;
    }
  }, [state.skillId, callApi, loadFiles, openFile]);

  const deleteFile = useCallback(async (path: string) => {
    if (!state.skillId) return;

    try {
      await callApi('delete_file', {
        skillId: state.skillId,
        path,
      });

      // Close tab if open
      if (state.openTabs.includes(path)) {
        dispatch({ type: 'CLOSE_TAB', payload: path });
      }

      await loadFiles();
    } catch (error) {
      console.error('Delete file error:', error);
      throw error;
    }
  }, [state.skillId, state.openTabs, callApi, loadFiles]);

  const publishSkill = useCallback(async () => {
    if (!state.skillId || !state.skillSlug) return;

    dispatch({ type: 'SET_PUBLISH_ERROR', payload: null });
    dispatch({ type: 'SET_PUBLISHING', payload: true });
    try {
      // Save all unsaved files first
      await saveAllFiles();

      const response = await callApi('publish', {
        skillId: state.skillId,
        skillSlug: state.skillSlug,
      });

      const data = await parseSSEResponse(response, 'publish_result');
      if (data.error) {
        dispatch({ type: 'SET_PUBLISH_ERROR', payload: data.error as string });
        return;
      }

      dispatch({ type: 'SET_DRAFT_STATUS', payload: 'published' });
    } catch (error) {
      console.error('Publish error:', error);
      dispatch({ type: 'SET_PUBLISH_ERROR', payload: 'Failed to publish skill' });
    } finally {
      dispatch({ type: 'SET_PUBLISHING', payload: false });
    }
  }, [state.skillId, state.skillSlug, saveAllFiles, callApi]);

  const createSkill = useCallback(async (name: string): Promise<SkillSummary | null> => {
    try {
      const response = await callApi('create_skill', { name });
      const data = await parseSSEResponse(response, 'skill_created');

      if (data.skill) {
        await loadSkills();
        return data.skill as SkillSummary;
      }
      return null;
    } catch (error) {
      console.error('Create skill error:', error);
      return null;
    }
  }, [callApi, loadSkills]);

  const updateSkill = useCallback(async (skillId: string, data: Partial<SkillSummary>): Promise<boolean> => {
    try {
      const response = await callApi('update_skill', {
        skillId,
        ...data,
      });
      await parseSSEResponse(response, 'skill_updated');
      await loadSkills();
      return true;
    } catch (error) {
      console.error('Update skill error:', error);
      return false;
    }
  }, [callApi, loadSkills]);

  const deleteSkill = useCallback(async (skillId: string): Promise<boolean> => {
    try {
      const response = await callApi('delete_skill', { skillId });
      await parseSSEResponse(response, 'skill_deleted');
      await loadSkills();
      return true;
    } catch (error) {
      console.error('Delete skill error:', error);
      return false;
    }
  }, [callApi, loadSkills]);

  // Load initial skill if provided
  React.useEffect(() => {
    if (initialSkillId && state.skills.length > 0 && !state.skillId) {
      const skill = state.skills.find(s => s.id === initialSkillId);
      if (skill) {
        selectSkill(skill);
      }
    }
  }, [initialSkillId, state.skills, state.skillId, selectSkill]);

  const value: SkillBuilderContextValue = {
    state,
    dispatch,
    apiUrl,
    tenantId,
    getToken,
    agentUrl: agentUrl || null,
    userId: userId || null,
    loadSkills,
    selectSkill,
    loadFiles,
    openFile,
    saveFile,
    saveAllFiles,
    createFile,
    deleteFile,
    publishSkill,
    createSkill,
    updateSkill,
    deleteSkill,
  };

  return (
    <SkillBuilderContext.Provider value={value}>
      {children}
    </SkillBuilderContext.Provider>
  );
}

export function useSkillBuilder() {
  const context = useContext(SkillBuilderContext);
  if (!context) {
    throw new Error('useSkillBuilder must be used within SkillBuilderProvider');
  }
  return context;
}
