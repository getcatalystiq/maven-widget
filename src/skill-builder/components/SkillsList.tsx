import React, { useEffect, useState } from 'react';
import { useSkillBuilder } from '../context/SkillBuilderContext';
import type { Skill, SkillCreatePayload } from '../types';
import { validateSkillName } from '../types';
import { preloadEditor } from './SkillEditor';

interface SkillsListProps {
  onSkillSelect: () => void;
}

// Icons as SVG components
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="maven-icon">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="maven-icon">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="maven-icon">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="maven-icon">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="maven-icon">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// Default SKILL.md template
const DEFAULT_SKILL_CONTENT = `---
name: "{name}"
description: "{description}"
---

# {name}

{description}

## Instructions

Add your skill instructions here.
`;

function generateSkillContent(name: string, description: string): string {
  return DEFAULT_SKILL_CONTENT
    .replace(/{name}/g, name)
    .replace(/{description}/g, description || 'No description provided.');
}

export function SkillsList({ onSkillSelect }: SkillsListProps) {
  const {
    state,
    loadSkills,
    selectSkill,
    createSkill,
    updateSkillMetadata,
    deleteSkill,
    toggleSkillEnabled,
  } = useSkillBuilder();

  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (editingSkill) {
      setFormData({
        name: editingSkill.name,
        description: editingSkill.description || '',
      });
    } else {
      setFormData({
        name: '',
        description: '',
      });
    }
    setFormError(null);
  }, [editingSkill, showModal]);

  // Get skills from state
  const skills = state.list.status === 'loaded' ? state.list.skills : [];
  const isLoading = state.list.status === 'loading';

  const filteredSkills = skills.filter(skill =>
    skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (skill.description && skill.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleOpenEditor = async (skill: Skill) => {
    await selectSkill(skill.id);
    onSkillSelect();
  };

  const handleEditMetadata = (skill: Skill) => {
    setEditingSkill(skill);
    setShowModal(true);
  };

  const handleDeleteClick = (skill: Skill) => {
    setDeleteTarget(skill);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    await deleteSkill(deleteTarget.id);
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  const handleToggleEnabled = async (skill: Skill) => {
    await toggleSkillEnabled(skill.id, !skill.enabled);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate name
    const validation = validateSkillName(formData.name);
    if (!validation.valid) {
      setFormError(validation.error || 'Invalid skill name');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingSkill) {
        // Update existing skill metadata
        await updateSkillMetadata(editingSkill.id, {
          description: formData.description || undefined,
        });
      } else {
        // Create new skill with default content template
        const content = generateSkillContent(formData.name, formData.description);
        const data: SkillCreatePayload = {
          name: formData.name,
          description: formData.description || '',
          content,
        };
        const skill = await createSkill(data);
        if (skill) {
          // Optionally open the editor immediately after creation
          await selectSkill(skill.id);
          onSkillSelect();
        }
      }
      setShowModal(false);
      setEditingSkill(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="maven-skills">
      {/* Header - Search + Create */}
      <div className="maven-skills-header">
        <div className="maven-admin-search">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          className="maven-admin-btn maven-admin-btn-primary"
          onClick={() => {
            setEditingSkill(null);
            setShowModal(true);
          }}
        >
          <PlusIcon />
          Create Skill
        </button>
      </div>

      {/* Content */}
      <div className="maven-skills-content">
        <div className="maven-skills-list-content">
          {isLoading ? (
            <div className="maven-skills-list-loading">
              <div className="maven-skills-list-skeleton" />
              <div className="maven-skills-list-skeleton" />
              <div className="maven-skills-list-skeleton" />
            </div>
          ) : state.list.status === 'error' ? (
            <div className="maven-skills-list-error">
              <p>Failed to load skills: {state.list.error.message}</p>
              <button className="maven-admin-btn maven-admin-btn-primary" onClick={loadSkills}>
                Retry
              </button>
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="maven-skills-list-empty">
              {searchQuery ? (
                <p>No skills match "{searchQuery}"</p>
              ) : (
                <>
                  <div className="maven-skills-list-empty-icon">+</div>
                  <p>No skills yet</p>
                  <button className="maven-admin-btn maven-admin-btn-primary" onClick={() => setShowModal(true)}>
                    Create your first skill
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="maven-skills-table-wrapper">
              <table className="maven-skills-table">
                <thead>
                  <tr>
                    <th>Skill</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSkills.map((skill) => (
                    <tr key={skill.id}>
                      <td>
                        <div
                          className="maven-skills-table-skill"
                          onMouseEnter={preloadEditor}
                        >
                          <div className="maven-skills-table-name">{skill.name}</div>
                        </div>
                      </td>
                      <td>
                        <div className="maven-skills-table-description">
                          {skill.description || <span className="maven-skills-table-muted">No description</span>}
                        </div>
                      </td>
                      <td>
                        <div className="maven-skills-toggle-wrapper">
                          <button
                            className={`maven-skills-toggle ${skill.enabled ? 'maven-skills-toggle-on' : 'maven-skills-toggle-off'}`}
                            onClick={() => handleToggleEnabled(skill)}
                            title={skill.enabled ? 'Click to disable' : 'Click to enable'}
                          >
                            <span className="maven-skills-toggle-thumb" />
                          </button>
                        </div>
                      </td>
                      <td>
                        <div className="maven-skills-table-actions">
                          <button
                            onClick={() => handleOpenEditor(skill)}
                            onMouseEnter={preloadEditor}
                            title="Edit skill content"
                            className="maven-skills-table-action maven-skills-table-action-primary"
                          >
                            <EditIcon />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(skill)}
                            title="Delete skill"
                            className="maven-skills-table-action maven-skills-table-action-delete"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Skill Modal */}
      {showModal && (
        <div className="maven-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="maven-modal" onClick={(e) => e.stopPropagation()}>
            <div className="maven-modal-header">
              <h3>{editingSkill ? 'Edit Skill' : 'Create Skill'}</h3>
              <button onClick={() => setShowModal(false)} className="maven-modal-close">
                <XIcon />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="maven-modal-form">
              <div className="maven-modal-type-indicator">
                <span className="maven-modal-type-label">
                  {editingSkill ? 'Edit Skill Metadata' : 'New Skill'}
                </span>
                <span className="maven-modal-type-hint">
                  {editingSkill
                    ? 'Update the skill name and description'
                    : 'Create a new skill with custom behavior'}
                </span>
              </div>

              {formError && (
                <div className="maven-modal-error">
                  {formError}
                </div>
              )}

              {/* Name */}
              <div className="maven-modal-field">
                <label>Name <span className="maven-modal-required">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="my-skill-name"
                  disabled={!!editingSkill}
                  className={editingSkill ? 'maven-modal-field-disabled' : ''}
                />
                <span className="maven-modal-field-hint">
                  Letters, numbers, hyphens, and underscores only. 3-50 characters.
                </span>
              </div>

              {/* Description */}
              <div className="maven-modal-field">
                <label>Description <span className="maven-modal-optional">(optional)</span></label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Describe what this skill does..."
                />
              </div>

              {/* Actions */}
              <div className="maven-modal-form-actions">
                <button
                  type="button"
                  className="maven-modal-button maven-modal-button-cancel"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="maven-modal-button maven-modal-button-confirm"
                  disabled={!formData.name.trim() || isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : (editingSkill ? 'Update Skill' : 'Create Skill')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="maven-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="maven-modal" onClick={(e) => e.stopPropagation()}>
            <div className="maven-modal-header">
              <h3>Delete Skill</h3>
              <button onClick={() => setDeleteTarget(null)} className="maven-modal-close">
                <XIcon />
              </button>
            </div>
            <div className="maven-modal-body">
              <p>Are you sure you want to delete "{deleteTarget.name}"? This action cannot be undone.</p>
            </div>
            <div className="maven-modal-form-actions">
              <button
                type="button"
                className="maven-modal-button maven-modal-button-cancel"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="maven-modal-button maven-modal-button-danger"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
