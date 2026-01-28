// Context
export { SkillBuilderProvider, useSkillBuilder } from './context/SkillBuilderContext';
export type { SkillBuilderProviderProps } from './context/SkillBuilderContext';

// Types
export type {
  Skill,
  SkillWithContent,
  SkillCreatePayload,
  SkillUpdatePayload,
  SkillsError,
  SkillsListState,
  SelectedSkillState,
  SaveState,
  SkillsAdminState,
  SkillsAction,
} from './types';
export { hasUnsavedChanges, validateSkillName } from './types';

// Components
export { SkillBuilderView, SkillsList, SkillEditor, preloadEditor } from './components';

// API
export {
  initSkillsApi,
  listSkills,
  getSkill,
  createSkillWithAssignment,
  updateSkill,
  deleteSkill,
  toggleSkillEnabled,
  ApiError,
  PartialCreateError,
} from './api/skills';
