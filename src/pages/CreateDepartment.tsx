import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  ArrowLeft, 
  Calendar, 
  Loader2, 
  CheckCircle2, 
  CreditCard,
  Shield,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const departmentSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome muito longo'),
  description: z.string()
    .max(500, 'Descrição muito longa')
    .optional(),
});

type DepartmentForm = z.infer<typeof departmentSchema>;

const features = [
  'R$ 10/mês por membro',
  'Escalas ilimitadas por mês',
  'Notificações via Email',
  'Calendário drag-and-drop',
  'Link de convite único',
  'Exportação PDF/Excel',
];

export default function CreateDepartment() {
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'payment' | 'success'>('form');
  const [createdDepartment, setCreatedDepartment] = useState<{ id: string; name: string; invite_code: string } | null>(null);
  const [searchParams] = useSearchParams();
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<DepartmentForm>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { name: '', description: '' },
  });

  // Handle return from Stripe checkout
  useEffect(() => {
    const success = searchParams.get('success');
    const sessionId = searchParams.get('session_id');
    const canceled = searchParams.get('canceled');

    if (canceled) {
      toast({
        variant: 'destructive',
        title: 'Pagamento cancelado',
        description: 'O processo de pagamento foi cancelado.',
      });
      return;
    }

    if (success && sessionId) {
      completeCheckout(sessionId);
    }
  }, [searchParams]);

  const completeCheckout = async (sessionId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('complete-checkout', {
        body: { sessionId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setCreatedDepartment(data.department);
      setStep('success');
      
      toast({
        title: 'Departamento criado!',
        description: 'Seu período de teste de 7 dias começou.',
      });
    } catch (error) {
      console.error('Error completing checkout:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar departamento',
        description: 'Tente novamente em alguns instantes.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: DepartmentForm) => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Você precisa estar logado para criar um departamento.',
      });
      navigate('/auth');
      return;
    }

    setStep('payment');
  };

  const handlePayment = async () => {
    if (!user) return;
    
    setIsLoading(true);
    
    try {
      const formData = form.getValues();
      
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          departmentName: formData.name,
          departmentDescription: formData.description || '',
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao iniciar pagamento',
        description: 'Tente novamente em alguns instantes.',
      });
      setIsLoading(false);
    }
  };

  const copyInviteLink = () => {
    if (!createdDepartment) return;
    const link = `${window.location.origin}/join/${createdDepartment.invite_code}`;
    navigator.clipboard.writeText(link);
    toast({
      title: 'Link copiado!',
      description: 'Compartilhe com os membros do departamento.',
    });
  };

  // Show loading state when returning from Stripe
  if (searchParams.get('success') && searchParams.get('session_id') && !createdDepartment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold text-foreground mb-2">
            Finalizando criação...
          </h2>
          <p className="text-muted-foreground">
            Estamos configurando seu departamento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Link 
            to="/dashboard" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Voltar</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Form Step */}
          {step === 'form' && (
            <div className="grid lg:grid-cols-2 gap-12">
              <div className="animate-fade-in">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow-sm">
                    <Calendar className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="font-display text-2xl font-bold text-foreground">
                      Criar Departamento
                    </h1>
                    <p className="text-muted-foreground">
                      Configure seu novo departamento
                    </p>
                  </div>
                </div>

                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Departamento</Label>
                    <Input
                      id="name"
                      placeholder="Ex: Louvor, Mídia, Recepção..."
                      {...form.register('name')}
                      className="h-12"
                    />
                    {form.formState.errors.name && (
                      <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição (opcional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Descreva as atividades e responsabilidades do departamento..."
                      {...form.register('description')}
                      className="min-h-[120px] resize-none"
                    />
                    {form.formState.errors.description && (
                      <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 gradient-primary text-primary-foreground shadow-glow-sm hover:shadow-glow transition-all"
                  >
                    Continuar para pagamento
                  </Button>
                </form>
              </div>

              {/* Pricing sidebar */}
              <div className="lg:pl-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <div className="sticky top-24">
                  <div className="relative">
                    <div className="absolute inset-0 gradient-primary rounded-2xl blur-xl opacity-20" />
                    <div className="relative glass rounded-2xl p-6 border border-primary/20">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="w-5 h-5 text-primary" />
                        <span className="text-sm font-medium text-primary">7 dias grátis</span>
                      </div>
                      
              <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-4xl font-display font-bold text-foreground">R$ 10</span>
                        <span className="text-muted-foreground">/mês</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-6">por membro do departamento</p>

                      <ul className="space-y-3 mb-6">
                        {features.map((feature) => (
                          <li key={feature} className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                            <span className="text-foreground">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="pt-4 border-t border-border">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Shield className="w-4 h-4" />
                          <span>Pagamento seguro via Stripe</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payment Step */}
          {step === 'payment' && (
            <div className="max-w-md mx-auto text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-6 shadow-glow">
                <CreditCard className="w-8 h-8 text-primary-foreground" />
              </div>
              
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                Iniciar teste grátis
              </h2>
              <p className="text-muted-foreground mb-8">
                Você terá 7 dias para testar todas as funcionalidades. 
                Após o período de teste, a cobrança de R$ 10/mês por membro será iniciada.
              </p>

              <div className="bg-muted/50 rounded-xl p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">Departamento</span>
                  <span className="font-medium text-foreground">{form.getValues('name')}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">Período de teste</span>
                  <span className="font-medium text-foreground">7 dias</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">Membros iniciais</span>
                  <span className="font-medium text-foreground">1 (você)</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-muted-foreground">Após o teste</span>
                  <span className="font-medium text-foreground">R$ 10,00/mês por membro</span>
                </div>
              </div>

              <div className="space-y-3">
                <Button 
                  onClick={handlePayment}
                  className="w-full h-12 gradient-primary text-primary-foreground shadow-glow-sm hover:shadow-glow transition-all"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Redirecionando para pagamento...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-5 h-5 mr-2" />
                      Continuar para o Stripe
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="ghost" 
                  onClick={() => setStep('form')}
                  className="w-full"
                  disabled={isLoading}
                >
                  Voltar
                </Button>
              </div>

              <p className="mt-6 text-xs text-muted-foreground">
                Ao continuar, você concorda com nossos Termos de Serviço e Política de Privacidade.
              </p>
            </div>
          )}

          {/* Success Step */}
          {step === 'success' && createdDepartment && (
            <div className="max-w-md mx-auto text-center animate-fade-in">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                Departamento criado! 🎉
              </h2>
              <p className="text-muted-foreground mb-8">
                <strong>{createdDepartment.name}</strong> está pronto. 
                Agora convide os membros usando o link abaixo.
              </p>

              <div className="bg-muted/50 rounded-xl p-4 mb-6">
                <p className="text-sm text-muted-foreground mb-2">Link de convite</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-background rounded-lg px-3 py-2 text-foreground overflow-hidden text-ellipsis">
                    {`${window.location.origin}/join/${createdDepartment.invite_code}`}
                  </code>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={copyInviteLink}
                  >
                    Copiar
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Link to={`/departments/${createdDepartment.id}`} className="block">
                  <Button className="w-full h-12 gradient-primary text-primary-foreground shadow-glow-sm hover:shadow-glow transition-all">
                    Ir para o departamento
                  </Button>
                </Link>
                
                <Link to="/dashboard" className="block">
                  <Button variant="ghost" className="w-full">
                    Voltar ao dashboard
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
