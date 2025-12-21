import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DemoTour } from '@/components/DemoTour';
import { useUserCount } from '@/hooks/useUserCount';
import { 
  Calendar, 
  Users, 
  Bell, 
  Shield, 
  Zap, 
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  Sparkles
} from 'lucide-react';

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
    description: 'Lembretes via Email: confirmação imediata, 48h e 2h antes da escala.',
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
    title: 'Simples de Usar',
    description: 'Interface intuitiva que qualquer pessoa pode usar. Sem treinamento necessário.',
    color: 'icon-rose',
  },
];

const pricingFeatures = [
  'Membros ilimitados',
  'Escalas ilimitadas',
  'Notificações por Email',
  'Calendário drag-and-drop',
  'Link de convite único',
  'Exportação PDF/Excel',
  'Sincronização em tempo real',
  'Suporte por email',
];

export default function Landing() {
  const [showDemo, setShowDemo] = useState(false);
  const { count, loading: countLoading } = useUserCount();

  return (
    <div className="min-h-screen bg-background">
      <DemoTour open={showDemo} onOpenChange={setShowDemo} />
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/auth" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl gradient-vibrant flex items-center justify-center shadow-glow-sm transition-all duration-300 group-hover:scale-110 group-hover:shadow-glow">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xl font-bold text-foreground">LEVI</span>
              <span className="hidden md:inline text-sm text-muted-foreground border-l border-border pl-2">Logística de Escalas para Voluntários da Igreja</span>
            </div>
          </Link>
          
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/auth">
              <Button variant="ghost" className="hidden sm:inline-flex">
                Entrar
              </Button>
            </Link>
            <Link to="/">
              <Button className="gradient-vibrant text-white shadow-glow-sm hover:shadow-glow transition-all">
                Acessar Igreja
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
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
              <Link to="/">
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

      {/* Pricing Section */}
      <section className="py-20 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 mesh-gradient opacity-30" />
        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              Preços
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Preço simples e transparente
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Pague apenas pelo que usar. Sem taxas escondidas ou surpresas.
            </p>
          </div>
          
          <div className="max-w-lg mx-auto">
            <div className="relative">
              <div className="absolute inset-0 gradient-vibrant rounded-3xl blur-2xl opacity-20" />
              <div className="relative glass rounded-3xl p-8 lg:p-10 border-2 border-primary/20 shadow-colored">
                <div className="text-center mb-8">
                  <span className="inline-block px-4 py-1 rounded-full gradient-vibrant text-white text-sm font-medium mb-4">
                    Por voluntário
                  </span>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl lg:text-6xl font-display font-bold text-gradient-vibrant">R$ 10</span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    14 dias de teste grátis • Cobrança mensal por membro
                  </p>
                </div>
                
                <ul className="space-y-4 mb-8">
                  {pricingFeatures.map((feature, index) => (
                    <li key={feature} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full gradient-vibrant flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Link to="/" className="block">
                  <Button className="w-full gradient-vibrant text-white shadow-glow hover:shadow-glow-lg transition-all text-lg py-6">
                    Acessar com Código
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </Button>
                </Link>
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
            <Link to="/">
              <Button size="lg" className="gradient-vibrant text-white shadow-glow hover:shadow-glow-lg transition-all text-lg px-8">
                Acessar com Código
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link to="/auth" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg gradient-vibrant flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-glow">
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-semibold text-foreground">LEVI</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Logística de Escalas de Voluntários da Igreja
            </p>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} LEVI. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}