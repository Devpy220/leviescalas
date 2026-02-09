import { useState, useEffect, createContext, useContext, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  let t: number | undefined;
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      t = window.setTimeout(() => resolve(fallback), ms);
    }),
  ]).finally(() => {
    if (t) window.clearTimeout(t);
  });
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authEvent: AuthChangeEvent | null;
  signUp: (email: string, password: string, name: string, whatsapp: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; session: Session | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  /**
   * Attempts to recover the session without forcing a logout.
   * Uses a single-flight guard to avoid refresh storms.
   */
  ensureSession: () => Promise<Session | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// GLOBAL SINGLETON - Prevents multiple auth operations across all components
// ============================================================================
const AUTH_GUARD_KEY = '__levi_auth_guard__';

interface AuthGuard {
  refCount: number;
  lastTokenRefresh: number;
  isRefreshing: boolean;
  initialized: boolean;
  // Cached session to avoid redundant getSession calls
  cachedSession: Session | null;
  cacheTime: number;
  // Promise for in-flight refresh to allow waiting
  refreshPromise: Promise<Session | null> | null;
  // Debounce bootstrap to avoid multiple calls
  bootstrapTimeout: number | null;
  lastBootstrapUserId: string | null;
}

const getAuthGuard = (): AuthGuard => {
  const w = window as unknown as Record<string, AuthGuard>;
  if (!w[AUTH_GUARD_KEY]) {
    w[AUTH_GUARD_KEY] = { 
      refCount: 0, 
      lastTokenRefresh: 0,
      isRefreshing: false,
      initialized: false,
      cachedSession: null,
      cacheTime: 0,
      refreshPromise: null,
      bootstrapTimeout: null,
      lastBootstrapUserId: null
    };
  }
  return w[AUTH_GUARD_KEY];
};

// Cache TTL: 10 seconds - prevents multiple getSession calls
const SESSION_CACHE_TTL = 10000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authEvent, setAuthEvent] = useState<AuthChangeEvent | null>(null);

  // Ref to track if we've initialized
  const hasInitialized = useRef(false);

  // SYNC: Ensure user is always set when session.user exists
  // This prevents the "session exists but user is null" race condition
  useEffect(() => {
    if (session?.user && !user) {
      console.log('[Auth] Syncing user from session.user');
      setUser(session.user);
    }
  }, [session, user]);

  const bootstrapUser = useCallback(async (u: User) => {
    const guard = getAuthGuard();
    
    // Skip if we already bootstrapped this user recently
    if (guard.lastBootstrapUserId === u.id) {
      return;
    }
    
    try {
      guard.lastBootstrapUserId = u.id;

      // Ensure we actually have a valid session before doing any DB writes.
      // In some preview/partitioned-storage contexts, SIGNED_IN may fire before
      // the client has a usable access token for PostgREST, which results in 401.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        console.warn('[Auth] Bootstrap skipped: no valid session access token yet');
        guard.lastBootstrapUserId = null;
        return;
      }
      
      // Retry helper with exponential backoff for token propagation
      const retryWithDelay = async <T,>(
        fn: () => PromiseLike<{ data: T; error: unknown }>,
        maxRetries = 3,
        baseDelayMs = 300
      ): Promise<{ data: T | null; error: unknown }> => {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          if (attempt > 0) {
            await new Promise(resolve => setTimeout(resolve, baseDelayMs * attempt));
          }

          // Re-check session before each attempt to reduce 401s when token isn't ready.
          const { data: fresh } = await supabase.auth.getSession();
          if (!fresh.session?.access_token) {
            continue;
          }

          const result = await fn();
          if (!result.error) {
            return result;
          }
          // Check if it's an auth error (401/403) - worth retrying
          const errorObj = result.error as { code?: string; status?: number; message?: string };
          const isAuthError = 
            errorObj?.status === 401 || 
            errorObj?.status === 403 ||
            errorObj?.code === 'PGRST301' ||
           errorObj?.code === '42501' || // PostgreSQL insufficient_privilege (RLS violation)
            errorObj?.message?.includes('401') ||
           errorObj?.message?.includes('JWT') ||
           errorObj?.message?.includes('row-level security');
          
          if (!isAuthError || attempt === maxRetries) {
            return result;
          }
          console.log(`[Auth] Bootstrap retry ${attempt + 1}/${maxRetries} after auth error`);
        }
        return { data: null, error: new Error('Max retries exceeded') };
      };

      // Ensure profile exists (some flows like password recovery won't recreate it).
      const email = u.email ?? '';
      const name = (u.user_metadata?.name as string | undefined) ?? '';
      const whatsapp = (u.user_metadata?.whatsapp as string | undefined) ?? '';

      await retryWithDelay(() => 
        (
          // Don't select back here; selecting can trigger extra RLS/permission checks
          // and is not needed for bootstrap.
          supabase
            .from('profiles')
            .upsert(
              {
                id: u.id,
                email,
                name,
                whatsapp,
                updated_at: new Date().toISOString(),
              } as any,
              { onConflict: 'id' }
            )
        ) as unknown as PromiseLike<{ data: unknown; error: unknown }>
      );

      // Admin role is granted server-side via ensure_admin_role RPC
      await retryWithDelay(async () => {
        const result = await supabase.rpc('ensure_admin_role');
        return result as { data: boolean; error: unknown };
      });
    } catch {
      // Silent: bootstrap should never block auth flow.
      // Reset so we can retry on next login
      guard.lastBootstrapUserId = null;
    }
  }, []);

  /**
   * Recovers the session safely without causing token refresh storms.
   * Uses singleton guard and caching to ensure only ONE refresh happens at a time.
   */
  /**
   * Clears all auth-related storage to recover from corrupted token state.
   * This is called when we detect invalid refresh tokens.
   */
  const clearAuthStorage = useCallback(() => {
    console.warn('[Auth] Clearing auth storage due to invalid tokens');
    try {
      // Clear localStorage items that contain stale tokens
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('sb-') || key.includes('auth'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => {
        console.log('[Auth] Removing localStorage key:', key);
        localStorage.removeItem(key);
      });
      
      // Clear sessionStorage as well
      const sessionKeysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('sb-') || key.includes('auth'))) {
          sessionKeysToRemove.push(key);
        }
      }
      sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
      
      // Clear internal guard cache
      const guard = getAuthGuard();
      guard.cachedSession = null;
      guard.cacheTime = 0;
      guard.lastBootstrapUserId = null;
    } catch (e) {
      console.error('[Auth] Error clearing storage:', e);
    }
  }, []);

  /**
   * Check if an error is related to an invalid/expired refresh token
   */
  const isInvalidRefreshTokenError = useCallback((error: unknown): boolean => {
    if (!error) return false;
    
    const errorObj = error as { code?: string; message?: string };
    const code = errorObj?.code ?? '';
    const message = errorObj?.message ?? '';
    
    const invalidPatterns = [
      'refresh_token_not_found',
      'Invalid Refresh Token',
      'Refresh Token Not Found',
      'invalid_grant',
      'bad_jwt',
      'session_not_found',
    ];
    
    return invalidPatterns.some(pattern => 
      code.toLowerCase().includes(pattern.toLowerCase()) ||
      message.toLowerCase().includes(pattern.toLowerCase())
    );
  }, []);

  const ensureSession = useCallback(async (): Promise<Session | null> => {
    const guard = getAuthGuard();
    const now = Date.now();

    // Optional debug (enable via localStorage.DEBUG_AUTH = '1')
    const debug = (() => {
      try {
        return localStorage.getItem('DEBUG_AUTH') === '1';
      } catch {
        return false;
      }
    })();

    // 1) Return cached session if still valid
    if (guard.cachedSession && now - guard.cacheTime < SESSION_CACHE_TTL) {
      if (debug) console.log('[Auth] ensureSession: using cached session');
      return guard.cachedSession;
    }

    // 2) If a refresh is already in-flight, wait for it
    if (guard.refreshPromise) {
      if (debug) console.log('[Auth] ensureSession: waiting for in-flight refresh');
      return guard.refreshPromise;
    }

    // 3) Start new refresh operation
    guard.refreshPromise = (async () => {
      try {
        if (debug) console.log('[Auth] ensureSession: starting');

        // First attempt: getSession (fast, no network refresh required)
        const result = await withTimeout(
          supabase.auth.getSession(),
          6000,
          { data: { session: null }, error: null } as { data: { session: Session | null }; error: unknown }
        );

        const { data, error } = result;

        // CRITICAL: Check for refresh token errors and perform clean logout
        if (error && isInvalidRefreshTokenError(error)) {
          console.error('[Auth] Invalid refresh token detected:', error);

          // Clear all auth storage to recover from corrupted state
          clearAuthStorage();

          // Force signOut to clean up client state
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch {
            // Ignore signOut errors - storage is already cleared
          }

          // Reset React state
          setSession(null);
          setUser(null);
          setLoading(false);

          console.log('[Auth] Clean logout completed after invalid refresh token');
          return null;
        }

        if (data.session?.user) {
          if (debug) console.log('[Auth] ensureSession: getSession returned session');
          guard.cachedSession = data.session;
          guard.cacheTime = Date.now();
          setSession(data.session);
          setUser(data.session.user);
          return data.session;
        }

        // Second attempt: refreshSession (helps when client state is stale after sleep/unpause)
        // IMPORTANT: This is still single-flight due to guard.refreshPromise.
        if (debug) console.log('[Auth] ensureSession: getSession returned null; trying refreshSession');
        const refreshResult = await withTimeout(
          supabase.auth.refreshSession(),
          6000,
          { data: { session: null }, error: null } as { data: { session: Session | null }; error: unknown }
        );

        const { data: refreshData, error: refreshError } = refreshResult;

        if (refreshError && isInvalidRefreshTokenError(refreshError)) {
          console.error('[Auth] Invalid refresh token detected on refreshSession:', refreshError);
          clearAuthStorage();
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch {
            // Ignore
          }
          setSession(null);
          setUser(null);
          setLoading(false);
          return null;
        }

        if (refreshData.session?.user) {
          if (debug) console.log('[Auth] ensureSession: refreshSession recovered session');
          guard.cachedSession = refreshData.session;
          guard.cacheTime = Date.now();
          setSession(refreshData.session);
          setUser(refreshData.session.user);
          return refreshData.session;
        }

        if (debug) console.log('[Auth] ensureSession: no session found');
        // No session found - user is truly logged out
        return null;
      } catch (err) {
        // Also check for refresh token errors in catch block
        if (isInvalidRefreshTokenError(err)) {
          console.error('[Auth] Caught invalid refresh token error:', err);
          clearAuthStorage();
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch {
            // Ignore
          }
          setSession(null);
          setUser(null);
          setLoading(false);
          return null;
        }
        if (debug) console.log('[Auth] ensureSession: failed with error', err);
        return null;
      } finally {
        guard.refreshPromise = null;
      }
    })();

    return guard.refreshPromise;
  }, [clearAuthStorage, isInvalidRefreshTokenError]);// end ensureSession

  useEffect(() => {
    // Prevent duplicate initialization
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const guard = getAuthGuard();

    // IMPORTANT:
    // We do NOT call supabase.auth.startAutoRefresh() here.
    // The client is already configured with auth.autoRefreshToken=true (in the generated client).
    // Calling startAutoRefresh manually can cause duplicated refresh loops in some browsers.
    guard.refCount += 1;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        const now = Date.now();

        // Always record refresh events (do NOT debounce or we'll miss state updates)
        if (event === 'TOKEN_REFRESHED') {
          guard.lastTokenRefresh = now;
        }

        // CRITICAL: Detect token refresh failure (e.g., after Supabase unpause)
        // If TOKEN_REFRESHED fires but session is null, the token was invalidated
        if (event === 'TOKEN_REFRESHED' && !currentSession) {
          console.warn('[Auth] Token refresh failed - forcing logout');
          // Clear all cached data
          guard.cachedSession = null;
          guard.cacheTime = 0;
          guard.lastBootstrapUserId = null;
          // Force clean logout and redirect
          supabase.auth.signOut().then(() => {
            window.location.href = '/auth?expired=true';
          });
          return;
        }

        // Update cache when we get a valid session
        if (currentSession) {
          guard.cachedSession = currentSession;
          guard.cacheTime = now;
        }

        setAuthEvent(event);
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        // Debounced bootstrap - only run ONCE per user, not on every auth event
        if (currentSession?.user && event === 'SIGNED_IN') {
          // Clear any pending bootstrap
          if (guard.bootstrapTimeout) {
            window.clearTimeout(guard.bootstrapTimeout);
          }
          // Debounce to 500ms to let auth settle
          guard.bootstrapTimeout = window.setTimeout(() => {
            bootstrapUser(currentSession.user);
            guard.bootstrapTimeout = null;
          }, 500);
        }
      }
    );

    // Let onAuthStateChange handle session updates - it already calls setLoading(false).
    // We only set a fallback timeout to guarantee loading=false if no event fires.
    const bootTimeout = window.setTimeout(() => setLoading(false), 5000);
    
    // Warm up session on cold start (single-flight, cached - won't cause token storm)
    // This helps in preview/iframe environments where the session may not hydrate quickly
    void ensureSession();
    
    return () => {
      subscription.unsubscribe();
      window.clearTimeout(bootTimeout);
      if (guard.bootstrapTimeout) {
        window.clearTimeout(guard.bootstrapTimeout);
      }
      guard.refCount = Math.max(0, guard.refCount - 1);
    };
  }, [bootstrapUser, ensureSession]);

  // Keep-alive: only recover session when coming back online (not on every tab switch)
  useEffect(() => {
    const guard = getAuthGuard();
    
    const onOnline = () => {
      // Only attempt if we have NO session at all
      if (!session?.user && !guard.cachedSession) {
        void ensureSession();
      }
    };

    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [ensureSession, session?.user]);

  const signUp = useCallback(async (email: string, password: string, name: string, whatsapp: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name,
            whatsapp,
          }
        }
      });
      
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<{ error: Error | null; session: Session | null }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      // Immediately hydrate session state and cache to avoid timing issues
      if (data.session) {
        const guard = getAuthGuard();
        setSession(data.session);
        setUser(data.session.user);
        guard.cachedSession = data.session;
        guard.cacheTime = Date.now();
      }
      
      return { error: null, session: data.session };
    } catch (error) {
      return { error: error as Error, session: null };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      // Redirect to /auth - the recovery code handler will detect this and show reset form
      const redirectUrl = `${window.location.origin}/auth`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, authEvent, signUp, signIn, signOut, resetPassword, ensureSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
