import { useState } from 'react';
import { 
  Calendar, 
  Users, 
  Bell, 
  ChevronLeft, 
  ChevronRight, 
  X,
  Plus,
  Crown,
  Clock,
  Share2,
  FileText,
  Layers,
  Church,
  Check,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LeviLogo } from '@/components/LeviLogo';

interface DemoTourProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const tourSteps = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao LEVI!',
    description: 'Sistema gratuito de escalas para voluntários de igrejas. Veja como é simples organizar seu ministério.',
    icon: Sparkles,
  },
  {
    id: 'church',
    title: 'Sistema por Igrejas',
    description: 'Cada igreja tem seu código exclusivo. Os membros acessam pelo código da igreja e encontram todos os departamentos.',
    icon: Church,
  },
  {
    id: 'departments',
    title: 'Seus Departamentos',
    description: 'Participe de múltiplos departamentos como líder ou membro. Veja suas escalas de todos os ministérios em um só lugar.',
    icon: Users,
  },
  {
    id: 'calendar',
    title: 'Calendário de Escalas',
    description: 'Visualize todas as escalas do mês com cores diferenciadas para cada voluntário. Líderes podem adicionar e gerenciar escalas.',
    icon: Calendar,
  },
  {
    id: 'availability',
    title: 'Disponibilidade',
    description: 'Membros podem informar os dias que estão disponíveis. Líderes visualizam a disponibilidade de toda a equipe.',
    icon: Clock,
  },
  {
    id: 'sectors',
    title: 'Setores e Funções',
    description: 'Organize seu departamento em setores (ex: Bateria, Vocal, Teclado). Atribua membros a funções específicas.',
    icon: Layers,
  },
  {
    id: 'notifications',
    title: 'Notificações por Email',
    description: 'Voluntários recebem emails automáticos: ao serem escalados, 48h antes e 2h antes do compromisso.',
    icon: Bell,
  },
  {
    id: 'export',
    title: 'Exportar Escalas',
    description: 'Exporte suas escalas em PDF ou Excel para impressão ou compartilhamento com a equipe.',
    icon: FileText,
  },
];

const mockMembers = [
  { name: 'Maria Silva', role: 'leader', initials: 'MS', color: '#8B5CF6' },
  { name: 'João Pedro', role: 'member', initials: 'JP', color: '#10B981' },
  { name: 'Ana Clara', role: 'member', initials: 'AC', color: '#F59E0B' },
  { name: 'Lucas Mendes', role: 'member', initials: 'LM', color: '#06B6D4' },
];

const mockDepartments = [
  { name: 'Louvor', members: 8, isLeader: true, color: 'violet' },
  { name: 'Mídia', members: 5, isLeader: false, color: 'emerald' },
];

const mockSectors = [
  { name: 'Vocal', members: 4 },
  { name: 'Bateria', members: 2 },
  { name: 'Teclado', members: 2 },
];

export function DemoTour({ open, onOpenChange }: DemoTourProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const step = tourSteps[currentStep];
  const Icon = step.icon;

  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onOpenChange(false);
      setCurrentStep(0);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setCurrentStep(0);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
        {/* Header */}
        <div className="gradient-vibrant p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <LeviLogo size="sm" className="bg-white/20 rounded-xl p-1" />
              <span className="font-display text-xl font-bold">LEVI</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white/80 hover:text-white hover:bg-white/10"
              onClick={handleClose}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Progress */}
          <div className="flex gap-1">
            {tourSteps.map((_, index) => (
              <div 
                key={index}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  index <= currentStep ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl gradient-vibrant flex items-center justify-center shrink-0">
              <Icon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">
                {step.title}
              </h3>
              <p className="text-muted-foreground">
                {step.description}
              </p>
            </div>
          </div>

          {/* Demo Visual based on step */}
          <div className="bg-muted/30 rounded-xl p-4 border border-border min-h-[200px]">
            {step.id === 'welcome' && (
              <div className="flex flex-col items-center justify-center h-full py-8">
                <LeviLogo size="lg" className="mb-4 animate-float" />
                <p className="text-center text-muted-foreground">
                  Gerencie escalas de forma simples e gratuita
                </p>
              </div>
            )}

            {step.id === 'church' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-background border border-border">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl gradient-vibrant flex items-center justify-center">
                      <Church className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold">Igreja Batista Central</p>
                      <p className="text-sm text-muted-foreground">3 departamentos • 25 membros</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm">
                    <span className="text-muted-foreground">Código:</span>
                    <code className="font-mono font-semibold text-primary">ABC123</code>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Digite o código da igreja para acessar todos os departamentos
                </p>
              </div>
            )}

            {step.id === 'departments' && (
              <div className="grid grid-cols-2 gap-3">
                {mockDepartments.map((dept, i) => (
                  <div 
                    key={i}
                    className={`p-4 rounded-xl bg-gradient-to-br ${
                      dept.color === 'violet' 
                        ? 'from-violet-500/10 to-violet-600/5 border-violet-500/20' 
                        : 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20'
                    } border`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        dept.color === 'violet' ? 'icon-violet' : 'icon-emerald'
                      }`}>
                        <Users className="w-4 h-4" />
                      </div>
                      {dept.isLeader && <Crown className="w-4 h-4 text-primary" />}
                    </div>
                    <p className="font-medium text-sm">{dept.name}</p>
                    <p className="text-xs text-muted-foreground">{dept.members} membros</p>
                  </div>
                ))}
              </div>
            )}

            {step.id === 'calendar' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Janeiro 2025</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                    <div key={i} className="py-1 text-muted-foreground font-medium">{d}</div>
                  ))}
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((day) => (
                    <div key={day} className="py-2 rounded relative">
                      <span className={day === 5 ? 'w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto text-xs' : ''}>{day}</span>
                      {[5, 12].includes(day) && (
                        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#8B5CF6' }} />
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#10B981' }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step.id === 'availability' && (
              <div className="space-y-3">
                <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, i) => (
                    <div key={i} className="py-1 text-muted-foreground font-medium">{d}</div>
                  ))}
                  {[true, false, true, true, false, true, true].map((available, i) => (
                    <div 
                      key={i} 
                      className={`py-3 rounded-lg flex items-center justify-center ${
                        available 
                          ? 'bg-emerald-500/20 border border-emerald-500/30' 
                          : 'bg-muted/50 border border-border'
                      }`}
                    >
                      {available && <Check className="w-4 h-4 text-emerald-500" />}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Clique nos dias para marcar sua disponibilidade
                </p>
              </div>
            )}

            {step.id === 'sectors' && (
              <div className="space-y-2">
                {mockSectors.map((sector, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Layers className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{sector.name}</p>
                        <p className="text-xs text-muted-foreground">{sector.members} membros</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-primary/30 text-primary text-sm cursor-pointer hover:bg-primary/5">
                  <Plus className="w-4 h-4" />
                  <span>Adicionar setor</span>
                </div>
              </div>
            )}

            {step.id === 'notifications' && (
              <div className="space-y-3">
                {[
                  { title: 'Nova escala criada', desc: 'Você foi escalado para Domingo, 09:00', time: 'Agora', icon: Calendar },
                  { title: 'Lembrete 48h', desc: 'Sua escala é em 2 dias', time: '48h antes', icon: Clock },
                  { title: 'Lembrete final', desc: 'Sua escala começa em 2 horas', time: '2h antes', icon: Bell },
                ].map((notif, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <notif.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{notif.title}</p>
                        <span className="text-xs text-muted-foreground">{notif.time}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{notif.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {step.id === 'export' && (
              <div className="flex flex-col items-center justify-center h-full py-4 space-y-4">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-background border border-border hover:border-primary/50 cursor-pointer transition-colors">
                    <FileText className="w-10 h-10 text-red-500" />
                    <span className="text-sm font-medium">PDF</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-background border border-border hover:border-primary/50 cursor-pointer transition-colors">
                    <FileText className="w-10 h-10 text-green-500" />
                    <span className="text-sm font-medium">Excel</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Exporte para imprimir ou compartilhar com a equipe
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Anterior
          </Button>
          
          <span className="text-sm text-muted-foreground">
            {currentStep + 1} de {tourSteps.length}
          </span>
          
          <Button onClick={nextStep} className="gradient-vibrant text-white">
            {currentStep === tourSteps.length - 1 ? (
              'Começar'
            ) : (
              <>
                Próximo
                <ChevronRight className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
