import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Church,
  Users,
  Calendar,
  Clock,
  Layers,
  Bell,
  FileText,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LeviLogo } from '@/components/LeviLogo';
import introVideo from '@/assets/levi-intro-video.mp4';

const tutorialSections = [
  {
    id: 'church',
    icon: Church,
    title: 'Sistema por Igrejas',
    description: 'Cada igreja tem seu código exclusivo. Os membros acessam pelo código da igreja e encontram todos os departamentos disponíveis.',
    color: 'from-violet-500/20 to-violet-600/10',
    borderColor: 'border-violet-500/30',
    iconBg: 'bg-violet-500/20 text-violet-500',
  },
  {
    id: 'departments',
    icon: Users,
    title: 'Departamentos',
    description: 'Participe de múltiplos departamentos como líder ou membro. Cada departamento tem seu próprio calendário, membros e setores.',
    color: 'from-emerald-500/20 to-emerald-600/10',
    borderColor: 'border-emerald-500/30',
    iconBg: 'bg-emerald-500/20 text-emerald-500',
  },
  {
    id: 'calendar',
    icon: Calendar,
    title: 'Calendário de Escalas',
    description: 'Visualize todas as escalas do mês com cores diferenciadas para cada voluntário. Líderes podem adicionar e gerenciar escalas facilmente.',
    color: 'from-blue-500/20 to-blue-600/10',
    borderColor: 'border-blue-500/30',
    iconBg: 'bg-blue-500/20 text-blue-500',
  },
  {
    id: 'availability',
    icon: Clock,
    title: 'Disponibilidade',
    description: 'Membros podem informar os dias que estão disponíveis. Líderes visualizam a disponibilidade de toda a equipe para montar as escalas.',
    color: 'from-amber-500/20 to-amber-600/10',
    borderColor: 'border-amber-500/30',
    iconBg: 'bg-amber-500/20 text-amber-500',
  },
  {
    id: 'sectors',
    icon: Layers,
    title: 'Setores e Funções',
    description: 'Organize seu departamento em setores (ex: Bateria, Vocal, Teclado). Atribua membros a funções específicas nas escalas.',
    color: 'from-rose-500/20 to-rose-600/10',
    borderColor: 'border-rose-500/30',
    iconBg: 'bg-rose-500/20 text-rose-500',
  },
  {
    id: 'notifications',
    icon: Bell,
    title: 'Notificações por Email',
    description: 'Voluntários recebem emails automáticos: ao serem escalados, 48h antes e 2h antes do compromisso.',
    color: 'from-cyan-500/20 to-cyan-600/10',
    borderColor: 'border-cyan-500/30',
    iconBg: 'bg-cyan-500/20 text-cyan-500',
  },
  {
    id: 'export',
    icon: FileText,
    title: 'Exportar Escalas',
    description: 'Exporte suas escalas em PDF ou Excel para impressão ou compartilhamento com a equipe.',
    color: 'from-purple-500/20 to-purple-600/10',
    borderColor: 'border-purple-500/30',
    iconBg: 'bg-purple-500/20 text-purple-500',
  },
];

export default function Tutorial() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/landing">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <LeviLogo size="sm" />
              <span className="font-display text-lg font-bold">Tutorial</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Video Intro Section */}
        <section className="mb-12">
          <div className="relative rounded-2xl overflow-hidden border border-border shadow-lg">
            <video
              ref={videoRef}
              src={introVideo}
              className="w-full aspect-video object-cover"
              muted={isMuted}
              loop
              playsInline
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            
            {/* Video Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            
            {/* Play Button Overlay */}
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Button
                  size="lg"
                  onClick={togglePlay}
                  className="w-20 h-20 rounded-full gradient-vibrant shadow-glow hover:shadow-glow-lg transition-all"
                >
                  <Play className="w-8 h-8 text-white ml-1" />
                </Button>
              </div>
            )}

            {/* Video Controls */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <LeviLogo size="sm" className="opacity-90" />
                <div>
                  <h2 className="text-white font-display font-bold text-lg">LEVI</h2>
                  <p className="text-white/70 text-sm">Logística de Escalas para Voluntários</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={togglePlay}
                  className="text-white hover:bg-white/20"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  className="text-white hover:bg-white/20"
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Tutorial Content */}
        <section className="mb-12">
          <div className="text-center mb-10">
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Como usar o LEVI
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Aprenda a utilizar todas as funcionalidades do sistema de escalas mais simples para igrejas.
            </p>
          </div>

          <div className="space-y-6">
            {tutorialSections.map((section, index) => (
              <div
                key={section.id}
                className={`p-6 rounded-2xl bg-gradient-to-br ${section.color} border ${section.borderColor} animate-fade-in`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${section.iconBg}`}>
                      <section.icon className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                      {section.title}
                    </h3>
                    <p className="text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features Summary */}
        <section className="mb-12">
          <div className="p-8 rounded-2xl gradient-vibrant text-white">
            <h2 className="font-display text-2xl font-bold mb-6 text-center">
              Por que escolher o LEVI?
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                '100% gratuito para usar',
                'Membros ilimitados',
                'Escalas ilimitadas',
                'Notificações automáticas',
                'Exportação PDF/Excel',
                'Interface simples e intuitiva',
                'Suporte por email',
                'Sem necessidade de treinamento',
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-white/90 shrink-0" />
                  <span className="text-white/90">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <h2 className="font-display text-2xl font-bold text-foreground mb-4">
            Pronto para começar?
          </h2>
          <p className="text-muted-foreground mb-6">
            Entre com o código da sua igreja e comece a usar o LEVI agora mesmo.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/acessar">
              <Button size="lg" className="gradient-vibrant text-white shadow-glow hover:shadow-glow-lg">
                Acessar com Código
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/landing">
              <Button size="lg" variant="outline">
                Voltar para Início
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
