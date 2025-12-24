import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, Shield, Loader2, AlertTriangle, Lock, UserPlus, KeyRound, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

// Admin access is controlled by server-side has_role() function

export default function AdminLogin() {
  const { user, session, loading, signIn, signUp, signOut, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showUnauthorized, setShowUnauthorized] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'signup' | 'reset'>('login');
  const [isResetMode, setIsResetMode] = useState(false);

  useEffect(() => {
    // Check if we're in password reset mode (coming from email link)
    const isReset = searchParams.get('reset') === 'true';
    if (isReset) {
      setIsResetMode(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (loading) return;
    
    // If user is logged in
    if (user && session) {
      // If in reset mode, allow user to set new password
      if (isResetMode) return;
      
      // Redirect to admin panel - the Admin page will verify admin role
      navigate('/admin', { replace: true });
    }
  }, [user, session, loading, navigate, isResetMode]);

  // Note: Admin validation is done server-side via has_role() after login
  // No client-side email validation needed - the server will reject unauthorized access

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailValue = email.trim();
    const passwordValue = password.trim();

    if (!emailValue || !passwordValue) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Preencha email e senha.',
      });
      return;
    }

    // No client-side email validation - server will validate via has_role() after login

    setIsLoading(true);

    try {
      const { error } = await signIn(emailValue, passwordValue);

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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailValue = email.trim();
    
    if (!emailValue) {
      toast({
        variant: 'destructive',
        title: 'Email obrigatório',
        description: 'Preencha o email para criar a conta.',
      });
      return;
    }
    
    if (!password.trim() || !confirmPassword.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Preencha a senha e a confirmação.',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Senhas não conferem',
        description: 'A senha e a confirmação devem ser iguais.',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Server-side ensure_admin_role will grant admin only if email matches
      const { error } = await signUp(emailValue, password, 'Administrador LEVI', '');
      
      if (error) {
        if (error.message?.includes('already registered')) {
          toast({
            variant: 'destructive',
            title: 'Email já cadastrado',
            description: 'Este email já possui uma conta. Use a aba "Entrar" para fazer login.',
          });
          setActiveTab('login');
        } else {
          toast({
            variant: 'destructive',
            title: 'Erro no cadastro',
            description: error.message || 'Não foi possível criar a conta.',
          });
        }
      } else {
        toast({
          title: 'Conta criada com sucesso!',
          description: 'Você já pode acessar o painel administrativo.',
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível criar a conta. Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailValue = email.trim();
    
    if (!emailValue) {
      toast({
        variant: 'destructive',
        title: 'Email obrigatório',
        description: 'Preencha o email para recuperar a senha.',
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { error } = await resetPassword(emailValue);
      
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: error.message || 'Não foi possível enviar o email de recuperação.',
        });
      } else {
        toast({
          title: 'Email enviado!',
          description: `Um link para redefinir a senha foi enviado para ${emailValue}`,
        });
        setActiveTab('login');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível enviar o email. Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword.trim() || !confirmNewPassword.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Preencha a nova senha e a confirmação.',
      });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast({
        variant: 'destructive',
        title: 'Senhas não conferem',
        description: 'A nova senha e a confirmação devem ser iguais.',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: error.message || 'Não foi possível atualizar a senha.',
        });
      } else {
        toast({
          title: 'Senha atualizada!',
          description: 'Sua nova senha foi definida com sucesso.',
        });
        setIsResetMode(false);
        navigate('/admin', { replace: true });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar a senha. Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setShowUnauthorized(false);
    setIsResetMode(false);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show password update screen when in reset mode and user is authenticated
  if (isResetMode && user && session) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl gradient-vibrant flex items-center justify-center shadow-glow-sm transition-transform group-hover:scale-110">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <span className="font-display text-xl font-bold text-foreground">LEVI</span>
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center pt-16 px-4">
          <div className="w-full max-w-md">
            <div className="absolute inset-0 mesh-gradient mesh-gradient-animated opacity-50" />
            <div className="absolute inset-0 gradient-radial opacity-40" />
            
            <div className="relative">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 border border-primary/20">
                  <KeyRound className="w-4 h-4" />
                  <span>Redefinir Senha</span>
                </div>
                
                <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
                  Nova <span className="text-gradient-vibrant">Senha</span>
                </h1>
                
                <p className="text-muted-foreground">
                  Digite sua nova senha para acessar o painel administrativo.
                </p>
              </div>

              <div className="glass rounded-2xl p-6 sm:p-8 border border-border/50 shadow-xl">
                <form onSubmit={handleUpdatePassword} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nova Senha</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-12"
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-new-password">Confirmar Nova Senha</Label>
                    <Input
                      id="confirm-new-password"
                      type="password"
                      placeholder="Digite a senha novamente"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="h-12"
                      autoComplete="new-password"
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
                        Atualizando...
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-5 h-5 mr-2" />
                        Atualizar Senha
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Show unauthorized screen for non-admin users
  if (showUnauthorized && user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center transition-transform group-hover:scale-110">
                <Shield className="w-5 h-5 text-destructive" />
              </div>
              <span className="font-display text-xl font-bold text-foreground">LEVI Admin</span>
            </Link>
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
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl gradient-vibrant flex items-center justify-center shadow-glow-sm transition-transform group-hover:scale-110">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xl font-bold text-foreground">LEVI</span>
              <span className="hidden md:inline text-sm text-muted-foreground border-l border-border pl-2">
                Painel Administrativo
              </span>
            </div>
          </Link>
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

            {/* Login/Signup Form Card */}
            <div className="glass rounded-2xl p-6 sm:p-8 border border-border/50 shadow-xl">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'signup' | 'reset')} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="login" className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Entrar
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Criar
                  </TabsTrigger>
                  <TabsTrigger value="reset" className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    Esqueci
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary" />
                        Email do Administrador
                      </Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="exemplo@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12"
                        autoComplete="email"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password">Senha</Label>
                      <Input
                        id="login-password"
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
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-6">
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 mb-2">
                      <p className="text-sm text-foreground">
                        <Shield className="w-4 h-4 text-primary inline mr-2" />
                        Crie uma senha para acessar o painel administrativo.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Criar Senha</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-12"
                        autoComplete="new-password"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirmar Senha</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="Digite a senha novamente"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-12"
                        autoComplete="new-password"
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
                          Criando conta...
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-5 h-5 mr-2" />
                          Criar Conta Admin
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="reset">
                  <form onSubmit={handleResetPassword} className="space-y-6">
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-sm text-foreground">
                        <Mail className="w-4 h-4 text-primary inline mr-2" />
                        Clique abaixo para receber um link de recuperação de senha.
                      </p>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Clique no botão abaixo para receber um email com o link para redefinir sua senha.
                    </p>

                    <Button 
                      type="submit" 
                      className="w-full h-12 gradient-vibrant text-white shadow-glow-sm hover:shadow-glow transition-all"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Mail className="w-5 h-5 mr-2" />
                          Enviar Link de Recuperação
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
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