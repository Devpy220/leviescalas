import { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Church, Layers, Users, Link2, Sparkles, ArrowDown, CheckCircle2, Copy, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { LeviLogo } from '@/components/LeviLogo';
import { useToast } from '@/hooks/use-toast';

interface ChurchOnboardingGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchName: string;
  churchCode: string;
  product?: 'levi' | 'kids' | 'both';
  createDeptUrl?: string | null;
  kidsAdminUrl?: string | null;
  onClose: () => void | Promise<void>;
  onSendWhatsApp?: () => void | Promise<void>;
}

export function ChurchOnboardingGuide({
  open,
  onOpenChange,
  churchName,
  churchCode,
  product = 'levi',
  createDeptUrl,
  kidsAdminUrl,
  onClose,
  onSendWhatsApp,
}: ChurchOnboardingGuideProps) {
  const [step, setStep] = useState(0);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://leviescalas.com.br';
  const hubLink = `${origin}/igreja/join/${churchCode}`;
  const adminLink = hubLink;
  const kidsLink = hubLink;
  const showLevi = product === 'levi' || product === 'both';
  const showKids = product === 'kids' || product === 'both';

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: 'Link copiado!', description: 'Cole onde precisar.' });
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível copiar' });
    }
  };

  const handleSendWa = async () => {
    if (!onSendWhatsApp) return;
    setSending(true);
    try {
      await onSendWhatsApp();
    } finally {
      setSending(false);
    }
  };

  const kidsOnly = product === 'kids';

  const firstStep = {
    icon: CheckCircle2,
    title: `Igreja ${churchName} cadastrada! 🎉`,
    description: kidsOnly
      ? 'Guarde o link do LeviKids abaixo — envie pelo WhatsApp ou copie para usar quando quiser.'
      : 'Guarde o link administrativo abaixo — envie pelo WhatsApp ou copie para usar quando quiser.',
    content: (
      <div className="space-y-3">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p className="text-sm text-muted-foreground mb-1">Código da sua igreja</p>
          <p className="font-mono font-bold text-2xl text-emerald-600 dark:text-emerald-400 tracking-wider">
            {churchCode}
          </p>
        </div>

        {showLevi && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
            <p className="text-xs text-muted-foreground">📅 LEVI Escalas — criar departamentos/ministérios</p>
            <p className="text-[11px] font-mono text-primary break-all bg-background/60 rounded-md p-2">
              {adminLink}
            </p>
            <Button size="sm" variant="outline" className="w-full" onClick={() => handleCopy(adminLink)}>
              <Copy className="w-4 h-4 mr-1.5" />
              Copiar link Escalas
            </Button>
          </div>
        )}

        {showKids && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
            <p className="text-xs text-muted-foreground">👶 LeviKids — criar a área infantil (salas, professores, check-in)</p>
            <p className="text-[11px] font-mono text-amber-700 dark:text-amber-400 break-all bg-background/60 rounded-md p-2">
              {kidsLink}
            </p>
            <Button size="sm" variant="outline" className="w-full" onClick={() => handleCopy(kidsLink)}>
              <Copy className="w-4 h-4 mr-1.5" />
              Copiar link Kids
            </Button>
          </div>
        )}

        <Button
          size="sm"
          className="w-full bg-green-600 hover:bg-green-700 text-white"
          onClick={handleSendWa}
          disabled={sending || !onSendWhatsApp}
        >
          <MessageCircle className="w-4 h-4 mr-1.5" />
          {sending ? 'Enviando...' : 'Enviar links por WhatsApp'}
        </Button>
      </div>
    ),
  };

  const kidsSteps = [
    firstStep,
    {
      icon: Users,
      title: 'Como funciona o LeviKids',
      description: 'Crie salas por faixa etária, adicione professores e receba responsáveis via QR code.',
      content: (
        <div className="space-y-3">
          <div className="rounded-xl bg-muted/40 border border-border p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">1</span>
              <p>Acesse o link do LeviKids e crie sua conta</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">2</span>
              <p>Cadastre as <strong>salas por faixa etária</strong> (ex: 1-3 anos, 4-7 anos)</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">3</span>
              <p>Baixe o <strong>QR code único</strong> da sua igreja para check-in</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">4</span>
              <p>Responsáveis escaneiam, cadastram os filhos e fazem check-in/check-out</p>
            </div>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            ⚠️ Se a área infantil não for configurada em <strong>5 dias</strong>, a igreja é removida automaticamente.
          </p>
        </div>
      ),
    },
    {
      icon: Sparkles,
      title: 'Tudo pronto!',
      description: 'Guarde bem o link do LeviKids — é por ele que você acessa o painel administrativo.',
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
            <strong className="text-foreground">Importante:</strong> os responsáveis pelas crianças
            entram pelo QR code na primeira vez para se cadastrar e depois é só logar para o check-in.
          </div>
          <p className="text-xs italic">
            Ao fechar este aviso você sairá da conta e voltará para a tela de login.
          </p>
        </div>
      ),
    },
  ];

  const leviSteps = [
    firstStep,
    {
      icon: Link2,
      title: 'Existem 2 tipos de link no LEVI',
      description: 'Não confunda! Cada link serve para uma pessoa diferente.',
      content: (
        <div className="space-y-3">
          <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Church className="w-5 h-5 text-primary" />
              <p className="font-semibold text-sm">1. Link da Igreja (Admin)</p>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Para <strong>você (responsável pela igreja)</strong> e para os <strong>líderes de departamento</strong>.
              Permite criar novos ministérios.
            </p>
            <p className="text-[11px] font-mono text-primary/80 truncate">
              leviescalas.com.br/igreja/{churchCode.toLowerCase()}
            </p>
          </div>

          <div className="flex justify-center">
            <ArrowDown className="w-5 h-5 text-muted-foreground" />
          </div>

          <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <p className="font-semibold text-sm">2. Link do Departamento (Voluntários)</p>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Gerado <strong>dentro de cada departamento</strong>. Use para convidar voluntários
              (Louvor, Mídia, Diaconia…) a entrarem na equipe.
            </p>
            <p className="text-[11px] font-mono text-amber-700 dark:text-amber-400">
              leviescalas.com.br/join/CÓDIGO-DO-DEPTO
            </p>
          </div>
        </div>
      ),
    },
    {
      icon: Layers,
      title: 'Próximo passo: criar departamentos',
      description: 'Cada ministério é um departamento separado, com seu próprio líder e equipe.',
      content: (
        <div className="space-y-3">
          <div className="rounded-xl bg-muted/40 border border-border p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</span>
              <p>Crie um departamento (ex: <strong>Louvor</strong>)</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</span>
              <p>Defina o líder do departamento</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">3</span>
              <p>Compartilhe o link do departamento com os voluntários</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">4</span>
              <p>Repita para outros ministérios</p>
            </div>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            ⚠️ Se nenhum departamento for criado em <strong>5 dias</strong>, a igreja é removida
            automaticamente.
          </p>
        </div>
      ),
    },
    {
      icon: Sparkles,
      title: 'Tudo pronto!',
      description: 'Use os links para entrar como líder, coordenador ou voluntário.',
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
            <strong className="text-foreground">Importante:</strong> o responsável pelo cadastro
            <strong> não entra automaticamente como voluntário</strong>. O acesso à igreja e aos
            departamentos é feito apenas pelos links — como líder, coordenador ou membro do departamento.
          </div>
          <p className="text-xs italic">
            Guarde bem o link administrativo. Ao fechar este aviso você sairá da conta e voltará para a tela de login.
          </p>
        </div>
      ),
    },
  ];

  const steps = kidsOnly ? kidsSteps : leviSteps;

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  const handleClose = () => {
    onOpenChange(false);
    setStep(0);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden max-h-[92vh] flex flex-col gap-0">
        {/* Header */}
        <div className="gradient-vibrant p-4 text-white shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <LeviLogo size="sm" className="bg-white/20 rounded-xl p-1" />
              <span className="font-display text-base font-bold">LEVI · Boas-vindas</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-white/80 hover:text-white hover:bg-white/10 h-8 w-8"
              onClick={handleClose}
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

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl gradient-vibrant flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-foreground mb-1">
                {current.title}
              </h3>
              <p className="text-xs text-muted-foreground">{current.description}</p>
            </div>
          </div>

          <div>{current.content}</div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 flex items-center justify-between gap-2 border-t border-border bg-card shrink-0">
          <Button variant="ghost" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} size="sm">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>

          <span className="text-xs text-muted-foreground">
            {step + 1} de {steps.length}
          </span>

          {isLast ? (
            <Button size="sm" className="gradient-vibrant text-white" onClick={() => onClose()}>
              Sair
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" className="gradient-vibrant text-white" onClick={() => setStep(s => s + 1)}>
              Próximo
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
