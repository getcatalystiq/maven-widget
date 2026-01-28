/**
 * Skills REST API client
 *
 * Plain functions for interacting with the Maven Core /admin/skills/* endpoints.
 * Uses AbortSignal for request cancellation and provides structured error handling.
 */

import type { Skill, SkillWithContent, SkillCreatePayload, SkillUpdatePayload } from '../types';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/**
 * Structured API error with status code and optional error code
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get retryable(): boolean {
    // 5xx errors and network errors are retryable
    return this.status >= 500 || this.status === 0;
  }
}

/**
 * Partial create error - skill was created but assignment failed
 */
export class PartialCreateError extends Error {
  constructor(
    message: string,
    public readonly skillId: string,
    public readonly originalError: unknown
  ) {
    super(message);
    this.name = 'PartialCreateError';
  }
}

interface ApiConfig {
  baseUrl: string;
  getToken: () => Promise<string>;
  userId: string;
}

let config: ApiConfig | null = null;

/**
 * Initialize the skills API with configuration.
 * Must be called before any API functions.
 */
export function initSkillsApi(cfg: ApiConfig): void {
  config = cfg;
}

/**
 * Get current API configuration (for testing/debugging)
 */
export function getApiConfig(): ApiConfig | null {
  return config;
}

/**
 * Internal request helper with authentication and error handling
 */
async function request<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  if (!config) {
    throw new Error('Skills API not initialized. Call initSkillsApi() first.');
  }

  const token = await config.getToken();

  const headers: HeadersInit = {
    'Authorization': `Bearer ${token}`,
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new ApiError(
      errorBody.message ?? errorBody.error ?? `Request failed with status ${response.status}`,
      response.status,
      errorBody.code
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// ============================================================================
// Public API Functions
// ============================================================================

/**
 * List all skills for the current tenant
 */
export function listSkills(signal?: AbortSignal): Promise<{ skills: Skill[]; total: number }> {
  return request<{ skills: Skill[]; total: number }>('GET', '/admin/skills', undefined, signal);
}

/**
 * Get a single skill with its content
 */
export function getSkill(id: string, signal?: AbortSignal): Promise<SkillWithContent> {
  return request<SkillWithContent>('GET', `/admin/skills/${encodeURIComponent(id)}`, undefined, signal);
}

/**
 * Create a new skill and auto-assign to current user.
 *
 * Note: This is a two-step operation. If assignment fails after skill creation,
 * a PartialCreateError is thrown with the skill ID for recovery.
 */
export async function createSkillWithAssignment(
  data: SkillCreatePayload,
  signal?: AbortSignal
): Promise<Skill> {
  if (!config) {
    throw new Error('Skills API not initialized. Call initSkillsApi() first.');
  }

  const skill = await request<Skill>('POST', '/admin/skills', {
    name: data.name,
    description: data.description,
    content: data.content,
  }, signal);

  try {
    // Auto-assign to current user
    await request('POST', `/admin/skills/${skill.id}/users/${config.userId}`, undefined, signal);
  } catch (assignmentError) {
    throw new PartialCreateError(
      `Skill "${skill.name}" was created but couldn't be assigned to you. ` +
      `Contact support with skill ID: ${skill.id}`,
      skill.id,
      assignmentError
    );
  }

  return skill;
}

/**
 * Update an existing skill
 */
export function updateSkill(
  id: string,
  data: SkillUpdatePayload,
  signal?: AbortSignal
): Promise<Skill> {
  return request<Skill>('PATCH', `/admin/skills/${encodeURIComponent(id)}`, data, signal);
}

/**
 * Delete a skill
 */
export function deleteSkill(id: string, signal?: AbortSignal): Promise<void> {
  return request<void>('DELETE', `/admin/skills/${encodeURIComponent(id)}`, undefined, signal);
}

/**
 * Toggle skill enabled/disabled state
 */
export function toggleSkillEnabled(
  id: string,
  enabled: boolean,
  signal?: AbortSignal
): Promise<void> {
  const action = enabled ? 'enable' : 'disable';
  return request<void>('POST', `/admin/skills/${encodeURIComponent(id)}/${action}`, undefined, signal);
}
