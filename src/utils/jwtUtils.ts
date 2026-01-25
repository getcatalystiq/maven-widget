/**
 * JWT utility functions for extracting user info from tokens
 */

interface JwtPayload {
  sub?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  first_name?: string;  // Clerk
  last_name?: string;   // Clerk
  email?: string;
  preferred_username?: string;
  [key: string]: any;
}

/**
 * Decode a JWT token and extract the payload
 * Note: This does NOT verify the signature - that should be done server-side
 */
export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    // JWT structure: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (second part)
    // JWT uses base64url encoding, need to convert to standard base64
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload);
  } catch (e) {
    console.warn('[Maven Widget] Failed to decode JWT:', e);
    return null;
  }
}

/**
 * Extract the display name from a JWT token
 * Tries various common claims in order of preference
 */
export function extractUserNameFromToken(token: string): string | null {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return null;
  }

  // Try common name claims in order of preference
  // Standard OIDC claims
  if (payload.name) {
    return payload.name;
  }

  if (payload.given_name) {
    const fullName = payload.family_name
      ? `${payload.given_name} ${payload.family_name}`
      : payload.given_name;
    return fullName;
  }

  // Clerk-specific claims (when configured in JWT template)
  if (payload.first_name) {
    const fullName = payload.last_name
      ? `${payload.first_name} ${payload.last_name}`
      : payload.first_name;
    return fullName;
  }

  if (payload.preferred_username) {
    return payload.preferred_username;
  }

  if (payload.email) {
    // Use part before @ as fallback
    return payload.email.split('@')[0];
  }

  return null;
}
