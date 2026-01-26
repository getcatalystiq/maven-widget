/**
 * Authentication service for maven-core built-in auth
 * Handles login, register, token refresh, and storage
 */

import { decodeJwtPayload } from './jwtUtils';

export interface AuthUser {
  id: string;
  email: string;
  tenantId: string | null;
  roles: string[];
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user?: AuthUser;
}

export interface AuthError {
  message: string;
  status: number;
}

// Storage keys
const REFRESH_TOKEN_KEY = 'maven-auth-refresh-token';
const TOKEN_EXPIRY_KEY = 'maven-auth-token-expiry';

export class AuthService {
  private controlPlaneUrl: string;
  private tenantId: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private refreshPromise: Promise<string> | null = null;

  constructor(controlPlaneUrl: string, tenantId: string) {
    this.controlPlaneUrl = controlPlaneUrl.replace(/\/$/, ''); // Remove trailing slash
    this.tenantId = tenantId;

    // Try to restore token expiry from localStorage
    this.loadTokenExpiry();
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${this.controlPlaneUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': this.tenantId,
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Login failed' }));
      throw { message: error.message || 'Login failed', status: response.status } as AuthError;
    }

    const data: AuthResponse = await response.json();
    this.handleAuthResponse(data);
    return data;
  }

  /**
   * Register a new account
   */
  async register(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${this.controlPlaneUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, tenantId: this.tenantId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Registration failed' }));
      throw { message: error.message || 'Registration failed', status: response.status } as AuthError;
    }

    const data: AuthResponse = await response.json();
    this.handleAuthResponse(data);
    return data;
  }

  /**
   * Refresh the access token using the refresh token
   */
  async refresh(): Promise<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw { message: 'No refresh token available', status: 401 } as AuthError;
    }

    const response = await fetch(`${this.controlPlaneUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      // Clear tokens on refresh failure
      this.clearTokens();
      const error = await response.json().catch(() => ({ message: 'Token refresh failed' }));
      throw { message: error.message || 'Token refresh failed', status: response.status } as AuthError;
    }

    const data: AuthResponse = await response.json();
    this.handleAuthResponse(data);
    return data;
  }

  /**
   * Get a valid access token, refreshing if necessary
   * This is the main method used by the widget for authenticated requests
   */
  async getValidToken(): Promise<string> {
    // If we have a valid token in memory, return it
    if (this.accessToken && !this.isTokenExpiringSoon()) {
      return this.accessToken;
    }

    // If a refresh is already in progress, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Check if we have a refresh token
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw { message: 'Not authenticated', status: 401 } as AuthError;
    }

    // Start refresh and store promise to prevent concurrent refreshes
    this.refreshPromise = this.refresh()
      .then((response) => {
        this.refreshPromise = null;
        return response.access_token;
      })
      .catch((error) => {
        this.refreshPromise = null;
        throw error;
      });

    return this.refreshPromise;
  }

  /**
   * Check if user is authenticated (has a refresh token)
   */
  isAuthenticated(): boolean {
    return this.getRefreshToken() !== null;
  }

  /**
   * Handle auth response - store tokens and update state
   */
  private handleAuthResponse(response: AuthResponse): void {
    this.accessToken = response.access_token;
    this.saveRefreshToken(response.refresh_token);

    // Calculate and store expiry time
    // Subtract 60 seconds buffer to refresh before actual expiry
    const expiryTime = Date.now() + (response.expires_in * 1000) - 60000;
    this.tokenExpiry = expiryTime;
    this.saveTokenExpiry(expiryTime);
  }

  /**
   * Check if the access token is expiring soon (within 60 seconds)
   */
  private isTokenExpiringSoon(): boolean {
    return Date.now() >= this.tokenExpiry;
  }

  /**
   * Get the access token (may be expired)
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Save refresh token to localStorage
   */
  private saveRefreshToken(token: string): void {
    try {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } catch (e) {
      console.warn('[Maven Auth] Failed to save refresh token:', e);
    }
  }

  /**
   * Get refresh token from localStorage
   */
  getRefreshToken(): string | null {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch (e) {
      console.warn('[Maven Auth] Failed to get refresh token:', e);
      return null;
    }
  }

  /**
   * Save token expiry to localStorage
   */
  private saveTokenExpiry(expiry: number): void {
    try {
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiry.toString());
    } catch (e) {
      console.warn('[Maven Auth] Failed to save token expiry:', e);
    }
  }

  /**
   * Load token expiry from localStorage
   */
  private loadTokenExpiry(): void {
    try {
      const saved = localStorage.getItem(TOKEN_EXPIRY_KEY);
      if (saved) {
        this.tokenExpiry = parseInt(saved, 10);
      }
    } catch (e) {
      console.warn('[Maven Auth] Failed to load token expiry:', e);
    }
  }

  /**
   * Clear all stored tokens
   */
  clearTokens(): void {
    this.accessToken = null;
    this.tokenExpiry = 0;
    try {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
    } catch (e) {
      console.warn('[Maven Auth] Failed to clear tokens:', e);
    }
  }

  /**
   * Logout - clear all tokens
   */
  logout(): void {
    this.clearTokens();
  }
}

/**
 * Extract user info from access token
 */
export function extractUserFromToken(token: string): AuthUser | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  return {
    id: payload.sub || '',
    email: payload.email || '',
    tenantId: payload.tenant_id || null,
    roles: payload.roles || [],
  };
}
