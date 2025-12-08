import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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
  },
  {
    icon: Users,
    title: 'Gestão de Membros',
    description: 'Convide membros com link único. Organize equipes e visualize disponibilidades em tempo real.',
  },
  {
    icon: Bell,
    title: 'Notificações Automáticas',
    description: 'Lembretes via WhatsApp: confirmação imediata, 48h e 2h antes da escala.',
  },
  {
    icon: Shield,
    title: 'Seguro e Confiável',
    description: 'Dados protegidos com criptografia. Backups automáticos e acesso controlado por permissões.',
  },
  {
    icon: Zap,
    title: 'Tempo Real',
    description: 'Alterações sincronizam instantaneamente para todos os membros do departamento.',
  },
  {
    icon: CheckCircle2,
    title: 'Simples de Usar',
    description: 'Interface intuitiva que qualquer pessoa pode usar. Sem treinamento necessário.',
  },
];

const pricingFeatures = [
  'Membros ilimitados',
  'Escalas ilimitadas',
  'Notificações WhatsApp',
  'Calendário drag-and-drop',
  'Link de convite único',
  'Exportação PDF/Excel',
  'Sincronização em tempo real',
  'Suporte por email',
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow-sm">
              <Calendar className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold text-foreground">LEVI</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost" className="hidden sm:inline-flex">
                Entrar
              </Button>
            </Link>
            <Link to="/auth?tab=register">
              <Button className="gradient-primary text-primary-foreground shadow-glow-sm hover:shadow-glow transition-all">
                Começar Grátis
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 gradient-hero" />
        <div className="absolute inset-0 gradient-radial opacity-60" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] gradient-glow" />
        
        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center stagger-children">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              <span>Simplifique a gestão de escalas da sua igreja</span>
            </div>
            
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              Organize suas escalas com{' '}
              <span className="text-gradient">facilidade e elegância</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              LEVI é a solução completa para gerenciar escalas de voluntários. 
              Calendário visual, notificações automáticas e sincronização em tempo real.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth?tab=register">
                <Button size="lg" className="w-full sm:w-auto gradient-primary text-primary-foreground shadow-glow hover:shadow-glow-lg transition-all text-lg px-8">
                  Começar 7 dias grátis
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8">
                Ver demonstração
              </Button>
            </div>
            
            <p className="mt-4 text-sm text-muted-foreground">
              Sem cartão de crédito • Configuração em 2 minutos
            </p>
          </div>
          
          {/* Hero Image/Preview */}
          <div className="mt-16 lg:mt-24 relative">
            <div className="absolute inset-0 gradient-glow opacity-50" />
            <div className="relative glass rounded-3xl p-4 shadow-2xl animate-fade-in" style={{ animationDelay: '0.5s' }}>
              <div className="aspect-[16/9] bg-gradient-to-br from-levi-50 to-levi-100 rounded-2xl flex items-center justify-center">
                <div className="text-center p-8">
                  <Calendar className="w-20 h-20 text-primary mx-auto mb-4 animate-float" />
                  <p className="text-lg text-muted-foreground">
                    Prévia do calendário de escalas
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 lg:py-32 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
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
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-4 shadow-glow-sm group-hover:shadow-glow transition-all">
                  <feature.icon className="w-6 h-6 text-primary-foreground" />
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
      <section className="py-20 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Preço simples e transparente
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Pague apenas pelo que usar. Sem taxas escondidas ou surpresas.
            </p>
          </div>
          
          <div className="max-w-lg mx-auto">
            <div className="relative">
              <div className="absolute inset-0 gradient-primary rounded-3xl blur-xl opacity-20" />
              <div className="relative glass rounded-3xl p-8 lg:p-10 border-2 border-primary/20 shadow-glow">
                <div className="text-center mb-8">
                  <span className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                    Por departamento
                  </span>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl lg:text-6xl font-display font-bold text-foreground">R$ 10</span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    7 dias de teste grátis
                  </p>
                </div>
                
                <ul className="space-y-4 mb-8">
                  {pricingFeatures.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Link to="/auth?tab=register" className="block">
                  <Button className="w-full gradient-primary text-primary-foreground shadow-glow hover:shadow-glow-lg transition-all text-lg py-6">
                    Começar teste grátis
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32 bg-gradient-to-b from-secondary/30 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-6">
              Pronto para organizar suas escalas?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Junte-se a centenas de igrejas que já simplificaram sua gestão de voluntários.
            </p>
            <Link to="/auth?tab=register">
              <Button size="lg" className="gradient-primary text-primary-foreground shadow-glow hover:shadow-glow-lg transition-all text-lg px-8">
                Criar conta gratuita
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
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <Calendar className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display font-semibold text-foreground">LEVI</span>
            </div>
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
