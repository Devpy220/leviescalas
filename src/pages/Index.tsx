import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, Church, Sparkles } from 'lucide-react';
import { LeviLogo } from '@/components/LeviLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function Index() {
  const [churchCode, setChurchCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!churchCode.trim()) {
      toast({
        variant: 'destructive',
        title: 'Código obrigatório',
        description: 'Digite o código da sua igreja para continuar.',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.rpc('get_church_invite_info', { 
        p_code: churchCode.toUpperCase().trim() 
      });

      if (error) throw error;

      if (!data || data.length === 0 || !data[0].is_valid) {
        toast({
          variant: 'destructive',
          title: 'Código inválido',
          description: 'O código da igreja não foi encontrado. Verifique com o líder da sua igreja.',
        });
        setIsLoading(false);
        return;
      }

      // Redirect to church public page
      navigate(`/igreja/${data[0].church_slug}`);
    } catch (error) {
      console.error('Error validating church code:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível validar o código. Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LeviLogo />
            <div className="flex items-center gap-2">
              <span className="font-display text-xl font-bold text-foreground">LEVI</span>
              <span className="hidden md:inline text-sm text-muted-foreground border-l border-border pl-2">
                Logística de Escalas para Voluntários da Igreja
              </span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center pt-16 px-4">
        <div className="w-full max-w-md">
          {/* Decorative background */}
          <div className="absolute inset-0 mesh-gradient mesh-gradient-animated opacity-50" />
          <div className="absolute inset-0 gradient-radial opacity-40" />
          
          <div className="relative">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 border border-primary/20">
                <Sparkles className="w-4 h-4" />
                <span>Gestão de Escalas para Voluntários</span>
              </div>
              
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Bem-vindo ao <span className="text-gradient-vibrant">LEVI</span>
              </h1>
              
              <p className="text-muted-foreground">
                Digite o código da sua igreja para acessar o sistema.
              </p>
            </div>

            {/* Form Card */}
            <div className="glass rounded-2xl p-6 sm:p-8 border border-border/50 shadow-xl">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="church-code" className="flex items-center gap-2">
                    <Church className="w-4 h-4 text-primary" />
                    Código da Igreja
                  </Label>
                  <Input
                    id="church-code"
                    type="text"
                    placeholder="Ex: ABC12345"
                    value={churchCode}
                    onChange={(e) => setChurchCode(e.target.value.toUpperCase())}
                    className="h-12 text-center text-lg font-mono tracking-wider uppercase"
                    maxLength={20}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Solicite o código ao líder da sua igreja
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 gradient-vibrant text-white shadow-glow-sm hover:shadow-glow transition-all"
                  disabled={isLoading || !churchCode.trim()}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      Continuar
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            </div>

            {/* Footer info */}
            <p className="text-center text-sm text-muted-foreground mt-6">
              O código é fornecido pelo administrador da igreja após o cadastro.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
