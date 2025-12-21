import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Church, 
  Loader2, 
  ArrowRight, 
  CheckCircle2,
  Plus,
  Key,
  Copy,
  Mail,
  Phone,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  email: z.string()
    .email('Email inválido'),
  phone: z.string()
    .min(10, 'Telefone inválido')
    .max(20, 'Telefone inválido'),
  cnpj: z.string()
    .max(18, 'CNPJ inválido')
    .optional(),
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

interface CreatedChurch {
  id: string;
  name: string;
  code: string;
}

export default function ChurchSetup() {
  const [isLoading, setIsLoading] = useState(false);
  const [validatedChurch, setValidatedChurch] = useState<ValidatedChurch | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('code');
  const [createdChurch, setCreatedChurch] = useState<CreatedChurch | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const churchForm = useForm<ChurchForm>({
    resolver: zodResolver(churchSchema),
    defaultValues: { name: '', email: '', phone: '', cnpj: '', description: '', address: '', city: '', state: '' },
  });

  const codeForm = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  });

  const requireAuth = () => {
    if (!user) {
      navigate('/auth?tab=register&redirect=/church-setup');
      return false;
    }
    return true;
  };

  const validateChurchCode = async (code: string) => {
    if (!code || code.length < 4) {
      setValidatedChurch(null);
      setCodeError(null);
      return;
    }

    setValidatingCode(true);
    setCodeError(null);

    try {
      // Use secure function that doesn't expose internal IDs
      const { data, error } = await supabase
        .rpc('validate_church_code_secure', { p_code: code });

      if (error) throw error;

      if (data && data.length > 0 && data[0].is_valid) {
        // Store the code instead of ID for security
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

  const handleCodeSubmit = async (data: CodeForm) => {
    if (!validatedChurch) {
      toast({
        variant: 'destructive',
        title: 'Igreja não encontrada',
        description: 'Por favor, verifique o código e tente novamente.',
      });
      return;
    }

    if (!requireAuth()) return;

    // Navigate to create department with church code (not ID) for security
    navigate(`/departments/new?churchCode=${validatedChurch.id}`);
  };

  const sendCodeByEmail = async (churchId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('send-church-code-email', {
        body: { churchId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Email enviado!',
        description: `Enviamos o código para ${user.email}`,
      });
    } catch (err: any) {
      console.error('Error sending code email:', err);
      toast({
        variant: 'destructive',
        title: 'Não foi possível enviar o email',
        description: 'Tente novamente em instantes.',
      });
    }
  };

  const handleCreateChurch = async (data: ChurchForm) => {
    if (!requireAuth()) return;
    
    setIsLoading(true);
    
    try {
      // Generate unique code
      const { data: codeData, error: codeErr } = await supabase
        .rpc('generate_church_code');
      
      if (codeErr) throw codeErr;

      const { data: newChurch, error } = await supabase
        .from('churches')
        .insert({
          name: data.name,
          email: data.email,
          phone: data.phone,
          cnpj: data.cnpj || null,
          description: data.description || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          code: codeData,
          leader_id: user!.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Show success dialog with code
      setCreatedChurch({
        id: newChurch.id,
        name: newChurch.name,
        code: newChurch.code,
      });
      setShowSuccessDialog(true);

      // Fire-and-forget email (won't block UI)
      setTimeout(() => {
        sendCodeByEmail(newChurch.id);
      }, 0);
    } catch (error: any) {
      console.error('Error creating church:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar igreja',
        description: error?.message || 'Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyCode = () => {
    if (!createdChurch) return;
    navigator.clipboard.writeText(createdChurch.code);
    toast({
      title: 'Código copiado!',
      description: 'Compartilhe com os líderes de departamento.',
    });
  };

  const handleContinue = () => {
    if (!createdChurch) return;
    setShowSuccessDialog(false);
    // Redireciona para o dashboard em vez de criar departamento automaticamente
    navigate('/dashboard');
  };

  const handleCreateDepartment = () => {
    if (!createdChurch) return;
    setShowSuccessDialog(false);
    navigate(`/departments/new?church=${createdChurch.id}`);
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

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email" className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          Email *
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="contato@igreja.com"
                          {...churchForm.register('email')}
                        />
                        {churchForm.formState.errors.email && (
                          <p className="text-sm text-destructive">{churchForm.formState.errors.email.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          Telefone *
                        </Label>
                        <Input
                          id="phone"
                          placeholder="(11) 99999-9999"
                          {...churchForm.register('phone')}
                        />
                        {churchForm.formState.errors.phone && (
                          <p className="text-sm text-destructive">{churchForm.formState.errors.phone.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cnpj" className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        CNPJ (opcional)
                      </Label>
                      <Input
                        id="cnpj"
                        placeholder="00.000.000/0000-00"
                        {...churchForm.register('cnpj')}
                      />
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
                          Cadastrar Igreja
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

      {/* Success Dialog with Code */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              Igreja Cadastrada!
            </DialogTitle>
            <DialogDescription className="text-center">
              Sua igreja foi cadastrada com sucesso. Guarde o código abaixo para compartilhar com os líderes de departamento.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6">
            <div className="bg-muted rounded-xl p-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">Código da Igreja</p>
              <div className="flex items-center justify-center gap-3">
                <code className="text-3xl font-mono font-bold text-primary tracking-wider">
                  {createdChurch?.code}
                </code>
                <Button 
                  size="icon" 
                  variant="outline"
                  onClick={copyCode}
                  className="h-10 w-10"
                >
                  <Copy className="w-5 h-5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {createdChurch?.name}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={copyCode}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copiar Código
              </Button>
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => createdChurch && sendCodeByEmail(createdChurch.id)}
              >
                <Mail className="w-4 h-4 mr-2" />
                Enviar por email
              </Button>
            </div>
            <Button 
              className="w-full gradient-primary text-primary-foreground"
              onClick={handleCreateDepartment}
            >
              <Plus className="w-4 h-4 mr-2" />
              Criar Departamento Agora
            </Button>
            <Button 
              variant="ghost"
              className="w-full"
              onClick={handleContinue}
            >
              Ir para o Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
