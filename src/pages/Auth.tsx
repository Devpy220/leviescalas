import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Calendar, Eye, EyeOff, ArrowLeft, Loader2, Sparkles, Users, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/ThemeToggle';
import { validatePassword } from '@/lib/passwordBreachChecker';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { TwoFactorVerify } from '@/components/auth/TwoFactorVerify';

import { supabase } from '@/integrations/supabase/client';

// Google Icon Component
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// Facebook Icon Component  
const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#1877F2">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

// Validation schemas
const passwordSchema = z.string()
  .min(8, 'Senha deve ter no mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Senha deve conter ao menos uma letra maiúscula')
  .regex(/[a-z]/, 'Senha deve conter ao menos uma letra minúscula')
  .regex(/\d/, 'Senha deve conter ao menos um número')
  .regex(/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'`~]/, 'Senha deve conter ao menos um caractere especial');

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

// Schema for regular members (church code required)
const registerSchema = z.object({
  churchCode: z.string().max(20, 'Código muito longo').optional(),
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100, 'Nome muito longo'),
  email: z.string().email('Email inválido').max(255, 'Email muito longo'),
  whatsapp: z.string()
    .regex(/^\d{11}$/, 'WhatsApp deve ter 11 dígitos (DDD + número)')
    .transform(val => val.replace(/\D/g, '')),
  password: passwordSchema,
  confirmPassword: z.string(),
  isAdminSignup: z.boolean().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

const recoverySchema = z.object({
  email: z.string().email('Email inválido'),
});

const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;
type RecoveryForm = z.infer<typeof recoverySchema>;
type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export default function Auth() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'register' ? 'register' : 'login';
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'recovery' | 'reset-password' | '2fa-verify' | '2fa-verify-password-reset'>(initialTab);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recoveryEmailSent, setRecoveryEmailSent] = useState(false);
  const [pendingPasswordReset, setPendingPasswordReset] = useState<string | null>(null);
  const [churchValidated, setChurchValidated] = useState<{ valid: boolean; name: string | null; slug: string | null }>({ valid: false, name: null, slug: null });
  const [isValidatingChurch, setIsValidatingChurch] = useState(false);
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
        title: 'Sessão expirada',
        description: 'Sua sessão expirou. Por favor, faça login novamente.',
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

    // Some providers/flows may omit `type=recovery` but still include `code`.
    const isRecovery = queryType === 'recovery' || hashType === 'recovery' || !!code || !!hashAccessToken;

    return { isRecovery, queryType, hashType, code, hashAccessToken };
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
            title: 'Link inválido',
            description: 'Esse link de recuperação expirou. Solicite um novo email de recuperação.',
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
      
      // Use smart redirect instead of default /dashboard
      // If there's a specific redirect param, honor it
      if (redirectParam && redirectParam.startsWith('/')) {
        navigate(redirectParam, { replace: true });
        return;
      }
      
      // Otherwise, use smart redirect based on department count
      const destination = await getSmartRedirectDestination(session.user.id);
      console.log('[Auth] Already authenticated, smart redirecting to:', destination);
      navigate(destination, { replace: true });
    }, 150);
    
    return () => clearTimeout(stabilizationTimeout);
  }, [loading, session, navigate, redirectParam, isLoading, forceLogin, activeTab]);

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

  // Form is ready when church is validated OR it's a department invite
  const isFormReadyToSubmit = churchValidated.valid || isDepartmentInvite;

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
    const { error, session: loginSession } = await signIn(data.email, data.password);

    if (error) {
      setIsLoading(false);
      const errorMessage = error.message.includes('Invalid login credentials')
        ? 'Email ou senha incorretos'
        : error.message.includes('Email not confirmed')
        ? 'Por favor, confirme seu email antes de entrar'
        : 'Erro ao fazer login. Tente novamente.';
      
      toast({
        variant: 'destructive',
        title: 'Erro no login',
        description: errorMessage,
      });
      return;
    }

    // Use the session returned directly from signIn - no need for delays
    const currentSession = loginSession;
    
    if (!currentSession?.user) {
      setIsLoading(false);
      toast({
        variant: 'destructive',
        title: 'Erro ao entrar',
        description: 'Não foi possível iniciar a sessão. Tente novamente.',
      });
      return;
    }

    // Check if MFA verification is required
    const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    
    if (mfaData?.currentLevel === 'aal1' && mfaData?.nextLevel === 'aal2') {
      setIsLoading(false);
      setActiveTab('2fa-verify');
      return;
    }

    // Check if user is admin and redirect accordingly
    const { data: hasRole } = await supabase.rpc('has_role', { 
      _user_id: currentSession.user.id, 
      _role: 'admin' 
    });
    
    if (hasRole) {
      setIsLoading(false);
      toast({
        title: 'Bem-vindo, Admin!',
        description: 'Redirecionando para o painel administrativo.',
      });
      navigate('/admin', { replace: true });
      return;
    }

    // Count user departments to determine redirect destination
    // Session is already hydrated in state, so RLS should work immediately
    const redirectDestination = await getSmartRedirectDestination(currentSession.user.id);
    
    console.log('[Auth] Login complete, redirecting to:', redirectDestination);
    
    setIsLoading(false);
    toast({
      title: 'Bem-vindo de volta!',
      description: 'Login realizado com sucesso.',
    });
    navigate(redirectDestination, { replace: true });
  };
  
  // Helper function to determine redirect based on department count
  // Uses a SECURITY DEFINER RPC to bypass RLS timing issues during login
  const getSmartRedirectDestination = async (userId: string): Promise<string> => {
    try {
      // Use RPC function that runs with SECURITY DEFINER - bypasses RLS timing issues
      const { data: departmentCount, error } = await supabase.rpc('get_my_department_count');

      if (error) {
        console.error('Error getting department count via RPC:', error);
        // Fallback to dashboard on error
        return '/dashboard';
      }
      
      console.log('[Auth] Smart redirect - departments found via RPC:', departmentCount);

      // 1 department -> go directly to schedules
      // 0 or 2+ departments -> go to dashboard
      if (departmentCount === 1) {
        return '/my-schedules';
      }
      return '/dashboard';
    } catch (error) {
      console.error('Error counting departments:', error);
      return '/dashboard';
    }
  };

  const handle2FASuccess = async () => {
    // Get current session to count departments
    const currentSession = await ensureSession();
    
    if (currentSession?.user) {
      const redirectDestination = await getSmartRedirectDestination(currentSession.user.id);
      toast({
        title: 'Bem-vindo de volta!',
        description: 'Login realizado com sucesso.',
      });
      navigate(redirectDestination, { replace: true });
      return;
    }
    
    // Fallback to smart redirect via dashboard
    const destination = redirectParam && redirectParam.startsWith('/') ? redirectParam : '/dashboard';
    toast({
      title: 'Bem-vindo de volta!',
      description: 'Login realizado com sucesso.',
    });
    navigate(destination, { replace: true });
  };

  const handle2FACancel = async () => {
    await supabase.auth.signOut();
    setActiveTab('login');
  };

  const handleRegister = async (data: RegisterForm) => {
    setIsLoading(true);
    
    // Church must be validated unless it's a department invite
    if (!churchValidated.valid && !isDepartmentInvite) {
      toast({
        variant: 'destructive',
        title: 'Igreja não encontrada',
        description: 'Você precisa acessar a página de uma igreja ou usar um código de convite para criar conta.',
      });
      setIsLoading(false);
      return;
    }
    
    // Verificação de senha vazada
    const passwordValidation = await validatePassword(data.password);
    
    if (!passwordValidation.valid) {
      toast({
        variant: 'destructive',
        title: 'Senha insegura',
        description: passwordValidation.errors.join(' '),
      });
      setIsLoading(false);
      return;
    }
    
    const { error } = await signUp(data.email, data.password, data.name, data.whatsapp);

    if (error) {
      setIsLoading(false);
      const errorMessage = error.message.includes('User already registered')
        ? 'Este email já está cadastrado'
        : error.message.includes('Password')
        ? 'Senha muito fraca. Use letras e números.'
        : 'Erro ao criar conta. Tente novamente.';
      
      toast({
        variant: 'destructive',
        title: 'Erro no cadastro',
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

    if (currentSession?.user) {
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
      const ADMIN_EMAIL = 'leviescalas@gmail.com';
      
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

    const welcomeMessage = isDepartmentInvite
      ? 'Conta criada! Você será redirecionado para entrar no departamento.'
      : `Bem-vindo à ${churchValidated.name}!`;

    toast({
      title: 'Conta criada com sucesso!',
      description: welcomeMessage,
    });
    
    // Redirect logic:
    // 1. Department invite -> redirect to join page (redirectParam contains /join/:code)
    // 2. Church code from URL (volunteer via /join link) -> create department page
    // 3. Church slug -> church public page
    // 4. Otherwise -> dashboard
    let redirectTo = '/dashboard';
    
    if (isDepartmentInvite && redirectParam) {
      // Department invite - go back to join page to complete joining
      redirectTo = redirectParam;
    } else if (churchCodeParam) {
      // Volunteer coming from church code link - go to create department
      redirectTo = `/departments/new?churchCode=${churchCodeParam.toUpperCase()}`;
    } else if (churchValidated.slug) {
      redirectTo = `/igreja/${churchValidated.slug}`;
    }
    
    navigate(redirectTo);
  };

  const formatWhatsapp = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    return numbers;
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
        description: 'Não foi possível enviar o email de recuperação. Tente novamente.',
      });
      return;
    }

    setRecoveryEmailSent(true);
    toast({
      title: 'Email enviado!',
      description: 'Verifique sua caixa de entrada para redefinir sua senha.',
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
          title: 'Senha insegura',
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
      // Sem uma sessão de recuperação válida, updateUser vai falhar (e parece que “não redefiniu”).
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast({
          variant: 'destructive',
          title: 'Sessão de recuperação ausente',
          description: 'Abra novamente o link de recuperação do email e tente de novo.',
        });
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        console.error('Reset password error:', error);
        let friendly = 'Não foi possível redefinir sua senha. Tente novamente.';

        if (error.message.includes('expired')) {
          friendly = 'Link de recuperação expirado. Solicite um novo.';
        } else if (error.message.includes('same')) {
          friendly = 'A nova senha deve ser diferente da atual.';
        } else if (error.message.includes('insufficient_aal') || error.message.includes('AAL2')) {
          friendly = 'Verificação 2FA necessária. Por favor, verifique seu autenticador.';
        }

        toast({
          variant: 'destructive',
          title: 'Erro ao redefinir senha',
          description: `${friendly} (detalhe: ${error.message})`,
        });
        return;
      }

      toast({
        title: 'Senha redefinida!',
        description: 'Sua senha foi alterada com sucesso.',
      });

      // Clear the hash and redirect
      window.location.hash = '';
      setPendingPasswordReset(null);
      setActiveTab('login');

      // Sign out to force fresh login with new password
      await supabase.auth.signOut();

      toast({
        title: 'Faça login novamente',
        description: 'Use sua nova senha para entrar.',
      });
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Ocorreu um erro inesperado. Tente novamente.',
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

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível conectar com Google. Tente novamente.',
      });
      setIsLoading(false);
    }
  };

  const handleFacebookSignIn = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível conectar com Facebook. Tente novamente.',
      });
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
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
              Voltar ao início
            </Link>
            <ThemeToggle />
          </div>

          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl gradient-vibrant flex items-center justify-center shadow-glow-sm">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-display text-2xl font-bold text-foreground">LEVI</span>
              <p className="text-sm text-muted-foreground">Gestão de Escalas</p>
            </div>
          </div>

          {/* Tabs */}
          {activeTab !== 'recovery' && activeTab !== 'reset-password' && activeTab !== '2fa-verify' && activeTab !== '2fa-verify-password-reset' && (
            <div className="flex gap-1 p-1 bg-muted rounded-xl mb-8">
              <button
                onClick={() => setActiveTab('login')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'login'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Entrar
              </button>
              <button
                onClick={() => setActiveTab('register')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'register'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Criar conta
              </button>
            </div>
          )}

          {/* Recovery Header */}
          {activeTab === 'recovery' && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">Recuperar senha</h2>
              <p className="text-muted-foreground">
                Digite seu email para receber o link de recuperação.
              </p>
            </div>
          )}

          {/* Reset Password Header */}
          {activeTab === 'reset-password' && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">Nova senha</h2>
              <p className="text-muted-foreground">
                Digite sua nova senha abaixo.
              </p>
            </div>
          )}

          {/* Login Form */}
          {activeTab === 'login' && (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-6 animate-fade-in">
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
                <Label htmlFor="login-password">Senha</Label>
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
                className="w-full h-12 gradient-vibrant text-white shadow-glow-sm hover:shadow-glow transition-all"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('recovery');
                  setRecoveryEmailSent(false);
                }}
                className="w-full text-center text-sm text-primary hover:underline"
              >
                Esqueceu sua senha?
              </button>

              {/* Social Login Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
              </div>

              {/* Social Login Buttons */}
              <div className="flex justify-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="w-12 h-12 rounded-xl"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                >
                  <GoogleIcon />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="w-12 h-12 rounded-xl"
                  onClick={handleFacebookSignIn}
                  disabled={isLoading}
                >
                  <FacebookIcon />
                </Button>
              </div>
            </form>
          )}

          {/* Register Form */}
          {activeTab === 'register' && (
            <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-5 animate-fade-in">
              {/* Church Context Info - Show church name and code when validated from URL */}
              {churchValidated.valid && churchValidated.name && (
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 mb-4 space-y-3">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">Criando conta para:</span>
                    <br />
                    <span className="text-primary font-semibold text-lg">{churchValidated.name}</span>
                  </p>
                  {/* Show church code if it came from URL */}
                  {churchCodeParam && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Código da Igreja</Label>
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
              {!hasChurchContext && !churchValidated.valid && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 mb-4">
                  <p className="text-sm text-foreground">
                    <span className="font-medium text-destructive">Código da igreja necessário</span>
                    <br />
                    <span className="text-muted-foreground">
                      Para criar uma conta, você precisa do código da sua igreja ou um link de convite.
                    </span>
                  </p>
                  <Link to="/" className="inline-block mt-2">
                    <Button variant="outline" size="sm">
                      Digitar código da igreja
                    </Button>
                  </Link>
                </div>
              )}

              {/* Loading church validation */}
              {isValidatingChurch && (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                  <span className="text-muted-foreground">Verificando igreja...</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="register-name">Nome completo</Label>
                <Input
                  id="register-name"
                  type="text"
                  placeholder="Seu nome"
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
                <Label htmlFor="register-whatsapp">WhatsApp (apenas números)</Label>
                <Input
                  id="register-whatsapp"
                  type="tel"
                  placeholder="11999999999"
                  {...registerForm.register('whatsapp')}
                  onChange={(e) => {
                    const formatted = formatWhatsapp(e.target.value);
                    registerForm.setValue('whatsapp', formatted);
                  }}
                  className="h-12"
                  disabled={!isFormReadyToSubmit}
                />
                {registerForm.formState.errors.whatsapp && (
                  <p className="text-sm text-destructive">{registerForm.formState.errors.whatsapp.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Exemplo: 11999999999 (DDD + número)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-password">Senha</Label>
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
                <Label htmlFor="register-confirm">Confirmar senha</Label>
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
                    Criando conta...
                  </>
                ) : !isFormReadyToSubmit ? (
                  'Acesse a página da igreja primeiro'
                ) : (
                  'Criar conta'
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Ao criar sua conta, você concorda com nossos{' '}
                <a href="#" className="text-primary hover:underline">Termos de Uso</a>
                {' '}e{' '}
                <a href="#" className="text-primary hover:underline">Política de Privacidade</a>.
              </p>

              {/* Info for users without church context */}
              {!hasChurchContext && (
                <div className="p-4 rounded-xl glass border border-border/50">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Não tem o código da igreja?</span>
                    <br />
                    Solicite ao administrador da sua igreja. Igrejas são cadastradas apenas por administradores autorizados.
                  </p>
                </div>
              )}

              {/* Social Login Divider */}
              {isFormReadyToSubmit && (
                <>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border"></div>
                    </div>
                  </div>

                  {/* Social Login Buttons */}
                  <div className="flex justify-center gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="w-12 h-12 rounded-xl"
                      onClick={handleGoogleSignIn}
                      disabled={isLoading}
                    >
                      <GoogleIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="w-12 h-12 rounded-xl"
                      onClick={handleFacebookSignIn}
                      disabled={isLoading}
                    >
                      <FacebookIcon />
                    </Button>
                  </div>
                </>
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
                    className="w-full h-12 gradient-vibrant text-white shadow-glow-sm hover:shadow-glow transition-all"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Enviando...
                      </>
                    ) : (
                      'Enviar link de recuperação'
                    )}
                  </Button>
                </form>
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Email enviado!</h3>
                  <p className="text-muted-foreground">
                    Verifique sua caixa de entrada e clique no link para redefinir sua senha.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('login')}
                className="w-full text-center text-sm text-primary hover:underline"
              >
                Voltar para o login
              </button>
            </div>
          )}

          {/* Reset Password Form */}
          {activeTab === 'reset-password' && (
            <form onSubmit={resetPasswordForm.handleSubmit(handleResetPassword)} className="space-y-6 animate-fade-in">
              <div className="space-y-2">
                <Label htmlFor="reset-password">Nova senha</Label>
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
                <Label htmlFor="reset-confirm">Confirmar nova senha</Label>
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
                className="w-full h-12 gradient-vibrant text-white shadow-glow-sm hover:shadow-glow transition-all"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Redefinindo...
                  </>
                ) : (
                  'Redefinir senha'
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
                <h2 className="text-2xl font-bold text-foreground mb-2">Verificação 2FA</h2>
                <p className="text-muted-foreground">
                  Como você tem autenticação de dois fatores ativada, por favor verifique sua identidade antes de redefinir a senha.
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
              Simplifique a gestão de voluntários
            </h2>
            <p className="text-lg text-white/80 mb-8">
              Com LEVI, você organiza escalas, envia notificações automáticas e mantém 
              todos os membros sincronizados em tempo real.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <Calendar className="w-5 h-5" />
                </div>
                <span>Calendário visual com drag-and-drop</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <Bell className="w-5 h-5" />
                </div>
                <span>Notificações automáticas via Email</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <Users className="w-5 h-5" />
                </div>
                <span>Sincronização em tempo real</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}