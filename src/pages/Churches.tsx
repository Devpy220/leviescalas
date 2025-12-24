import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Footer from '@/components/Footer';
import { 
  ArrowLeft, 
  Plus, 
  Church, 
  Copy, 
  Users, 
  Building2,
  Loader2,
  MapPin,
  ChevronRight,
  Crown
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

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

type ChurchForm = z.infer<typeof churchSchema>;

interface ChurchData {
  id: string;
  name: string;
  description: string | null;
  code: string;
  leader_id: string;
  address: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
  department_count?: number;
}

export default function Churches() {
  const [churches, setChurches] = useState<ChurchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<ChurchForm>({
    resolver: zodResolver(churchSchema),
    defaultValues: { name: '', description: '', address: '', city: '', state: '' },
  });

  useEffect(() => {
    if (authLoading || adminLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    // Only admins can access this page
    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Acesso negado',
        description: 'Apenas administradores podem cadastrar igrejas.',
      });
      navigate('/dashboard');
      return;
    }
    fetchChurches();
  }, [user, authLoading, isAdmin, adminLoading]);

  const fetchChurches = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('churches')
        .select('*')
        .eq('leader_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get department counts for each church
      const churchesWithCounts = await Promise.all(
        (data || []).map(async (church) => {
          const { count } = await supabase
            .from('departments')
            .select('*', { count: 'exact', head: true })
            .eq('church_id', church.id);
          
          return {
            ...church,
            department_count: count || 0
          };
        })
      );

      setChurches(churchesWithCounts);
    } catch (error) {
      console.error('Error fetching churches:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar igrejas',
        description: 'Tente recarregar a página.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: ChurchForm) => {
    if (!user) return;
    
    setIsCreating(true);
    
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

      setChurches(prev => [{ ...newChurch, department_count: 0 }, ...prev]);
      setDialogOpen(false);
      form.reset();
    } catch (error) {
      console.error('Error creating church:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar igreja',
        description: 'Tente novamente.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: 'Código copiado!',
      description: 'Compartilhe com os líderes de departamento.',
    });
  };

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link 
            to="/dashboard" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Voltar</span>
          </Link>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground shadow-glow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Nova Igreja
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Church className="w-5 h-5 text-primary" />
                  Cadastrar Nova Igreja
                </DialogTitle>
                <DialogDescription>
                  Preencha os dados da igreja. Um código único será gerado automaticamente.
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Igreja *</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Igreja Batista Central"
                    {...form.register('name')}
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    placeholder="Descrição breve da igreja..."
                    {...form.register('description')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      placeholder="Ex: São Paulo"
                      {...form.register('city')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">Estado</Label>
                    <Input
                      id="state"
                      placeholder="Ex: SP"
                      {...form.register('state')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    placeholder="Rua, número, bairro..."
                    {...form.register('address')}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 gradient-primary text-primary-foreground"
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Criando...
                      </>
                    ) : (
                      'Cadastrar'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex-1">
        {/* Title */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-glow">
            <Church className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            Minhas Igrejas
          </h1>
          <p className="text-muted-foreground">
            Gerencie suas igrejas e compartilhe o código com líderes de departamento
          </p>
        </div>

        {/* Churches Grid */}
        {churches.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-display text-xl font-semibold text-foreground mb-2">
              Nenhuma igreja cadastrada
            </h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Cadastre sua primeira igreja para começar a organizar os departamentos.
            </p>
            <Button 
              onClick={() => setDialogOpen(true)}
              className="gradient-primary text-primary-foreground shadow-glow-sm"
            >
              <Plus className="w-5 h-5 mr-2" />
              Cadastrar Igreja
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {churches.map((church) => (
              <Link key={church.id} to={`/churches/${church.id}`}>
                <div className="relative group h-full">
                  <div className="absolute inset-0 gradient-primary rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity" />
                  <div className="relative glass rounded-2xl p-6 border border-border/50 hover:border-primary/50 transition-all hover-lift h-full">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow-sm">
                        <Church className="w-6 h-6 text-primary-foreground" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-primary" />
                        <span className="text-xs text-muted-foreground">Líder</span>
                      </div>
                    </div>

                    <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                      {church.name}
                    </h3>
                    
                    {(church.city || church.state) && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{[church.city, church.state].filter(Boolean).join(', ')}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="w-4 h-4" />
                          <span>{church.department_count} departamentos</span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>

                    {/* Church Code */}
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Código da Igreja</p>
                          <code className="text-sm font-mono font-bold text-primary">{church.code}</code>
                        </div>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.preventDefault();
                            copyCode(church.code);
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
}
