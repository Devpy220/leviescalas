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

// Global guard to prevent multiple auth provider instances from running auto-refresh
const AUTH_GUARD_KEY = '__levi_auth_guard__';

const getAuthGuard = () => {
  const w = window as unknown as Record<string, any>;
  if (!w[AUTH_GUARD_KEY]) {
    w[AUTH_GUARD_KEY] = { 
      refCount: 0, 
      lastTokenRefresh: 0,
      isRefreshing: false,
      initialized: false
    };
  }
  return w[AUTH_GUARD_KEY] as { 
    refCount: number; 
    lastTokenRefresh: number;
    isRefreshing: boolean;
    initialized: boolean;
  };
};

// TOKEN_REFRESHED debounce increased to 60 seconds to prevent cascade refreshes
const TOKEN_REFRESH_DEBOUNCE = 60000;

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
      // which checks the email in the database function itself
      await supabase.rpc('ensure_admin_role');
    } catch {
      // Silent: bootstrap should never block auth flow.
    }
  }, []);

  const ensureSession = useCallback(async (): Promise<Session | null> => {
    const guard = getAuthGuard();

    // Fast path
    if (session?.user) return session;

    // Single-flight refresh guard
    if (guard.isRefreshing) {
      // Wait briefly for the in-flight refresh to settle
      await new Promise((r) => setTimeout(r, 250));
      const { data } = await supabase.auth.getSession();
      return data.session ?? null;
    }

    guard.isRefreshing = true;
    try {
      // 1) Re-check session from storage
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session?.user) {
        setSession(existing.session);
        setUser(existing.session.user);
        return existing.session;
      }

      // 2) Attempt refresh (may fail if refresh token expired)
      await supabase.auth.refreshSession();

      // 3) Read again
      const { data: refreshed } = await supabase.auth.getSession();
      setSession(refreshed.session ?? null);
      setUser(refreshed.session?.user ?? null);
      return refreshed.session ?? null;
    } catch {
      return null;
    } finally {
      guard.isRefreshing = false;
    }
  }, [session]);

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

        // Debounce TOKEN_REFRESHED events - ignore if less than 60 seconds since last one
        if (event === 'TOKEN_REFRESHED') {
          if (now - guard.lastTokenRefresh < TOKEN_REFRESH_DEBOUNCE) return;
          guard.lastTokenRefresh = now;
        }

        // Debounce SIGNED_IN events during MFA flow to prevent multiple triggers
        if (event === 'SIGNED_IN' && guard.isRefreshing) {
          return;
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

    // THEN check for existing session only once
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      // Only update if not already set by onAuthStateChange
      setSession(prev => prev ?? existingSession);
      setUser(prev => prev ?? existingSession?.user ?? null);
      setLoading(false);

      if (existingSession?.user) {
        setTimeout(() => {
          bootstrapUser(existingSession.user);
        }, 0);
      }
    });

    return () => {
      subscription.unsubscribe();
      guard.refCount = Math.max(0, guard.refCount - 1);
      // Don't stop auto-refresh on cleanup to prevent rate limiting issues
    };
  }, [bootstrapUser]);

  // Keep-alive: when the user returns to the tab / goes online, attempt a safe session recovery.
  useEffect(() => {
    let t: number | undefined;
    const schedule = () => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => {
        // Only attempt recovery if we appear logged-out
        if (!session?.user) void ensureSession();
      }, 500);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') schedule();
    };

    window.addEventListener('focus', schedule);
    window.addEventListener('online', schedule);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (t) window.clearTimeout(t);
      window.removeEventListener('focus', schedule);
      window.removeEventListener('online', schedule);
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
