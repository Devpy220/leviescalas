import { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Crown,
  Users,
  Link2,
  Sparkles,
  CalendarDays,
  MessageCircle,
  Layers,
  CalendarSync,
  Megaphone,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { LeviLogo } from '@/components/LeviLogo';

interface LeaderTourProps {
  departmentId: string;
  departmentName: string;
  inviteCode?: string;
}

const STORAGE_PREFIX = 'levi-leader-tour-';

export function LeaderTour({ departmentId, departmentName, inviteCode }: LeaderTourProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const key = `${STORAGE_PREFIX}${departmentId}`;
    if (!localStorage.getItem(key)) {
      // small delay so the page settles first
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [departmentId]);

  const closeAndRemember = () => {
    localStorage.setItem(`${STORAGE_PREFIX}${departmentId}`, '1');
    setOpen(false);
    setStep(0);
  };

  const inviteUrl =
    inviteCode && typeof window !== 'undefined'
      ? `${window.location.origin}/join/${inviteCode}`
      : '';

  const steps = [
    {
      icon: Crown,
      title: `Bem-vindo, líder de ${departmentName}!`,
      description:
        'Vamos te mostrar rapidamente as principais funcionalidades. Pode pular a qualquer momento.',
      content: (
        <p className="text-sm text-muted-foreground">
          Você é responsável por convidar voluntários, montar escalas e manter a comunicação com a equipe.
          Tudo isso pode ser feito por aqui.
        </p>
      ),
    },
    {
      icon: Link2,
      title: 'Convide voluntários para a equipe',
      description: 'Cada departamento tem um link único para entrada na equipe.',
      content: (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Compartilhe o link abaixo no grupo do WhatsApp do ministério. Quem clicar entra direto neste departamento.
          </p>
          {inviteUrl && (
            <div className="rounded-lg bg-muted/50 border border-border p-3 text-[11px] font-mono break-all">
              {inviteUrl}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Você encontra esse link na barra lateral em <strong>Convidar voluntários</strong>.
          </p>
        </div>
      ),
    },
    {
      icon: Users,
      title: 'Disponibilidade da equipe',
      description: 'Cada voluntário define quando pode servir.',
      content: (
        <p className="text-sm text-muted-foreground">
          Os membros marcam horários semanais (ex: Dom manhã, Qua noite) e datas de bloqueio.
          Como líder, você vê tudo consolidado e o LEVI usa essa info para evitar conflitos.
        </p>
      ),
    },
    {
      icon: Sparkles,
      title: 'Geração inteligente de escalas',
      description: 'O LEVI monta a escala do mês para você.',
      content: (
        <p className="text-sm text-muted-foreground">
          Use o botão flutuante <strong>de varinha</strong> (canto inferior direito) para gerar
          escalas automaticamente respeitando disponibilidade, bloqueios e equilíbrio entre voluntários.
          O botão <strong>calendário+</strong> ao lado é para escalar manualmente.
        </p>
      ),
    },
    {
      icon: MessageCircle,
      title: 'Notificações por WhatsApp',
      description: 'Lembretes automáticos para os voluntários.',
      content: (
        <p className="text-sm text-muted-foreground">
          Quando uma escala é confirmada, o LEVI envia mensagens pelo WhatsApp lembrando o voluntário do dia,
          horário e função. Também envia o pedido mensal de datas de bloqueio.
        </p>
      ),
    },
    {
      icon: Layers,
      title: 'Setores e funções',
      description: 'Organize a equipe por papéis.',
      content: (
        <p className="text-sm text-muted-foreground">
          Crie setores (ex: Vocal, Bateria, Câmera 1) e funções com cores/ícones próprios.
          Na hora de escalar, você designa cada voluntário para uma função específica.
        </p>
      ),
    },
    {
      icon: Megaphone,
      title: 'Mural de avisos',
      description: 'Comunicação rápida com a equipe.',
      content: (
        <p className="text-sm text-muted-foreground">
          Publique recados que aparecem como pop-up por 3h e disparam WhatsApp para os voluntários.
          Ideal para mudanças de última hora.
        </p>
      ),
    },
    {
      icon: CalendarSync,
      title: 'Sincronizar com Google Agenda / iCal',
      description: 'Cada voluntário pode levar a escala para o calendário pessoal.',
      content: (
        <p className="text-sm text-muted-foreground">
          Em <strong>Sincronização de Calendário</strong> cada um gera um link .ics para importar no
          Google Agenda, Apple Calendar, Outlook…
        </p>
      ),
    },
    {
      icon: Settings,
      title: 'Configurações do departamento',
      description: 'Ajuste regras específicas do seu ministério.',
      content: (
        <p className="text-sm text-muted-foreground">
          No ícone de engrenagem (canto superior direito do departamento) você define:
          turnos, dobra de domingo, máximo de bloqueios por voluntário, e mais.
        </p>
      ),
    },
    {
      icon: ShieldCheck,
      title: 'Pronto para começar!',
      description: 'Você pode rever esse tour a qualquer momento.',
      content: (
        <p className="text-sm text-muted-foreground">
          Próximos passos sugeridos:
          <br />1. Convidar voluntários pelo link do departamento.
          <br />2. Aguardar todos preencherem disponibilidade.
          <br />3. Gerar a primeira escala com a varinha mágica. ✨
        </p>
      ),
    },
  ];

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeAndRemember()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <div className="gradient-vibrant p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <LeviLogo size="sm" className="bg-white/20 rounded-xl p-1" />
              <span className="font-display text-lg font-bold">Tour do líder</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-white/80 hover:text-white hover:bg-white/10 h-8 w-8"
              onClick={closeAndRemember}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl gradient-vibrant flex items-center justify-center shrink-0">
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-foreground mb-1">
                {current.title}
              </h3>
              <p className="text-sm text-muted-foreground">{current.description}</p>
            </div>
          </div>

          <div className="min-h-[140px] rounded-xl bg-muted/30 border border-border p-4">
            {current.content}
          </div>
        </div>

        <div className="px-5 pb-5 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            size="sm"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>

          <span className="text-xs text-muted-foreground">
            {step + 1} de {steps.length}
          </span>

          {isLast ? (
            <Button size="sm" className="gradient-vibrant text-white" onClick={closeAndRemember}>
              Começar
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={closeAndRemember}>
                Pular
              </Button>
              <Button
                size="sm"
                className="gradient-vibrant text-white"
                onClick={() => setStep((s) => s + 1)}
              >
                Próximo
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
