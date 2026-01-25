import React, { useState, useEffect } from 'react';
import { useCronJobs, CronJob } from '../../contexts/CronJobsContext';

// Common cron presets
const CRON_PRESETS = [
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at 9 AM', value: '0 9 * * *' },
  { label: 'Every weekday at 9 AM', value: '0 9 * * 1-5' },
  { label: 'Every Monday at 9 AM', value: '0 9 * * 1' },
  { label: 'Every day at midnight', value: '0 0 * * *' },
  { label: 'First of month at 9 AM', value: '0 9 1 * *' },
  { label: 'Custom', value: 'custom' },
];

// Common timezones
const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Australia/Sydney',
];

interface FormData {
  name: string;
  description: string;
  skill_id: string;
  skill_variables: Record<string, unknown>;
  cron_expression: string;
  timezone: string;
  output_to_widget: boolean;
  output_to_email: boolean;
  enabled: boolean;
  target_users: string[];
}

// Icons
const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);

export function CronJobModal() {
  const { state, closeModal, createCronJob, updateCronJob, userId } = useCronJobs();
  const isEdit = state.modalMode === 'edit';
  const existingJob = state.selectedCronJob;

  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    skill_id: '',
    skill_variables: {},
    cron_expression: '0 9 * * *',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
    output_to_widget: true,
    output_to_email: false,
    enabled: true,
    target_users: userId ? [userId] : [],
  });

  const [cronPreset, setCronPreset] = useState<string>('0 9 * * *');
  const [isCustomCron, setIsCustomCron] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isEdit && existingJob) {
      // Parse target_users - handle both string and object formats
      const targetUsers = (existingJob.target_users || []).map((u) =>
        typeof u === 'string' ? u : u.user_id
      );

      setFormData({
        name: existingJob.name,
        description: existingJob.description || '',
        skill_id: existingJob.skill_id,
        skill_variables: existingJob.skill_variables || {},
        cron_expression: existingJob.cron_expression,
        timezone: existingJob.timezone,
        output_to_widget: existingJob.output_to_widget,
        output_to_email: existingJob.output_to_email,
        enabled: existingJob.enabled,
        target_users: targetUsers,
      });

      // Check if it matches a preset
      const preset = CRON_PRESETS.find((p) => p.value === existingJob.cron_expression);
      if (preset) {
        setCronPreset(preset.value);
        setIsCustomCron(false);
      } else {
        setCronPreset('custom');
        setIsCustomCron(true);
      }
    }
  }, [isEdit, existingJob]);

  const handlePresetChange = (preset: string) => {
    setCronPreset(preset);
    if (preset === 'custom') {
      setIsCustomCron(true);
    } else {
      setIsCustomCron(false);
      setFormData((prev) => ({ ...prev, cron_expression: preset }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.skill_id) {
      newErrors.skill_id = 'Please select a skill';
    }

    if (!formData.cron_expression.trim()) {
      newErrors.cron_expression = 'Cron expression is required';
    } else {
      // Basic cron validation (5 parts separated by spaces)
      const parts = formData.cron_expression.trim().split(/\s+/);
      if (parts.length !== 5) {
        newErrors.cron_expression = 'Invalid cron expression (should have 5 parts)';
      }
    }

    if (!formData.target_users || formData.target_users.length === 0) {
      newErrors.target_users = 'At least one target user is required. Please ensure you are signed in.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    // Format target_users as objects with user_id key
    const targetUsers = formData.target_users.map((userId) => ({ user_id: userId }));

    const data = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      skill_id: formData.skill_id,
      skill_variables: formData.skill_variables,
      cron_expression: formData.cron_expression.trim(),
      timezone: formData.timezone,
      output_to_widget: formData.output_to_widget,
      output_to_email: formData.output_to_email,
      enabled: formData.enabled,
      target_users: targetUsers,
    };

    if (isEdit && existingJob) {
      await updateCronJob(existingJob.id, data);
    } else {
      await createCronJob(data as Omit<CronJob, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>);
    }
  };

  const selectedSkill = state.skills.find((s) => s.id === formData.skill_id);

  return (
    <div className="maven-modal-overlay" onClick={closeModal}>
      <div className="maven-modal maven-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="maven-modal-header">
          <h3>{isEdit ? 'Edit Job' : 'Create Job'}</h3>
          <button className="maven-modal-close" onClick={closeModal}>
            <XIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="maven-modal-form">
          {state.error && (
            <div className="maven-admin-error">
              <AlertIcon />
              <span>{state.error}</span>
            </div>
          )}

          {/* Type indicator */}
          <div className="maven-modal-type-indicator">
            <span className="maven-modal-type-label">Scheduled Job</span>
            <span className="maven-modal-type-hint">
              Jobs run automatically on a schedule using a skill
            </span>
          </div>

          {/* Name */}
          <div className="maven-modal-field">
            <label htmlFor="name">
              Name <span className="maven-modal-required">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Daily Report"
            />
            {errors.name && <span className="maven-modal-field-error">{errors.name}</span>}
          </div>

          {/* Description */}
          <div className="maven-modal-field">
            <label htmlFor="description">
              Description <span className="maven-modal-optional">(optional)</span>
            </label>
            <input
              type="text"
              id="description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description of what this job does"
            />
          </div>

          {/* Skill */}
          <div className="maven-modal-field">
            <label htmlFor="skill">
              Skill <span className="maven-modal-required">*</span>
            </label>
            <select
              id="skill"
              value={formData.skill_id}
              onChange={(e) => setFormData((prev) => ({ ...prev, skill_id: e.target.value }))}
            >
              <option value="">Select a skill...</option>
              {state.skills.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.emoji ? `${skill.emoji} ` : ''}
                  {skill.name}
                </option>
              ))}
            </select>
            {errors.skill_id && <span className="maven-modal-field-error">{errors.skill_id}</span>}
            {selectedSkill && (
              <span className="maven-modal-field-hint">
                Selected: {selectedSkill.emoji} {selectedSkill.name}
              </span>
            )}
          </div>

          {/* Schedule & Timezone */}
          <div className="maven-modal-form-row">
            <div className="maven-modal-field">
              <label htmlFor="schedule">Schedule</label>
              <select
                id="schedule"
                value={cronPreset}
                onChange={(e) => handlePresetChange(e.target.value)}
              >
                {CRON_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="maven-modal-field">
              <label htmlFor="timezone">Timezone</label>
              <select
                id="timezone"
                value={formData.timezone}
                onChange={(e) => setFormData((prev) => ({ ...prev, timezone: e.target.value }))}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom cron expression */}
          {isCustomCron && (
            <div className="maven-modal-field">
              <label htmlFor="cron_expression">
                Cron Expression <span className="maven-modal-required">*</span>
              </label>
              <input
                type="text"
                id="cron_expression"
                value={formData.cron_expression}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, cron_expression: e.target.value }))
                }
                placeholder="*/15 * * * *"
              />
              {errors.cron_expression && (
                <span className="maven-modal-field-error">{errors.cron_expression}</span>
              )}
              <span className="maven-modal-field-hint">
                Format: minute hour day-of-month month day-of-week
              </span>
            </div>
          )}

          {/* Output Destinations */}
          <div className="maven-modal-field">
            <label>Output Destinations</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <label className="maven-modal-checkbox">
                <input
                  type="checkbox"
                  checked={formData.output_to_widget}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, output_to_widget: e.target.checked }))
                  }
                />
                Widget (show in chat)
              </label>
              <label className="maven-modal-checkbox">
                <input
                  type="checkbox"
                  checked={formData.output_to_email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, output_to_email: e.target.checked }))
                  }
                />
                Email
              </label>
            </div>
          </div>

          {/* Target Users Info */}
          <div className="maven-modal-field">
            <label>Target User</label>
            {userId ? (
              <span className="maven-modal-field-hint" style={{ color: '#16a34a' }}>
                ✓ Job will run for the current user
              </span>
            ) : (
              <span className="maven-modal-field-error">
                No user signed in. You must be signed in to create scheduled jobs.
              </span>
            )}
            {errors.target_users && (
              <span className="maven-modal-field-error">{errors.target_users}</span>
            )}
          </div>

          {/* Enabled toggle */}
          <div className="maven-modal-field">
            <div className="maven-modal-toggle-label">
              <span>Enabled</span>
              <button
                type="button"
                className={`maven-modal-toggle ${formData.enabled ? 'maven-modal-toggle-on' : 'maven-modal-toggle-off'}`}
                onClick={() => setFormData((prev) => ({ ...prev, enabled: !prev.enabled }))}
              >
                <div className="maven-modal-toggle-thumb" />
              </button>
            </div>
            <span className="maven-modal-toggle-hint">
              {formData.enabled ? 'Job will run on schedule' : 'Job is paused'}
            </span>
          </div>

          {/* Actions */}
          <div className="maven-modal-form-actions">
            <button type="button" className="maven-admin-btn maven-admin-btn-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button
              type="submit"
              className="maven-admin-btn maven-admin-btn-primary"
              disabled={state.isSaving}
            >
              {state.isSaving ? (isEdit ? 'Saving...' : 'Creating...') : isEdit ? 'Save Changes' : 'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
