import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';

// Types
export interface Skill {
  id: string;
  name: string;
  slug: string;
  emoji?: string;
}

export interface CronJob {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  skill_id: string;
  skill_variables: Record<string, unknown>;
  cron_expression: string;
  timezone: string;
  output_to_widget: boolean;
  output_to_email: boolean;
  enabled: boolean;
  target_users: (string | { user_id: string })[];
  last_run_at: string | null;
  last_run_status: 'success' | 'failed' | 'running' | null;
  last_error: string | null;
  eventbridge_schedule_arn: string | null;
  eventbridge_schedule_name: string | null;
  created_at?: string;
  updated_at?: string;
  skills?: Skill;
  skill_name?: string;
  skill_slug?: string;
  recent_executions?: CronJobExecution[];
}

export interface CronJobExecution {
  id: string;
  cron_job_id: string;
  user_id: string;
  started_at: string;
  completed_at: string | null;
  status: 'success' | 'failed' | 'running';
  error_message: string | null;
}

export interface CronJobsState {
  cronJobs: CronJob[];
  skills: Skill[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  selectedCronJob: CronJob | null;
  isModalOpen: boolean;
  modalMode: 'create' | 'edit';
  searchQuery: string;
}

type CronJobsAction =
  | { type: 'SET_CRON_JOBS'; payload: CronJob[] }
  | { type: 'SET_SKILLS'; payload: Skill[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SELECTED_CRON_JOB'; payload: CronJob | null }
  | { type: 'OPEN_MODAL'; payload: { mode: 'create' | 'edit'; cronJob?: CronJob } }
  | { type: 'CLOSE_MODAL' }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'ADD_CRON_JOB'; payload: CronJob }
  | { type: 'UPDATE_CRON_JOB'; payload: CronJob }
  | { type: 'DELETE_CRON_JOB'; payload: string }
  | { type: 'RESET' };

const initialState: CronJobsState = {
  cronJobs: [],
  skills: [],
  isLoading: false,
  isSaving: false,
  error: null,
  selectedCronJob: null,
  isModalOpen: false,
  modalMode: 'create',
  searchQuery: '',
};

function reducer(state: CronJobsState, action: CronJobsAction): CronJobsState {
  switch (action.type) {
    case 'SET_CRON_JOBS':
      return { ...state, cronJobs: action.payload, isLoading: false };

    case 'SET_SKILLS':
      return { ...state, skills: action.payload };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_SAVING':
      return { ...state, isSaving: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'SET_SELECTED_CRON_JOB':
      return { ...state, selectedCronJob: action.payload };

    case 'OPEN_MODAL':
      return {
        ...state,
        isModalOpen: true,
        modalMode: action.payload.mode,
        selectedCronJob: action.payload.cronJob || null,
      };

    case 'CLOSE_MODAL':
      return {
        ...state,
        isModalOpen: false,
        selectedCronJob: null,
      };

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };

    case 'ADD_CRON_JOB':
      return {
        ...state,
        cronJobs: [action.payload, ...state.cronJobs],
        isSaving: false,
      };

    case 'UPDATE_CRON_JOB':
      return {
        ...state,
        cronJobs: state.cronJobs.map((j) => (j.id === action.payload.id ? action.payload : j)),
        isSaving: false,
      };

    case 'DELETE_CRON_JOB':
      return {
        ...state,
        cronJobs: state.cronJobs.filter((j) => j.id !== action.payload),
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// Context
interface CronJobsContextValue {
  state: CronJobsState;
  dispatch: React.Dispatch<CronJobsAction>;
  userId?: string;
  loadCronJobs: () => Promise<void>;
  loadSkills: () => Promise<void>;
  createCronJob: (data: Omit<CronJob, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => Promise<CronJob | null>;
  updateCronJob: (id: string, data: Partial<CronJob>) => Promise<boolean>;
  deleteCronJob: (id: string) => Promise<boolean>;
  runCronJob: (id: string) => Promise<boolean>;
  openCreateModal: () => void;
  openEditModal: (cronJob: CronJob) => void;
  closeModal: () => void;
}

const CronJobsContext = createContext<CronJobsContextValue | null>(null);

interface CronJobsProviderProps {
  children: ReactNode;
  tenantId: string;
  adminApiUrl: string;
  getToken?: () => Promise<string>;
  userId?: string;
}

/**
 * CronJobsProvider - uses Admin API for all cron job operations.
 * Widget calls admin API directly, no longer goes through agent.
 */
export function CronJobsProvider({
  children,
  tenantId,
  adminApiUrl,
  getToken,
  userId,
}: CronJobsProviderProps) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Helper to make authenticated requests to admin API
  const callAdminApi = useCallback(
    async <T,>(method: string, path: string, body?: Record<string, unknown>): Promise<T> => {
      const url = `${adminApiUrl}/tenants/${tenantId}${path}`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (getToken) {
        const token = await getToken();
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Request failed');
      }

      return data;
    },
    [adminApiUrl, tenantId, getToken]
  );

  const loadCronJobs = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const data = await callAdminApi<{ cron_jobs: CronJob[] }>('GET', '/cron-jobs');
      // Transform skill fields to nested skills object
      const jobs = (data.cron_jobs || []).map((job) => ({
        ...job,
        skills: job.skill_name ? {
          id: job.skill_id,
          name: job.skill_name,
          slug: job.skill_slug || '',
          emoji: undefined,
        } : undefined,
      }));
      dispatch({ type: 'SET_CRON_JOBS', payload: jobs });
    } catch (error) {
      console.error('Load cron jobs error:', error);
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [callAdminApi]);

  const loadSkills = useCallback(async () => {
    try {
      // Use skills endpoint to get available skills
      const data = await callAdminApi<{ skills: Skill[] }>('GET', '/skills');
      dispatch({ type: 'SET_SKILLS', payload: data.skills || [] });
    } catch (error) {
      console.error('Load skills error:', error);
    }
  }, [callAdminApi]);

  const createCronJob = useCallback(
    async (data: Omit<CronJob, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<CronJob | null> => {
      dispatch({ type: 'SET_SAVING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      try {
        const result = await callAdminApi<CronJob>('POST', '/cron-jobs', {
          name: data.name,
          description: data.description,
          skill_id: data.skill_id,
          skill_variables: data.skill_variables,
          cron_expression: data.cron_expression,
          timezone: data.timezone,
          output_to_widget: data.output_to_widget,
          output_to_email: data.output_to_email,
          enabled: data.enabled,
          target_users: data.target_users,
        });
        if (result) {
          // Transform skill fields to nested skills object (same as loadCronJobs)
          const transformedJob = {
            ...result,
            skills: result.skill_name ? {
              id: result.skill_id,
              name: result.skill_name,
              slug: result.skill_slug || '',
              emoji: undefined,
            } : undefined,
          };
          dispatch({ type: 'ADD_CRON_JOB', payload: transformedJob });
          dispatch({ type: 'CLOSE_MODAL' });
          return transformedJob;
        }
        return null;
      } catch (error) {
        console.error('Create cron job error:', error);
        dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
        dispatch({ type: 'SET_SAVING', payload: false });
        return null;
      }
    },
    [callAdminApi]
  );

  const updateCronJob = useCallback(
    async (id: string, data: Partial<CronJob>): Promise<boolean> => {
      dispatch({ type: 'SET_SAVING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      try {
        await callAdminApi<CronJob>('PUT', `/cron-jobs/${id}`, data);
        // Fetch full job to get updated data
        const fullJob = await callAdminApi<CronJob>('GET', `/cron-jobs/${id}`);
        if (fullJob) {
          // Transform skill fields to nested skills object (same as loadCronJobs)
          const transformedJob = {
            ...fullJob,
            skills: fullJob.skill_name ? {
              id: fullJob.skill_id,
              name: fullJob.skill_name,
              slug: fullJob.skill_slug || '',
              emoji: undefined,
            } : undefined,
          };
          dispatch({ type: 'UPDATE_CRON_JOB', payload: transformedJob });
          dispatch({ type: 'CLOSE_MODAL' });
          return true;
        }
        return false;
      } catch (error) {
        console.error('Update cron job error:', error);
        dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
        dispatch({ type: 'SET_SAVING', payload: false });
        return false;
      }
    },
    [callAdminApi]
  );

  const deleteCronJob = useCallback(
    async (id: string): Promise<boolean> => {
      dispatch({ type: 'SET_ERROR', payload: null });
      try {
        await callAdminApi<{ deleted: boolean }>('DELETE', `/cron-jobs/${id}`);
        dispatch({ type: 'DELETE_CRON_JOB', payload: id });
        return true;
      } catch (error) {
        console.error('Delete cron job error:', error);
        dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
        return false;
      }
    },
    [callAdminApi]
  );

  const runCronJob = useCallback(
    async (id: string): Promise<boolean> => {
      dispatch({ type: 'SET_ERROR', payload: null });
      try {
        await callAdminApi<{ triggered: boolean }>('POST', `/cron-jobs/${id}/run`);
        // Reload to see updated status
        await loadCronJobs();
        return true;
      } catch (error) {
        console.error('Run cron job error:', error);
        dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
        return false;
      }
    },
    [callAdminApi, loadCronJobs]
  );

  const openCreateModal = useCallback(() => {
    dispatch({ type: 'OPEN_MODAL', payload: { mode: 'create' } });
  }, []);

  const openEditModal = useCallback(async (cronJob: CronJob) => {
    // Fetch full job data since list endpoint returns limited fields
    try {
      const fullJob = await callAdminApi<CronJob>('GET', `/cron-jobs/${cronJob.id}`);
      dispatch({ type: 'OPEN_MODAL', payload: { mode: 'edit', cronJob: fullJob } });
    } catch (error) {
      console.error('Failed to load cron job:', error);
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
    }
  }, [callAdminApi]);

  const closeModal = useCallback(() => {
    dispatch({ type: 'CLOSE_MODAL' });
  }, []);

  const value: CronJobsContextValue = {
    state,
    dispatch,
    userId,
    loadCronJobs,
    loadSkills,
    createCronJob,
    updateCronJob,
    deleteCronJob,
    runCronJob,
    openCreateModal,
    openEditModal,
    closeModal,
  };

  return <CronJobsContext.Provider value={value}>{children}</CronJobsContext.Provider>;
}

export function useCronJobs() {
  const context = useContext(CronJobsContext);
  if (!context) {
    throw new Error('useCronJobs must be used within CronJobsProvider');
  }
  return context;
}
