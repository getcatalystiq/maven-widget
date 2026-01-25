import React, { useState } from 'react';
import { useCronJobs, CronJob } from '../../contexts/CronJobsContext';

// Icons
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

// Helper to format cron expression to human readable
function formatCronExpression(expression: string): string {
  const parts = expression.split(' ');
  if (parts.length !== 5) return expression;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Common patterns
  if (minute === '0' && hour === '9' && dayOfMonth === '*' && month === '*' && dayOfWeek === '1-5') {
    return 'Weekdays at 9 AM';
  }
  if (minute === '0' && hour === '9' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Daily at 9 AM';
  }
  if (minute === '0' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every hour';
  }
  if (minute === '*/15' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every 15 min';
  }
  if (minute === '0' && hour === '0' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Daily at midnight';
  }
  if (dayOfMonth === '1' && month === '*') {
    return `Monthly at ${hour}:${minute.padStart(2, '0')}`;
  }

  return expression;
}

function formatLastRun(dateString: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

interface CronJobsListProps {
  showSearch?: boolean;
}

export function CronJobsList({ showSearch = true }: CronJobsListProps) {
  const { state, dispatch, openEditModal, deleteCronJob, updateCronJob, runCronJob } = useCronJobs();
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());
  const [deletingJob, setDeletingJob] = useState<string | null>(null);

  const filteredJobs = state.cronJobs.filter((job) => {
    if (!state.searchQuery) return true;
    const query = state.searchQuery.toLowerCase();
    return (
      job.name.toLowerCase().includes(query) ||
      (job.description?.toLowerCase().includes(query) ?? false) ||
      (job.skills?.name.toLowerCase().includes(query) ?? false)
    );
  });

  const handleToggleEnabled = async (job: CronJob) => {
    await updateCronJob(job.id, { enabled: !job.enabled });
  };

  const handleRunNow = async (jobId: string) => {
    setRunningJobs((prev) => new Set(prev).add(jobId));
    try {
      await runCronJob(jobId);
    } finally {
      setRunningJobs((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  const handleDelete = async (job: CronJob) => {
    if (!confirm(`Are you sure you want to delete "${job.name}"?`)) return;
    setDeletingJob(job.id);
    await deleteCronJob(job.id);
    setDeletingJob(null);
  };

  return (
    <>
      {/* Search */}
      {showSearch && (
        <div className="maven-admin-search">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search jobs..."
            value={state.searchQuery}
            onChange={(e) => dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value })}
          />
        </div>
      )}

      {/* Table */}
      <div className="maven-admin-table-wrapper">
        <table className="maven-admin-table">
          <thead>
            <tr>
              <th>Job</th>
              <th>Skill</th>
              <th>Schedule</th>
              <th>Status</th>
              <th>Last Run</th>
              <th>Enabled</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredJobs.map((job) => (
              <tr key={job.id} style={{ opacity: job.enabled ? 1 : 0.6 }}>
                <td>
                  <div className="maven-admin-table-item">
                    <div>
                      <div className="maven-admin-table-name">{job.name}</div>
                      {job.description && (
                        <div className="maven-admin-table-description">{job.description}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <span className="maven-admin-table-badge maven-admin-table-badge-info">
                    {job.skills?.emoji && <span style={{ marginRight: 4 }}>{job.skills.emoji}</span>}
                    {job.skills?.name || 'Unknown'}
                  </span>
                </td>
                <td>
                  <div>
                    <div className="maven-admin-table-name" style={{ fontWeight: 400 }}>
                      {formatCronExpression(job.cron_expression)}
                    </div>
                    <div className="maven-admin-table-description">{job.timezone}</div>
                  </div>
                </td>
                <td>
                  {job.last_run_status === 'running' || runningJobs.has(job.id) ? (
                    <span className="maven-admin-table-badge maven-admin-table-badge-warning">
                      Running
                    </span>
                  ) : job.last_run_status === 'success' ? (
                    <span className="maven-admin-table-badge maven-admin-table-badge-success">
                      <CheckIcon />
                      Success
                    </span>
                  ) : job.last_run_status === 'failed' ? (
                    <span
                      className="maven-admin-table-badge"
                      style={{ background: 'color-mix(in srgb, var(--maven-error) 15%, transparent)', color: 'var(--maven-error)' }}
                      title={job.last_error || 'Unknown error'}
                    >
                      <XIcon />
                      Failed
                    </span>
                  ) : (
                    <span className="maven-admin-table-badge">
                      <ClockIcon />
                      Pending
                    </span>
                  )}
                </td>
                <td>
                  <span className="maven-admin-table-muted">{formatLastRun(job.last_run_at)}</span>
                </td>
                <td>
                  <button
                    className={`maven-modal-toggle ${job.enabled ? 'maven-modal-toggle-on' : 'maven-modal-toggle-off'}`}
                    onClick={() => handleToggleEnabled(job)}
                    disabled={state.isSaving}
                  >
                    <div className="maven-modal-toggle-thumb" />
                  </button>
                </td>
                <td>
                  <div className="maven-admin-table-actions">
                    <button
                      className="maven-admin-table-action maven-admin-table-action-primary"
                      onClick={() => handleRunNow(job.id)}
                      disabled={runningJobs.has(job.id) || !job.enabled}
                      title="Run now"
                    >
                      <PlayIcon />
                    </button>
                    <button
                      className="maven-admin-table-action"
                      onClick={() => openEditModal(job)}
                      title="Edit"
                    >
                      <EditIcon />
                    </button>
                    <button
                      className="maven-admin-table-action maven-admin-table-action-delete"
                      onClick={() => handleDelete(job)}
                      disabled={deletingJob === job.id}
                      title="Delete"
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

      {filteredJobs.length === 0 && state.searchQuery && (
        <div className="maven-admin-empty">
          <p>No jobs matching "{state.searchQuery}"</p>
          <button className="maven-admin-btn maven-admin-btn-secondary" onClick={() => dispatch({ type: 'SET_SEARCH_QUERY', payload: '' })}>
            Clear search
          </button>
        </div>
      )}
    </>
  );
}
