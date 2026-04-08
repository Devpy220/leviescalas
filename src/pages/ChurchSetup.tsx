import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Church, 
  Loader2, 
  ArrowRight, 
  CheckCircle2,
  Mail,
  Phone,
  FileText,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Link } from 'react-router-dom';
import { LeviLogo } from '@/components/LeviLogo';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

type ChurchForm = z.infer<typeof churchSchema>;

interface CreatedChurch {
  id: string;
  name: string;
  code: string;
}

export default function ChurchSetup() {
  const [isLoading, setIsLoading] = useState(false);
  const [createdChurch, setCreatedChurch] = useState<CreatedChurch | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const churchForm = useForm<ChurchForm>({
    resolver: zodResolver(churchSchema),
    defaultValues: { name: '', email: '', phone: '', cnpj: '', description: '', address: '', city: '', state: '' },
  });

  const requireAuth = () => {
    if (!user) {
      navigate('/auth?tab=register&redirect=/church-setup');
      return false;
    }
    return true;
  };

  const sendCodeByEmail = async (churchId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-church-code-email', {
        body: { churchId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Email enviado!',
        description: 'Enviamos as instruções para o email da igreja.',
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

      setCreatedChurch({
        id: newChurch.id,
        name: newChurch.name,
        code: newChurch.code,
      });
      setShowSuccessDialog(true);

      // Send email with link automatically
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

  const handleCreateDepartment = () => {
    if (!createdChurch) return;
    setShowSuccessDialog(false);
    navigate(`/departments/new?churchCode=${createdChurch.code}`);
  };

  const handleContinue = () => {
    setShowSuccessDialog(false);
    navigate('/dashboard');
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
            <LeviLogo className="transition-all duration-300 group-hover:scale-110 group-hover:shadow-glow" />
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
              Cadastrar sua Igreja
            </h1>
            <p className="text-muted-foreground">
              Cadastre sua igreja para começar a criar departamentos e escalas
            </p>
          </div>

          {/* Info Alert */}
          <Alert className="mb-6 border-primary/20 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm text-muted-foreground">
              Após o cadastro, enviaremos um email com o link para criar os departamentos/ministérios da sua igreja. 
              Dentro de cada departamento você poderá convidar os voluntários.
              <br />
              <strong className="text-foreground">Atenção:</strong> igrejas sem departamentos criados em até 5 dias serão removidas automaticamente.
            </AlertDescription>
          </Alert>

          {/* Form */}
          <div className="animate-fade-in glass rounded-2xl p-6 border border-border/50" style={{ animationDelay: '0.1s' }}>
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
            </form>
          </div>
        </div>
      </main>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              Igreja Cadastrada!
            </DialogTitle>
            <DialogDescription className="text-center">
              Sua igreja <strong>{createdChurch?.name}</strong> foi cadastrada com sucesso!
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <Alert className="border-primary/20 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                Enviamos um email para o endereço da igreja com o <strong>link para criar departamentos</strong>. 
                Use esse link para criar os ministérios (Louvor, Mídia, etc.). 
                Dentro de cada departamento você terá um link para convidar voluntários.
              </AlertDescription>
            </Alert>

            <Alert className="border-amber-500/20 bg-amber-500/5">
              <AlertDescription className="text-sm text-amber-700 dark:text-amber-400">
                ⚠️ Se nenhum departamento for criado em <strong>5 dias</strong>, a igreja será removida automaticamente.
              </AlertDescription>
            </Alert>
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              className="w-full gradient-primary text-primary-foreground"
              onClick={handleCreateDepartment}
            >
              Criar Departamento Agora
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button 
              variant="ghost"
              className="w-full"
              onClick={handleContinue}
            >
              Ir para o Dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
