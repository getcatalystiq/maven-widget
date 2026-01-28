import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect, ReactNode } from 'react';
import type {
  Skill,
  SkillWithContent,
  SkillsAdminState,
  SkillsAction,
  SkillsError,
  SkillCreatePayload,
  SkillUpdatePayload,
} from '../types';
import { hasUnsavedChanges } from '../types';
import {
  initSkillsApi,
  listSkills as apiListSkills,
  getSkill as apiGetSkill,
  createSkillWithAssignment as apiCreateSkill,
  updateSkill as apiUpdateSkill,
  deleteSkill as apiDeleteSkill,
  toggleSkillEnabled as apiToggleSkillEnabled,
  ApiError,
} from '../api/skills';

// ============================================================================
// Initial State
// ============================================================================

const initialState: SkillsAdminState = {
  list: { status: 'idle' },
  selected: { status: 'none' },
  save: { status: 'idle' },
};

// ============================================================================
// Reducer
// ============================================================================

function reducer(state: SkillsAdminState, action: SkillsAction): SkillsAdminState {
  switch (action.type) {
    // List actions
    case 'LOAD_SKILLS_START':
      return { ...state, list: { status: 'loading' } };

    case 'LOAD_SKILLS_SUCCESS':
      return { ...state, list: { status: 'loaded', skills: action.skills } };

    case 'LOAD_SKILLS_ERROR':
      return { ...state, list: { status: 'error', error: action.error } };

    // Selection actions
    case 'SELECT_SKILL_START':
      return {
        ...state,
        selected: { status: 'loading', skillId: action.skillId },
        save: { status: 'idle' },
      };

    case 'SELECT_SKILL_SUCCESS':
      return {
        ...state,
        selected: {
          status: 'loaded',
          skill: action.skill,
          draftContent: action.skill.content,
        },
      };

    case 'SELECT_SKILL_ERROR':
      return {
        ...state,
        selected: { status: 'error', skillId: action.skillId, error: action.error },
      };

    case 'DESELECT_SKILL':
      return {
        ...state,
        selected: { status: 'none' },
        save: { status: 'idle' },
      };

    // Draft content actions
    case 'UPDATE_DRAFT_CONTENT':
      if (state.selected.status !== 'loaded') return state;
      return {
        ...state,
        selected: { ...state.selected, draftContent: action.content },
      };

    // Save actions
    case 'SAVE_START':
      return { ...state, save: { status: 'saving', contentAtSaveTime: action.contentAtSaveTime } };

    case 'SAVE_SUCCESS': {
      // Update the skill's content with saved content only if content hasn't changed during save
      if (state.selected.status !== 'loaded') return { ...state, save: { status: 'idle' } };
      if (state.selected.draftContent !== action.contentAtSaveTime) {
        // Content changed during save - keep the draft, just clear save state
        return { ...state, save: { status: 'idle' } };
      }
      return {
        ...state,
        selected: {
          ...state.selected,
          skill: { ...state.selected.skill, content: action.contentAtSaveTime },
        },
        save: { status: 'idle' },
      };
    }

    case 'SAVE_ERROR':
      return { ...state, save: { status: 'error', error: action.error } };

    // Toggle enabled (optimistic update)
    case 'SET_SKILL_ENABLED': {
      if (state.list.status !== 'loaded') return state;
      const skills = state.list.skills.map((skill) =>
        skill.id === action.skillId ? { ...skill, enabled: action.enabled } : skill
      );
      let selected = state.selected;
      if (selected.status === 'loaded' && selected.skill.id === action.skillId) {
        selected = { ...selected, skill: { ...selected.skill, enabled: action.enabled } };
      }
      return { ...state, list: { status: 'loaded', skills }, selected };
    }

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ============================================================================
// Error Helper
// ============================================================================

function toSkillsError(error: unknown): SkillsError {
  if (error instanceof ApiError) {
    return {
      message: error.message,
      status: error.status,
      code: error.code,
      retryable: error.retryable,
    };
  }
  if (error instanceof Error) {
    return {
      message: error.message,
      retryable: false,
    };
  }
  return {
    message: 'An unknown error occurred',
    retryable: false,
  };
}

// ============================================================================
// Context
// ============================================================================

interface SkillBuilderContextValue {
  state: SkillsAdminState;
  dispatch: React.Dispatch<SkillsAction>;

  // Derived state
  hasUnsavedChanges: boolean;

  // API connection info
  apiUrl: string;
  tenantId: string;
  userId: string;

  // Actions
  loadSkills: () => Promise<void>;
  selectSkill: (skillId: string) => Promise<void>;
  deselectSkill: () => void;
  updateDraftContent: (content: string) => void;
  saveSkill: () => Promise<void>;
  createSkill: (data: SkillCreatePayload) => Promise<Skill | null>;
  updateSkillMetadata: (skillId: string, data: SkillUpdatePayload) => Promise<boolean>;
  deleteSkill: (skillId: string) => Promise<boolean>;
  toggleSkillEnabled: (skillId: string, enabled: boolean) => Promise<void>;
}

const SkillBuilderContext = createContext<SkillBuilderContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export interface SkillBuilderProviderProps {
  children: ReactNode;
  apiUrl: string;
  tenantId: string;
  userId: string;
  getToken: () => Promise<string>;
  initialSkillId?: string;
}

export function SkillBuilderProvider({
  children,
  apiUrl,
  tenantId,
  userId,
  getToken,
  initialSkillId,
}: SkillBuilderProviderProps) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Request tracking for race condition prevention
  const loadSkillsRequestRef = useRef(0);
  const selectSkillRequestRef = useRef(0);
  const toggleRequestRef = useRef<Map<string, number>>(new Map());

  // AbortController for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize API on mount
  useEffect(() => {
    initSkillsApi({
      baseUrl: apiUrl,
      getToken,
      userId,
    });
  }, [apiUrl, getToken, userId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Load skills
  const loadSkills = useCallback(async () => {
    const thisRequest = ++loadSkillsRequestRef.current;
    dispatch({ type: 'LOAD_SKILLS_START' });

    try {
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const result = await apiListSkills(abortControllerRef.current.signal);

      if (thisRequest !== loadSkillsRequestRef.current) return;

      dispatch({ type: 'LOAD_SKILLS_SUCCESS', skills: result.skills });
    } catch (error) {
      if (thisRequest !== loadSkillsRequestRef.current) return;
      if (error instanceof Error && error.name === 'AbortError') return;

      dispatch({ type: 'LOAD_SKILLS_ERROR', error: toSkillsError(error) });
    }
  }, []);

  // Select a skill (load its content)
  const selectSkill = useCallback(async (skillId: string) => {
    const thisRequest = ++selectSkillRequestRef.current;
    dispatch({ type: 'SELECT_SKILL_START', skillId });

    try {
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const skill = await apiGetSkill(skillId, abortControllerRef.current.signal);

      if (thisRequest !== selectSkillRequestRef.current) return;

      dispatch({ type: 'SELECT_SKILL_SUCCESS', skill });
    } catch (error) {
      if (thisRequest !== selectSkillRequestRef.current) return;
      if (error instanceof Error && error.name === 'AbortError') return;

      dispatch({ type: 'SELECT_SKILL_ERROR', skillId, error: toSkillsError(error) });
    }
  }, []);

  // Deselect skill
  const deselectSkill = useCallback(() => {
    dispatch({ type: 'DESELECT_SKILL' });
  }, []);

  // Update draft content
  const updateDraftContent = useCallback((content: string) => {
    dispatch({ type: 'UPDATE_DRAFT_CONTENT', content });
  }, []);

  // Save current skill
  const saveSkill = useCallback(async () => {
    if (state.selected.status !== 'loaded') return;

    const contentAtSaveTime = state.selected.draftContent;
    const skillId = state.selected.skill.id;

    dispatch({ type: 'SAVE_START', contentAtSaveTime });

    try {
      await apiUpdateSkill(skillId, { content: contentAtSaveTime });
      dispatch({ type: 'SAVE_SUCCESS', contentAtSaveTime });
    } catch (error) {
      dispatch({ type: 'SAVE_ERROR', error: toSkillsError(error) });
    }
  }, [state.selected]);

  // Create a new skill
  const createSkill = useCallback(async (data: SkillCreatePayload): Promise<Skill | null> => {
    try {
      const skill = await apiCreateSkill(data);
      await loadSkills();
      return skill;
    } catch (error) {
      console.error('Create skill error:', error);
      return null;
    }
  }, [loadSkills]);

  // Update skill metadata (not content - that's done via saveSkill)
  const updateSkillMetadata = useCallback(async (skillId: string, data: SkillUpdatePayload): Promise<boolean> => {
    try {
      await apiUpdateSkill(skillId, data);
      await loadSkills();
      return true;
    } catch (error) {
      console.error('Update skill error:', error);
      return false;
    }
  }, [loadSkills]);

  // Delete a skill
  const deleteSkillFn = useCallback(async (skillId: string): Promise<boolean> => {
    try {
      await apiDeleteSkill(skillId);
      // If this was the selected skill, deselect it
      if (state.selected.status === 'loaded' && state.selected.skill.id === skillId) {
        dispatch({ type: 'DESELECT_SKILL' });
      }
      await loadSkills();
      return true;
    } catch (error) {
      console.error('Delete skill error:', error);
      return false;
    }
  }, [loadSkills, state.selected]);

  // Toggle skill enabled (with optimistic update and rollback)
  const toggleSkillEnabled = useCallback(async (skillId: string, enabled: boolean) => {
    const requestId = (toggleRequestRef.current.get(skillId) ?? 0) + 1;
    toggleRequestRef.current.set(skillId, requestId);

    // Optimistic update
    dispatch({ type: 'SET_SKILL_ENABLED', skillId, enabled });

    try {
      await apiToggleSkillEnabled(skillId, enabled);

      // Stale request - ignore
      if (toggleRequestRef.current.get(skillId) !== requestId) return;
    } catch (error) {
      // Rollback only if this is still the latest request
      if (toggleRequestRef.current.get(skillId) === requestId) {
        dispatch({ type: 'SET_SKILL_ENABLED', skillId, enabled: !enabled });
        console.error('Toggle skill enabled error:', error);
      }
    }
  }, []);

  // Load initial skill if provided
  useEffect(() => {
    if (initialSkillId && state.list.status === 'loaded' && state.selected.status === 'none') {
      const skill = state.list.skills.find((s) => s.id === initialSkillId);
      if (skill) {
        selectSkill(skill.id);
      }
    }
  }, [initialSkillId, state.list, state.selected.status, selectSkill]);

  const value: SkillBuilderContextValue = {
    state,
    dispatch,
    hasUnsavedChanges: hasUnsavedChanges(state),
    apiUrl,
    tenantId,
    userId,
    loadSkills,
    selectSkill,
    deselectSkill,
    updateDraftContent,
    saveSkill,
    createSkill,
    updateSkillMetadata,
    deleteSkill: deleteSkillFn,
    toggleSkillEnabled,
  };

  return (
    <SkillBuilderContext.Provider value={value}>
      {children}
    </SkillBuilderContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useSkillBuilder(): SkillBuilderContextValue {
  const context = useContext(SkillBuilderContext);
  if (!context) {
    throw new Error('useSkillBuilder must be used within SkillBuilderProvider');
  }
  return context;
}
