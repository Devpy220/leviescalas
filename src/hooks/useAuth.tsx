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
  const refreshTimeoutRef = useRef<number | null>(null);
  const refreshInFlightRef = useRef(false);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimeoutRef.current) {
      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  }, []);

  const scheduleNextRefresh = useCallback((sess: Session | null) => {
    clearRefreshTimer();

    if (!sess?.expires_at) return;

    const nowSec = Math.floor(Date.now() / 1000);
    // Refresh ~60s before expiry (min 10s)
    const secondsUntilRefresh = Math.max(sess.expires_at - nowSec - 60, 10);

    refreshTimeoutRef.current = window.setTimeout(async () => {
      if (refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;

      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        // If we got a new session, schedule next refresh
        scheduleNextRefresh(data.session ?? null);
      } catch (e) {
        // Backoff on rate limit / transient failures
        refreshTimeoutRef.current = window.setTimeout(() => {
          refreshInFlightRef.current = false;
          scheduleNextRefresh(sess);
        }, 30000);
        return;
      } finally {
        refreshInFlightRef.current = false;
      }
    }, secondsUntilRefresh * 1000);
  }, [clearRefreshTimer]);

  useEffect(() => {
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

        scheduleNextRefresh(currentSession ?? null);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
      scheduleNextRefresh(existingSession ?? null);
    });

    return () => {
      subscription.unsubscribe();
      clearRefreshTimer();
    };
  }, [clearRefreshTimer, scheduleNextRefresh]);

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
