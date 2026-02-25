import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Footer from '@/components/Footer';
import { ArrowLeft, Shield, ShieldOff, Loader2, AlertTriangle, Eye, EyeOff, Bell, BellOff, ChevronDown, ChevronUp, CalendarSync } from 'lucide-react';
import { TelegramLinkToggle } from '@/components/TelegramLinkToggle';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { useTwoFactor } from '@/hooks/useTwoFactor';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { TwoFactorSetup } from '@/components/auth/TwoFactorSetup';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import CalendarSyncDialog from '@/components/department/CalendarSyncDialog';
import ProfileAvatarUpload from '@/components/ProfileAvatarUpload';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Security() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isEnabled, isLoading: mfaLoading, checkFactors, disable2FA } = useTwoFactor();
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, permission: pushPermission, loading: pushLoading, subscribe: subscribePush, unsubscribe: unsubscribePush, recheckPermission } = usePushNotifications();
  const { toast } = useToast();
  
  const [showSetup, setShowSetup] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [shareContact, setShareContact] = useState(false);
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);
  const [showUnblockInstructions, setShowUnblockInstructions] = useState(false);
  const [showCalendarSync, setShowCalendarSync] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  // Fetch current privacy setting
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('share_contact, name, email, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      
      if (!error && data) {
        setShareContact(data.share_contact || false);
        setProfileName(data.name || '');
        setProfileEmail(data.email || '');
        setProfileAvatarUrl(data.avatar_url || null);
      }
    };
    
    fetchProfile();
  }, [user]);

  const handlePrivacyToggle = async (checked: boolean) => {
    setIsUpdatingPrivacy(true);
    
    const { error } = await supabase.rpc('update_contact_privacy', { share: checked });
    
    setIsUpdatingPrivacy(false);
    
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar a configuração de privacidade.',
      });
      return;
    }
    
    setShareContact(checked);
    toast({
      title: checked ? 'Contato compartilhado' : 'Contato oculto',
      description: checked 
        ? 'Membros do seu departamento agora podem ver seu email e WhatsApp.'
        : 'Seu email e WhatsApp estão ocultos para outros membros.',
    });
  };

  // Loading state - ProtectedRoute ensures user exists when not loading
  if (authLoading || mfaLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleDisable2FA = async () => {
    setIsDisabling(true);
    const { error } = await disable2FA();
    setIsDisabling(false);
    setShowDisableDialog(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível desativar o 2FA. Tente novamente.',
      });
      return;
    }

    toast({
      title: '2FA Desativado',
      description: 'A autenticação de dois fatores foi removida da sua conta.',
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container max-w-2xl py-8 px-4 flex-1">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => navigate('/dashboard')}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Voltar</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
            <p className="text-muted-foreground">Gerencie as configurações de segurança e privacidade da sua conta</p>
          </div>
        </div>

        {/* Profile Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Meu Perfil</CardTitle>
            <CardDescription>Altere sua foto de perfil</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-5">
              {user && (
                <ProfileAvatarUpload
                  userId={user.id}
                  currentAvatarUrl={profileAvatarUrl}
                  userName={profileName || user.email || ''}
                  size="lg"
                  onAvatarUpdated={(url) => setProfileAvatarUrl(url)}
                />
              )}
              <div>
                <p className="font-medium text-foreground text-lg">{profileName || 'Sem nome'}</p>
                <p className="text-sm text-muted-foreground">{profileEmail || user?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>


        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isEnabled ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
              }`}>
                {isEnabled ? <Shield className="w-5 h-5" /> : <ShieldOff className="w-5 h-5" />}
              </div>
              <div>
                <CardTitle className="text-lg">Autenticação de dois fatores (2FA)</CardTitle>
                <CardDescription>
                  {isEnabled 
                    ? 'Sua conta está protegida com 2FA' 
                    : 'Adicione uma camada extra de segurança'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50">
              {isEnabled ? (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                  <div>
                    <p className="font-medium text-foreground">2FA está ativo</p>
                    <p className="text-sm text-muted-foreground">
                      Ao fazer login, você precisará inserir um código do seu aplicativo autenticador.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">2FA não está configurado</p>
                    <p className="text-sm text-muted-foreground">
                      Recomendamos ativar a autenticação de dois fatores para maior segurança.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              {isEnabled ? (
                <Button 
                  variant="destructive" 
                  onClick={() => setShowDisableDialog(true)}
                >
                  Desativar 2FA
                </Button>
              ) : (
                <Button 
                  onClick={() => setShowSetup(true)}
                  className="gradient-vibrant text-white"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Ativar 2FA
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Privacy Card */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                shareContact ? 'bg-blue-500/10 text-blue-500' : 'bg-muted text-muted-foreground'
              }`}>
                {shareContact ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">Privacidade de contato</CardTitle>
                <CardDescription>
                  Controle quem pode ver seu email e WhatsApp
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex-1">
                <p className="font-medium text-foreground">
                  {shareContact ? 'Contato visível' : 'Contato oculto'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {shareContact 
                    ? 'Membros do seu departamento podem ver seu email e WhatsApp.'
                    : 'Seu email e WhatsApp estão ocultos para outros membros.'}
                </p>
              </div>
              <Switch
                checked={shareContact}
                onCheckedChange={handlePrivacyToggle}
                disabled={isUpdatingPrivacy}
              />
            </div>
            
            <p className="text-xs text-muted-foreground">
              Essa configuração afeta apenas a visibilidade para outros membros dos seus departamentos. 
              Líderes de departamento sempre podem ver informações de contato para fins de coordenação.
            </p>

            <div className="flex justify-end">
              <Button
                variant={shareContact ? "outline" : "default"}
                size="sm"
                onClick={() => handlePrivacyToggle(!shareContact)}
                disabled={isUpdatingPrivacy}
              >
                {isUpdatingPrivacy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {shareContact ? (
                  <>
                    <EyeOff className="w-4 h-4 mr-2" />
                    Ocultar meu contato
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Compartilhar meu contato
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Push Notifications Card */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                pushSubscribed ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
              }`}>
                {pushSubscribed ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">Notificações Push</CardTitle>
                <CardDescription>
                  Receba alertas de escalas diretamente no seu dispositivo
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!pushSupported ? (
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Navegador não suportado</p>
                    <p className="text-sm text-muted-foreground">
                      Seu navegador não suporta notificações push. Tente usar Chrome, Firefox, Edge ou Safari.
                    </p>
                  </div>
                </div>
              </div>
            ) : pushPermission === 'denied' && window.self === window.top ? (
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-destructive/10">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Permissão bloqueada</p>
                      <p className="text-sm text-muted-foreground">
                        Você bloqueou as notificações. Altere nas configurações do navegador e clique em "Tentar novamente".
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      recheckPermission();
                      subscribePush();
                    }}
                    disabled={pushLoading}
                  >
                    {pushLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Bell className="w-4 h-4 mr-2" />}
                    Tentar novamente
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowUnblockInstructions(!showUnblockInstructions)}
                  >
                    {showUnblockInstructions ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                    Como desbloquear
                  </Button>
                </div>
                {showUnblockInstructions && (
                  <div className="p-4 rounded-lg bg-muted/50 space-y-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Passo a passo:</p>
                    <div>
                      <p className="font-medium text-foreground">Chrome / Edge:</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Clique no ícone de cadeado 🔒 na barra de endereços</li>
                        <li>Encontre "Notificações"</li>
                        <li>Altere para "Permitir"</li>
                        <li>Recarregue a página</li>
                      </ol>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Firefox:</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Clique no ícone de cadeado 🔒 na barra de endereços</li>
                        <li>Clique em "Limpar permissão" ao lado de Notificações</li>
                        <li>Recarregue a página</li>
                      </ol>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Safari (iPhone/Mac):</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Vá em Ajustes &gt; Safari &gt; Notificações</li>
                        <li>Encontre este site e ative as notificações</li>
                        <li>Volte e recarregue a página</li>
                      </ol>
                    </div>
                    <p className="text-xs">Após alterar a permissão, clique em "Tentar novamente" acima.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`w-2 h-2 rounded-full mt-2 ${pushSubscribed ? 'bg-green-500' : 'bg-destructive'}`} />
                  <div>
                    <p className="font-medium text-foreground">
                      {pushSubscribed ? '✅ Notificações ativas' : '❌ Notificações desativadas'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {pushSubscribed 
                        ? 'Você receberá alertas sobre novas escalas, lembretes e trocas.'
                        : 'Ative o botão ao lado para receber alertas no seu dispositivo.'}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={pushSubscribed}
                  onCheckedChange={(checked) => checked ? subscribePush() : unsubscribePush()}
                  disabled={pushLoading}
                />
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              Você receberá alertas de: novas escalas, 
              lembretes 48h e 2h antes, e atualizações de trocas de escala.
            </p>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-yellow-600 dark:text-yellow-400">Notificações via WhatsApp em desenvolvimento.</span>{' '}
                Por enquanto, ative as notificações push ou conecte seu Telegram para receber alertas.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Telegram Card */}
        <div className="mt-6">
          <TelegramLinkToggle />
        </div>

        {/* Calendar Sync Card */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-500">
                <CalendarSync className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">Sincronizar Calendário</CardTitle>
                <CardDescription>
                  Sincronize suas escalas com Google Calendar ou Apple Calendar
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-3">
                Gere um link de assinatura para manter suas escalas sempre atualizadas no seu calendário favorito.
              </p>
              <Button onClick={() => setShowCalendarSync(true)} className="gap-2">
                <CalendarSync className="w-4 h-4" />
                Configurar sincronização
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info Section */}
        <div className="mt-8 p-4 rounded-lg border border-border bg-card">
          <h3 className="font-medium text-foreground mb-2">Como funciona o 2FA?</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary">1.</span>
              Você usa um aplicativo autenticador (Google Authenticator, Authy, etc.)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">2.</span>
              Ao fazer login, além da senha, você insere um código do aplicativo
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">3.</span>
              O código muda a cada 30 segundos, tornando o login mais seguro
            </li>
          </ul>
        </div>
      </div>

      <Footer />

      {/* Setup Dialog */}
      <TwoFactorSetup 
        open={showSetup}
        onOpenChange={setShowSetup}
        onComplete={checkFactors}
      />

      {/* Calendar Sync Dialog */}
      <CalendarSyncDialog
        open={showCalendarSync}
        onOpenChange={setShowCalendarSync}
      />

      {/* Disable Confirmation Dialog */}
      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar autenticação de dois fatores?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso tornará sua conta menos segura. Qualquer pessoa com sua senha poderá acessar sua conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisabling}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDisable2FA}
              disabled={isDisabling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDisabling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Desativando...
                </>
              ) : (
                'Sim, desativar 2FA'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
