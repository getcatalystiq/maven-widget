import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react';
import { AuthService, AuthUser, AuthError, extractUserFromToken } from '../utils/authService';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  getToken: () => Promise<string>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  controlPlaneUrl: string;
  tenantId: string;
  onAuthStateChange?: (isAuthenticated: boolean) => void;
}

export function AuthProvider({
  children,
  controlPlaneUrl,
  tenantId,
  onAuthStateChange,
}: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create auth service instance (memoized)
  const authService = useMemo(() => {
    return new AuthService(controlPlaneUrl, tenantId);
  }, [controlPlaneUrl, tenantId]);

  // Check for existing session on mount
  useEffect(() => {
    async function checkAuth() {
      setIsLoading(true);
      try {
        // Try to get a valid token (will refresh if needed)
        const token = await authService.getValidToken();
        const userInfo = extractUserFromToken(token);
        setUser(userInfo);
        setIsAuthenticated(true);
        onAuthStateChange?.(true);
      } catch (err) {
        // No valid session
        setIsAuthenticated(false);
        setUser(null);
        onAuthStateChange?.(false);
      } finally {
        setIsLoading(false);
      }
    }

    // Only check if we have a refresh token
    if (authService.getRefreshToken()) {
      checkAuth();
    } else {
      setIsLoading(false);
      setIsAuthenticated(false);
      onAuthStateChange?.(false);
    }
  }, [authService, onAuthStateChange]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login(email, password);
      const userInfo = response.user || extractUserFromToken(response.access_token);
      setUser(userInfo);
      setIsAuthenticated(true);
      onAuthStateChange?.(true);
      return true;
    } catch (err) {
      const authError = err as AuthError;
      setError(authError.message || 'Login failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [authService, onAuthStateChange]);

  const register = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.register(email, password);
      const userInfo = response.user || extractUserFromToken(response.access_token);
      setUser(userInfo);
      setIsAuthenticated(true);
      onAuthStateChange?.(true);
      return true;
    } catch (err) {
      const authError = err as AuthError;
      setError(authError.message || 'Registration failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [authService, onAuthStateChange]);

  const logout = useCallback(() => {
    authService.logout();
    setIsAuthenticated(false);
    setUser(null);
    setError(null);
    onAuthStateChange?.(false);
  }, [authService, onAuthStateChange]);

  const getToken = useCallback(async (): Promise<string> => {
    return authService.getValidToken();
  }, [authService]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextValue = {
    isAuthenticated,
    isLoading,
    user,
    error,
    login,
    register,
    logout,
    getToken,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Optional auth hook - returns null if not within AuthProvider
 * Use this in components that may or may not be wrapped in AuthProvider
 */
export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}

export type { AuthUser };
