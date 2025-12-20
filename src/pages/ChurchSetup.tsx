import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Church, 
  Loader2, 
  ArrowRight, 
  CheckCircle2,
  Plus,
  Key
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

const churchSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome muito longo'),
  description: z.string()
    .max(500, 'Descrição muito longa')
    .optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
});

const codeSchema = z.object({
  code: z.string()
    .min(4, 'Código deve ter no mínimo 4 caracteres')
    .max(20, 'Código inválido'),
});

type ChurchForm = z.infer<typeof churchSchema>;
type CodeForm = z.infer<typeof codeSchema>;

interface ValidatedChurch {
  id: string;
  name: string;
}

export default function ChurchSetup() {
  const [isLoading, setIsLoading] = useState(false);
  const [validatedChurch, setValidatedChurch] = useState<ValidatedChurch | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('code');
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const churchForm = useForm<ChurchForm>({
    resolver: zodResolver(churchSchema),
    defaultValues: { name: '', description: '', address: '', city: '', state: '' },
  });

  const codeForm = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth?tab=register&redirect=/church-setup');
    }
  }, [user, authLoading, navigate]);

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
        .rpc('validate_church_code', { p_code: code });

      if (error) throw error;

      if (data && data.length > 0 && data[0].is_valid) {
        setValidatedChurch({ id: data[0].id, name: data[0].name });
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

  const handleCodeSubmit = async (data: CodeForm) => {
    if (!validatedChurch) {
      toast({
        variant: 'destructive',
        title: 'Igreja não encontrada',
        description: 'Por favor, verifique o código e tente novamente.',
      });
      return;
    }

    // Navigate to create department with church pre-filled
    navigate(`/departments/new?church=${validatedChurch.id}`);
  };

  const handleCreateChurch = async (data: ChurchForm) => {
    if (!user) return;
    
    setIsLoading(true);
    
    try {
      // Generate unique code
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_church_code');
      
      if (codeError) throw codeError;

      const { data: newChurch, error } = await supabase
        .from('churches')
        .insert({
          name: data.name,
          description: data.description || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          code: codeData,
          leader_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Igreja cadastrada!',
        description: `Código: ${codeData}`,
      });

      // Navigate to create department with church pre-filled
      navigate(`/departments/new?church=${newChurch.id}`);
    } catch (error) {
      console.error('Error creating church:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar igreja',
        description: 'Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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

      <main className="container mx-auto px-4 pt-32 pb-16">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="text-center mb-8 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-glow">
              <Church className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground mb-2">
              Configurar Igreja
            </h1>
            <p className="text-muted-foreground">
              Para criar um departamento, primeiro precisamos identificar sua igreja
            </p>
          </div>

          {/* Tabs */}
          <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="code" className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Tenho o código
                </TabsTrigger>
                <TabsTrigger value="new" className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Cadastrar igreja
                </TabsTrigger>
              </TabsList>

              {/* Tab: Enter Code */}
              <TabsContent value="code">
                <div className="glass rounded-2xl p-6 border border-border/50">
                  <form onSubmit={codeForm.handleSubmit(handleCodeSubmit)} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="code">Código da Igreja</Label>
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
                      Continuar
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>

                    <p className="text-sm text-center text-muted-foreground">
                      Não tem o código? Peça ao administrador da igreja ou{' '}
                      <button 
                        type="button"
                        onClick={() => setActiveTab('new')} 
                        className="text-primary hover:underline"
                      >
                        cadastre uma nova igreja
                      </button>
                    </p>
                  </form>
                </div>
              </TabsContent>

              {/* Tab: Register New Church */}
              <TabsContent value="new">
                <div className="glass rounded-2xl p-6 border border-border/50">
                  <form onSubmit={churchForm.handleSubmit(handleCreateChurch)} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome da Igreja *</Label>
                      <Input
                        id="name"
                        placeholder="Ex: Igreja Batista Central"
                        {...churchForm.register('name')}
                        className="h-12"
                      />
                      {churchForm.formState.errors.name && (
                        <p className="text-sm text-destructive">{churchForm.formState.errors.name.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        placeholder="Descrição breve da igreja..."
                        {...churchForm.register('description')}
                        className="min-h-[80px] resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">Cidade</Label>
                        <Input
                          id="city"
                          placeholder="Ex: São Paulo"
                          {...churchForm.register('city')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">Estado</Label>
                        <Input
                          id="state"
                          placeholder="Ex: SP"
                          {...churchForm.register('state')}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Endereço</Label>
                      <Input
                        id="address"
                        placeholder="Rua, número, bairro..."
                        {...churchForm.register('address')}
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full h-12 gradient-primary text-primary-foreground shadow-glow-sm hover:shadow-glow transition-all"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          Cadastrando...
                        </>
                      ) : (
                        <>
                          Cadastrar e Continuar
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </Button>

                    <p className="text-sm text-center text-muted-foreground">
                      Um código único será gerado automaticamente para sua igreja
                    </p>
                  </form>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
