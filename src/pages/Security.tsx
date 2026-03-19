import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Footer from '@/components/Footer';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { useSidebarExpanded } from '@/contexts/SidebarContext';
import { useAdmin } from '@/hooks/useAdmin';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useIsMobile } from '@/hooks/use-mobile';
import { ArrowLeft, Shield, ShieldOff, Loader2, AlertTriangle, Eye, EyeOff, CalendarSync, Pencil, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { useTwoFactor } from '@/hooks/useTwoFactor';
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
  const { user, loading: authLoading, signOut } = useAuth();
  const { isEnabled, isLoading: mfaLoading, checkFactors, disable2FA } = useTwoFactor();
  const { toast } = useToast();
  const { isAdmin } = useAdmin();
  const { shouldShowInstallPrompt, install } = usePWAInstall();
  const isMobile = useIsMobile();
  const { expanded: sidebarExpanded } = useSidebarExpanded();
  const [showSetup, setShowSetup] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [shareContact, setShareContact] = useState(false);
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);
  const [showCalendarSync, setShowCalendarSync] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileWhatsapp, setProfileWhatsapp] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('share_contact, name, email, avatar_url, whatsapp')
        .eq('id', user.id)
        .maybeSingle();
      if (!error && data) {
        setShareContact(data.share_contact || false);
        setProfileName(data.name || '');
        setProfileEmail(data.email || '');
        setProfileWhatsapp(data.whatsapp || '');
        setProfileAvatarUrl(data.avatar_url || null);
      }
    };
    fetchProfile();
  }, [user]);

  const startEditingProfile = () => {
    setEditName(profileName);
    setEditEmail(profileEmail);
    setEditWhatsapp(profileWhatsapp);
    setIsEditingProfile(true);
  };

  const cancelEditingProfile = () => setIsEditingProfile(false);

  const saveProfile = async () => {
    if (!user) return;
    if (!editName.trim() || !editEmail.trim() || !editWhatsapp.trim()) {
      toast({ variant: 'destructive', title: 'Campos obrigatórios', description: 'Nome, email e WhatsApp não podem estar vazios.' });
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase.from('profiles').update({ name: editName.trim(), email: editEmail.trim(), whatsapp: editWhatsapp.trim() }).eq('id', user.id);
    setSavingProfile(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: 'Não foi possível atualizar seu perfil.' });
      return;
    }
    setProfileName(editName.trim());
    setProfileEmail(editEmail.trim());
    setProfileWhatsapp(editWhatsapp.trim());
    setIsEditingProfile(false);
    toast({ title: 'Perfil atualizado', description: 'Suas informações foram salvas com sucesso.' });
  };

  const handlePrivacyToggle = async (checked: boolean) => {
    setIsUpdatingPrivacy(true);
    const { error } = await supabase.rpc('update_contact_privacy', { share: checked });
    setIsUpdatingPrivacy(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar a configuração de privacidade.' });
      return;
    }
    setShareContact(checked);
    toast({
      title: checked ? 'Contato compartilhado' : 'Contato oculto',
      description: checked ? 'Membros do seu departamento agora podem ver seu email e WhatsApp.' : 'Seu email e WhatsApp estão ocultos para outros membros.',
    });
  };

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
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível desativar o 2FA. Tente novamente.' });
      return;
    }
    toast({ title: '2FA Desativado', description: 'A autenticação de dois fatores foi removida da sua conta.' });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <DashboardSidebar
        isAdmin={isAdmin}
        shouldShowInstallPrompt={shouldShowInstallPrompt()}
        onInstallClick={install}
        onSignOut={handleSignOut}
      />
      <div className={`${sidebarExpanded ? 'ml-56' : 'ml-16'} flex-1 flex flex-col transition-all duration-300`}>
      <div className="container max-w-2xl py-8 px-4 flex-1">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">Gerencie as configurações de segurança e privacidade da sua conta</p>
        </div>

        {/* Profile Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Meu Perfil</CardTitle>
                <CardDescription>Gerencie sua foto e informações pessoais</CardDescription>
              </div>
              {!isEditingProfile ? (
                <Button variant="outline" size="sm" onClick={startEditingProfile}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={cancelEditingProfile} disabled={savingProfile}>
                    <X className="w-4 h-4" />
                  </Button>
                  <Button size="sm" onClick={saveProfile} disabled={savingProfile}>
                    {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                    {savingProfile ? '' : 'Salvar'}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-5">
              {user && (
                <ProfileAvatarUpload
                  userId={user.id}
                  currentAvatarUrl={profileAvatarUrl}
                  userName={profileName || user.email || ''}
                  size="lg"
                  onAvatarUpdated={(url) => setProfileAvatarUrl(url)}
                />
              )}
              {isEditingProfile ? (
                <div className="flex-1 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nome</Label>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Seu nome" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="seu@email.com" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">WhatsApp</Label>
                    <Input value={editWhatsapp} onChange={(e) => setEditWhatsapp(e.target.value)} placeholder="11999999999" />
                  </div>
                </div>
              ) : (
                <div className="flex-1">
                  <p className="font-medium text-foreground text-lg">{profileName || 'Sem nome'}</p>
                  <p className="text-sm text-muted-foreground">{profileEmail || user?.email}</p>
                  {profileWhatsapp && <p className="text-sm text-muted-foreground mt-0.5">📱 {profileWhatsapp}</p>}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 2FA Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isEnabled ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                {isEnabled ? <Shield className="w-5 h-5" /> : <ShieldOff className="w-5 h-5" />}
              </div>
              <div>
                <CardTitle className="text-lg">Autenticação de dois fatores (2FA)</CardTitle>
                <CardDescription>{isEnabled ? 'Sua conta está protegida com 2FA' : 'Adicione uma camada extra de segurança'}</CardDescription>
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
                    <p className="text-sm text-muted-foreground">Ao fazer login, você precisará inserir um código do seu aplicativo autenticador.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">2FA não está configurado</p>
                    <p className="text-sm text-muted-foreground">Recomendamos ativar a autenticação de dois fatores para maior segurança.</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              {isEnabled ? (
                <Button variant="destructive" onClick={() => setShowDisableDialog(true)}>Desativar 2FA</Button>
              ) : (
                <Button onClick={() => setShowSetup(true)} className="gradient-vibrant text-white">
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
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${shareContact ? 'bg-blue-500/10 text-blue-500' : 'bg-muted text-muted-foreground'}`}>
                {shareContact ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">Privacidade de contato</CardTitle>
                <CardDescription>Controle quem pode ver seu email e WhatsApp</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex-1">
                <p className="font-medium text-foreground">{shareContact ? 'Contato visível' : 'Contato oculto'}</p>
                <p className="text-sm text-muted-foreground">
                  {shareContact ? 'Membros do seu departamento podem ver seu email e WhatsApp.' : 'Seu email e WhatsApp estão ocultos para outros membros.'}
                </p>
              </div>
              <Switch checked={shareContact} onCheckedChange={handlePrivacyToggle} disabled={isUpdatingPrivacy} />
            </div>
            <p className="text-xs text-muted-foreground">
              Essa configuração afeta apenas a visibilidade para outros membros dos seus departamentos. 
              Líderes de departamento sempre podem ver informações de contato para fins de coordenação.
            </p>
            <div className="flex justify-end">
              <Button variant={shareContact ? "outline" : "default"} size="sm" onClick={() => handlePrivacyToggle(!shareContact)} disabled={isUpdatingPrivacy}>
                {isUpdatingPrivacy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {shareContact ? <><EyeOff className="w-4 h-4 mr-2" />Ocultar meu contato</> : <><Eye className="w-4 h-4 mr-2" />Compartilhar meu contato</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Calendar Sync Card */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-500">
                <CalendarSync className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">Sincronizar Calendário</CardTitle>
                <CardDescription>Sincronize suas escalas com Google Calendar ou Apple Calendar</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-3">Gere um link de assinatura para manter suas escalas sempre atualizadas no seu calendário favorito.</p>
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
            <li className="flex items-start gap-2"><span className="text-primary">1.</span>Você usa um aplicativo autenticador (Google Authenticator, Authy, etc.)</li>
            <li className="flex items-start gap-2"><span className="text-primary">2.</span>Ao fazer login, além da senha, você insere um código do aplicativo</li>
            <li className="flex items-start gap-2"><span className="text-primary">3.</span>O código muda a cada 30 segundos, tornando o login mais seguro</li>
          </ul>
        </div>
      </div>

      <Footer />

      <TwoFactorSetup open={showSetup} onOpenChange={setShowSetup} onComplete={checkFactors} />
      <CalendarSyncDialog open={showCalendarSync} onOpenChange={setShowCalendarSync} />

      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar autenticação de dois fatores?</AlertDialogTitle>
            <AlertDialogDescription>Isso tornará sua conta menos segura. Qualquer pessoa com sua senha poderá acessar sua conta.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisabling}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisable2FA} disabled={isDisabling} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDisabling ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Desativando...</> : 'Sim, desativar 2FA'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </div>
  );
}
