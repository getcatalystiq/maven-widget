import React, { useEffect, useState } from 'react';
import { useSkillBuilder } from '../context/SkillBuilderContext';
import { SkillSummary } from '../types';

interface SkillsListProps {
  onSkillSelect: () => void;
  onClose: () => void;
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

const CodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="maven-icon">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
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

// Slug generator
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Expanded emoji palette
const EMOJI_CATEGORIES = [
  ['⚡', '🔧', '📊', '📈', '🎯', '💡', '🚀', '✨'],
  ['📝', '📋', '📁', '🔍', '🔔', '💬', '📧', '📱'],
  ['🛒', '💳', '📦', '🏷️', '🎁', '💰', '📉', '🏦'],
  ['👤', '👥', '🔐', '🔑', '🛡️', '⚙️', '🔄', '📡'],
  ['🌐', '🔗', '📤', '📥', '☁️', '💾', '🗄️', '🖥️'],
  ['📅', '⏰', '🕐', '📆', '✅', '❌', '⚠️', 'ℹ️'],
  ['🎨', '🖼️', '📸', '🎬', '🎵', '🎮', '🏆', '🎪'],
  ['🌟', '💎', '🔥', '❤️', '🌈', '🍀', '🌙', '☀️'],
];

export function SkillsList({ onSkillSelect, onClose: _onClose }: SkillsListProps) {
  const { state, loadSkills, selectSkill, createSkill, updateSkill, deleteSkill } = useSkillBuilder();
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SkillSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    emoji: '⚡',
    category: 'general',
    url_patterns: [''],
    variables: [''],
  });

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  // Auto-generate slug from name when creating
  useEffect(() => {
    if (!editingSkill && formData.name) {
      setFormData(prev => ({ ...prev, slug: slugify(formData.name) }));
    }
  }, [formData.name, editingSkill]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (editingSkill) {
      setFormData({
        name: editingSkill.name,
        slug: editingSkill.slug,
        description: editingSkill.description || '',
        emoji: editingSkill.emoji || '1',
        category: editingSkill.category || 'general',
        url_patterns: editingSkill.url_patterns?.length ? editingSkill.url_patterns : [''],
        variables: editingSkill.variables?.length ? editingSkill.variables : [''],
      });
    } else {
      setFormData({
        name: '',
        slug: '',
        description: '',
        emoji: '⚡',
        category: 'general',
        url_patterns: [''],
        variables: [''],
      });
    }
    setShowEmojiPicker(false);
  }, [editingSkill, showModal]);

  const filteredSkills = state.skills.filter(skill =>
    skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    skill.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (skill.description && skill.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleOpenEditor = (skill: SkillSummary) => {
    selectSkill(skill);
    onSkillSelect();
  };

  const handleEditMetadata = (skill: SkillSummary) => {
    setEditingSkill(skill);
    setShowModal(true);
  };

  const handleDeleteClick = (skill: SkillSummary) => {
    setDeleteTarget(skill);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    await deleteSkill(deleteTarget.id);
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingSkill) {
        await updateSkill(editingSkill.id, {
          name: formData.name,
          description: formData.description || undefined,
          emoji: formData.emoji,
          category: formData.category,
          url_patterns: formData.url_patterns.filter(p => p.trim()),
          variables: formData.variables.filter(v => v.trim()),
        });
      } else {
        const skill = await createSkill(formData.name);
        if (skill) {
          await updateSkill(skill.id, {
            description: formData.description || undefined,
            emoji: formData.emoji,
            category: formData.category,
            url_patterns: formData.url_patterns.filter(p => p.trim()),
            variables: formData.variables.filter(v => v.trim()),
          });
        }
      }
      setShowModal(false);
      setEditingSkill(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateUrlPattern = (index: number, value: string) => {
    const newPatterns = [...formData.url_patterns];
    newPatterns[index] = value;
    setFormData({ ...formData, url_patterns: newPatterns });
  };

  const addUrlPattern = () => {
    setFormData({ ...formData, url_patterns: [...formData.url_patterns, ''] });
  };

  const removeUrlPattern = (index: number) => {
    setFormData({
      ...formData,
      url_patterns: formData.url_patterns.filter((_, i) => i !== index),
    });
  };

  const updateVariable = (index: number, value: string) => {
    const newVariables = [...formData.variables];
    newVariables[index] = value;
    setFormData({ ...formData, variables: newVariables });
  };

  const addVariable = () => {
    setFormData({ ...formData, variables: [...formData.variables, ''] });
  };

  const removeVariable = (index: number) => {
    setFormData({
      ...formData,
      variables: formData.variables.filter((_, i) => i !== index),
    });
  };

  const handleEmojiSelect = (e: React.MouseEvent, emoji: string) => {
    e.preventDefault();
    e.stopPropagation();
    setFormData({ ...formData, emoji });
    setShowEmojiPicker(false);
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

        {/* Table */}
        <div className="maven-skills-list-content">
        {state.isLoadingSkills ? (
          <div className="maven-skills-list-loading">
            <div className="maven-skills-list-skeleton" />
            <div className="maven-skills-list-skeleton" />
            <div className="maven-skills-list-skeleton" />
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="maven-skills-list-empty">
            {searchQuery ? (
              <p>No skills match "{searchQuery}"</p>
            ) : (
              <>
                <div className="maven-skills-list-empty-icon">1</div>
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
                <th>Category</th>
                <th>URL Patterns</th>
                <th>Variables</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSkills.map((skill) => (
                <tr key={skill.id}>
                  <td>
                    <div className="maven-skills-table-skill">
                      <span className="maven-skills-table-emoji">{skill.emoji || '1'}</span>
                      <div>
                        <div className="maven-skills-table-name">{skill.name}</div>
                        {skill.description && (
                          <div className="maven-skills-table-description">{skill.description}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="maven-skills-table-badge">{skill.category || 'general'}</span>
                  </td>
                  <td>
                    <div className="maven-skills-table-patterns">
                      {skill.url_patterns?.slice(0, 2).map((pattern, i) => (
                        <span key={i} className="maven-skills-table-badge maven-skills-table-badge-info">{pattern}</span>
                      ))}
                      {(skill.url_patterns?.length || 0) > 2 && (
                        <span className="maven-skills-table-badge">+{(skill.url_patterns?.length || 0) - 2}</span>
                      )}
                      {!skill.url_patterns?.length && <span className="maven-skills-table-muted">-</span>}
                    </div>
                  </td>
                  <td>
                    <span className="maven-skills-table-muted maven-skills-table-mono">
                      {skill.variables?.length || '-'}
                    </span>
                  </td>
                  <td>
                    <div className="maven-skills-table-actions">
                      <button
                        onClick={() => handleOpenEditor(skill)}
                        title="Open in IDE"
                        className="maven-skills-table-action maven-skills-table-action-code"
                      >
                        <CodeIcon />
                      </button>
                      <button
                        onClick={() => handleEditMetadata(skill)}
                        title="Edit metadata"
                        className="maven-skills-table-action"
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
          <div className="maven-modal maven-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="maven-modal-header">
              <h3>{editingSkill ? 'Edit Skill' : 'Create Skill'}</h3>
              <button onClick={() => setShowModal(false)} className="maven-modal-close">
                <XIcon />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="maven-modal-form">
              <div className="maven-modal-type-indicator">
                <span className="maven-modal-type-label">
                  {editingSkill ? 'Edit Skill Configuration' : 'New Skill'}
                </span>
                <span className="maven-modal-type-hint">
                  {editingSkill
                    ? 'Update the skill metadata and configuration'
                    : 'Create a new skill with custom behavior'}
                </span>
              </div>

              {/* Name with Emoji */}
              <div className="maven-modal-field">
                <label>Name <span className="maven-modal-required">*</span></label>
                <div className="maven-skill-name-row">
                  <div className="maven-skill-emoji-picker-wrapper">
                    <button
                      type="button"
                      className="maven-skill-emoji-button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    >
                      {formData.emoji}
                    </button>
                    {showEmojiPicker && (
                      <>
                        <div
                          className="maven-skill-emoji-backdrop"
                          onClick={() => setShowEmojiPicker(false)}
                        />
                        <div
                          className="maven-skill-emoji-dropdown"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {EMOJI_CATEGORIES.map((row, rowIndex) => (
                            <div key={rowIndex} className="maven-skill-emoji-row">
                              {row.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  className="maven-skill-emoji-option"
                                  onClick={(e) => handleEmojiSelect(e, emoji)}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Get Order Status"
                    className="maven-skill-name-input"
                  />
                </div>
              </div>

              {/* Slug - display-only when editing, editable when creating */}
              {editingSkill ? (
                <div className="maven-modal-field">
                  <label>Slug</label>
                  <div className="maven-skill-slug-display">{formData.slug}</div>
                </div>
              ) : (
                <div className="maven-modal-field">
                  <label>Slug <span className="maven-modal-optional">(auto-generated)</span></label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="auto-generated from name"
                    className="maven-skill-form-mono"
                  />
                </div>
              )}

              {/* Description */}
              <div className="maven-modal-field">
                <label>Description <span className="maven-modal-optional">(optional)</span></label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Help users check their order status"
                />
              </div>

              {/* Category */}
              <div className="maven-modal-field">
                <label>Category <span className="maven-modal-required">*</span></label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="general">General</option>
                  <option value="support">Support</option>
                  <option value="sales">Sales</option>
                  <option value="documentation">Documentation</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {/* URL Patterns */}
              <div className="maven-modal-field">
                <label>URL Patterns <span className="maven-modal-optional">(optional)</span></label>
                <div className="maven-skill-form-list">
                  {formData.url_patterns.map((pattern, index) => (
                    <div key={index} className="maven-skill-form-list-item">
                      <input
                        type="text"
                        value={pattern}
                        onChange={(e) => updateUrlPattern(index, e.target.value)}
                        placeholder="/orders/*"
                        className="maven-skill-form-mono"
                      />
                      {formData.url_patterns.length > 1 && (
                        <button type="button" onClick={() => removeUrlPattern(index)} className="maven-skill-form-remove">
                          <XIcon />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={addUrlPattern} className="maven-skill-form-add">
                    <PlusIcon /> Add URL Pattern
                  </button>
                </div>
              </div>

              {/* Variables */}
              <div className="maven-modal-field">
                <label>Variables <span className="maven-modal-optional">(optional)</span></label>
                <div className="maven-skill-form-list">
                  {formData.variables.map((variable, index) => (
                    <div key={index} className="maven-skill-form-list-item">
                      <input
                        type="text"
                        value={variable}
                        onChange={(e) => updateVariable(index, e.target.value)}
                        placeholder="orderNumber"
                        className="maven-skill-form-mono"
                      />
                      <button type="button" onClick={() => removeVariable(index)} className="maven-skill-form-remove">
                        <XIcon />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addVariable} className="maven-skill-form-add">
                    <PlusIcon /> Add Variable
                  </button>
                </div>
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
