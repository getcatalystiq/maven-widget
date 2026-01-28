/**
 * Skill types for Maven Widget
 *
 * These types are aligned with Maven Core's skill interfaces but defined
 * locally to avoid cross-repository dependencies.
 */

// ============================================================================
// Core Skill Types (aligned with @maven/shared)
// ============================================================================

/**
 * Skill as returned from the API
 */
export interface Skill {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly description: string;
  readonly r2Path: string;
  readonly roles?: readonly string[];
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Skill with SKILL.md content included
 */
export interface SkillWithContent extends Skill {
  readonly content: string;
}

/**
 * Payload for creating a new skill
 */
export interface SkillCreatePayload {
  readonly name: string;
  readonly description: string;
  readonly content: string;
}

/**
 * Payload for updating an existing skill
 */
export interface SkillUpdatePayload {
  readonly description?: string;
  readonly content?: string;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Structured error for API failures
 */
export interface SkillsError {
  readonly message: string;
  readonly code?: string;
  readonly status?: number;
  readonly retryable: boolean;
}

// ============================================================================
// State Types (Discriminated Unions)
// ============================================================================

/**
 * State for the skills list
 */
export type SkillsListState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly error: SkillsError }
  | { readonly status: 'loaded'; readonly skills: readonly Skill[] };

/**
 * State for the selected skill
 */
export type SelectedSkillState =
  | { readonly status: 'none' }
  | { readonly status: 'loading'; readonly skillId: string }
  | { readonly status: 'error'; readonly skillId: string; readonly error: SkillsError }
  | { readonly status: 'loaded'; readonly skill: SkillWithContent; readonly draftContent: string };

/**
 * State for save operations
 */
export type SaveState =
  | { readonly status: 'idle' }
  | { readonly status: 'saving'; readonly contentAtSaveTime: string }
  | { readonly status: 'error'; readonly error: SkillsError };

/**
 * Combined state for skills admin
 */
export interface SkillsAdminState {
  readonly list: SkillsListState;
  readonly selected: SelectedSkillState;
  readonly save: SaveState;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Derive whether there are unsaved changes.
 * This should be computed, not stored in state.
 */
export function hasUnsavedChanges(state: SkillsAdminState): boolean {
  if (state.selected.status !== 'loaded') return false;
  return state.selected.draftContent !== state.selected.skill.content;
}

/**
 * Validate skill name
 */
const SKILL_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_-]{2,49}$/;
const RESERVED_NAMES = ['admin', 'system', 'default', 'null', 'undefined'];

export function validateSkillName(name: string): { valid: boolean; error?: string } {
  if (!name || name.length < 3) {
    return { valid: false, error: 'Skill name must be at least 3 characters' };
  }
  if (name.length > 50) {
    return { valid: false, error: 'Skill name must be at most 50 characters' };
  }
  if (!SKILL_NAME_REGEX.test(name)) {
    return {
      valid: false,
      error: 'Skill name must start with a letter and contain only letters, numbers, hyphens, and underscores',
    };
  }
  if (RESERVED_NAMES.includes(name.toLowerCase())) {
    return { valid: false, error: 'This skill name is reserved' };
  }
  return { valid: true };
}

// ============================================================================
// Action Types
// ============================================================================

export type SkillsAction =
  // List actions
  | { type: 'LOAD_SKILLS_START' }
  | { type: 'LOAD_SKILLS_SUCCESS'; skills: readonly Skill[] }
  | { type: 'LOAD_SKILLS_ERROR'; error: SkillsError }
  // Selection actions
  | { type: 'SELECT_SKILL_START'; skillId: string }
  | { type: 'SELECT_SKILL_SUCCESS'; skill: SkillWithContent }
  | { type: 'SELECT_SKILL_ERROR'; skillId: string; error: SkillsError }
  | { type: 'DESELECT_SKILL' }
  | { type: 'DESELECT_IF_SELECTED'; skillId: string }
  // Draft content actions
  | { type: 'UPDATE_DRAFT_CONTENT'; content: string }
  // Save actions
  | { type: 'SAVE_START'; contentAtSaveTime: string }
  | { type: 'SAVE_SUCCESS'; contentAtSaveTime: string }
  | { type: 'SAVE_ERROR'; error: SkillsError }
  // Toggle enabled (optimistic)
  | { type: 'SET_SKILL_ENABLED'; skillId: string; enabled: boolean }
  // Reset
  | { type: 'RESET' };
