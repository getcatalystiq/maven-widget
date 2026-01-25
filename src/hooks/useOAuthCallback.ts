import { useEffect, useCallback } from 'react';

export interface OAuthResult {
  success: boolean;
  providerId?: string;
  error?: string;
  /** If true, the error is retriable (e.g., session expired) */
  retryable?: boolean;
  /** Tenant slug from the OAuth flow */
  tenantSlug?: string;
}

/**
 * Parse OAuth result from URL fragment.
 * This is used by the widget to detect OAuth completion after redirect.
 */
function parseOAuthResultFromHash(hash: string): OAuthResult | null {
  if (!hash || !hash.includes('maven_oauth=')) {
    return null;
  }

  // Remove leading # if present
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(fragment);

  const status = params.get('maven_oauth');
  if (!status) {
    return null;
  }

  return {
    success: status === 'success',
    providerId: params.get('provider') || undefined,
    error: params.get('message') || undefined,
  };
}

interface UseOAuthCallbackOptions {
  onSuccess?: (result: OAuthResult) => void;
  onError?: (result: OAuthResult) => void;
}

/**
 * Hook to detect OAuth callback results from URL fragment.
 *
 * After OAuth authorization, the callback redirects back to the host page
 * with the result in the URL fragment (e.g., #maven_oauth=success&provider=123).
 *
 * This hook:
 * 1. Checks for OAuth result on mount
 * 2. Clears the hash from URL to clean up
 * 3. Calls the appropriate callback (onSuccess or onError)
 *
 * @example
 * useOAuthCallback({
 *   onSuccess: (result) => {
 *     // Refresh OAuth connections, show toast
 *     console.log('Connected to provider:', result.providerId);
 *   },
 *   onError: (result) => {
 *     console.error('OAuth failed:', result.error);
 *   }
 * });
 */
export function useOAuthCallback(options: UseOAuthCallbackOptions = {}) {
  const { onSuccess, onError } = options;

  const handleOAuthResult = useCallback((result: OAuthResult) => {
    if (result.success) {
      onSuccess?.(result);
    } else {
      onError?.(result);
    }
  }, [onSuccess, onError]);

  useEffect(() => {
    // Check URL fragment for OAuth result
    const hash = window.location.hash;
    const result = parseOAuthResultFromHash(hash);

    if (result) {
      // Clear the hash to clean up URL
      // Use replaceState to avoid adding to browser history
      const cleanUrl = window.location.pathname + window.location.search;
      window.history.replaceState(null, '', cleanUrl);

      // Handle the result
      handleOAuthResult(result);
    }
  }, [handleOAuthResult]);

  // Listen for postMessage from OAuth popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Handle OAuth error from popup (e.g., session expired)
      if (event.data?.type === 'maven_oauth_error' || event.data?.type === 'oauth_error') {
        const isSessionExpired = event.data.error === 'session_expired';
        handleOAuthResult({
          success: false,
          error: isSessionExpired ? 'Authorization session expired' : (event.data.error || event.data.description || 'OAuth failed'),
          retryable: isSessionExpired,
          tenantSlug: event.data.tenantSlug,
          providerId: event.data.connector_id,
        });
      }

      // Handle OAuth success from popup
      if (event.data?.type === 'maven_oauth_success' || event.data?.type === 'oauth_success') {
        handleOAuthResult({
          success: true,
          tenantSlug: event.data.tenantSlug,
          providerId: event.data.connector_id,
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleOAuthResult]);
}

/**
 * Open OAuth popup window and wait for completion.
 *
 * Note: For cross-origin scenarios where the widget is embedded on a third-party site,
 * postMessage won't work reliably. Instead, use the redirect flow with useOAuthCallback.
 *
 * This utility is provided for same-origin scenarios where popup is preferred.
 */
export async function openOAuthPopup(consentUrl: string): Promise<OAuthResult> {
  return new Promise((resolve) => {
    const popup = window.open(
      consentUrl,
      'maven_oauth',
      'width=600,height=700,popup,noopener,noreferrer'
    );

    if (!popup) {
      resolve({ success: false, error: 'Popup blocked by browser' });
      return;
    }

    // Poll for popup closure and check URL
    const pollTimer = setInterval(() => {
      try {
        // If popup is closed, stop polling
        if (popup.closed) {
          clearInterval(pollTimer);
          // We can't know if it succeeded from here
          // The redirect flow handles this better
          resolve({ success: false, error: 'Authorization window closed' });
          return;
        }

        // Try to read popup location (will throw if cross-origin)
        const popupUrl = popup.location.href;
        const hash = popup.location.hash;
        const result = parseOAuthResultFromHash(hash);

        if (result) {
          clearInterval(pollTimer);
          popup.close();
          resolve(result);
        }
      } catch {
        // Cross-origin error - can't read popup location
        // This is expected during OAuth flow
      }
    }, 500);

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(pollTimer);
      if (!popup.closed) {
        popup.close();
      }
      resolve({ success: false, error: 'Authorization timed out' });
    }, 5 * 60 * 1000);
  });
}
