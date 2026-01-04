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
  Church,
  AlertCircle,
  Heart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const departmentSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome muito longo'),
  description: z.string()
    .max(500, 'Descrição muito longa')
    .optional(),
  churchCode: z.string()
    .min(1, 'Código da igreja é obrigatório')
    .max(20, 'Código inválido'),
});

type DepartmentForm = z.infer<typeof departmentSchema>;

interface ValidatedChurch {
  id: string;
  name: string;
}

export default function CreateDepartment() {
  const [isLoading, setIsLoading] = useState(false);
  const [createdDepartment, setCreatedDepartment] = useState<{ id: string; name: string; invite_code: string } | null>(null);
  const [validatedChurch, setValidatedChurch] = useState<ValidatedChurch | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  // Check if coming from church page with pre-filled church code
  const prefilledChurchCode = searchParams.get('churchCode');

  const form = useForm<DepartmentForm>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { name: '', description: '', churchCode: '' },
  });

  // Pre-fill church code if coming from church page
  useEffect(() => {
    if (prefilledChurchCode) {
      form.setValue('churchCode', prefilledChurchCode);
      validateChurchCode(prefilledChurchCode);
    }
  }, [prefilledChurchCode]);

  const validateChurchCode = async (code: string) => {
    if (!code || code.length < 4) {
      setValidatedChurch(null);
      setCodeError(null);
      return;
    }

    setValidatingCode(true);
    setCodeError(null);

    try {
      const { data, error } = await supabase
        .rpc('validate_church_code_secure', { p_code: code });

      if (error) throw error;

      if (data && data.length > 0 && data[0].is_valid) {
        setValidatedChurch({ id: code.toUpperCase(), name: data[0].church_name });
        setCodeError(null);
      } else {
        setValidatedChurch(null);
        setCodeError('Código de igreja não encontrado');
      }
    } catch (error) {
      console.error('Error validating church code:', error);
      setCodeError('Erro ao validar código');
    } finally {
      setValidatingCode(false);
    }
  };

  const handleSubmit = async (data: DepartmentForm) => {
    if (authLoading) return;

    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Você precisa estar logado para criar um departamento.',
      });
      navigate('/auth');
      return;
    }

    if (!validatedChurch) {
      toast({
        variant: 'destructive',
        title: 'Igreja não validada',
        description: 'Por favor, insira um código de igreja válido.',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: result, error } = await supabase.functions.invoke('create-department', {
        body: {
          departmentName: data.name,
          departmentDescription: data.description || '',
          churchCode: validatedChurch.id,
        },
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);

      setCreatedDepartment(result.department);
      
      toast({
        title: 'Departamento criado!',
        description: 'Seu departamento foi criado com sucesso.',
      });
    } catch (error) {
      console.error('Error creating department:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar departamento',
        description: 'Tente novamente em alguns instantes.',
      });
    } finally {
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

  // Success view
  if (createdDepartment) {
    return (
      <div className="min-h-screen bg-background">
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
              
              <Link to="/apoio" className="block">
                <Button variant="outline" className="w-full h-12 gap-2">
                  <Heart className="w-5 h-5 text-rose-500" />
                  Apoiar o projeto (voluntário)
                </Button>
              </Link>
              
              <Link to="/dashboard" className="block">
                <Button variant="ghost" className="w-full">
                  Voltar ao dashboard
                </Button>
              </Link>
            </div>
          </div>
        </main>
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
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Form Column */}
            <div className="lg:col-span-2 animate-fade-in">
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

              {/* Free badge */}
              <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    100% Gratuito
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Crie seu departamento sem nenhum custo.
                </p>
              </div>

              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                {/* Church Code Field */}
                <div className="space-y-2">
                  <Label htmlFor="churchCode" className="flex items-center gap-2">
                    <Church className="w-4 h-4 text-primary" />
                    Código da Igreja *
                  </Label>
                  <div className="relative">
                    <Input
                      id="churchCode"
                      placeholder="Digite o código da igreja"
                      {...form.register('churchCode')}
                      className="h-12 uppercase font-mono"
                      onChange={(e) => {
                        form.setValue('churchCode', e.target.value.toUpperCase());
                        validateChurchCode(e.target.value);
                      }}
                      disabled={!!prefilledChurchCode}
                    />
                    {validatingCode && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {form.formState.errors.churchCode && (
                    <p className="text-sm text-destructive">{form.formState.errors.churchCode.message}</p>
                  )}
                  {codeError && (
                    <p className="text-sm text-destructive">{codeError}</p>
                  )}
                  {validatedChurch && (
                    <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Igreja: {validatedChurch.name}</span>
                    </div>
                  )}
                </div>

                {!validatedChurch && !prefilledChurchCode && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Igreja não cadastrada?</AlertTitle>
                    <AlertDescription>
                      Se sua igreja ainda não está cadastrada, entre em contato com o administrador do sistema para obter o código.
                    </AlertDescription>
                  </Alert>
                )}

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
                  disabled={!validatedChurch || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Criando departamento...
                    </>
                  ) : (
                    'Criar Departamento'
                  )}
                </Button>
              </form>
            </div>

            {/* Support Card Column */}
            <div className="lg:col-span-1 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="sticky top-24">
                <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-pink-500/5 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center">
                      <Heart className="w-6 h-6 text-rose-500" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-foreground">
                        Apoie o Projeto
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Contribuição voluntária
                      </p>
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-4">
                    Gostou do LEVI? Ajude a manter o projeto ativo com uma contribuição a partir de <strong className="text-foreground">R$ 10,00</strong>.
                  </p>

                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-background/50 border border-border/50">
                      <p className="text-xs text-muted-foreground mb-1">Sugestão</p>
                      <p className="text-lg font-semibold text-foreground">R$ 10,00</p>
                    </div>
                    
                    <Link to="/apoio" className="block">
                      <Button 
                        variant="outline" 
                        className="w-full h-12 gap-2 border-rose-500/30 hover:bg-rose-500/10 hover:border-rose-500/50 transition-all"
                      >
                        <Heart className="w-5 h-5 text-rose-500" />
                        Quero Apoiar
                      </Button>
                    </Link>
                  </div>

                  <p className="text-xs text-muted-foreground text-center mt-4">
                    Sua contribuição é 100% voluntária
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
