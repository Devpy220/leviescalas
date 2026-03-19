import { useState, useEffect, useRef, useCallback } from 'react';
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
  DialogPortal,
  Dialog,
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
  RefreshCw,
  LayoutGrid,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { LeviLogo } from '@/components/LeviLogo';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { TwoFactorVerify } from '@/components/auth/TwoFactorVerify';

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

  useEffect(() => {
    const word = words[idx];
    const t = del
      ? setTimeout(() => {
          setText(s => s.slice(0, -1));
          if (text.length === 1) { setDel(false); setIdx(i => (i + 1) % words.length); }
        }, 55)
      : setTimeout(() => {
          setText(word.slice(0, text.length + 1));
          if (text.length === word.length - 1) setTimeout(() => setDel(true), 1500);
        }, 85);
    return () => clearTimeout(t);
  }, [text, del, idx, words]);

  return (
    <span className="text-secondary">
      {text}
      <span className="animate-pulse">|</span>
    </span>
  );
}

// ── Particle Background ──────────────────────────────────────────────────────
function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    let W: number, H: number;

    const particles: { x: number; y: number; r: number; sx: number; sy: number; opacity: number; hue: number }[] = [];
    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 2 + 0.3,
        sx: (Math.random() - 0.5) * 0.2,
        sy: (Math.random() - 0.5) * 0.2,
        opacity: Math.random() * 0.3 + 0.05,
        hue: [263, 263, 38, 160][Math.floor(Math.random() * 4)],
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 70%, 60%, ${p.opacity})`;
        ctx.fill();
        p.x += p.sx; p.y += p.sy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
}

// ── Reveal wrapper (CSS-only, no framer-motion) ─────────────────────────────
function Reveal({ children, delay = 0, direction = 'up' }: { children: React.ReactNode; delay?: number; direction?: 'up' | 'left' | 'right' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const transforms: Record<string, string> = {
    up: 'translateY(30px)',
    left: 'translateX(-30px)',
    right: 'translateX(30px)',
  };

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : transforms[direction],
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
      }}
    >
      {children}
    </div>
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

// ── 3D Rotating Cube ─────────────────────────────────────────────────────────
function FeatureCube() {
  const cubeRef = useRef<HTMLDivElement>(null);
  const rotRef = useRef({ x: -25, y: 0 });
  const rafRef = useRef<number>(0);
  const [paused, setPaused] = useState(false);
  const lastRef = useRef<number | null>(null);

  const faces = [
    { Icon: Calendar, label: 'Calendário', pill: '⚡ Ao vivo', face: 'front' },
    { Icon: Users, label: 'Membros', pill: '✓ Organizado', face: 'right' },
    { Icon: Bell, label: 'Notificações', pill: '📲 Auto', face: 'back' },
    { Icon: RefreshCw, label: 'Trocas', pill: '🔄 Fácil', face: 'left' },
    { Icon: Zap, label: 'Tempo Real', pill: '🔴 Online', face: 'top' },
    { Icon: CheckCircle2, label: 'Confirmações', pill: '✅ Real-time', face: 'bottom' },
  ];

  // Size of the cube (half-side for translateZ)
  const size = 130; // mobile-friendly

  const faceTransforms: Record<string, string> = {
    front: `translateZ(${size}px)`,
    back: `rotateY(180deg) translateZ(${size}px)`,
    right: `rotateY(90deg) translateZ(${size}px)`,
    left: `rotateY(-90deg) translateZ(${size}px)`,
    top: `rotateX(90deg) translateZ(${size}px)`,
    bottom: `rotateX(-90deg) translateZ(${size}px)`,
  };

  useEffect(() => {
    const animate = (ts: number) => {
      if (!paused) {
        if (lastRef.current !== null) {
          const dt = ts - lastRef.current;
          rotRef.current.y += dt * 0.02;
          rotRef.current.x = -25 + Math.sin(ts * 0.0005) * 10;
        }
        lastRef.current = ts;
      } else {
        lastRef.current = null;
      }

      if (cubeRef.current) {
        cubeRef.current.style.transform = `rotateX(${rotRef.current.x}deg) rotateY(${rotRef.current.y}deg)`;
      }

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [paused]);

  return (
    <div
      className="flex flex-col items-center gap-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      {/* Glow behind cube */}
      <div className="absolute w-[300px] h-[300px] sm:w-[380px] sm:h-[380px] rounded-full pointer-events-none animate-pulse-glow"
        style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.2) 0%, hsl(var(--primary) / 0.05) 50%, transparent 70%)' }}
      />

      {/* 3D Cube Scene */}
      <div
        className="relative"
        style={{
          width: size * 2,
          height: size * 2,
          perspective: 800,
        }}
      >
        <div
          ref={cubeRef}
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            transformStyle: 'preserve-3d',
            transition: paused ? 'transform 0.3s ease-out' : 'none',
          }}
        >
          {faces.map((item) => (
            <div
              key={item.face}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-card/80 backdrop-blur-sm"
              style={{
                transform: faceTransforms[item.face],
                backfaceVisibility: 'hidden',
                boxShadow: 'inset 0 1px 0 hsl(0 0% 100% / 0.12), 0 8px 32px hsl(0 0% 0% / 0.2)',
              }}
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-primary/15 flex items-center justify-center">
                <item.Icon className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
              </div>
              <span className="text-sm sm:text-base font-bold text-foreground">{item.label}</span>
              <span className="text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full border border-border/40 bg-muted/20 text-muted-foreground">
                {item.pill}
              </span>
            </div>
          ))}
        </div>
      </div>
      <span className="text-[11px] text-primary/40 tracking-wider">↻ toque para pausar</span>
    </div>
  );
}

// ── Feature data (real LEVI features) ────────────────────────────────────────
const allSlides = [
  // Features
  { type: 'feature' as const, icon: Calendar, title: 'Escalas inteligentes', desc: 'Crie escalas semanais ou mensais com poucos cliques. O sistema distribui os voluntários automaticamente.', color: 'bg-primary/15 text-primary' },
  { type: 'feature' as const, icon: Bell, title: 'Notificações automáticas', desc: 'Voluntários recebem lembrete via WhatsApp antes do compromisso, sem você precisar fazer nada.', color: 'bg-accent/15 text-accent' },
  { type: 'feature' as const, icon: CheckCircle2, title: 'Confirmações em tempo real', desc: 'Acompanhe quem confirmou, quem pediu troca e quem ainda não respondeu — tudo num painel.', color: 'bg-emerald/15 text-emerald' },
  { type: 'feature' as const, icon: RefreshCw, title: 'Troca de horários', desc: 'Voluntários solicitam trocas direto no app, sem precisar falar com o líder a cada pedido.', color: 'bg-orange-500/15 text-orange-500' },
  { type: 'feature' as const, icon: LayoutGrid, title: 'Múltiplas equipes', desc: 'Louvor, recepção, mídia, infantil — gerencie quantas equipes precisar em um único lugar.', color: 'bg-violet-500/15 text-violet-500' },
  { type: 'feature' as const, icon: Users, title: 'Setores e funções', desc: 'Organize membros por setores e atribua funções específicas para cada escala.', color: 'bg-secondary/15 text-secondary' },
  // Steps
  { type: 'step' as const, step: 1, title: 'Crie sua conta', desc: 'Cadastre-se em menos de 2 minutos. Totalmente gratuito.' },
  { type: 'step' as const, step: 2, title: 'Monte sua equipe', desc: 'Cadastre os voluntários e organize por ministério ou setor.' },
  { type: 'step' as const, step: 3, title: 'Gere a escala', desc: 'Defina datas e o sistema cuida do resto automaticamente.' },
  { type: 'step' as const, step: 4, title: 'Acompanhe ao vivo', desc: 'Confirmações e pendências em tempo real no painel.' },
  // CTA
  { type: 'cta' as const, title: 'Comece hoje, gratuitamente', desc: 'Junte-se aos voluntários que já simplificaram a gestão das escalas na sua igreja. 100% gratuito · Suporte em português' },
];

// Keep for backward compat references
const featureCards = allSlides.filter(s => s.type === 'feature');
const steps = [
  { title: 'Crie sua conta', desc: 'Cadastre-se em menos de 2 minutos. Totalmente gratuito.' },
  { title: 'Monte sua equipe', desc: 'Cadastre os voluntários e organize por ministério ou setor.' },
  { title: 'Gere a escala', desc: 'Defina datas e o sistema cuida do resto automaticamente.' },
  { title: 'Acompanhe ao vivo', desc: 'Confirmações e pendências em tempo real no painel.' },
];

// ── Feature Carousel (single-screen, auto-cycling) ──────────────────────────
function FeatureCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = allSlides.length;

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setActive(a => (a + 1) % total), 3500);
    return () => clearInterval(t);
  }, [paused, total]);

  const slide = allSlides[active];
  const isFeature = slide.type === 'feature';
  const sectionLabel = isFeature ? 'Funcionalidades' : 'Como funciona';
  const sectionTitle = isFeature ? 'Tudo que sua igreja precisa' : 'Simples de começar';

  return (
    <div
      className="flex flex-col items-center gap-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Header */}
      <div className="text-center">
        <p className="text-primary text-xs font-semibold uppercase tracking-[0.12em] mb-2">{sectionLabel}</p>
        <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">{sectionTitle}</h2>
      </div>

      {/* Card area */}
      <div className="relative w-full max-w-md h-[220px] sm:h-[200px]">
        {allSlides.map((s, i) => {
          const isActive = i === active;
          return (
            <div
              key={i}
              className="absolute inset-0 flex items-center justify-center transition-all duration-700 ease-in-out"
              style={{
                opacity: isActive ? 1 : 0,
                transform: isActive ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
                pointerEvents: isActive ? 'auto' : 'none',
              }}
            >
              <div
                className="w-full p-8 rounded-2xl backdrop-blur-md border border-primary/15 overflow-hidden relative"
                style={{
                  background: 'hsl(var(--card) / 0.55)',
                  boxShadow: '0 8px 40px hsl(var(--primary) / 0.12), 0 2px 8px hsl(0 0% 0% / 0.12), inset 0 1px 0 hsl(0 0% 100% / 0.1)',
                }}
              >
                {/* Glass shine */}
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.06) 0%, transparent 50%, hsl(var(--secondary) / 0.04) 100%)' }} />

                <div className="relative z-[1] flex flex-col items-center text-center gap-3">
                  {s.type === 'feature' && 'icon' in s ? (
                    <div className={`w-14 h-14 rounded-xl ${'color' in s ? s.color : ''} flex items-center justify-center shadow-sm`}>
                      {(() => { const Icon = (s as any).icon; return <Icon className="w-7 h-7" />; })()}
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center font-bold text-lg text-primary-foreground shadow-glow-sm">
                      {'step' in s ? (s as any).step : ''}
                    </div>
                  )}
                  <h3 className="font-display text-lg sm:text-xl font-bold text-foreground">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">{s.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dot indicators */}
      <div className="flex items-center gap-2">
        {allSlides.map((s, i) => {
          const isFeatureGroup = i < 6;
          return (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`rounded-full transition-all duration-300 ${
                i === active
                  ? 'w-6 h-2.5 bg-primary shadow-glow-sm'
                  : `w-2.5 h-2.5 ${isFeatureGroup ? 'bg-primary/25 hover:bg-primary/40' : 'bg-secondary/25 hover:bg-secondary/40'}`
              }`}
            />
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs h-1 rounded-full bg-muted/30 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
          style={{ width: `${((active + 1) / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ── Schemas ──────────────────────────────────────────────────────────────────
const loginSchema = z.object({ email: z.string().email('Email inválido'), password: z.string().min(1, 'Senha é obrigatória') });
const recoverySchema = z.object({ email: z.string().email('Email inválido') });
type LoginForm = z.infer<typeof loginSchema>;
type RecoveryForm = z.infer<typeof recoverySchema>;

// ══════════════════════════════════════════════════════════════════════════════
export default function Landing() {
  const [showDemo, setShowDemo] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
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

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

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

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <DemoTour open={showDemo} onOpenChange={setShowDemo} />
      <PWAInstallPrompt open={showInstallPrompt} onOpenChange={setShowInstallPrompt} />
      <ParticleBackground />

      {/* ── NAV ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'glass border-b border-border/50 shadow-soft' : 'bg-transparent'}`}>
        <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LeviLogo className="transition-all duration-300" />
            <span className="font-display text-xl font-bold text-foreground tracking-tight">LEVI</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="hidden md:flex items-center gap-0.5">
              {[{ label: 'Funcionalidades', id: 'funcionalidades' }, { label: 'Como funciona', id: 'como-funciona' }].map(({ label, id }) => (
                <button key={id} onClick={() => scrollTo(id)} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-primary/5 rounded-lg transition-colors">
                  {label}
                </button>
              ))}
              <div className="w-px h-5 bg-border mx-2" />
            </div>
            <ThemeToggle />
            {isInstallable && (
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => setShowInstallPrompt(true)}>
                <Download className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Instalar</span>
              </Button>
            )}
            <Button
              size="sm"
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-glow-sm rounded-full px-5 font-semibold"
              onClick={() => openAuth('login')}
            >
              Entrar
            </Button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="min-h-screen flex items-center relative z-[1] pt-20" style={{ scrollMarginTop: 80 }}>
        <div className="absolute inset-0 mesh-gradient mesh-gradient-animated opacity-50" />
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            {/* Left */}
            <div className="text-center lg:text-left space-y-6">
              <div className="animate-fade-in" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
                  <Sparkles className="w-4 h-4" />
                  <span>Gestão de escalas para igrejas</span>
                </div>
              </div>

              <h1
                className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight animate-fade-in"
                style={{ animationDelay: '0.25s', animationFillMode: 'both' }}
              >
                Organize suas<br />escalas com<br />
                <Typewriter words={['facilidade', 'agilidade', 'amor', 'inteligência']} />
              </h1>

              <p
                className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto lg:mx-0 leading-relaxed animate-fade-in"
                style={{ animationDelay: '0.4s', animationFillMode: 'both' }}
              >
                Calendário visual, notificações automáticas e sincronização em tempo real para voluntários da sua igreja.
              </p>

              <div
                className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start animate-fade-in"
                style={{ animationDelay: '0.55s', animationFillMode: 'both' }}
              >
                <Button
                  size="lg"
                  className="bg-secondary text-secondary-foreground shadow-glow-sm hover:shadow-glow transition-all hover:brightness-110 rounded-full px-8 font-semibold"
                  onClick={() => openAuth('login')}
                >
                  Entrar
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary/30 text-primary hover:bg-primary/10 rounded-full px-8"
                  onClick={() => scrollTo('funcionalidades')}
                >
                  Ver funcionalidades <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>

              {/* User counter */}
              <div
                className="flex items-center justify-center lg:justify-start gap-3 animate-fade-in"
                style={{ animationDelay: '0.7s', animationFillMode: 'both' }}
              >
                <div className="flex -space-x-2">
                  {['from-primary/80 to-primary', 'from-secondary/80 to-secondary', 'from-accent/80 to-accent'].map((gradient, i) => (
                    <div key={i} className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradient} border-2 border-background flex items-center justify-center`}>
                      <Users className="w-3.5 h-3.5 text-white" />
                    </div>
                  ))}
                </div>
                <div className="text-left">
                  <span className="text-xl font-bold text-secondary">
                    {countLoading ? '...' : <AnimatedCounter target={count || 0} suffix="+" />}
                  </span>
                  <p className="text-xs text-muted-foreground">voluntários cadastrados</p>
                </div>
              </div>
            </div>

            {/* Right — 3D Cube */}
            <div className="flex justify-center items-center mt-8 lg:mt-0">
              <FeatureCube />
            </div>

          </div>
        </div>
      </section>

      {/* ── FEATURES + HOW IT WORKS — Single Screen Carousel ── */}
      <section id="funcionalidades" className="relative z-[1] min-h-[80vh] flex items-center overflow-hidden py-12" style={{ scrollMarginTop: 80 }}>
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] rounded-full opacity-30 blur-mega" style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.4), transparent 70%)' }} />
          <div className="absolute bottom-1/4 -right-32 w-[400px] h-[400px] rounded-full opacity-25 blur-mega" style={{ background: 'radial-gradient(circle, hsl(var(--secondary) / 0.4), transparent 70%)' }} />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        </div>

        <div className="container mx-auto px-4 sm:px-6 max-w-5xl relative w-full">
          <FeatureCarousel />
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="relative z-[1] py-20 sm:py-28">
        <div className="container mx-auto px-4 sm:px-6 max-w-xl">
          <Reveal>
            <div className="text-center rounded-3xl bg-card/70 backdrop-blur-sm border border-border/50 p-10 sm:p-14 shadow-soft-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none" />
              <div className="relative z-[1]">
                <div className="text-5xl mb-4">📅</div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-3">Comece hoje, gratuitamente</h2>
                <p className="text-muted-foreground mb-8 leading-relaxed">
                  Junte-se aos voluntários que já simplificaram a gestão das escalas na sua igreja.
                </p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <Button
                    size="lg"
                    className="bg-secondary text-secondary-foreground shadow-glow-sm hover:shadow-glow rounded-full px-8 font-semibold"
                    onClick={() => openAuth('login')}
                  >
                    Entrar
                  </Button>
                </div>
                <p className="mt-5 text-xs text-muted-foreground/50">
                  100% gratuito · Suporte em português
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-[1] py-6 border-t border-border/30 text-center text-xs text-muted-foreground/40">
        <span className="text-primary font-bold">LEVI</span> · © {new Date().getFullYear()} · Feito com 💜 para igrejas brasileiras
      </footer>

      {/* ── AUTH MODAL ── */}
      <Dialog open={showAuth} onOpenChange={(open) => { setShowAuth(open); if (!open) { setAuthTab('login'); setRecoveryEmailSent(false); } }}>
        <DialogPortal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">Fechar</span>
            </DialogPrimitive.Close>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
                <LeviLogo className="w-7 h-7" />
              </div>
              <div>
                <span className="font-display text-xl font-bold text-foreground">LEVI</span>
                <p className="text-xs text-muted-foreground">Gestão de Escalas</p>
              </div>
            </div>

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

            {authTab === '2fa-verify' && (
              <TwoFactorVerify onSuccess={handle2FASuccess} onCancel={handle2FACancel} />
            )}
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </div>
  );
}
