import { useState, useEffect, useRef } from 'react';
import Footer from '@/components/Footer';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DemoTour } from '@/components/DemoTour';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useUserCount } from '@/hooks/useUserCount';
import { 
  Calendar, 
  Users, 
  Bell, 
  Shield, 
  Zap, 
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Heart,
  Download,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { LeviLogo } from '@/components/LeviLogo';
import screenshotLanding from '@/assets/screenshots/screenshot-landing.png';
import screenshotLogin from '@/assets/screenshots/screenshot-login.png';
import screenshotMinhasEscalas from '@/assets/screenshots/screenshot-minhas-escalas.png';
import screenshotEscalaEquipe from '@/assets/screenshots/screenshot-escala-equipe.png';
import screenshotDisponibilidade from '@/assets/screenshots/screenshot-disponibilidade.png';
import screenshotPreferencias from '@/assets/screenshots/screenshot-preferencias.png';
import screenshotDashboard from '@/assets/screenshots/screenshot-dashboard.png';
import screenshotApoio from '@/assets/screenshots/screenshot-apoio.png';

const features = [
  {
    icon: Calendar,
    title: 'Calendário Interativo',
    description: 'Arraste e solte membros diretamente nas datas. Visualização mensal e semanal com cores diferenciadas.',
    color: 'icon-violet',
  },
  {
    icon: Users,
    title: 'Gestão de Membros',
    description: 'Convide membros com link único. Organize equipes e visualize disponibilidades em tempo real.',
    color: 'icon-coral',
  },
  {
    icon: Bell,
    title: 'Notificações Automáticas',
    description: 'Lembretes via Email, Push, Telegram e WhatsApp: confirmação imediata, 48h e 2h antes da escala.',
    color: 'icon-emerald',
  },
  {
    icon: Shield,
    title: 'Seguro e Confiável',
    description: 'Dados protegidos com criptografia. Backups automáticos e acesso controlado por permissões.',
    color: 'icon-cyan',
  },
  {
    icon: Zap,
    title: 'Tempo Real',
    description: 'Alterações sincronizam instantaneamente para todos os membros do departamento.',
    color: 'icon-amber',
  },
  {
    icon: CheckCircle2,
    title: 'Mural de Avisos',
    description: 'Líderes publicam comunicados e notificam todo o departamento via Push, Telegram e WhatsApp automaticamente.',
    color: 'icon-rose',
  },
];

const appFeatures = [
  '100% gratuito para usar',
  'Membros ilimitados',
  'Escalas ilimitadas',
  'Notificações por Email, Push, Telegram e WhatsApp',
  'Calendário drag-and-drop',
  'Exportação PDF/Excel',
  'Sincronização em tempo real',
  'Suporte por email',
];

const screenshots = [
  { src: screenshotLanding, title: 'Página Inicial', description: 'Design moderno e intuitivo para sua igreja' },
  { src: screenshotLogin, title: 'Acesso Seguro', description: 'Login com email, Google ou Apple' },
  { src: screenshotMinhasEscalas, title: 'Minhas Escalas', description: 'Veja suas próximas escalas e peça trocas facilmente' },
  { src: screenshotEscalaEquipe, title: 'Escala da Equipe', description: 'Visualize todos os voluntários escalados por turno' },
  { src: screenshotDisponibilidade, title: 'Disponibilidade Semanal', description: 'Marque os horários em que você pode servir' },
  { src: screenshotPreferencias, title: 'Preferências', description: 'Configure limites de escalas e datas de bloqueio' },
  { src: screenshotDashboard, title: 'Dashboard', description: 'Gerencie departamentos e escalas em um só lugar' },
  { src: screenshotApoio, title: 'Apoio Voluntário', description: '100% gratuito com recursos ilimitados' },
];

export default function Landing() {
  const [showDemo, setShowDemo] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const { count, loading: countLoading } = useUserCount();
  const { isInstallable, shouldShowInstallPrompt } = usePWAInstall();

  // Auto-advance carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % screenshots.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Show PWA install prompt after 5 seconds if installable
  useEffect(() => {
    if (shouldShowInstallPrompt()) {
      const timer = setTimeout(() => {
        setShowInstallPrompt(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [shouldShowInstallPrompt]);

  return (
    <div className="min-h-screen bg-background">
      <DemoTour open={showDemo} onOpenChange={setShowDemo} />
      <PWAInstallPrompt open={showInstallPrompt} onOpenChange={setShowInstallPrompt} />
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <LeviLogo className="transition-all duration-300 group-hover:scale-110 group-hover:shadow-glow" />
            <div className="flex items-center gap-2">
              <span className="font-display text-xl font-bold text-foreground">LEVI</span>
              <span className="hidden md:inline text-sm text-muted-foreground border-l border-border pl-2">Logística de Escalas para Voluntários da Igreja</span>
            </div>
          </Link>
          
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isInstallable && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setShowInstallPrompt(true)}
              >
                <Download className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Instalar</span>
              </Button>
            )}
            <Link to="/auth?forceLogin=true">
              <Button variant="outline" size="sm" className="border-primary/50 text-primary hover:bg-primary/10">
                Entrar
              </Button>
            </Link>
            <Link to="/acessar">
              <Button className="gradient-vibrant text-white shadow-glow-sm hover:shadow-glow transition-all">
                Criar Conta
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>


      {/* Hero Section */}
      <section className="relative pt-36 pb-20 lg:pt-44 lg:pb-32 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 mesh-gradient mesh-gradient-animated" />
        <div className="absolute inset-0 gradient-radial opacity-60" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] gradient-glow" />
        
        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center stagger-children">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 border border-primary/20">
              <Sparkles className="w-4 h-4" />
              <span>Simplifique a gestão de escalas da sua igreja</span>
            </div>
            
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              Organize suas escalas com{' '}
              <span className="text-gradient-vibrant">facilidade e elegância</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              LEVI é a solução completa para gerenciar escalas de voluntários. 
              Calendário visual, notificações automáticas e sincronização em tempo real.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/acessar">
                <Button size="lg" className="w-full sm:w-auto gradient-vibrant text-white shadow-glow hover:shadow-glow-lg transition-all text-lg px-8 animate-gradient">
                  Acessar com Código
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full sm:w-auto text-lg px-8 border-2"
                onClick={() => setShowDemo(true)}
              >
                Ver demonstração
              </Button>
            </div>
            
            <p className="mt-4 text-sm text-muted-foreground">
              Digite o código da sua igreja para começar
            </p>

            {/* User Counter */}
            <div className="mt-8 flex items-center justify-center gap-3">
              <div className="flex -space-x-2">
                {[...Array(4)].map((_, i) => (
                  <div 
                    key={i} 
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary border-2 border-background flex items-center justify-center"
                  >
                    <Users className="w-4 h-4 text-white" />
                  </div>
                ))}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1">
                  <span className="text-2xl font-bold text-gradient-vibrant">
                    {countLoading ? '...' : (count || 0).toLocaleString('pt-BR')}
                  </span>
                  <span className="text-sm text-muted-foreground">+</span>
                </div>
                <p className="text-xs text-muted-foreground">voluntários cadastrados</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Screenshots Carousel Section */}
      <section className="py-12 lg:py-20 relative">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <span className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                Veja como funciona
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                Conheça o LEVI em ação
              </h2>
            </div>
            <div className="relative rounded-2xl overflow-hidden border border-border shadow-xl bg-card">
              <div className="relative aspect-video overflow-hidden">
                {screenshots.map((screenshot, index) => (
                  <img
                    key={index}
                    src={screenshot.src}
                    alt={screenshot.title}
                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
                    style={{ opacity: index === currentSlide ? 1 : 0 }}
                    loading="lazy"
                  />
                ))}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              </div>
              
              {/* Caption */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-display font-bold text-lg">
                    {screenshots[currentSlide].title}
                  </p>
                  <p className="text-white/70 text-sm">
                    {screenshots[currentSlide].description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentSlide((prev) => (prev - 1 + screenshots.length) % screenshots.length)}
                    className="text-white hover:bg-white/20 h-9 w-9"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentSlide((prev) => (prev + 1) % screenshots.length)}
                    className="text-white hover:bg-white/20 h-9 w-9"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Dots */}
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2">
                {screenshots.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      index === currentSlide ? 'bg-white scale-125' : 'bg-white/40'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 lg:py-32 relative">
        <div className="absolute inset-0 bg-secondary/30 dark:bg-secondary/10" />
        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              Recursos
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Tudo que você precisa para gerenciar escalas
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Ferramentas poderosas, interface simples. Desenvolvido especialmente para igrejas.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {features.map((feature, index) => (
              <div 
                key={feature.title}
                className="group p-6 rounded-2xl bg-card border border-border hover-lift cursor-default animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${feature.color} transition-transform group-hover:scale-110`}>
                  <feature.icon className="w-7 h-7" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Support Section */}
      <section className="py-20 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 mesh-gradient opacity-30" />
        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              Apoie o Projeto
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
              LEVI é 100% gratuito
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Desenvolvido com amor para servir igrejas. Se o LEVI abençoou seu ministério, 
              considere apoiar o projeto com uma contribuição voluntária.
            </p>
          </div>
          
          <div className="max-w-lg mx-auto">
            <div className="relative">
              <div className="absolute inset-0 gradient-vibrant rounded-3xl blur-2xl opacity-20" />
              <div className="relative glass rounded-3xl p-8 lg:p-10 border-2 border-primary/20 shadow-colored">
                <div className="text-center mb-8">
                  <div className="w-20 h-20 rounded-full gradient-vibrant flex items-center justify-center mx-auto mb-4 shadow-glow">
                    <Heart className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-display font-bold text-foreground mb-2">
                    Apoio Voluntário
                  </h3>
                  <p className="text-muted-foreground">
                    Qualquer valor é bem-vindo e ajuda a manter o projeto ativo
                  </p>
                </div>
                
                <ul className="space-y-4 mb-8">
                  {appFeatures.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full gradient-vibrant flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Link to="/payment" className="block">
                  <Button className="w-full gradient-vibrant text-white shadow-glow hover:shadow-glow-lg transition-all text-lg py-6">
                    <Heart className="w-5 h-5 mr-2" />
                    Apoie o LEVI
                  </Button>
                </Link>
                
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Contribuição 100% voluntária • Sem obrigatoriedade
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/20 to-background" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-6">
              Pronto para organizar suas escalas?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Junte-se a centenas de igrejas que já simplificaram sua gestão de voluntários.
            </p>
            <Link to="/acessar">
              <Button size="lg" className="gradient-vibrant text-white shadow-glow hover:shadow-glow-lg transition-all text-lg px-8">
                Acessar com Código
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}