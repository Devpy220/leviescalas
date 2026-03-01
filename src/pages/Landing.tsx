import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DemoTour } from '@/components/DemoTour';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useUserCount } from '@/hooks/useUserCount';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { 
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogPortal,
} from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { 
  Calendar, 
  Users, 
  Bell, 
  Zap, 
  Download,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { LeviLogo } from '@/components/LeviLogo';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { TwoFactorVerify } from '@/components/auth/TwoFactorVerify';

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

const features = [
  { icon: Calendar, title: 'Calendário Interativo', color: 'icon-violet' },
  { icon: Users, title: 'Gestão de Membros', color: 'icon-coral' },
  { icon: Bell, title: 'Notificações Automáticas', color: 'icon-emerald' },
  { icon: Zap, title: 'Tempo Real', color: 'icon-amber' },
];

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

const recoverySchema = z.object({
  email: z.string().email('Email inválido'),
});

type LoginForm = z.infer<typeof loginSchema>;
type RecoveryForm = z.infer<typeof recoverySchema>;

export default function Landing() {
  const [showDemo, setShowDemo] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'recovery' | '2fa-verify'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recoveryEmailSent, setRecoveryEmailSent] = useState(false);
  const hasRedirectedRef = useRef(false);
  
  const { count, loading: countLoading } = useUserCount();
  const { isInstallable, shouldShowInstallPrompt } = usePWAInstall();
  const { signIn, user, session, ensureSession } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Show PWA install prompt after 5 seconds if installable
  useEffect(() => {
    if (shouldShowInstallPrompt()) {
      const timer = setTimeout(() => setShowInstallPrompt(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [shouldShowInstallPrompt]);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const recoveryForm = useForm<RecoveryForm>({
    resolver: zodResolver(recoverySchema),
    defaultValues: { email: '' },
  });

  const getSmartRedirectDestination = async (userId: string): Promise<string> => {
    try {
      const result = await Promise.race([
        supabase.rpc('get_my_department_count', { p_user_id: userId }),
        new Promise<{ data: null; error: Error }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('timeout') }), 4000)
        ),
      ]);
      if (result.error || result.data === null) return '/dashboard';
      if (result.data === 1) return '/my-schedules';
      return '/dashboard';
    } catch {
      return '/dashboard';
    }
  };

  const handleLogin = async (data: LoginForm) => {
    setIsLoading(true);
    hasRedirectedRef.current = true;
    try {
      const { error, session: loginSession } = await signIn(data.email, data.password);
      if (error) {
        hasRedirectedRef.current = false;
        const errorMessage = error.message.includes('Invalid login credentials')
          ? 'Email ou senha incorretos'
          : error.message.includes('Email not confirmed')
          ? 'Por favor, confirme seu email antes de entrar'
          : 'Erro ao fazer login. Tente novamente.';
        toast({ variant: 'destructive', title: 'Erro no login', description: errorMessage });
        return;
      }
      const currentSession = loginSession;
      if (!currentSession?.user) {
        hasRedirectedRef.current = false;
        toast({ variant: 'destructive', title: 'Erro ao entrar', description: 'Não foi possível iniciar a sessão.' });
        return;
      }
      // Wait for auth state
      await new Promise<void>((resolve) => {
        if (user) { resolve(); return; }
        const timeout = setTimeout(resolve, 3000);
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_IN') { clearTimeout(timeout); subscription.unsubscribe(); setTimeout(resolve, 50); }
        });
        setTimeout(() => subscription.unsubscribe(), 3100);
      });
      // Check MFA
      const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (mfaData?.currentLevel === 'aal1' && mfaData?.nextLevel === 'aal2') {
        setAuthTab('2fa-verify');
        return;
      }
      // Check admin
      const { data: hasRole } = await supabase.rpc('has_role', { _user_id: currentSession.user.id, _role: 'admin' });
      if (hasRole) {
        toast({ title: 'Bem-vindo, Admin!', description: 'Redirecionando para o painel administrativo.' });
        navigate('/admin', { replace: true });
        return;
      }
      // Check profile completion
      const { data: profile } = await supabase.from('profiles').select('name, whatsapp').eq('id', currentSession.user.id).maybeSingle();
      if (profile && (!profile.name || !profile.whatsapp || profile.name.trim() === '' || profile.whatsapp.trim() === '')) {
        navigate('/complete-profile', { replace: true });
        return;
      }
      const dest = await getSmartRedirectDestination(currentSession.user.id);
      toast({ title: 'Bem-vindo de volta!', description: 'Login realizado com sucesso.' });
      navigate(dest, { replace: true });
    } catch (err) {
      console.error('[Landing] Login error:', err);
      hasRedirectedRef.current = false;
      toast({ variant: 'destructive', title: 'Erro inesperado', description: 'Ocorreu um erro. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FASuccess = async () => {
    hasRedirectedRef.current = true;
    await new Promise(resolve => setTimeout(resolve, 200));
    const currentSession = await ensureSession();
    if (currentSession?.user) {
      const dest = await getSmartRedirectDestination(currentSession.user.id);
      toast({ title: 'Bem-vindo de volta!', description: 'Login realizado com sucesso.' });
      navigate(dest, { replace: true });
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  const handle2FACancel = async () => {
    await supabase.auth.signOut();
    setAuthTab('login');
  };

  const handleRecovery = async (data: RecoveryForm) => {
    setIsLoading(true);
    const redirectUrl = `${window.location.origin}/auth`;
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, { redirectTo: redirectUrl });
    setIsLoading(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível enviar o email de recuperação.' });
      return;
    }
    setRecoveryEmailSent(true);
    toast({ title: 'Email enviado!', description: 'Verifique sua caixa de entrada para redefinir sua senha.' });
  };

  const handleSocialSignIn = async (provider: 'google' | 'apple') => {
    setIsLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
      if (result.redirected) return;
      if (result.error) {
        toast({ variant: 'destructive', title: 'Erro', description: `Não foi possível conectar com ${provider === 'google' ? 'Google' : 'Apple'}.` });
        setIsLoading(false);
        return;
      }
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const { data: profile } = await supabase.from('profiles').select('name, whatsapp').eq('id', currentUser.id).maybeSingle();
        if (profile && (!profile.name || !profile.whatsapp || profile.name.trim() === '' || profile.whatsapp.trim() === '')) {
          navigate('/complete-profile', { replace: true });
          return;
        }
      }
      navigate('/dashboard', { replace: true });
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: `Não foi possível conectar com ${provider === 'google' ? 'Google' : 'Apple'}.` });
      setIsLoading(false);
    }
  };

  const openAuth = (tab: 'login') => {
    setAuthTab(tab);
    setShowAuth(true);
    setRecoveryEmailSent(false);
  };

  return (
    <div className="min-h-screen h-screen bg-background flex flex-col overflow-hidden">
      <DemoTour open={showDemo} onOpenChange={setShowDemo} />
      <PWAInstallPrompt open={showInstallPrompt} onOpenChange={setShowInstallPrompt} />

      {/* Navigation */}
      <nav className="flex-shrink-0 glass border-b border-border/50 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LeviLogo className="transition-all duration-300" />
            <span className="font-display text-xl font-bold text-foreground">LEVI</span>
          </div>
          
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isInstallable && (
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => setShowInstallPrompt(true)}>
                <Download className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Instalar</span>
              </Button>
            )}
            <Button variant="outline" size="sm" className="border-secondary/50 text-secondary hover:bg-secondary/10" onClick={() => openAuth('login')}>
              Entrar
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content - Single Screen */}
      <main className="flex-1 flex items-center relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 mesh-gradient mesh-gradient-animated" />
        <div className="absolute inset-0 gradient-radial opacity-40" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            {/* Left Side - Branding */}
            <div className="text-center lg:text-left space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 text-secondary text-sm font-medium border border-secondary/20">
                <Sparkles className="w-4 h-4" />
                <span>Gestão de escalas para igrejas</span>
              </div>
              
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
                Organize suas escalas com{' '}
                <span className="text-gradient-vibrant">facilidade</span>
              </h1>
              
              <p className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto lg:mx-0">
                Calendário visual, notificações automáticas e sincronização em tempo real para voluntários.
              </p>

              {/* User Counter */}
              <div className="flex items-center justify-center lg:justify-start gap-3">
                <div className="flex -space-x-2">
                  {['from-primary/80 to-primary', 'from-secondary/80 to-secondary', 'from-accent/80 to-accent'].map((gradient, i) => (
                    <div key={i} className={`w-7 h-7 rounded-full bg-gradient-to-br ${gradient} border-2 border-background flex items-center justify-center`}>
                      <Users className="w-3.5 h-3.5 text-white" />
                    </div>
                  ))}
                </div>
                <div className="text-left">
                  <span className="text-xl font-bold text-gradient-vibrant">
                    {countLoading ? '...' : (count || 0).toLocaleString('pt-BR')}+
                  </span>
                  <p className="text-xs text-muted-foreground">voluntários cadastrados</p>
                </div>
              </div>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Button 
                  size="lg" 
                  className="bg-secondary text-secondary-foreground shadow-glow-sm hover:shadow-glow transition-all hover:brightness-110"
                  onClick={() => openAuth('login')}
                >
                  Entrar
                </Button>
              </div>
            </div>

            {/* Right Side - Features */}
            <div className="grid grid-cols-2 gap-4">
              {features.map((feature) => (
                <div 
                  key={feature.title}
                  className="group p-5 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 hover-lift cursor-default"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${feature.color} transition-transform group-hover:scale-110`}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    {feature.title}
                  </h3>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Auth Modal */}
      <Dialog open={showAuth} onOpenChange={(open) => { setShowAuth(open); if (!open) { setAuthTab('login'); setRecoveryEmailSent(false); } }}>
        <DialogPortal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
            {/* Close button */}
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">Fechar</span>
            </DialogPrimitive.Close>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
                <LeviLogo className="w-7 h-7" />
              </div>
              <div>
                <span className="font-display text-xl font-bold text-foreground">LEVI</span>
                <p className="text-xs text-muted-foreground">Gestão de Escalas</p>
              </div>
            </div>

            {/* Login Form */}
            {authTab === 'login' && (
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4 animate-fade-in">
                <div className="space-y-2">
                  <Label htmlFor="modal-email">Email</Label>
                  <Input id="modal-email" type="email" placeholder="seu@email.com" {...loginForm.register('email')} className="h-11" />
                  {loginForm.formState.errors.email && <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="modal-password">Senha</Label>
                  <div className="relative">
                    <Input id="modal-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" {...loginForm.register('password')} className="h-11 pr-12" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {loginForm.formState.errors.password && <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>}
                </div>

                <Button type="submit" className="w-full h-11 bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-glow-sm transition-all" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Entrando...</> : 'Entrar'}
                </Button>

                <button type="button" onClick={() => { setAuthTab('recovery'); setRecoveryEmailSent(false); }} className="w-full text-center text-sm text-primary hover:underline">
                  Esqueceu sua senha?
                </button>

                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
                </div>

                {/* Social Login */}
                <div className="flex justify-center gap-4">
                  <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-xl border-secondary/30 hover:border-secondary/50" onClick={() => handleSocialSignIn('google')} disabled={isLoading} title="Continuar com Google">
                    <GoogleIcon />
                  </Button>
                  <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-xl border-secondary/30 hover:border-secondary/50" onClick={() => handleSocialSignIn('apple')} disabled={isLoading} title="Continuar com Apple">
                    <AppleIcon />
                  </Button>
                </div>
              </form>
            )}

            {/* Recovery Form */}
            {authTab === 'recovery' && (
              <div className="space-y-4 animate-fade-in">
                <div className="mb-2">
                  <h2 className="text-xl font-bold text-foreground mb-1">Recuperar senha</h2>
                  <p className="text-sm text-muted-foreground">Digite seu email para receber o link de recuperação.</p>
                </div>
                {!recoveryEmailSent ? (
                  <form onSubmit={recoveryForm.handleSubmit(handleRecovery)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="modal-recovery-email">Email</Label>
                      <Input id="modal-recovery-email" type="email" placeholder="seu@email.com" {...recoveryForm.register('email')} className="h-11" />
                      {recoveryForm.formState.errors.email && <p className="text-sm text-destructive">{recoveryForm.formState.errors.email.message}</p>}
                    </div>
                    <Button type="submit" className="w-full h-11 gradient-fresh text-white shadow-glow-sm transition-all" disabled={isLoading}>
                      {isLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Enviando...</> : 'Enviar link de recuperação'}
                    </Button>
                  </form>
                ) : (
                  <div className="text-center space-y-3 py-4">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Sparkles className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Email enviado!</h3>
                    <p className="text-sm text-muted-foreground">Verifique sua caixa de entrada e clique no link para redefinir sua senha.</p>
                  </div>
                )}
                <button type="button" onClick={() => setAuthTab('login')} className="w-full text-center text-sm text-primary hover:underline">
                  Voltar para o login
                </button>
              </div>
            )}

            {/* 2FA Verification */}
            {authTab === '2fa-verify' && (
              <TwoFactorVerify onSuccess={handle2FASuccess} onCancel={handle2FACancel} />
            )}
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </div>
  );
}
