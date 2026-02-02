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
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
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

  const bootstrapUser = useCallback(async (u: User) => {
    const guard = getAuthGuard();
    
    // Skip if we already bootstrapped this user recently
    if (guard.lastBootstrapUserId === u.id) {
      return;
    }
    
    try {
      guard.lastBootstrapUserId = u.id;
      
      // Ensure profile exists (some flows like password recovery won't recreate it).
      const email = u.email ?? '';
      const name = (u.user_metadata?.name as string | undefined) ?? '';
      const whatsapp = (u.user_metadata?.whatsapp as string | undefined) ?? '';

      await supabase
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
        );

      // Admin role is granted server-side via ensure_admin_role RPC
      await supabase.rpc('ensure_admin_role');
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
  const ensureSession = useCallback(async (): Promise<Session | null> => {
    const guard = getAuthGuard();
    const now = Date.now();

    // 1) Return cached session if still valid
    if (guard.cachedSession && now - guard.cacheTime < SESSION_CACHE_TTL) {
      return guard.cachedSession;
    }

    // 2) If a refresh is already in-flight, wait for it
    if (guard.refreshPromise) {
      return guard.refreshPromise;
    }

    // 3) Start new refresh operation
    guard.refreshPromise = (async () => {
      try {
        // Only call getSession ONCE
        // In some environments (e.g., sandboxed iframes / strict privacy settings),
        // getSession() can hang. We hard-timeout to avoid infinite loading states.
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          6000,
          { data: { session: null } } as any
        );
        
        if (data.session?.user) {
          guard.cachedSession = data.session;
          guard.cacheTime = Date.now();
          setSession(data.session);
          setUser(data.session.user);
          return data.session;
        }

        // No session found - user is truly logged out
        return null;
      } catch {
        return null;
      } finally {
        guard.refreshPromise = null;
      }
    })();

    return guard.refreshPromise;
  }, []);

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
    
    return () => {
      subscription.unsubscribe();
      window.clearTimeout(bootTimeout);
      if (guard.bootstrapTimeout) {
        window.clearTimeout(guard.bootstrapTimeout);
      }
      guard.refCount = Math.max(0, guard.refCount - 1);
    };
  }, [bootstrapUser, ensureSession]);

  // Keep-alive: when the user returns to the tab, check cached session.
  // IMPORTANT: Do NOT call ensureSession on every focus - only if we're in loading state
  useEffect(() => {
    let t: number | undefined;
    const guard = getAuthGuard();
    
    const attemptRecovery = () => {
      if (t) window.clearTimeout(t);
      // Debounce to 5 seconds to avoid rapid calls and token storms
      t = window.setTimeout(() => {
        // Only attempt if we have NO session and NO cached session
        if (!session?.user && !guard.cachedSession) {
          void ensureSession();
        }
      }, 5000);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') attemptRecovery();
    };

    // Only add listeners, don't call immediately
    window.addEventListener('online', attemptRecovery);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (t) window.clearTimeout(t);
      window.removeEventListener('online', attemptRecovery);
      document.removeEventListener('visibilitychange', onVisibility);
    };
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

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      const redirectUrl = `${window.location.origin}/admin-login?reset=true`;
      
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
