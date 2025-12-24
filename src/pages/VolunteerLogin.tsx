import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, Loader2, LogIn, UserPlus, KeyRound, Mail, Eye, EyeOff, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PasswordStrengthIndicator, validatePasswordStrength } from '@/components/PasswordStrengthIndicator';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  whatsapp: z.string().min(10, 'WhatsApp inválido'),
  password: z.string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .refine((password) => validatePasswordStrength(password).isValid, {
      message: 'A senha não atende aos requisitos de segurança',
    }),
  confirmPassword: z.string(),
  churchCode: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não conferem',
  path: ['confirmPassword'],
});

const recoverySchema = z.object({
  email: z.string().email('Email inválido'),
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;
type RecoveryForm = z.infer<typeof recoverySchema>;

export default function VolunteerLogin() {
  const { user, session, loading, signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'recovery'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [churchValidated, setChurchValidated] = useState<{ valid: boolean; name: string | null; slug: string | null }>({ valid: false, name: null, slug: null });

  const churchCodeParam = searchParams.get('churchCode') || searchParams.get('code');
  const redirectParam = searchParams.get('redirect');

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { 
      name: '', 
      email: '', 
      whatsapp: '', 
      password: '', 
      confirmPassword: '',
      churchCode: churchCodeParam || '',
    },
  });

  const recoveryForm = useForm<RecoveryForm>({
    resolver: zodResolver(recoverySchema),
    defaultValues: { email: '' },
  });

  // Validate church code from URL
  useEffect(() => {
    const validateChurchCode = async (code: string) => {
      try {
        const { data, error } = await supabase.rpc('validate_church_code_secure', { p_code: code });
        if (!error && data && data.length > 0 && data[0].is_valid) {
          setChurchValidated({ valid: true, name: data[0].church_name, slug: null });
          registerForm.setValue('churchCode', code.toUpperCase());
          if (activeTab === 'login') {
            setActiveTab('register');
          }
        }
      } catch (err) {
        console.error('Error validating church code:', err);
      }
    };

    if (churchCodeParam) {
      validateChurchCode(churchCodeParam);
    }
  }, [churchCodeParam]);

  // Redirect authenticated users
  useEffect(() => {
    if (!loading && user && session) {
      const redirectTo = redirectParam || '/dashboard';
      navigate(redirectTo, { replace: true });
    }
  }, [user, session, loading, navigate, redirectParam]);

  const handleLogin = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const { error } = await signIn(data.email, data.password);
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
        description: 'Não foi possível fazer login.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      const { error } = await signUp(data.email, data.password, data.name, data.whatsapp);
      
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
          description: 'Bem-vindo ao LEVI!',
        });
        
        // Redirect based on context
        if (churchCodeParam) {
          navigate(`/departments/new?churchCode=${churchCodeParam.toUpperCase()}`);
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível criar a conta.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecovery = async (data: RecoveryForm) => {
    setIsLoading(true);
    try {
      const { error } = await resetPassword(data.email);
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: error.message || 'Não foi possível enviar o email.',
        });
      } else {
        toast({
          title: 'Email enviado!',
          description: 'Verifique sua caixa de entrada para redefinir a senha.',
        });
        setActiveTab('login');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível enviar o email.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
                Acesso Voluntários
              </span>
            </div>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center pt-16 px-4 py-8">
        <div className="w-full max-w-md">
          {/* Decorative background */}
          <div className="absolute inset-0 mesh-gradient mesh-gradient-animated opacity-50" />
          <div className="absolute inset-0 gradient-radial opacity-40" />
          
          <div className="relative">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 border border-primary/20">
                <Users className="w-4 h-4" />
                <span>Área do Voluntário</span>
              </div>
              
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Acesse sua <span className="text-gradient-vibrant">Conta</span>
              </h1>
              
              <p className="text-muted-foreground">
                Gerencie suas escalas e departamentos.
              </p>
            </div>

            {/* Form Card */}
            <div className="glass rounded-2xl p-6 sm:p-8 border border-border/50 shadow-xl">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'register' | 'recovery')} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="login" className="flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    Entrar
                  </TabsTrigger>
                  <TabsTrigger value="register" className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Criar
                  </TabsTrigger>
                  <TabsTrigger value="recovery" className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    Esqueci
                  </TabsTrigger>
                </TabsList>

                {/* Login Tab */}
                <TabsContent value="login">
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                  {...field}
                                  type="email"
                                  placeholder="seu@email.com"
                                  className="h-12 pl-10"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Senha</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  {...field}
                                  type={showPassword ? 'text' : 'password'}
                                  placeholder="••••••••"
                                  className="h-12 pr-10"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-0 top-0 h-12 w-12"
                                  onClick={() => setShowPassword(!showPassword)}
                                >
                                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </Button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

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
                            <LogIn className="w-5 h-5 mr-2" />
                            Entrar
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>

                {/* Register Tab */}
                <TabsContent value="register">
                  {/* Church Context Info */}
                  {churchValidated.valid && churchValidated.name && (
                    <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 mb-4 space-y-3">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">Criando conta para:</span>
                        <br />
                        <span className="text-primary font-semibold text-lg">{churchValidated.name}</span>
                      </p>
                      {churchCodeParam && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Código da Igreja</Label>
                          <Input
                            type="text"
                            value={churchCodeParam.toUpperCase()}
                            disabled
                            className="h-10 bg-muted/50 font-mono text-sm"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                      <FormField
                        control={registerForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome completo</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Seu nome" className="h-12" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" placeholder="seu@email.com" className="h-12" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="whatsapp"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>WhatsApp</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="(00) 00000-0000" className="h-12" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Senha</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  {...field}
                                  type={showPassword ? 'text' : 'password'}
                                  placeholder="Senha segura"
                                  className="h-12 pr-10"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-0 top-0 h-12 w-12"
                                  onClick={() => setShowPassword(!showPassword)}
                                >
                                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </Button>
                              </div>
                            </FormControl>
                            <PasswordStrengthIndicator password={field.value} showSecurityTips={false} />
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmar senha</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Digite a senha novamente"
                                className="h-12"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

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
                            Criar conta
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>

                {/* Recovery Tab */}
                <TabsContent value="recovery">
                  <Form {...recoveryForm}>
                    <form onSubmit={recoveryForm.handleSubmit(handleRecovery)} className="space-y-4">
                      <FormField
                        control={recoveryForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                  {...field}
                                  type="email"
                                  placeholder="seu@email.com"
                                  className="h-12 pl-10"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

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
                            Enviar email de recuperação
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </div>

            {/* Footer Links */}
            <div className="mt-6 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                É administrador?{' '}
                <Link to="/admin-login" className="text-primary hover:underline font-medium">
                  Acesse aqui
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
