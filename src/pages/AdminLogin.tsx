import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Shield, Loader2, AlertTriangle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const ADMIN_EMAIL = 'leviescalas@gmail.com';

export default function AdminLogin() {
  const { user, session, loading, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showUnauthorized, setShowUnauthorized] = useState(false);

  useEffect(() => {
    if (loading) return;
    
    // If user is logged in
    if (user && session) {
      const userEmail = user.email?.toLowerCase();
      
      // If it's the admin, redirect to admin panel
      if (userEmail === ADMIN_EMAIL.toLowerCase()) {
        navigate('/admin', { replace: true });
        return;
      }
      
      // If it's not the admin, show unauthorized message
      setShowUnauthorized(true);
    }
  }, [user, session, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Preencha email e senha.',
      });
      return;
    }

    // Check if it's the admin email BEFORE attempting login
    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      toast({
        variant: 'destructive',
        title: 'Acesso Negado',
        description: 'Esta área é restrita ao administrador do sistema.',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Erro no login',
          description: error.message || 'Credenciais inválidas.',
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível fazer login. Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setShowUnauthorized(false);
    setEmail('');
    setPassword('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show unauthorized screen for non-admin users
  if (showUnauthorized && user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-destructive" />
              </div>
              <span className="font-display text-xl font-bold text-foreground">LEVI Admin</span>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center pt-16 px-4">
          <div className="w-full max-w-md">
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle className="text-lg font-semibold">Acesso Não Autorizado</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="mb-4">
                  Você está logado como <strong>{user.email}</strong>, mas esta área é restrita apenas ao administrador do sistema.
                </p>
                <p className="text-sm opacity-80">
                  Se você é um voluntário ou líder de departamento, utilize o código da sua igreja para acessar o sistema através do link fornecido pelo administrador.
                </p>
              </AlertDescription>
            </Alert>

            <Button 
              onClick={handleLogout}
              variant="outline"
              className="w-full"
            >
              Sair desta conta
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl gradient-vibrant flex items-center justify-center shadow-glow-sm">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xl font-bold text-foreground">LEVI</span>
              <span className="hidden md:inline text-sm text-muted-foreground border-l border-border pl-2">
                Painel Administrativo
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
                <Lock className="w-4 h-4" />
                <span>Área Restrita</span>
              </div>
              
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Painel <span className="text-gradient-vibrant">Administrativo</span>
              </h1>
              
              <p className="text-muted-foreground">
                Acesso exclusivo para o administrador do sistema LEVI.
              </p>
            </div>

            {/* Login Form Card */}
            <div className="glass rounded-2xl p-6 sm:p-8 border border-border/50 shadow-xl">
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    Email do Administrador
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12"
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12"
                    autoComplete="current-password"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 gradient-vibrant text-white shadow-glow-sm hover:shadow-glow transition-all"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      <Shield className="w-5 h-5 mr-2" />
                      Acessar Painel Admin
                    </>
                  )}
                </Button>
              </form>
            </div>

            {/* Footer info */}
            <p className="text-center text-sm text-muted-foreground mt-6">
              Este painel é exclusivo para o administrador responsável pelo cadastro de igrejas.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
