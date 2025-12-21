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

      // Auto-grant admin role ONLY for the designated bootstrap email.
      const ADMIN_EMAIL = 'leviescalas@gmail.com';
      if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        const { data: existing } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', u.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (!existing?.id) {
          await supabase.from('user_roles').insert({ user_id: u.id, role: 'admin' });
        }
      }
    } catch {
      // Silent: bootstrap should never block auth flow.
    }
  }, []);

  useEffect(() => {
    // Prevent duplicate initialization
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const guard = getAuthGuard();

    // Only the first instance manages auto-refresh
    if (guard.refCount === 0 && !guard.initialized) {
      guard.initialized = true;
      supabase.auth.stopAutoRefresh();
      supabase.auth.startAutoRefresh();
    }
    guard.refCount += 1;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        const now = Date.now();

        // Debounce TOKEN_REFRESHED events - ignore if less than 5 seconds since last one
        if (event === 'TOKEN_REFRESHED') {
          if (now - guard.lastTokenRefresh < 5000) return;
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

    // Check for existing session only once
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
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
      if (guard.refCount === 0) {
        supabase.auth.stopAutoRefresh();
        guard.initialized = false;
      }
    };
  }, [bootstrapUser]);

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
