import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Calendar, Eye, EyeOff, ArrowLeft, Loader2, Sparkles, Users, Bell, Fingerprint, Info } from 'lucide-react';
import { isWebAuthnSupported, loginWithBiometric } from '@/lib/webauthn';
import { SEO } from '@/components/SEO';
import { LeviLogo } from '@/components/LeviLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/ThemeToggle';
import { validatePassword } from '@/lib/passwordBreachChecker';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { TwoFactorVerify } from '@/components/auth/TwoFactorVerify';

import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { userHasKidsAccess } from '@/lib/kidsAccess';

async function maybeChooseApp(userId: string, defaultDest: string): Promise<string> {
  // Only intercept when default lands on the Escalas hub
  if (defaultDest !== '/dashboard') return defaultDest;
  const hasKids = await userHasKidsAccess(userId);
  return hasKids ? '/escolher-app' : defaultDest;
}

// Google Icon Component
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// Apple Icon Component
const AppleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
  </svg>
);

// Validation schemas: translate messages without changing the input rules.
const createSchemas = (t: (key: string) => string) => {
const passwordSchema = z.string()
  .min(8, t("authValidation.passwordMin"))
  .regex(/[A-Z]/, t("authValidation.passwordUpper"))
  .regex(/[a-z]/, t("authValidation.passwordLower"))
  .regex(/\d/, t("authValidation.passwordNumber"))
  .regex(/[!@#$%^&*(),.?":{}|<>_\-+=[\]\\;'`~]/, t("authValidation.passwordSpecial"));

const loginSchema = z.object({
  email: z.string().email(t("authValidation.invalidEmail")),
  password: z.string().min(1, t("authValidation.passwordRequired")),
});

// Schema for regular members (church code required)
const registerSchema = z.object({
  churchCode: z.string().max(20, t("authValidation.codeLong")).optional(),
  name: z.string().trim().min(2, t("authValidation.nameMin")).max(100, t("authValidation.nameLong")),
  email: z.string().trim().email(t("authValidation.invalidEmail")).max(255, t("authValidation.emailLong")),
  whatsapp: z.string()
    .min(1, t("authValidation.whatsappRequired"))
    .transform(val => val.replace(/[^\d+]/g, ''))
    .refine(
      val => /^\d{11}$/.test(val) || /^\+\d{8,15}$/.test(val),
      t("authValidation.whatsappFormat"),
    ),

  password: passwordSchema,
  confirmPassword: z.string().min(1, t("authValidation.confirmationRequired")),
  isAdminSignup: z.boolean().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: t("authValidation.passwordMismatch"),
  path: ['confirmPassword'],
});

const recoverySchema = z.object({
  email: z.string().email(t("authValidation.invalidEmail")),
});

const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: t("authValidation.passwordMismatch"),
  path: ['confirmPassword'],
});

return { loginSchema, registerSchema, recoverySchema, resetPasswordSchema };
};

type Schemas = ReturnType<typeof createSchemas>;
type LoginForm = z.infer<Schemas["loginSchema"]>;
type RegisterForm = z.infer<Schemas["registerSchema"]>;
type RecoveryForm = z.infer<Schemas["recoverySchema"]>;
type ResetPasswordForm = z.infer<Schemas["resetPasswordSchema"]>;

export default function Auth() {
  const { t } = useTranslation();
  const { loginSchema, registerSchema, recoverySchema, resetPasswordSchema } = createSchemas(t);
  const [searchParams] = useSearchParams();
  // Only allow register tab when coming from an invite link (church or department)
  const isChurchSetupRedirect = searchParams.get('redirect') === '/church-setup';
  const hasInviteContext = !!searchParams.get('church') || !!searchParams.get('churchCode') || searchParams.get('redirect')?.startsWith('/join/') || isChurchSetupRedirect;
  const initialTab = (searchParams.get('tab') === 'register' && hasInviteContext) ? 'register' : 'login';
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'recovery' | 'reset-password' | '2fa-verify' | '2fa-verify-password-reset'>(initialTab);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recoveryEmailSent, setRecoveryEmailSent] = useState(false);
  const [pendingPasswordReset, setPendingPasswordReset] = useState<string | null>(null);
  const [churchValidated, setChurchValidated] = useState<{ valid: boolean; name: string | null; slug: string | null }>({ valid: false, name: null, slug: null });
  const [isValidatingChurch, setIsValidatingChurch] = useState(false);
  const [whatsappFocused, setWhatsappFocused] = useState(false);
  // Admin is identified by email only (leviescalas@gmail.com)
  
  // Ref to prevent duplicate redirects
  const hasRedirectedRef = useRef(false);
  
  // Ref to block auto-redirect during password recovery flow
  const isRecoveryFlowRef = useRef(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, signUp, user, session, loading, authEvent, ensureSession } = useAuth();

  const redirectParam = searchParams.get('redirect');
  const churchSlugParam = searchParams.get('church');
  const churchCodeParam = searchParams.get('churchCode');
  const sessionExpired = searchParams.get('expired') === 'true';
  const forceLogin = searchParams.get('forceLogin') === 'true';
  
  // Check if coming from a department invite link
  const isDepartmentInvite = redirectParam?.startsWith('/join/') || false;
  
  // Church slug or code from URL - this is the only way to register now (except department invites)
  const hasChurchContext = !!churchSlugParam || !!churchCodeParam;
  
  // Show toast when session expired (after Supabase unpause or token invalidation)
  useEffect(() => {
    if (sessionExpired) {
      toast({
        variant: 'destructive',
        title: t("auth.sessionExpired"),
        description: t("auth.sessionExpiredDetail"),
      });
      // Clean up URL param to avoid showing toast again on refresh
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('expired');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [sessionExpired, toast]);

  // Detect password recovery flow from auth event
  useEffect(() => {
    if (authEvent === 'PASSWORD_RECOVERY') {
      setActiveTab('reset-password');
    }
  }, [authEvent]);

  const recoveryHandledRef = useRef(false);

  const getRecoveryContextFromUrl = () => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const hashType = hashParams.get('type');
    const hashAccessToken = hashParams.get('access_token');

    const queryParams = new URLSearchParams(window.location.search);
    const queryType = queryParams.get('type');
    const code = queryParams.get('code');

    // A bare `?code=` is only treated as a PKCE recovery code when it looks
    // like one (long token). Short codes are church invite codes and must
    // never be exchanged for a session.
    const looksLikePkceCode = !!code && code.length > 20;

    const isRecovery = queryType === 'recovery' || hashType === 'recovery' || looksLikePkceCode || !!hashAccessToken;

    return { isRecovery, queryType, hashType, code: looksLikePkceCode ? code : null, hashAccessToken };
  };

  // Handle recovery links that arrive either via URL hash (implicit) or via ?code=... (PKCE)
  useEffect(() => {
    const run = async () => {
      if (recoveryHandledRef.current) return;

      const ctx = getRecoveryContextFromUrl();

      // PKCE-style link: ?code=...
      if (ctx.code) {
        recoveryHandledRef.current = true;
        // CRITICAL: Set recovery flag BEFORE exchanging code to block auto-redirect
        isRecoveryFlowRef.current = true;
        
        const { error } = await supabase.auth.exchangeCodeForSession(ctx.code);
        if (error) {
          isRecoveryFlowRef.current = false;
          toast({
            variant: 'destructive',
            title: t("auth.invalidLink"),
            description: t("auth.invalidLinkDetail"),
          });
          return;
        }

        setActiveTab('reset-password');
        return;
      }

      // Implicit-style link (hash)
      if ((ctx.queryType ?? ctx.hashType) === 'recovery' && ctx.hashAccessToken) {
        recoveryHandledRef.current = true;
        isRecoveryFlowRef.current = true;
        setActiveTab('reset-password');
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle force login - sign out existing session to allow switching accounts
  useEffect(() => {
    const handleForceLogin = async () => {
      // IMPORTANT: Never force-logout during password recovery.
      // A recovery link can temporarily create a session that is required for updateUser({ password }).
      const { isRecovery } = getRecoveryContextFromUrl();

      if (forceLogin && session && !isRecovery && activeTab !== 'reset-password' && !isRecoveryFlowRef.current) {
        await supabase.auth.signOut();
        return;
      }

      // If we are in recovery but the URL still has forceLogin=true (old links / redirects),
      // strip it so other logic doesn't interfere.
      if (forceLogin && isRecovery) {
        const url = new URL(window.location.href);
        url.searchParams.delete('forceLogin');
        window.history.replaceState({}, '', url.toString());
      }
    };
    handleForceLogin();
  }, [forceLogin, session, activeTab]);

  // Get returnUrl from location.state (set by ProtectedRoute when redirecting unauthenticated users)
  const location = window.location;
  const routerLocation = { state: (window.history.state?.usr ?? {}) as Record<string, unknown> };

  // If user is already authenticated, redirect away from /auth (except password recovery flow, force login, or during active login)
  useEffect(() => {
    const { isRecovery } = getRecoveryContextFromUrl();

    // Don't redirect if:
    // - Still loading auth state
    // - No session
    // - In recovery flow (URL or ref flag)
    // - Active tab is reset-password (user is resetting password)
    // - In the middle of a login operation
    // - Force login mode
    // - Already redirected
    const isResetPasswordTab = activeTab === 'reset-password';
    const shouldSkipRedirect = 
      loading || 
      !session || 
      isRecovery || 
      isRecoveryFlowRef.current || 
      isResetPasswordTab ||
      isLoading || 
      forceLogin || 
      hasRedirectedRef.current;

    if (shouldSkipRedirect) {
      return;
    }
    
    // Add stabilization delay to avoid race conditions with session hydration
    // This prevents the auth loop on cold preview starts
    const stabilizationTimeout = setTimeout(async () => {
      // Double-check ref conditions after delay (state may have changed)
      if (isRecoveryFlowRef.current || hasRedirectedRef.current) {
        return;
      }
      
      hasRedirectedRef.current = true;
      
      // PRIORITY 1: Check if there's a returnUrl from ProtectedRoute in location.state
      // This happens when user was redirected to /auth from a protected page
      const stateReturnUrl = routerLocation.state?.returnUrl as string | undefined;
      if (stateReturnUrl && stateReturnUrl.startsWith('/')) {
        console.log('[Auth] Using returnUrl from state:', stateReturnUrl);
        navigate(stateReturnUrl, { replace: true, state: {} });
        return;
      }
      
      // PRIORITY 2: Use redirect param from URL
      if (redirectParam && redirectParam.startsWith('/')) {
        navigate(redirectParam, { replace: true });
        return;
      }
      
      // PRIORITY 3: Check if profile is incomplete (OAuth users)
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, whatsapp')
        .eq('id', session.user.id)
        .maybeSingle();
      
      if (profile && (!profile.name || !profile.whatsapp || profile.name.trim() === '' || profile.whatsapp.trim() === '')) {
        console.log('[Auth] Profile incomplete, redirecting to complete-profile');
        const completeProfileUrl = redirectParam ? `/complete-profile?redirect=${encodeURIComponent(redirectParam)}` : '/complete-profile';
        navigate(completeProfileUrl, { replace: true });
        return;
      }
      
      // PRIORITY 4: Smart redirect based on department count
      const destination = await getSmartRedirectDestination(session.user.id);
      const finalDest = await maybeChooseApp(session.user.id, destination);
      console.log('[Auth] Already authenticated, smart redirecting to:', finalDest);
      navigate(finalDest, { replace: true });
    }, 150);
    
    return () => clearTimeout(stabilizationTimeout);
  }, [loading, session, navigate, redirectParam, isLoading, forceLogin, activeTab, routerLocation.state]);

  // Validate church from slug when accessing register tab
  // Validate church from URL params when accessing register tab
  useEffect(() => {
    if (activeTab === 'register') {
      if (churchSlugParam) {
        validateChurchBySlug(churchSlugParam);
      } else if (churchCodeParam) {
        // If we have a church code from URL, validate it automatically
        registerForm.setValue('churchCode', churchCodeParam.toUpperCase());
        validateChurchCode(churchCodeParam);
      }
    }
  }, [churchSlugParam, churchCodeParam, activeTab]);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Use different schema - church code is always required for registration
  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { churchCode: '', name: '', email: '', whatsapp: '', password: '', confirmPassword: '' },
  });

  // Form is ready when church is validated, it's a department invite, or it's the church owner signup flow
  const isFormReadyToSubmit = churchValidated.valid || isDepartmentInvite || isChurchSetupRedirect;

  // Validate church by slug (from URL)
  const validateChurchBySlug = async (slug: string) => {
    setIsValidatingChurch(true);
    try {
      const { data, error } = await supabase.rpc('get_church_public', { p_slug: slug });
      
      if (error) {
        console.error('Error fetching church:', error);
        setChurchValidated({ valid: false, name: null, slug: null });
        return;
      }

      if (data && data.length > 0) {
        setChurchValidated({ valid: true, name: data[0].name, slug: slug });
        // Set a placeholder for church code since we're validating by slug
        registerForm.setValue('churchCode', 'VALIDATED');
      } else {
        setChurchValidated({ valid: false, name: null, slug: null });
      }
    } catch (err) {
      console.error('Error fetching church:', err);
      setChurchValidated({ valid: false, name: null, slug: null });
    } finally {
      setIsValidatingChurch(false);
    }
  };

  // Validate church code manually (fallback)
  const validateChurchCode = async (code: string) => {
    if (!code || code.length < 1) {
      setChurchValidated({ valid: false, name: null, slug: null });
      return;
    }

    setIsValidatingChurch(true);
    try {
      const { data, error } = await supabase.rpc('validate_church_code_secure', { p_code: code.toUpperCase() });
      
      if (error) {
        console.error('Error validating church code:', error);
        setChurchValidated({ valid: false, name: null, slug: null });
        return;
      }

      if (data && data.length > 0 && data[0].is_valid) {
        setChurchValidated({ valid: true, name: data[0].church_name, slug: null });
      } else {
        setChurchValidated({ valid: false, name: null, slug: null });
      }
    } catch (err) {
      console.error('Error validating church code:', err);
      setChurchValidated({ valid: false, name: null, slug: null });
    } finally {
      setIsValidatingChurch(false);
    }
  };

  // Watch church code changes
  const churchCodeValue = registerForm.watch('churchCode');

  const recoveryForm = useForm<RecoveryForm>({
    resolver: zodResolver(recoverySchema),
    defaultValues: { email: '' },
  });

  const resetPasswordForm = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const handleLogin = async (data: LoginForm) => {
    setIsLoading(true);
    
    // Mark that we're handling navigation to prevent useEffect from interfering
    hasRedirectedRef.current = true;
    
    try {
      const { error, session: loginSession } = await signIn(data.email, data.password);

      if (error) {
        hasRedirectedRef.current = false; // Reset on error so user can try again
        const errorMessage = error.message.includes('Invalid login credentials')
          ? t("auth.wrongCredentials")
          : error.message.includes('Email not confirmed')
          ? t("auth.emailUnconfirmed")
          : t("auth.loginFailed");
        
        toast({
          variant: 'destructive',
          title: t("auth.loginError"),
          description: errorMessage,
        });
        return;
      }

      // Use the session returned directly from signIn
      const currentSession = loginSession;
      
      if (!currentSession?.user) {
        hasRedirectedRef.current = false; // Reset on error
        toast({
          variant: 'destructive',
          title: t("auth.signInError"),
          description: t("auth.sessionFailed"),
        });
        return;
      }

      // CRITICAL: Wait for AuthProvider to process the SIGNED_IN event
      // Instead of a fixed delay, listen for the actual auth state change
      await new Promise<void>((resolve) => {
        if (user) { resolve(); return; }
        const timeout = setTimeout(resolve, 3000);
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_IN') {
            clearTimeout(timeout);
            subscription.unsubscribe();
            setTimeout(resolve, 50);
          }
        });
        setTimeout(() => subscription.unsubscribe(), 3100);
      });

      // Check if MFA verification is required
      const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      
      if (mfaData?.currentLevel === 'aal1' && mfaData?.nextLevel === 'aal2') {
        setActiveTab('2fa-verify');
        return;
      }

      // PRIORITY: If user came from a department invite link, send them back to /join/:code
      // so they get auto-added to the new department (existing accounts joining additional depts)
      if (isDepartmentInvite && redirectParam) {
        sessionStorage.setItem('pendingInvite', redirectParam.replace('/join/', ''));
        toast({
          title: t("auth.welcomeBack"),
          description: t("auth.joiningDepartment"),
        });
        navigate(redirectParam, { replace: true });
        return;
      }

      if (isChurchSetupRedirect) {
        toast({
          title: t("auth.loginComplete"),
          description: t("auth.continueChurch"),
        });
        navigate('/church-setup', { replace: true });
        return;
      }

      // Check if user is admin and redirect accordingly
      const { data: hasRole } = await supabase.rpc('has_role', { 
        _user_id: currentSession.user.id, 
        _role: 'admin' 
      });
      
      if (hasRole) {
        toast({
          title: t("auth.welcomeAdmin"),
          description: t("auth.adminRedirect"),
        });
        navigate('/admin', { replace: true });
        return;
      }

      // Count user departments to determine redirect destination
      const redirectDestination = await getSmartRedirectDestination(currentSession.user.id);
      const finalDest = await maybeChooseApp(currentSession.user.id, redirectDestination);
      
      console.log('[Auth] Login complete, redirecting to:', finalDest);
      
      toast({
        title: t("auth.welcomeBack"),
        description: t("auth.signedIn"),
      });
      navigate(finalDest, { replace: true });
    } catch (err) {
      console.error('[Auth] Unexpected error during login:', err);
      hasRedirectedRef.current = false;
      toast({
        variant: 'destructive',
        title: t("auth.unexpectedError"),
        description: t("auth.tryAgain"),
      });
    } finally {
      // CRITICAL: Always turn off loading state to prevent stuck UI
      setIsLoading(false);
    }
  };
  
  // Helper function to determine redirect based on department count
  // Uses a SECURITY DEFINER RPC to bypass RLS timing issues during login
  // Includes timeout to prevent hanging on slow/unresponsive RPC calls
  // Also includes retry logic to handle session propagation delays
  const getSmartRedirectDestination = async (userId: string): Promise<string> => {
    const RPC_TIMEOUT_MS = 4000; // 4 second timeout per attempt
    const MAX_RETRIES = 2; // Retry up to 2 times if we get 0 (session might not be propagated)
    const RETRY_DELAY_MS = 300; // Wait 300ms between retries
    
    const attemptRpc = async (attempt: number): Promise<{ count: number; elapsed: number; error?: Error }> => {
      const startTime = Date.now();
      
      try {
        // Create a timeout promise
        const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) => {
          setTimeout(() => {
            resolve({ data: null, error: new Error('RPC timeout') });
          }, RPC_TIMEOUT_MS);
        });
        
        // Race the RPC call against the timeout
        const rpcPromise = supabase.rpc('get_my_department_count', { p_user_id: userId });
        const result = await Promise.race([rpcPromise, timeoutPromise]);
        
        const elapsed = Date.now() - startTime;
        
        if (result.error) {
          return { count: -1, elapsed, error: result.error };
        }
        
        return { count: result.data as number, elapsed };
      } catch (error) {
        const elapsed = Date.now() - startTime;
        return { count: -1, elapsed, error: error as Error };
      }
    };
    
    let lastResult: { count: number; elapsed: number; error?: Error } = { count: 0, elapsed: 0 };
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        // Wait before retry to let session propagate
        console.log(`[Auth] Retrying department count (attempt ${attempt + 1}/${MAX_RETRIES + 1}) after ${RETRY_DELAY_MS}ms delay...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
      
      lastResult = await attemptRpc(attempt);
      
      if (lastResult.error) {
        console.error(`[Auth] Error getting department count (attempt ${attempt + 1}, ${lastResult.elapsed}ms):`, lastResult.error);
        // On error, fallback to dashboard
        return '/dashboard';
      }
      
      // If we got a non-zero count, we're good
      if (lastResult.count > 0) {
        console.log(`[Auth] Smart redirect - departments found via RPC: ${lastResult.count} (attempt ${attempt + 1}, ${lastResult.elapsed}ms)`);
        
        // Always go to dashboard (Meu Perfil)
        return '/dashboard';
      }
      
      // Got 0 - this might be a session propagation issue, retry if we have attempts left
      console.log(`[Auth] Smart redirect - got 0 departments (attempt ${attempt + 1}, ${lastResult.elapsed}ms), ${attempt < MAX_RETRIES ? 'retrying...' : 'giving up'}`);
    }
    
    // After all retries, if still 0, go to dashboard
    console.log(`[Auth] Smart redirect - final count: ${lastResult.count} after ${MAX_RETRIES + 1} attempts, going to /dashboard`);
    return '/dashboard';
  };

  const handle2FASuccess = async () => {
    // Mark that we're handling navigation
    hasRedirectedRef.current = true;
    
    // CRITICAL: Wait for React context to hydrate after 2FA completion
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Get current session to count departments
    const currentSession = await ensureSession();
    
    if (currentSession?.user) {
      const redirectDestination = await getSmartRedirectDestination(currentSession.user.id);
      const finalDest = await maybeChooseApp(currentSession.user.id, redirectDestination);
      toast({
        title: t("auth.welcomeBack"),
        description: t("auth.signedIn"),
      });
      navigate(finalDest, { replace: true });
      return;
    }
    
    // Fallback to smart redirect via dashboard
    const destination = redirectParam && redirectParam.startsWith('/') ? redirectParam : '/dashboard';
    toast({
      title: t("auth.welcomeBack"),
      description: t("auth.signedIn"),
    });
    navigate(destination, { replace: true });
  };

  const handle2FACancel = async () => {
    await supabase.auth.signOut();
    setActiveTab('login');
  };

  const handleRegister = async (data: RegisterForm) => {
    setIsLoading(true);
    
    // Church must be validated unless it's a department invite or the church owner signup flow
    if (!churchValidated.valid && !isDepartmentInvite && !isChurchSetupRedirect) {
      toast({
        variant: 'destructive',
        title: t("auth.churchNotFound"),
        description: t("auth.churchRequired"),
      });
      setIsLoading(false);
      return;
    }
    
    // Verificação de senha vazada
    const passwordValidation = await validatePassword(data.password);
    
    if (!passwordValidation.valid) {
      toast({
        variant: 'destructive',
        title: t("auth.unsafePassword"),
        description: passwordValidation.errors.join(' '),
      });
      setIsLoading(false);
      return;
    }
    
    const { error } = await signUp(
      data.email,
      data.password,
      data.name,
      data.whatsapp,
      isChurchSetupRedirect ? '/church-setup' : '/'
    );

    if (error) {
      setIsLoading(false);
      const isDuplicate = error.message.includes('User already registered')
        || error.message.toLowerCase().includes('already exists')
        || error.message.toLowerCase().includes('already been registered');

      if (isDuplicate) {
        // Preserve invite context so login takes the user back to /join/:code
        const redirectParam = searchParams.get('redirect');
        const invitedByParam = searchParams.get('invitedBy');
        const loginParams = new URLSearchParams({ tab: 'login' });
        if (redirectParam) loginParams.set('redirect', redirectParam);
        if (invitedByParam) loginParams.set('invitedBy', invitedByParam);

        toast({
          variant: 'destructive',
          title: t("auth.alreadyRegistered"),
          description: t("auth.alreadyRegisteredDetail"),
          action: (
            <ToastAction
              altText={t("auth.goToLogin")}
              onClick={() => navigate(`/auth?${loginParams.toString()}`)}
            >
              Fazer login
            </ToastAction>
          ),
        });
        // Auto-switch to login tab and pre-fill email for convenience
        setActiveTab('login');
        loginForm.setValue('email', data.email);
        return;
      }

      const errorMessage = error.message.includes('Password')
        ? t("auth.weakPassword")
        : t("auth.registerFailed");

      toast({
        variant: 'destructive',
        title: t("auth.registerError"),
        description: errorMessage,
      });
      return;
    }

    // Track which department invite led to this registration
    const invitedByParam = searchParams.get('invitedBy');
    const invitedByStorage = sessionStorage.getItem('invitedByDepartment');
    const invitedByDepartmentId = invitedByParam || invitedByStorage;

    // Wait a bit to ensure session is ready
    await new Promise(resolve => setTimeout(resolve, 500));

    const currentSession = await ensureSession();

    if (!currentSession?.user) {
      setIsLoading(false);
      toast({
        title: t("auth.accountCreated"),
        description: t("auth.confirmEmail"),
      });
      loginForm.setValue('email', data.email);
      setActiveTab('login');
      return;
    }

    if (currentSession.user) {
      // Save invited_by_department_id if coming from department invite
      if (invitedByDepartmentId && invitedByDepartmentId !== '') {
        try {
          await supabase
            .from('profiles')
            .update({ invited_by_department_id: invitedByDepartmentId })
            .eq('id', currentSession.user.id);
          
          // Clear storage after saving
          sessionStorage.removeItem('invitedByDepartment');
        } catch (err) {
          console.log('Não foi possível salvar origem do cadastro:', err);
        }
      }

      // Se é o email do admin principal, torná-lo admin automaticamente
      const ADMIN_EMAIL = 'elsdigital@elsdigital.tech';
      
      if (data.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        try {
          // Inserir como admin
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({ user_id: currentSession.user.id, role: 'admin' });
          
          if (!roleError) {
            toast({
              title: '🎉 Você é o administrador!',
              description: 'Você tem acesso total ao sistema.',
            });
          }
        } catch (err) {
          console.log('Não foi possível definir role de admin:', err);
        }
      }
    }

    setIsLoading(false);

    const welcomeMessage = isChurchSetupRedirect
      ? t("auth.registerChurchNext")
      : isDepartmentInvite
      ? t("auth.registerDeptNext")
      : t("auth.welcomeChurch", { church: churchValidated.name });

    toast({
      title: t("auth.accountCreatedSuccess"),
      description: welcomeMessage,
    });
    
    // Redirect logic:
    // 1. Department invite -> redirect to join page (redirectParam contains /join/:code)
    // 2. Church code from URL (volunteer via /join link) -> create department page
    // 3. Church slug -> church public page
    // 4. Otherwise -> dashboard
    let redirectTo = '/dashboard';

    // If the user came from a church code link (LEVI Escalas OR LeviKids),
    // try to claim leadership of that church (first person to register with the code becomes leader).
    if (churchCodeParam && currentSession?.user) {
      try {
        await supabase.rpc('claim_church_leadership' as any, { _code: churchCodeParam });
      } catch (err) {
        console.warn('[Auth] claim_church_leadership failed', err);
      }
    }

    if (isDepartmentInvite && redirectParam) {
      // Department invite - go back to join page to complete joining
      redirectTo = redirectParam;
    } else if (isChurchSetupRedirect) {
      redirectTo = '/church-setup';
    } else if (redirectParam && (redirectParam.startsWith('/departments/new') || redirectParam.startsWith('/kids/'))) {
      // Explicit redirect: create department OR LeviKids area
      redirectTo = redirectParam;
    } else if (churchCodeParam) {
      // Volunteer coming from church code link (no explicit redirect) - go to create department
      redirectTo = `/departments/new?churchCode=${churchCodeParam.toUpperCase()}`;
    } else if (churchValidated.slug) {
      redirectTo = `/igreja/${churchValidated.slug}`;
    }
    
    navigate(redirectTo);
  };

  const formatWhatsapp = (value: string) => {
    // Allows Brazilian numbers (11 digits) and international ones (+351..., +1...)
    if (value.trim().startsWith('+')) {
      return '+' + value.replace(/\D/g, '').slice(0, 15);
    }
    return value.replace(/\D/g, '').slice(0, 11);
  };

  const handleRecovery = async (data: RecoveryForm) => {
    setIsLoading(true);
    const redirectUrl = `${window.location.origin}/auth`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: redirectUrl,
    });
    setIsLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: t("auth.recoverySendFailed"),
      });
      return;
    }

    setRecoveryEmailSent(true);
    toast({
      title: 'Email enviado!',
      description: t("auth.recoveryCheckInbox"),
    });
  };

  const handleResetPassword = async (data: ResetPasswordForm) => {
    setIsLoading(true);
    
    try {
      // Verificação de senha vazada
      const passwordValidation = await validatePassword(data.password);
      
      if (!passwordValidation.valid) {
        toast({
          variant: 'destructive',
          title: t("auth.unsafePassword"),
          description: passwordValidation.errors.join(' '),
        });
        setIsLoading(false);
        return;
      }

      // Check if user has MFA enabled and needs AAL2
      const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      
      if (mfaData?.currentLevel === 'aal1' && mfaData?.nextLevel === 'aal2') {
        // User has MFA enabled, need to verify 2FA first
        setPendingPasswordReset(data.password);
        setActiveTab('2fa-verify-password-reset');
        setIsLoading(false);
        return;
      }
      
      await performPasswordReset(data.password);
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Ocorreu um erro inesperado. Tente novamente.',
      });
      setIsLoading(false);
    }
  };

  const performPasswordReset = async (password: string) => {
    setIsLoading(true);

    try {
      console.log('[PasswordReset] Starting password reset flow...');

      // Use refreshSession() instead of getSession() to ensure a fresh, valid token
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      console.log('[PasswordReset] refreshSession result:', {
        hasSession: !!refreshData?.session,
        hasUser: !!refreshData?.session?.user,
        error: refreshError?.message,
      });

      if (refreshError || !refreshData?.session) {
        console.error('[PasswordReset] No valid session after refresh:', refreshError);
        toast({
          variant: 'destructive',
          title: t("auth.recoveryMissing"),
          description: t("auth.recoveryMissingDetail"),
        });
        setActiveTab('recovery');
        return;
      }

      console.log('[PasswordReset] Session valid, calling updateUser...');
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        console.error('[PasswordReset] updateUser error:', error);
        let friendly = t("auth.resetFailed");

        if (error.message.includes('expired')) {
          friendly = t("auth.resetExpired");
        } else if (error.message.includes('same')) {
          friendly = t("auth.resetSame");
        } else if (error.message.includes('insufficient_aal') || error.message.includes('AAL2')) {
          friendly = t("auth.reset2fa");
        }

        toast({
          variant: 'destructive',
          title: t("auth.resetError"),
          description: `${friendly} (detalhe: ${error.message})`,
        });
        return;
      }

      console.log('[PasswordReset] Password updated successfully!');

      toast({
        title: t("auth.resetSuccess"),
        description: t("auth.resetSuccessDetail"),
      });

      window.location.hash = '';
      setPendingPasswordReset(null);
      setActiveTab('login');

      // Small delay to allow password update propagation
      await new Promise(resolve => setTimeout(resolve, 500));

      // Use scope: 'local' to avoid triggering TOKEN_REFRESHED redirect
      console.log('[PasswordReset] Signing out locally...');
      await supabase.auth.signOut({ scope: 'local' });

      toast({
        title: t("auth.loginAgain"),
        description: t("auth.loginAgainDetail"),
      });
    } catch (err) {
      console.error('[PasswordReset] Unexpected error:', err);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Ocorreu um erro inesperado. Solicite um novo link de recuperação.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FAPasswordResetSuccess = async () => {
    if (pendingPasswordReset) {
      await performPasswordReset(pendingPasswordReset);
    }
  };

  const handle2FAPasswordResetCancel = () => {
    setPendingPasswordReset(null);
    setActiveTab('reset-password');
  };

  const handleSocialSignIn = async (provider: 'google' | 'apple') => {
    setIsLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      
      if (result.redirected) {
        // Page is redirecting to OAuth provider
        return;
      }
      
      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: `Não foi possível conectar com ${provider === 'google' ? 'Google' : 'Apple'}. Tente novamente.`,
        });
        setIsLoading(false);
        return;
      }
      
      // OAuth successful - check if profile is complete
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, whatsapp')
          .eq('id', currentUser.id)
          .maybeSingle();
        
        if (profile && (!profile.name || !profile.whatsapp || profile.name.trim() === '' || profile.whatsapp.trim() === '')) {
          const completeUrl = redirectParam ? `/complete-profile?redirect=${encodeURIComponent(redirectParam)}` : '/complete-profile';
          navigate(completeUrl, { replace: true });
          return;
        }
      }
      
      navigate(redirectParam || '/dashboard', { replace: true });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: `Não foi possível conectar com ${provider === 'google' ? 'Google' : 'Apple'}. Tente novamente.`,
      });
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => handleSocialSignIn('google');
  const handleAppleSignIn = () => handleSocialSignIn('apple');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <SEO title={`${t("auth.login")} — LEVI`} description={t("landing.heroDescription")} path="/auth" />
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 py-12">
        <div className="w-full max-w-md mx-auto">
          {/* Back link and theme toggle */}
          <div className="flex items-center justify-between mb-8">
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {t("auth.backToStart")}
            </Link>
            <div className="flex items-center gap-2"><LanguageSelector /><ThemeToggle /></div>
          </div>

          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-glow-sm">
              <LeviLogo className="w-8 h-8" />
            </div>
            <div>
              <span className="font-display text-2xl font-bold text-foreground">LEVI</span>
              <p className="text-sm text-muted-foreground">{t("auth.scheduleManagement")}</p>
            </div>
          </div>

          <h1 className="font-display text-3xl font-bold text-foreground mb-6">
            {t("auth.accessTitle")}
          </h1>

          {/* Tabs - only show when coming from invite link */}
          {activeTab !== 'recovery' && activeTab !== 'reset-password' && activeTab !== '2fa-verify' && activeTab !== '2fa-verify-password-reset' && hasInviteContext && (
            <div className="flex gap-1 p-1 bg-muted rounded-xl mb-8">
              <button
                onClick={() => setActiveTab('login')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'login'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t("auth.login")}
              </button>
              <button
                onClick={() => setActiveTab('register')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'register'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t("auth.register")}
              </button>
            </div>
          )}

          {/* Recovery Header */}
          {activeTab === 'recovery' && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">{t("auth.recoverPassword")}</h2>
              <p className="text-muted-foreground">
                {t("auth.recoverDescription")}
              </p>
            </div>
          )}

          {/* Reset Password Header */}
          {activeTab === 'reset-password' && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">{t("auth.newPassword")}</h2>
              <p className="text-muted-foreground">
                {t("auth.enterNewPassword")}
              </p>
            </div>
          )}

          {/* Login Form */}
          {activeTab === 'login' && (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4 animate-fade-in">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="seu@email.com"
                  {...loginForm.register('email')}
                  className="h-12"
                />
                {loginForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">{t("common.password")}</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    {...loginForm.register('password')}
                    className="h-12 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-glow-sm transition-all"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    {t("auth.loggingIn")}
                  </>
                ) : (
                  t("auth.login")
                )}
              </Button>

              {isWebAuthnSupported() && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 gap-2"
                  disabled={isLoading}
                  onClick={async () => {
                    const email = loginForm.getValues('email');
                    if (!email) {
                      toast({
                        variant: 'destructive',
                        title: t("auth.provideEmail"),
                        description: t("auth.provideEmailDesc"),
                      });
                      return;
                    }
                    setIsLoading(true);
                    hasRedirectedRef.current = false;
                    try {
                      await loginWithBiometric(email);
                      toast({ title: t("auth.welcome"), description: t("auth.biometricSuccess") });
                    } catch (e: any) {
                      toast({
                        variant: 'destructive',
                        title: t("auth.biometricFailed"),
                        description: e?.message || t("auth.biometricError"),
                      });
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                >
                  <Fingerprint className="w-5 h-5" />
                  {t("auth.biometricLogin")}
                </Button>
              )}

              <button
                type="button"
                onClick={() => {
                  setActiveTab('recovery');
                  setRecoveryEmailSent(false);
                }}
                className="w-full text-center text-sm text-primary hover:underline"
              >
                {t("auth.forgotPassword")}
              </button>

            </form>
          )}

          {/* Register Form */}
          {activeTab === 'register' && (
            <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-5 animate-fade-in">
              {/* Church Context Info - Show church name and code when validated from URL */}
              {churchValidated.valid && churchValidated.name && (
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 mb-4 space-y-3">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{t("auth.creatingAccountFor")}</span>
                    <br />
                    <span className="text-primary font-semibold text-lg">{churchValidated.name}</span>
                  </p>
                  {/* Show church code if it came from URL */}
                  {churchCodeParam && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{t("auth.churchCode")}</Label>
                      <Input
                        type="text"
                        value={churchCodeParam.toUpperCase()}
                        disabled
                        className="h-10 bg-muted/50 font-mono text-sm"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* No church context - show error */}
              {!hasChurchContext && !churchValidated.valid && !isDepartmentInvite && !isChurchSetupRedirect && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 mb-4">
                  <p className="text-sm text-foreground">
                    <span className="font-medium text-destructive">{t("auth.inviteOnly")}</span>
                    <br />
                    <span className="text-muted-foreground">
                      {t("auth.inviteOnlyDesc")}
                    </span>
                  </p>
                </div>
              )}

              {/* Loading church validation */}
              {isValidatingChurch && (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                  <span className="text-muted-foreground">{t("auth.verifyingChurch")}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="register-name">{t("auth.fullName")}</Label>
                <Input
                  id="register-name"
                  type="text"
                  placeholder={t("auth.yourName")}
                  {...registerForm.register('name')}
                  className="h-12"
                  disabled={!isFormReadyToSubmit}
                />
                {registerForm.formState.errors.name && (
                  <p className="text-sm text-destructive">{registerForm.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-email">Email</Label>
                <Input
                  id="register-email"
                  type="email"
                  placeholder="seu@email.com"
                  {...registerForm.register('email')}
                  className="h-12"
                  disabled={!isFormReadyToSubmit}
                />
                {registerForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{registerForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-whatsapp">{t("auth.whatsapp")}</Label>
                <Input
                  id="register-whatsapp"
                  type="tel"
                  placeholder="11999999999"
                  {...registerForm.register('whatsapp')}
                  onChange={(e) => {
                    const formatted = formatWhatsapp(e.target.value);
                    registerForm.setValue('whatsapp', formatted);
                  }}
                  onFocus={() => setWhatsappFocused(true)}
                  onBlur={() => setWhatsappFocused(false)}
                  className="h-12"
                  disabled={!isFormReadyToSubmit}
                />
                {whatsappFocused && (
                  <p className="text-xs text-primary flex items-start gap-1 animate-fade-in">
                    <Info className="w-3 h-3 mt-0.5 shrink-0" />
                    Brasil: 11 dígitos (DDD + número). Fora do Brasil: use + e o código do país, ex: +351912345678
                  </p>
                )}
                {registerForm.formState.errors.whatsapp && (
                  <p className="text-sm text-destructive">{registerForm.formState.errors.whatsapp.message}</p>
                )}
                {!whatsappFocused && (
                  <p className="text-xs text-muted-foreground">
                    {t("auth.phoneHint")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-password">{t("common.password")}</Label>
                <div className="relative">
                  <Input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    {...registerForm.register('password')}
                    className="h-12 pr-12"
                    disabled={!isFormReadyToSubmit}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={!isFormReadyToSubmit}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {registerForm.formState.errors.password && (
                  <p className="text-sm text-destructive">{registerForm.formState.errors.password.message}</p>
                )}
                <PasswordStrengthIndicator password={registerForm.watch('password') || ''} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-confirm">{t("auth.confirmPassword")}</Label>
                <Input
                  id="register-confirm"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...registerForm.register('confirmPassword')}
                  className="h-12"
                  disabled={!isFormReadyToSubmit}
                />
                {registerForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive">{registerForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 gradient-vibrant text-white shadow-glow-sm hover:shadow-glow transition-all"
                disabled={isLoading || !isFormReadyToSubmit}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    {t("auth.creatingAccount")}
                  </>
                ) : !isFormReadyToSubmit ? (
                  t("auth.accessChurchFirst")
                ) : (
                  t("auth.register")
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                {t('auth.termsAgree')}{' '}
                <a href="#" className="text-primary hover:underline">{t("auth.termsOfUse")}</a>
                {' '}{t('common.and')}{' '}
                <a href="#" className="text-primary hover:underline">{t("auth.privacyPolicy")}</a>.
              </p>

              {/* Info for users without church context */}
              {!hasChurchContext && !isDepartmentInvite && !isChurchSetupRedirect && (
                <div className="p-4 rounded-xl glass border border-border/50">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{t("auth.howToCreateAccount")}</span>
                    <br />
                    {t("auth.howToCreateAccountDesc")}
                  </p>
                </div>
              )}

            </form>
          )}

          {/* Recovery Form */}
          {activeTab === 'recovery' && (
            <div className="space-y-6 animate-fade-in">
              {!recoveryEmailSent ? (
                <form onSubmit={recoveryForm.handleSubmit(handleRecovery)} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="recovery-email">Email</Label>
                    <Input
                      id="recovery-email"
                      type="email"
                      placeholder="seu@email.com"
                      {...recoveryForm.register('email')}
                      className="h-12"
                    />
                    {recoveryForm.formState.errors.email && (
                      <p className="text-sm text-destructive">{recoveryForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 gradient-fresh text-white shadow-glow-sm hover:shadow-glow transition-all"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        {t("auth.sending")}
                      </>
                    ) : (
                      t("auth.sendRecoveryLink")
                    )}
                  </Button>
                </form>
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{t("auth.emailSent")}</h3>
                  <p className="text-muted-foreground">
                    {t("auth.checkInbox")}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('login')}
                className="w-full text-center text-sm text-primary hover:underline"
              >
                {t("auth.backToLogin")}
              </button>
            </div>
          )}

          {/* Reset Password Form */}
          {activeTab === 'reset-password' && (
            <form onSubmit={resetPasswordForm.handleSubmit(handleResetPassword)} className="space-y-6 animate-fade-in">
              <div className="space-y-2">
                <Label htmlFor="reset-password">{t("auth.newPassword")}</Label>
                <div className="relative">
                  <Input
                    id="reset-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    {...resetPasswordForm.register('password')}
                    className="h-12 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {resetPasswordForm.formState.errors.password && (
                  <p className="text-sm text-destructive">{resetPasswordForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-confirm">{t("auth.confirmNewPassword")}</Label>
                <Input
                  id="reset-confirm"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...resetPasswordForm.register('confirmPassword')}
                  className="h-12"
                />
                {resetPasswordForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive">{resetPasswordForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 gradient-warm text-white shadow-glow-sm hover:shadow-glow transition-all"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    {t("auth.resetting")}
                  </>
                ) : (
                  t("auth.resetPassword")
                )}
              </Button>
            </form>
          )}

          {/* 2FA Verification */}
          {activeTab === '2fa-verify' && (
            <TwoFactorVerify 
              onSuccess={handle2FASuccess}
              onCancel={handle2FACancel}
            />
          )}

          {/* 2FA Verify for Password Reset */}
          {activeTab === '2fa-verify-password-reset' && (
            <div className="space-y-6 animate-fade-in">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-2">{t("auth.twoFactor")}</h2>
                <p className="text-muted-foreground">
                  {t("auth.twoFactorDescription")}
                </p>
              </div>
              <TwoFactorVerify 
                onSuccess={handle2FAPasswordResetSuccess}
                onCancel={handle2FAPasswordResetCancel}
              />
            </div>
          )}
        </div>
      </div>

      {/* Right side - Decorative */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <div className="absolute inset-0 mesh-gradient mesh-gradient-animated" />
        <div className="absolute inset-0 gradient-vibrant opacity-80" />
        
        <div className="relative z-10 flex flex-col justify-center p-16 text-white">
          <div className="max-w-md">
            <h2 className="font-display text-4xl font-bold mb-6">
              {t("auth.simplify")}
            </h2>
            <p className="text-lg text-white/80 mb-8">
              {t("auth.benefit")}
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <Calendar className="w-5 h-5" />
                </div>
                <span>{t("auth.calendarBenefit")}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <Bell className="w-5 h-5" />
                </div>
                <span>{t("auth.whatsappBenefit")}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <Users className="w-5 h-5" />
                </div>
                <span>{t("auth.syncBenefit")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}