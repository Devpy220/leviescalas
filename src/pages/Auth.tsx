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

import { supabase } from '@/integrations/supabase/client';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100, 'Nome muito longo'),
  email: z.string().email('Email inválido').max(255, 'Email muito longo'),
  whatsapp: z.string()
    .regex(/^\d{11}$/, 'WhatsApp deve ter 11 dígitos (DDD + número)')
    .transform(val => val.replace(/\D/g, '')),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

const recoverySchema = z.object({
  email: z.string().email('Email inválido'),
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;
type RecoveryForm = z.infer<typeof recoverySchema>;

export default function Auth() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'register' ? 'register' : 'login';
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'recovery'>(initialTab);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recoveryEmailSent, setRecoveryEmailSent] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, signUp, user, loading } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

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

    toast({
      title: 'Bem-vindo de volta!',
      description: 'Login realizado com sucesso.',
    });
    navigate('/dashboard');
  };

  const handleRegister = async (data: RegisterForm) => {
    setIsLoading(true);
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
          {activeTab !== 'recovery' && (
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
                <span>Notificações automáticas via WhatsApp</span>
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