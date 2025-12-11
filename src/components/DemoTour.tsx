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
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface DemoTourProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const tourSteps = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao LEVI!',
    description: 'Vamos fazer um tour rápido pelo sistema de gerenciamento de escalas mais simples do mercado.',
    icon: Calendar,
  },
  {
    id: 'dashboard',
    title: 'Dashboard Principal',
    description: 'Visualize todos os seus departamentos em um só lugar. Crie novos ou participe como membro.',
    icon: Users,
  },
  {
    id: 'calendar',
    title: 'Calendário de Escalas',
    description: 'Veja todas as escalas do mês com cores diferenciadas para cada voluntário. Clique em qualquer dia para gerenciar.',
    icon: Calendar,
  },
  {
    id: 'add-schedule',
    title: 'Adicionar Escalas',
    description: 'Como líder, você pode adicionar voluntários às escalas com data, horário e observações.',
    icon: Plus,
  },
  {
    id: 'members',
    title: 'Gestão de Membros',
    description: 'Convide novos membros através de um link exclusivo. Gerencie funções e permissões.',
    icon: Crown,
  },
  {
    id: 'notifications',
    title: 'Notificações Automáticas',
    description: 'Os voluntários recebem lembretes por email: na criação, 48h antes e 2h antes da escala.',
    icon: Bell,
  },
  {
    id: 'export',
    title: 'Exportação de Dados',
    description: 'Exporte suas escalas em PDF ou Excel para impressão ou compartilhamento.',
    icon: FileText,
  },
];

// Mock data for demo visuals
const mockSchedules = [
  { name: 'Maria S.', time: '09:00 - 12:00', color: '#8B5CF6' },
  { name: 'João P.', time: '09:00 - 12:00', color: '#10B981' },
  { name: 'Ana C.', time: '14:00 - 17:00', color: '#F59E0B' },
];

const mockMembers = [
  { name: 'Maria Silva', role: 'leader', initials: 'MS' },
  { name: 'João Pedro', role: 'member', initials: 'JP' },
  { name: 'Ana Clara', role: 'member', initials: 'AC' },
  { name: 'Lucas Mendes', role: 'member', initials: 'LM' },
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
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
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
                <div className="w-20 h-20 rounded-2xl gradient-vibrant flex items-center justify-center mb-4 animate-float">
                  <Calendar className="w-10 h-10 text-white" />
                </div>
                <p className="text-center text-muted-foreground">
                  Gerencie escalas de forma simples e eficiente
                </p>
              </div>
            )}

            {step.id === 'dashboard' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-violet-600/5 border border-violet-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg icon-violet flex items-center justify-center">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <Crown className="w-4 h-4 text-primary" />
                  </div>
                  <p className="font-medium text-sm">Louvor</p>
                  <p className="text-xs text-muted-foreground">8 membros</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg icon-emerald flex items-center justify-center">
                      <Calendar className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="font-medium text-sm">Mídia</p>
                  <p className="text-xs text-muted-foreground">5 membros</p>
                </div>
              </div>
            )}

            {step.id === 'calendar' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Dezembro 2024</span>
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
                      <span className={day === 8 ? 'w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto text-xs' : ''}>{day}</span>
                      {[3, 7, 10, 14].includes(day) && (
                        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                          <div className="w-1 h-1 rounded-full" style={{ backgroundColor: '#8B5CF6' }} />
                          {[7, 14].includes(day) && <div className="w-1 h-1 rounded-full" style={{ backgroundColor: '#10B981' }} />}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step.id === 'add-schedule' && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-background border border-border">
                  <label className="text-xs text-muted-foreground">Voluntário</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs bg-primary text-white">MS</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">Maria Silva</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-lg bg-background border border-border">
                    <label className="text-xs text-muted-foreground">Data</label>
                    <p className="text-sm font-medium">15/12/2024</p>
                  </div>
                  <div className="p-3 rounded-lg bg-background border border-border">
                    <label className="text-xs text-muted-foreground">Horário</label>
                    <p className="text-sm font-medium">09:00 - 12:00</p>
                  </div>
                </div>
              </div>
            )}

            {step.id === 'members' && (
              <div className="space-y-2">
                {mockMembers.map((member, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback 
                          className="text-xs text-white"
                          style={{ backgroundColor: ['#8B5CF6', '#10B981', '#F59E0B', '#06B6D4'][i] }}
                        >
                          {member.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{member.role === 'leader' ? 'Líder' : 'Membro'}</p>
                      </div>
                    </div>
                    {member.role === 'leader' && <Crown className="w-4 h-4 text-primary" />}
                  </div>
                ))}
                <div className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-primary/30 text-primary text-sm">
                  <Share2 className="w-4 h-4" />
                  <span>Convidar com link único</span>
                </div>
              </div>
            )}

            {step.id === 'notifications' && (
              <div className="space-y-3">
                {[
                  { title: 'Escala criada', desc: 'Email imediato ao voluntário', time: 'Agora' },
                  { title: 'Lembrete 48h', desc: 'Confirmação de presença', time: '48h antes' },
                  { title: 'Lembrete final', desc: 'Último aviso antes da escala', time: '2h antes' },
                ].map((notif, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4 text-primary" />
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
                  <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-background border border-border">
                    <FileText className="w-10 h-10 text-red-500" />
                    <span className="text-sm font-medium">PDF</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-background border border-border">
                    <FileText className="w-10 h-10 text-green-500" />
                    <span className="text-sm font-medium">Excel</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Exporte para imprimir ou compartilhar
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