/**
 * Global Auth Error Handler
 * 
 * Detects invalid JWT tokens (e.g., after Supabase project unpause) and forces
 * a clean logout with redirect to /auth?expired=true
 */

const INVALID_TOKEN_PATTERNS = [
  'bad_jwt',
  'invalid claim',
  'missing sub claim',
  'JWT expired',
  'invalid_grant',
  'Token is expired',
  'session_not_found',
];

/**
 * Check if an error is related to an invalid/expired JWT token
 */
export function isInvalidTokenError(error: unknown): boolean {
  if (!error) return false;
  
  const errorMessage = typeof error === 'string' 
    ? error 
    : (error as { message?: string })?.message || JSON.stringify(error);
  
  return INVALID_TOKEN_PATTERNS.some(pattern => 
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Handle auth error by clearing storage and redirecting to login
 * Call this when you detect a 401/403 with an invalid token error
 */
export function handleAuthError(error: unknown): boolean {
  if (!isInvalidTokenError(error)) {
    return false; // Not an auth error, don't handle
  }
  
  console.warn('[AuthErrorHandler] Invalid token detected, forcing logout:', error);
  
  // Clear all auth-related storage
  try {
    // Clear localStorage items that might contain stale tokens
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('supabase') || key.includes('auth'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Clear sessionStorage as well
    const sessionKeysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.includes('supabase') || key.includes('auth'))) {
        sessionKeysToRemove.push(key);
      }
    }
    sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
  } catch (e) {
    console.error('[AuthErrorHandler] Error clearing storage:', e);
  }
  
  // Redirect to auth page with expired flag
  window.location.href = '/auth?expired=true';
  return true;
}

/**
 * Wrapper to safely call an async function and handle auth errors
 * Returns null if auth error was handled (redirect triggered)
 */
export async function withAuthErrorHandling<T>(
  fn: () => Promise<T>
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    if (handleAuthError(error)) {
      return null; // Auth error handled, redirect in progress
    }
    throw error; // Re-throw non-auth errors
  }
}
