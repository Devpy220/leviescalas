import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SEO } from '@/components/SEO';
import { 
  Church, 
  Loader2, 
  ArrowRight, 
  Mail,
  Phone,
  FileText,
  Info,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Link } from 'react-router-dom';
import { LeviLogo } from '@/components/LeviLogo';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChurchOnboardingGuide } from '@/components/ChurchOnboardingGuide';

// CNPJ validation algorithm
function isValidCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const calc = (str: string, weights: number[]) =>
    str.split('').reduce((sum, d, i) => sum + parseInt(d) * weights[i], 0);

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let r = calc(digits.slice(0, 12), w1) % 11;
  const d1 = r < 2 ? 0 : 11 - r;
  if (parseInt(digits[12]) !== d1) return false;

  r = calc(digits.slice(0, 13), w2) % 11;
  const d2 = r < 2 ? 0 : 11 - r;
  if (parseInt(digits[13]) !== d2) return false;

  return true;
}

function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

const churchSchema = z.object({
  registrantName: z.string().min(2, 'Nome do responsável é obrigatório').max(100),
  registrantEmail: z.string().email('Email inválido'),
  registrantPhone: z.string().min(10, 'Telefone inválido').max(20),
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100, 'Nome muito longo'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(10, 'Telefone inválido').max(20, 'Telefone inválido'),
  cnpj: z.string().trim().optional().nullable()
    .transform((v) => (v ?? '').trim())
    .refine((val) => val === '' || isValidCNPJ(val), 'CNPJ inválido — verifique os dígitos'),
  description: z.string().max(500, 'Descrição muito longa').optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Você deve aceitar os termos' }) }),
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
  const [whatsappStatus, setWhatsappStatus] = useState<'sent' | 'failed' | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();

  const churchForm = useForm<ChurchForm>({
    resolver: zodResolver(churchSchema),
    defaultValues: { 
      registrantName: '', registrantEmail: '', registrantPhone: '',
      name: '', email: '', phone: '', cnpj: '', description: '', 
      address: '', city: '', state: '', acceptTerms: undefined as any,
    },
  });

  const handleCreateChurch = async (data: ChurchForm) => {
    setIsLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('create-church-public', {
        body: {
          registrantName: data.registrantName,
          registrantEmail: data.registrantEmail,
          registrantPhone: data.registrantPhone,
          name: data.name,
          email: data.email,
          phone: data.phone,
          cnpj: data.cnpj || null,
          description: data.description || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
        },
      });

      if (error) throw error;
      if (!result?.ok) throw new Error(result?.error || 'Falha ao cadastrar igreja');

      setCreatedChurch({
        id: result.church.id,
        name: result.church.name,
        code: result.church.code,
      });
      setWhatsappStatus(result.whatsappSent ? 'sent' : 'failed');
      setShowSuccessDialog(true);
      toast({
        title: 'Igreja cadastrada!',
        description: result.whatsappSent
          ? 'O link de acesso foi enviado por WhatsApp.'
          : 'O link aparece no modal. Copie e envie manualmente se necessário.',
      });
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

  const handleFormInvalid = () => {
    toast({
      variant: 'destructive',
      title: 'Confira os campos obrigatórios',
      description: 'Preencha os dados destacados antes de cadastrar a igreja.',
    });
  };

  const handleClose = () => {
    setShowSuccessDialog(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Cadastrar minha Igreja — LEVI" description="Cadastre sua igreja gratuitamente no LEVI e comece a organizar escalas de voluntários em minutos." path="/church-setup" />
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
          <div className="text-center mb-8 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-glow">
              <Church className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground mb-2">
              Cadastrar sua Igreja
            </h1>
            <p className="text-muted-foreground">
              Cadastre apenas a igreja agora. O link para criar a conta e os departamentos será enviado pelo seu WhatsApp.
            </p>
          </div>

          <Alert className="mb-6 border-primary/20 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm text-muted-foreground">
              Após o cadastro, mostraremos um modal com o link e enviaremos esse link pelo WhatsApp do responsável.
              É por esse link que você cria sua conta e os departamentos.
              <br />
              <strong className="text-foreground">Atenção:</strong> igrejas sem departamentos criados em até 5 dias serão removidas automaticamente.
            </AlertDescription>
          </Alert>

          <div className="animate-fade-in glass rounded-2xl p-6 border border-border/50" style={{ animationDelay: '0.1s' }}>
            <form onSubmit={churchForm.handleSubmit(handleCreateChurch, handleFormInvalid)} className="space-y-6">
              
              <div className="space-y-4 pb-4 border-b border-border/50">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  Responsável pelo Cadastro
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="registrantName">Nome do Responsável *</Label>
                  <Input id="registrantName" placeholder="Seu nome completo" {...churchForm.register('registrantName')} />
                  {churchForm.formState.errors.registrantName && (
                    <p className="text-sm text-destructive">{churchForm.formState.errors.registrantName.message}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="registrantEmail">Email *</Label>
                    <Input id="registrantEmail" type="email" placeholder="seu@email.com" {...churchForm.register('registrantEmail')} />
                    {churchForm.formState.errors.registrantEmail && (
                      <p className="text-sm text-destructive">{churchForm.formState.errors.registrantEmail.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registrantPhone">WhatsApp *</Label>
                    <Input id="registrantPhone" placeholder="(11) 99999-9999" {...churchForm.register('registrantPhone')} />
                    {churchForm.formState.errors.registrantPhone && (
                      <p className="text-sm text-destructive">{churchForm.formState.errors.registrantPhone.message}</p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  O link de acesso será enviado para esse WhatsApp.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Church className="w-4 h-4 text-primary" />
                  Dados da Igreja
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Igreja *</Label>
                  <Input id="name" placeholder="Ex: Igreja Batista Central" {...churchForm.register('name')} className="h-12" />
                  {churchForm.formState.errors.name && (
                    <p className="text-sm text-destructive">{churchForm.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email da Igreja *
                    </Label>
                    <Input id="email" type="email" placeholder="contato@igreja.com" {...churchForm.register('email')} />
                    {churchForm.formState.errors.email && (
                      <p className="text-sm text-destructive">{churchForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Telefone *
                    </Label>
                    <Input id="phone" placeholder="(11) 99999-9999" {...churchForm.register('phone')} />
                    {churchForm.formState.errors.phone && (
                      <p className="text-sm text-destructive">{churchForm.formState.errors.phone.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cnpj" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    CNPJ <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                  </Label>
                  <Controller
                    name="cnpj"
                    control={churchForm.control}
                    render={({ field }) => (
                      <Input
                        id="cnpj"
                        placeholder="00.000.000/0000-00"
                        value={field.value}
                        onChange={(e) => field.onChange(formatCNPJ(e.target.value))}
                      />
                    )}
                  />
                  {churchForm.formState.errors.cnpj && (
                    <p className="text-sm text-destructive">{churchForm.formState.errors.cnpj.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea id="description" placeholder="Descrição breve da igreja..." {...churchForm.register('description')} className="min-h-[80px] resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input id="city" placeholder="Ex: São Paulo" {...churchForm.register('city')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">Estado</Label>
                    <Input id="state" placeholder="Ex: SP" {...churchForm.register('state')} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input id="address" placeholder="Rua, número, bairro..." {...churchForm.register('address')} />
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-border/50">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Ao cadastrar, você declara que os dados fornecidos são verdadeiros e de sua inteira responsabilidade. 
                    O <strong className="text-foreground">LEVI</strong> não se responsabiliza por informações incorretas, 
                    incompletas ou fornecidas por terceiros. O uso indevido dos dados é de responsabilidade exclusiva 
                    de quem realizou o cadastro.
                  </p>
                </div>

                <Controller
                  name="acceptTerms"
                  control={churchForm.control}
                  render={({ field }) => (
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="acceptTerms"
                        checked={field.value === true}
                        onCheckedChange={(checked) => field.onChange(checked === true ? true : undefined)}
                        className="mt-0.5"
                      />
                      <Label htmlFor="acceptTerms" className="text-sm text-muted-foreground cursor-pointer leading-tight">
                        Li e aceito os termos acima. Declaro que os dados são verdadeiros e assumo total responsabilidade.
                      </Label>
                    </div>
                  )}
                />
                {churchForm.formState.errors.acceptTerms && (
                  <p className="text-sm text-destructive">{churchForm.formState.errors.acceptTerms.message}</p>
                )}
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

      {createdChurch && (
        <ChurchOnboardingGuide
          open={showSuccessDialog}
          onOpenChange={(open) => { if (!open) handleClose(); }}
          churchName={createdChurch.name}
          churchCode={createdChurch.code}
          onClose={handleClose}
          onSendWhatsApp={whatsappStatus === 'sent' ? undefined : undefined}
        />
      )}
    </div>
  );
}
