import { useState, useEffect, createContext, useContext, ReactNode, useRef, useCallback } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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
      refreshPromise: null
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
    try {
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
        const { data } = await supabase.auth.getSession();
        
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

    // Only the first instance manages auto-refresh
    if (guard.refCount === 0 && !guard.initialized) {
      guard.initialized = true;
      // Don't restart auto-refresh if already running
      supabase.auth.startAutoRefresh();
    }
    guard.refCount += 1;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        const now = Date.now();

        // Always record refresh events (do NOT debounce or we'll miss state updates)
        if (event === 'TOKEN_REFRESHED') {
          guard.lastTokenRefresh = now;
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

        // Never call supabase inside the callback; defer.
        if (currentSession?.user) {
          setTimeout(() => {
            bootstrapUser(currentSession.user);
          }, 0);
        }
      }
    );

    // THEN check for existing session (single-flight guarded)
    void ensureSession().finally(() => setLoading(false));

    return () => {
      subscription.unsubscribe();
      guard.refCount = Math.max(0, guard.refCount - 1);
      // Don't stop auto-refresh on cleanup to prevent rate limiting issues
    };
  }, [bootstrapUser, ensureSession]);

  // Keep-alive: when the user returns to the tab, check cached session.
  // IMPORTANT: Do NOT call ensureSession on every focus - only if we're in loading state
  useEffect(() => {
    let t: number | undefined;
    const guard = getAuthGuard();
    
    const attemptRecovery = () => {
      if (t) window.clearTimeout(t);
      // Debounce to 2 seconds to avoid rapid calls
      t = window.setTimeout(() => {
        // Only attempt if we have NO session and NO cached session
        if (!session?.user && !guard.cachedSession) {
          void ensureSession();
        }
      }, 2000);
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
