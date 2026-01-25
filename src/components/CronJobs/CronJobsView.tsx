import React, { useEffect } from 'react';
import { useCronJobs } from '../../contexts/CronJobsContext';
import { CronJobsList } from './CronJobsList';
import { CronJobModal } from './CronJobModal';

interface CronJobsViewProps {
  onClose: () => void;
}

// Icons
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const CloseIcon = () => (
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

export function CronJobsView({ onClose }: CronJobsViewProps) {
  const { state, dispatch, loadCronJobs, loadSkills, openCreateModal } = useCronJobs();

  useEffect(() => {
    loadCronJobs();
    loadSkills();
  }, [loadCronJobs, loadSkills]);

  return (
    <div className="maven-admin-view">
      {/* Header - Search + New Job */}
      <div className="maven-admin-header maven-admin-header-compact">
        <div className="maven-admin-search">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search jobs..."
            value={state.searchQuery}
            onChange={(e) => dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value })}
          />
        </div>
        <button className="maven-admin-btn maven-admin-btn-primary" onClick={openCreateModal}>
          <PlusIcon />
          New Job
        </button>
      </div>

      {/* Content */}
      <div className="maven-admin-content">
        {state.error && (
          <div className="maven-admin-error">
            <AlertIcon />
            <span>{state.error}</span>
            <button onClick={() => dispatch({ type: 'SET_ERROR', payload: null })}>
              <CloseIcon />
            </button>
          </div>
        )}

        {state.isLoading ? (
          <div className="maven-admin-loading">
            <div className="maven-admin-spinner" />
            <span>Loading scheduled jobs...</span>
          </div>
        ) : state.cronJobs.length === 0 ? (
          <div className="maven-admin-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <h3>No scheduled jobs yet</h3>
            <p>Create your first scheduled job to automate tasks.</p>
            <button className="maven-admin-btn maven-admin-btn-primary" onClick={openCreateModal}>
              <PlusIcon />
              Create Job
            </button>
          </div>
        ) : (
          <CronJobsList showSearch={false} />
        )}
      </div>

      {state.isModalOpen && <CronJobModal />}
    </div>
  );
}
