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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authEvent, setAuthEvent] = useState<AuthChangeEvent | null>(null);

  // Refs to prevent duplicate operations
  const lastTokenRefresh = useRef<number>(0);

  // supabase-js already supports token auto-refresh (client.ts has autoRefreshToken: true).
  // In dev (React StrictMode/HMR), AuthProvider can mount/unmount more than once;
  // we guard auto-refresh globally to avoid multiple refresh loops (which can cause 429 and logout).
  const AUTO_REFRESH_GUARD_KEY = '__levi_auto_refresh_guard__';

  const getAutoRefreshGuard = () => {
    const w = window as unknown as Record<string, any>;
    if (!w[AUTO_REFRESH_GUARD_KEY]) {
      w[AUTO_REFRESH_GUARD_KEY] = { refCount: 0 };
    }
    return w[AUTO_REFRESH_GUARD_KEY] as { refCount: number };
  };

  useEffect(() => {
    const guard = getAutoRefreshGuard();
    if (guard.refCount === 0) {
      // Ensure a clean slate before starting
      supabase.auth.stopAutoRefresh();
      supabase.auth.startAutoRefresh();
    }
    guard.refCount += 1;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        // Debounce TOKEN_REFRESHED events - ignore if less than 2 seconds since last one
        if (event === 'TOKEN_REFRESHED') {
          const now = Date.now();
          if (now - lastTokenRefresh.current < 2000) return;
          lastTokenRefresh.current = now;
        }

        setAuthEvent(event);
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      const g = getAutoRefreshGuard();
      g.refCount = Math.max(0, g.refCount - 1);
      if (g.refCount === 0) {
        supabase.auth.stopAutoRefresh();
      }
    };
  }, []);

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

  return (
    <AuthContext.Provider value={{ user, session, loading, authEvent, signUp, signIn, signOut }}>
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
