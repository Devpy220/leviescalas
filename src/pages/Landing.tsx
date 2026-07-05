import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { useIsMobile } from '@/hooks/use-mobile';
import elsdigitalLogo from '@/assets/elsdigital-logo.jpeg';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useUserCount } from '@/hooks/useUserCount';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  DialogPortal,
  Dialog,
} from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Calendar,
  Users,
  Bell,
  
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  X,
  RefreshCw,
  LayoutGrid,
  CheckCircle2,
  ArrowRight,
  Mail,
  Send,
  Church,
  MessageCircle,
  Smartphone,
  Shield,
  CalendarDays,
  Megaphone,
  FileSpreadsheet,
  Globe,
  CalendarSync,
  Clock,
  HeartHandshake,
  Crown,
  Settings,
  Music,
  Fingerprint,
  UserCog,
  Lock,
} from 'lucide-react';
import { LeviLogo } from '@/components/LeviLogo';
import { VideoBackground } from '@/components/VideoBackground';
import { LeviTypewriter } from '@/components/LeviTypewriter';
import { BibleVerseTypewriter } from '@/components/BibleVerseTypewriter';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { TwoFactorVerify } from '@/components/auth/TwoFactorVerify';
import { LanguageSelector } from '@/components/LanguageSelector';

// ── Icons ────────────────────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);
const AppleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
  </svg>
);

// ── Typewriter ───────────────────────────────────────────────────────────────
function Typewriter({ words }: { words: string[] }) {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState('');
  const [del, setDel] = useState(false);
  const [charKey, setCharKey] = useState(0);

  useEffect(() => {
    const word = words[idx];
    const t = del
      ? setTimeout(() => {
          setText(s => s.slice(0, -1));
          if (text.length === 1) { setDel(false); setIdx(i => (i + 1) % words.length); setCharKey(k => k + 1); }
        }, 55)
      : setTimeout(() => {
          setText(word.slice(0, text.length + 1));
          if (text.length === word.length - 1) setTimeout(() => setDel(true), 1500);
        }, 85);
    return () => clearTimeout(t);
  }, [text, del, idx, words]);

  return (
    <span className="typewriter-word">
      {text.split('').map((char, i) => (
        <span
          key={`${charKey}-${i}`}
          className="typewriter-char"
          style={{ animationDelay: `${i * 30}ms` }}
        >
          {char}
        </span>
      ))}
      <span className="typewriter-cursor">|</span>
    </span>
  );
}

// ── Counter animation ────────────────────────────────────────────────────────
function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStarted(true); }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    let v = 0;
    const step = Math.ceil(target / 50);
    const t = setInterval(() => {
      v += step;
      if (v >= target) { setN(target); clearInterval(t); } else setN(v);
    }, 25);
    return () => clearInterval(t);
  }, [started, target]);

  return <span ref={ref}>{n.toLocaleString('pt-BR')}{suffix}</span>;
}



// ── Feature data ─────────────────────────────────────────────────────────────
// slides are now built dynamically in FeatureCarousel using t()

// ── Feature Grid (todas as funcionalidades reais do LEVI) ───────────────────
function FeatureGrid() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);
  const features = [
    {
      icon: Sparkles,
      title: 'Geração Inteligente de Escalas',
      desc: 'IA monta a escala do mês inteiro respeitando disponibilidade, bloqueios e setores.',
      color: 'from-violet-500/15 to-violet-500/5',
      iconColor: 'text-violet-600',
    },
    {
      icon: Calendar,
      title: 'Disponibilidade Semanal',
      desc: 'Cada voluntário marca os dias e turnos que pode servir — uma vez só, vale para sempre.',
      color: 'from-amber-500/15 to-amber-500/5',
      iconColor: 'text-amber-600',
    },
    {
      icon: CalendarDays,
      title: 'Bloqueio de Datas',
      desc: 'Voluntário bloqueia dias específicos pelo app ou respondendo no WhatsApp.',
      color: 'from-rose-500/15 to-rose-500/5',
      iconColor: 'text-rose-600',
    },
    {
      icon: MessageCircle,
      title: 'Notificações via WhatsApp',
      desc: 'Confirmações, lembretes e avisos chegam direto no WhatsApp do voluntário.',
      color: 'from-emerald-500/15 to-emerald-500/5',
      iconColor: 'text-emerald-600',
    },
    {
      icon: RefreshCw,
      title: 'Trocas pelo WhatsApp',
      desc: 'Voluntário envia "troca" no WhatsApp do LEVI e resolve a substituição em segundos — sem abrir o app.',
      color: 'from-sky-500/15 to-sky-500/5',
      iconColor: 'text-sky-600',
    },
    {
      icon: CheckCircle2,
      title: 'Confirmação por Link',
      desc: 'Voluntário confirma presença com um clique no link recebido pelo WhatsApp.',
      color: 'from-teal-500/15 to-teal-500/5',
      iconColor: 'text-teal-600',
    },
    {
      icon: Bell,
      title: 'Lembretes Automáticos',
      desc: 'Avisos no WhatsApp 18 horas e 6 horas antes da escala, com efeito de digitação humanizado.',
      color: 'from-indigo-500/15 to-indigo-500/5',
      iconColor: 'text-indigo-600',
    },
    {
      icon: Megaphone,
      title: 'Mural de Avisos',
      desc: 'Líder publica comunicados que aparecem como popup e vão para o WhatsApp.',
      color: 'from-pink-500/15 to-pink-500/5',
      iconColor: 'text-pink-600',
    },
    {
      icon: LayoutGrid,
      title: 'Múltiplos Departamentos',
      desc: 'Louvor, mídia, recepção, kids… cada um com seus líderes, setores e regras.',
      color: 'from-fuchsia-500/15 to-fuchsia-500/5',
      iconColor: 'text-fuchsia-600',
    },
    {
      icon: Users,
      title: 'Setores e Funções',
      desc: 'Defina funções (vocal, guitarra, câmera) e setores para escalar com precisão.',
      color: 'from-cyan-500/15 to-cyan-500/5',
      iconColor: 'text-cyan-600',
    },
    {
      icon: Church,
      title: 'Página Pública da Igreja',
      desc: 'leviescalas.com.br/igreja/sua-igreja com calendário visível para todos.',
      color: 'from-orange-500/15 to-orange-500/5',
      iconColor: 'text-orange-600',
    },
    {
      icon: Globe,
      title: 'Embed no Site da Igreja',
      desc: 'Incorpore as escalas no site da sua igreja com um simples iframe.',
      color: 'from-lime-500/15 to-lime-500/5',
      iconColor: 'text-lime-600',
    },
    {
      icon: CalendarSync,
      title: 'Sincronização com Calendário',
      desc: 'Adicione suas escalas no Google Calendar, iCal ou Outlook automaticamente.',
      color: 'from-blue-500/15 to-blue-500/5',
      iconColor: 'text-blue-600',
    },
    {
      icon: FileSpreadsheet,
      title: 'Exportação em Excel',
      desc: 'Baixe a escala mensal em planilha para imprimir ou compartilhar.',
      color: 'from-green-500/15 to-green-500/5',
      iconColor: 'text-green-600',
    },
    {
      icon: Smartphone,
      title: 'App PWA Instalável',
      desc: 'Instale no celular como um app nativo — Android, iOS e Desktop.',
      color: 'from-purple-500/15 to-purple-500/5',
      iconColor: 'text-purple-600',
    },
    {
      icon: Clock,
      title: 'Detecção de Conflitos',
      desc: 'Bloqueia escalas duplas ou conflitos entre departamentos automaticamente.',
      color: 'from-red-500/15 to-red-500/5',
      iconColor: 'text-red-600',
    },
    {
      icon: Shield,
      title: 'Convite Restrito',
      desc: 'Acesso só por link de convite. Sem cadastro aberto, sem bots.',
      color: 'from-slate-500/15 to-slate-500/5',
      iconColor: 'text-slate-600',
    },
    {
      icon: HeartHandshake,
      title: 'Gratuito para Igrejas',
      desc: 'Sem mensalidade. Mantido por doações via PIX e cartão. Sugestão: R$ 25,00.',
      color: 'from-yellow-500/15 to-yellow-500/5',
      iconColor: 'text-yellow-600',
    },
    {
      icon: Crown,
      title: 'Tour Guiado para Líderes',
      desc: 'Passo a passo na primeira entrada explica tudo o que o líder pode fazer.',
      color: 'from-violet-500/15 to-violet-500/5',
      iconColor: 'text-violet-600',
    },
    {
      icon: Settings,
      title: 'Configurações por Departamento',
      desc: 'Cada ministério define turnos, dobras de domingo e limite de bloqueios.',
      color: 'from-stone-500/15 to-stone-500/5',
      iconColor: 'text-stone-600',
    },
    {
      icon: Music,
      title: 'Repertório e Cifras',
      desc: 'Líder anexa repertório, links e cifras direto na escala — voluntário recebe tudo no WhatsApp.',
      color: 'from-purple-500/15 to-purple-500/5',
      iconColor: 'text-purple-600',
    },
    {
      icon: Fingerprint,
      title: 'Login Biométrico',
      desc: 'Entre com Face ID, Touch ID ou digital — sem digitar senha toda vez.',
      color: 'from-emerald-500/15 to-emerald-500/5',
      iconColor: 'text-emerald-600',
    },
    {
      icon: UserCog,
      title: 'Coordenadores Auxiliares',
      desc: 'Líder convida coordenadores para ajudar a gerenciar a escala sem dar acesso financeiro.',
      color: 'from-sky-500/15 to-sky-500/5',
      iconColor: 'text-sky-600',
    },
    {
      icon: Lock,
      title: 'Privacidade de Contato',
      desc: 'Cada voluntário decide se telefone e e-mail ficam visíveis para os outros do departamento.',
      color: 'from-rose-500/15 to-rose-500/5',
      iconColor: 'text-rose-600',
    },
  ];

  return (
    <div className="mt-2 sm:mt-3">
      <div className="text-center mb-6 sm:mb-7">
        <p className="text-primary text-[11px] font-semibold uppercase tracking-[0.15em] mb-1.5">Tudo o que o LEVI faz</p>
        <h3 className="font-display text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
          Funcionalidades em <span className="text-primary">um só lugar</span>
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto mt-2">
          Da geração inteligente da escala até o lembrete no WhatsApp do voluntário.
        </p>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5 sm:gap-2">
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(i)}
              className={`group relative overflow-hidden rounded-lg border border-border/60 bg-gradient-to-br ${f.color} p-1.5 hover:border-primary/50 hover:shadow-sm hover:shadow-primary/10 hover:-translate-y-0.5 transition-all duration-300 flex flex-col items-center justify-center gap-1 aspect-square`}
              aria-label={`Ver detalhes de ${f.title}`}
              title={f.title}
            >
              <div className={`w-7 h-7 rounded-md bg-card border border-border/60 flex items-center justify-center flex-shrink-0 ${f.iconColor} group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="w-3.5 h-3.5" strokeWidth={2} />
              </div>
              <h4 className="font-medium text-foreground text-[9px] leading-tight text-center line-clamp-2 px-0.5">{f.title}</h4>
            </button>
          );
        })}
      </div>

      {/* Modal central com blur ao clicar no banner */}
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogPortal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/60 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border border-border/60 bg-card/95 backdrop-blur-xl p-6 shadow-2xl rounded-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            {selected !== null && (() => {
              const f = features[selected];
              const Icon = f.icon;
              return (
                <>
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${f.color} border border-border/60 flex items-center justify-center ${f.iconColor} mx-auto`}>
                    <Icon className="w-7 h-7" strokeWidth={2} />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="font-display text-lg font-bold text-foreground">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                  <DialogPrimitive.Close className="absolute right-3 top-3 rounded-full p-1.5 hover:bg-muted/60 transition-colors">
                    <X className="w-4 h-4" />
                    <span className="sr-only">Fechar</span>
                  </DialogPrimitive.Close>
                </>
              );
            })()}
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </div>
  );
}



// ── Schemas ──────────────────────────────────────────────────────────────────
const loginSchema = z.object({ email: z.string().email('Email inválido'), password: z.string().min(1, 'Senha é obrigatória') });
const recoverySchema = z.object({ email: z.string().email('Email inválido') });
const contactSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(100),
  email: z.string().trim().email('Email inválido').max(255),
  phone: z.string().trim().min(1, 'Telefone é obrigatório').max(20),
  message: z.string().trim().min(1, 'Mensagem é obrigatória').max(1000),
});
type LoginForm = z.infer<typeof loginSchema>;
type RecoveryForm = z.infer<typeof recoverySchema>;
type ContactForm = z.infer<typeof contactSchema>;

// ══════════════════════════════════════════════════════════════════════════════
export default function Landing() {
  const { t } = useTranslation();
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'recovery' | '2fa-verify'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recoveryEmailSent, setRecoveryEmailSent] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const hasRedirectedRef = useRef(false);

  const { count, loading: countLoading } = useUserCount();
  const { isInstallable, shouldShowInstallPrompt } = usePWAInstall();
  const { signIn, user, session, ensureSession } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (shouldShowInstallPrompt()) {
      const timer = setTimeout(() => setShowInstallPrompt(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [shouldShowInstallPrompt]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const recoveryForm = useForm<RecoveryForm>({ resolver: zodResolver(recoverySchema), defaultValues: { email: '' } });
  const contactForm = useForm<ContactForm>({ resolver: zodResolver(contactSchema), defaultValues: { name: '', email: '', phone: '', message: '' } });

  const getSmartRedirectDestination = async (userId: string): Promise<string> => {
    try {
      const result = await Promise.race([
        supabase.rpc('get_my_department_count', { p_user_id: userId }),
        new Promise<{ data: null; error: Error }>((resolve) => setTimeout(() => resolve({ data: null, error: new Error('timeout') }), 4000)),
      ]);
      if (result.error || result.data === null) return '/dashboard';
      return '/dashboard';
    } catch { return '/dashboard'; }
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
      await new Promise<void>((resolve) => {
        if (user) { resolve(); return; }
        const timeout = setTimeout(resolve, 3000);
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_IN') { clearTimeout(timeout); subscription.unsubscribe(); setTimeout(resolve, 50); }
        });
        setTimeout(() => subscription.unsubscribe(), 3100);
      });
      const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (mfaData?.currentLevel === 'aal1' && mfaData?.nextLevel === 'aal2') {
        setAuthTab('2fa-verify');
        return;
      }
      const { data: hasRole } = await supabase.rpc('has_role', { _user_id: currentSession.user.id, _role: 'admin' });
      if (hasRole) {
        toast({ title: 'Bem-vindo, Admin!', description: 'Redirecionando para o painel administrativo.' });
        navigate('/admin', { replace: true });
        return;
      }
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
    } finally { setIsLoading(false); }
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

  const handle2FACancel = async () => { await supabase.auth.signOut(); setAuthTab('login'); };

  const handleRecovery = async (data: RecoveryForm) => {
    setIsLoading(true);
    const redirectUrl = `${window.location.origin}/auth`;
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, { redirectTo: redirectUrl });
    setIsLoading(false);
    if (error) { toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível enviar o email de recuperação.' }); return; }
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

  const openAuth = (tab: 'login') => { setAuthTab(tab); setShowAuth(true); setRecoveryEmailSent(false); };

  const handleContact = async (data: ContactForm) => {
    setContactLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-contact-email', {
        body: { name: data.name, email: data.email, phone: data.phone, message: data.message },
      });
      if (error) throw error;
      setContactSent(true);
      contactForm.reset();
      toast({ title: 'Mensagem enviada!', description: 'Recebemos sua mensagem e responderemos em breve.' });
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível enviar. Tente novamente.' });
    } finally { setContactLoading(false); }
  };

  return (
    <div className="relative h-screen flex flex-col text-foreground overflow-hidden">
      <VideoBackground />
      <PWAInstallPrompt open={showInstallPrompt} onOpenChange={setShowInstallPrompt} />

      {/* ── NAV ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-background/80 backdrop-blur-xl border-b border-border shadow-sm' : 'bg-transparent'}`}>
        <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <LeviLogo size="sm" className="transition-all duration-300" />
              <span className="text-[9px] font-bold tracking-widest text-primary dark:text-secondary">LEVI</span>
            </div>
            <div className="min-w-0 overflow-hidden">
              <LeviTypewriter />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowContact(true); setContactSent(false); }}
              className="hidden md:inline-flex px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg transition-colors"
            >
              {t('landing.contactUs')}
            </button>
            <LanguageSelector />
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="h-screen pt-16 flex flex-col overflow-hidden">
      {/* ── HERO + FEATURES (single viewport, no scroll) ── */}
      <section className="flex-1 min-h-0 relative z-[1] py-4 sm:py-6 overflow-hidden">
        {/* Dot grid + gradient blobs */}
        <div className="absolute inset-0 dot-grid pointer-events-none" />
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'hsl(var(--primary) / 0.12)', filter: 'blur(120px)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'hsl(var(--secondary) / 0.1)', filter: 'blur(120px)' }} />

        <div className="container mx-auto px-4 sm:px-6 relative z-10 h-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-center h-full">
            {/* Coluna esquerda: hero */}
            <div className="text-center lg:text-left space-y-3 sm:space-y-4">
              <div className="animate-slide-up-1 flex lg:justify-start justify-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/8 text-primary text-sm font-medium border border-primary/15">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('landing.tagline')}</span>
                </div>
              </div>

              <h1 className="animate-slide-up-2 font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-tight">
                {t('landing.heroTitle1')}<br />{t('landing.heroTitle2')}<br />
                <Typewriter words={t('landing.typewriterWords', { returnObjects: true }) as string[]} />
              </h1>

              <p className="animate-slide-up-3 text-sm sm:text-base text-muted-foreground max-w-lg mx-auto lg:mx-0 leading-relaxed">
                {t('landing.heroDescription')}
              </p>

              <div className="animate-slide-up-4 flex flex-col sm:flex-row flex-wrap gap-2.5 justify-center lg:justify-start pt-1">
                <Button
                  size="default"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-8 text-sm font-semibold btn-glow transition-all hover:scale-[1.02]"
                  onClick={() => openAuth('login')}
                >
                  {t('landing.enter')} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  size="default"
                  variant="outline"
                  className="border-primary/30 text-primary hover:bg-primary/10 rounded-full px-6 text-sm"
                  onClick={() => navigate('/church-setup')}
                >
                  <Church className="w-4 h-4 mr-2" />
                  {t('landing.registerChurch')}
                </Button>
              </div>

              <div className="animate-slide-up-5 flex items-center gap-3 justify-center lg:justify-start">
                <div className="flex -space-x-2">
                  {['from-primary to-primary/70', 'from-secondary to-secondary/70', 'from-accent to-accent/70'].map((gradient, i) => (
                    <div key={i} className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradient} border-2 border-background flex items-center justify-center`}>
                      <Users className="w-3.5 h-3.5 text-white" />
                    </div>
                  ))}
                </div>
                <div className="text-left">
                  <span className="text-xl font-bold text-foreground">
                    {countLoading ? '...' : <AnimatedCounter target={count || 0} suffix="+" />}
                  </span>
                  <p className="text-xs text-muted-foreground">{t('landing.volunteersRegistered')}</p>
                </div>
              </div>
            </div>

            {/* Coluna direita: funcionalidades */}
            <div id="funcionalidades" className="min-h-0 h-full overflow-y-auto lg:overflow-visible">
              <FeatureGrid />
            </div>
          </div>
        </div>
      </section>
      </main>




      <footer className="relative z-[1] py-6 border-t border-border">
        <div className="container mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">LEVI</span>
            <span>·</span>
            <span className="text-xs">© {new Date().getFullYear()} Escalas</span>
          </div>
          <div className="flex items-center gap-3">
            <img src={elsdigitalLogo} alt="ELSDIGITAL" className="w-5 h-5 rounded-full object-cover" />
            <span className="text-xs text-muted-foreground">{t('landing.developingSolutions')}</span>
          </div>
        </div>
      </footer>

      {/* ── AUTH MODAL ── */}
      <Dialog open={showAuth} onOpenChange={(open) => { setShowAuth(open); if (!open) { setAuthTab('login'); setRecoveryEmailSent(false); } }}>
        <DialogPortal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%] rounded-3xl border border-border bg-background p-8 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">{t('common.close')}</span>
            </DialogPrimitive.Close>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <LeviLogo className="w-7 h-7" />
              </div>
              <div>
                <span className="font-display text-xl font-bold text-foreground">LEVI</span>
                <p className="text-xs text-muted-foreground">{t('landing.scheduleManagement')}</p>
              </div>
            </div>

            {authTab === 'login' && (
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4 animate-fade-in">
                <div className="space-y-2">
                  <Label htmlFor="modal-email">Email</Label>
                  <Input id="modal-email" type="email" placeholder="seu@email.com" {...loginForm.register('email')} className="h-12 rounded-xl" />
                  {loginForm.formState.errors.email && <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modal-password">{t('common.password')}</Label>
                  <div className="relative">
                    <Input id="modal-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" {...loginForm.register('password')} className="h-12 pr-12 rounded-xl" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {loginForm.formState.errors.password && <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>}
                </div>
                <Button type="submit" className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t('auth.loggingIn')}</> : t('auth.login')}
                </Button>
                <button type="button" onClick={() => { setAuthTab('recovery'); setRecoveryEmailSent(false); }} className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors">
                  {t('auth.forgotPassword')}
                </button>
              </form>
            )}

            {authTab === 'recovery' && (
              <div className="space-y-4 animate-fade-in">
                <div className="mb-2">
                  <h2 className="text-xl font-bold text-foreground mb-1">{t('auth.recoverPassword')}</h2>
                  <p className="text-sm text-muted-foreground">{t('auth.recoverDescription')}</p>
                </div>
                {!recoveryEmailSent ? (
                  <form onSubmit={recoveryForm.handleSubmit(handleRecovery)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="modal-recovery-email">Email</Label>
                      <Input id="modal-recovery-email" type="email" placeholder="seu@email.com" {...recoveryForm.register('email')} className="h-12 rounded-xl" />
                      {recoveryForm.formState.errors.email && <p className="text-sm text-destructive">{recoveryForm.formState.errors.email.message}</p>}
                    </div>
                    <Button type="submit" className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold" disabled={isLoading}>
                      {isLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t('auth.sending')}</> : t('auth.sendRecoveryLink')}
                    </Button>
                  </form>
                ) : (
                  <div className="text-center space-y-3 py-4">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Sparkles className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">{t('auth.emailSent')}</h3>
                    <p className="text-sm text-muted-foreground">{t('auth.checkInbox')}</p>
                  </div>
                )}
                <button type="button" onClick={() => setAuthTab('login')} className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors">
                  {t('auth.backToLogin')}
                </button>
              </div>
            )}

            {authTab === '2fa-verify' && (
              <TwoFactorVerify onSuccess={handle2FASuccess} onCancel={handle2FACancel} />
            )}
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>

      {/* ── CONTACT MODAL ── */}
      <Dialog open={showContact} onOpenChange={(open) => { setShowContact(open); if (!open) setContactSent(false); }}>
        <DialogPortal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%] rounded-3xl border border-border bg-background p-8 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">{t('common.close')}</span>
            </DialogPrimitive.Close>

            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl bg-gradient-to-r from-primary via-primary/60 to-secondary/40" />

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <span className="font-display text-xl font-bold text-foreground">{t('contact.title')}</span>
                <p className="text-xs text-muted-foreground">{t('contact.subtitle')}</p>
              </div>
            </div>

            {!contactSent ? (
              <form onSubmit={contactForm.handleSubmit(handleContact)} className="space-y-4 animate-fade-in">
                <div className="space-y-2">
                  <Label htmlFor="contact-name">{t('common.name')}</Label>
                  <Input id="contact-name" placeholder={t('contact.yourName')} {...contactForm.register('name')} className="h-12 rounded-xl" />
                  {contactForm.formState.errors.name && <p className="text-sm text-destructive">{contactForm.formState.errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Email</Label>
                  <Input id="contact-email" type="email" placeholder="seu@email.com" {...contactForm.register('email')} className="h-12 rounded-xl" />
                  {contactForm.formState.errors.email && <p className="text-sm text-destructive">{contactForm.formState.errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-phone">{t('common.phone')}</Label>
                  <Input id="contact-phone" type="tel" placeholder="(00) 00000-0000" {...contactForm.register('phone')} className="h-12 rounded-xl" />
                  {contactForm.formState.errors.phone && <p className="text-sm text-destructive">{contactForm.formState.errors.phone.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-message">{t('common.message')}</Label>
                  <textarea
                    id="contact-message"
                    placeholder={t('contact.writeMessage')}
                    rows={4}
                    {...contactForm.register('message')}
                    className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  />
                  {contactForm.formState.errors.message && <p className="text-sm text-destructive">{contactForm.formState.errors.message.message}</p>}
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base"
                  disabled={contactLoading}
                >
                  {contactLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t('auth.sending')}</> : <><Send className="w-4 h-4 mr-2" />{t('contact.sendMessage')}</>}
                </Button>
              </form>
            ) : (
              <div className="text-center space-y-3 py-6 animate-fade-in">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{t('contact.messageSent')}</h3>
                <p className="text-sm text-muted-foreground">{t('contact.messageSentDesc')}</p>
                <Button variant="outline" className="rounded-xl" onClick={() => setContactSent(false)}>
                  {t('contact.sendAnother')}
                </Button>
              </div>
            )}
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </div>
  );
}
