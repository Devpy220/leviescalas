import { useState, useEffect } from 'react';
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

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100, 'Nome muito longo'),
  email: z.string().email('Email inválido').max(255, 'Email muito longo'),
  whatsapp: z.string()
    .regex(/^\d{11}$/, 'WhatsApp deve ter 11 dígitos (DDD + número)')
    .transform(val => val.replace(/\D/g, '')),
  password: passwordSchema,
  confirmPassword: z.string(),
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
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, signUp, user, loading, authEvent } = useAuth();

  // Detect password recovery flow from auth event
  useEffect(() => {
    if (authEvent === 'PASSWORD_RECOVERY') {
      console.log('Password recovery event detected');
      setActiveTab('reset-password');
    }
  }, [authEvent]);

  // Also check URL hash on mount for recovery link
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');
    
    if (type === 'recovery' && accessToken) {
      console.log('Recovery token found in URL');
      setActiveTab('reset-password');
    }
  }, []);

  // Sign out user when visiting auth page (force manual login)
  useEffect(() => {
    const signOutOnVisit = async () => {
      // Don't sign out during password reset flow
      if (activeTab === 'reset-password' || authEvent === 'PASSWORD_RECOVERY') {
        return;
      }
      
      // Sign out any existing session to force manual login
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.auth.signOut();
      }
    };
    
    signOutOnVisit();
  }, []);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', whatsapp: '', password: '', confirmPassword: '' },
  });

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
    const { error } = await signIn(data.email, data.password);
    setIsLoading(false);

    if (error) {
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

    // Check if MFA verification is required
    const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    
    if (mfaData?.currentLevel === 'aal1' && mfaData?.nextLevel === 'aal2') {
      setActiveTab('2fa-verify');
      return;
    }

    toast({
      title: 'Bem-vindo de volta!',
      description: 'Login realizado com sucesso.',
    });
    navigate('/dashboard');
  };

  const handle2FASuccess = () => {
    toast({
      title: 'Bem-vindo de volta!',
      description: 'Login realizado com sucesso.',
    });
    navigate('/dashboard');
  };

  const handle2FACancel = async () => {
    await supabase.auth.signOut();
    setActiveTab('login');
  };

  const handleRegister = async (data: RegisterForm) => {
    setIsLoading(true);
    
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
    setIsLoading(false);

    if (error) {
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

    toast({
      title: 'Conta criada com sucesso!',
      description: 'Você já pode fazer login.',
    });
    navigate('/dashboard');
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
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        console.error('Reset password error:', error);
        let errorMessage = 'Não foi possível redefinir sua senha. Tente novamente.';
        
        if (error.message.includes('expired')) {
          errorMessage = 'Link de recuperação expirado. Solicite um novo.';
        } else if (error.message.includes('same')) {
          errorMessage = 'A nova senha deve ser diferente da atual.';
        } else if (error.message.includes('insufficient_aal') || error.message.includes('AAL2')) {
          errorMessage = 'Verificação 2FA necessária. Por favor, verifique seu autenticador.';
        }
        
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: errorMessage,
        });
        setIsLoading(false);
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
              <div className="space-y-2">
                <Label htmlFor="register-name">Nome completo</Label>
                <Input
                  id="register-name"
                  type="text"
                  placeholder="Seu nome"
                  {...registerForm.register('name')}
                  className="h-12"
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
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                />
                {registerForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive">{registerForm.formState.errors.confirmPassword.message}</p>
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
                    Criando conta...
                  </>
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

              {/* Social Login Divider */}
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