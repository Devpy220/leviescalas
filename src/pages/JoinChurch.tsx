import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Footer from '@/components/Footer';
import { 
  Church, 
  Loader2, 
  ArrowRight, 
  CheckCircle2,
  Key,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ThemeToggle } from '@/components/ThemeToggle';

const codeSchema = z.object({
  code: z.string()
    .min(4, 'Código deve ter no mínimo 4 caracteres')
    .max(20, 'Código inválido'),
});

type CodeForm = z.infer<typeof codeSchema>;

interface ValidatedChurch {
  name: string;
  slug: string;
}

export default function JoinChurch() {
  const [searchParams] = useSearchParams();
  const churchSlug = searchParams.get('church');
  const codeFromUrl = searchParams.get('code');
  
  const [validatedChurch, setValidatedChurch] = useState<ValidatedChurch | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const codeForm = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: codeFromUrl || '' },
  });

  // Auto-validate code from URL
  useEffect(() => {
    if (codeFromUrl) {
      validateChurchCode(codeFromUrl);
    }
  }, [codeFromUrl]);

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
        .rpc('get_church_invite_info', { p_code: code });

      if (error) throw error;

      if (data && data.length > 0 && data[0].is_valid) {
        setValidatedChurch({ 
          name: data[0].church_name,
          slug: data[0].church_slug || code.toUpperCase()
        });
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

  const handleSubmit = async (data: CodeForm) => {
    if (!validatedChurch) {
      toast({
        variant: 'destructive',
        title: 'Igreja não encontrada',
        description: 'Por favor, verifique o código e tente novamente.',
      });
      return;
    }

    // If not logged in, redirect to auth with church slug for registration
    if (!user) {
      navigate(`/auth?tab=register&church=${validatedChurch.slug}&churchCode=${data.code.toUpperCase()}&redirect=/departments/new?churchCode=${data.code.toUpperCase()}`);
      return;
    }

    // Navigate to create department with church code
    navigate(`/departments/new?churchCode=${data.code.toUpperCase()}`);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl gradient-vibrant flex items-center justify-center shadow-glow-sm transition-all duration-300 group-hover:scale-110 group-hover:shadow-glow">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="font-display text-xl font-bold text-foreground">LEVI</span>
          </Link>
          
          <ThemeToggle />
        </div>
      </nav>

      <main className="container mx-auto px-4 pt-32 pb-16 flex-1">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-8 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-glow">
              <Church className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground mb-2">
              Criar Departamento
            </h1>
            <p className="text-muted-foreground">
              Digite o código da igreja para criar um novo departamento
            </p>
          </div>

          {/* Form */}
          <div className="glass rounded-2xl p-6 border border-border/50 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <form onSubmit={codeForm.handleSubmit(handleSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="code" className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Código da Igreja
                </Label>
                <div className="relative">
                  <Input
                    id="code"
                    placeholder="Digite o código"
                    {...codeForm.register('code')}
                    className="h-12 uppercase font-mono text-center text-lg"
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase();
                      codeForm.setValue('code', value);
                      validateChurchCode(value);
                    }}
                  />
                  {validatingCode && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-muted-foreground" />
                  )}
                </div>
                {codeForm.formState.errors.code && (
                  <p className="text-sm text-destructive">{codeForm.formState.errors.code.message}</p>
                )}
                {codeError && (
                  <p className="text-sm text-destructive">{codeError}</p>
                )}
                {validatedChurch && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-3 rounded-lg">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">{validatedChurch.name}</span>
                  </div>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 gradient-primary text-primary-foreground shadow-glow-sm hover:shadow-glow transition-all"
                disabled={!validatedChurch}
              >
                {user ? 'Continuar' : 'Entrar e Criar Departamento'}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>

              <p className="text-sm text-center text-muted-foreground">
                Não tem o código? Peça ao administrador da igreja.
              </p>
            </form>
          </div>

          {/* Already has account */}
          {!user && (
            <p className="text-center text-sm text-muted-foreground mt-6">
              Já tem uma conta?{' '}
              <Link to="/auth?tab=login" className="text-primary hover:underline">
                Entrar
              </Link>
            </p>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
