import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Trash2, Users, Building2, ChevronDown, ChevronUp, Shield, LogOut, Church, Plus, Copy, Link as LinkIcon, Mail, ExternalLink, ChevronRight, Pencil, Upload, X, TrendingUp, Eye } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { slugify } from '@/lib/slugify';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
interface Department {
  id: string;
  name: string;
  description: string | null;
  leader_id: string;
  leader_name: string | null;
  member_count: number;
  created_at: string;
}

interface Member {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  joined_at: string;
}

interface Profile {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  created_at: string;
  invited_by_department_id: string | null;
  invited_by_department_name?: string | null;
  church_name?: string | null;
}

interface ChurchData {
  id: string;
  name: string;
  slug: string | null;
  code: string;
  city: string | null;
  state: string | null;
  address: string | null;
  logo_url: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
}

interface AnalyticsData {
  date: string;
  visitors: number;
  pageviews: number;
}

// Admin access is controlled by server-side has_role() function via useAdmin hook

export default function Admin() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, Member[]>>({});
  const [loadingMembers, setLoadingMembers] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState(false);
  const [deletingChurch, setDeletingChurch] = useState<string | null>(null);
  const [deletingVolunteer, setDeletingVolunteer] = useState<string | null>(null);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  
  // Churches state
  const [churches, setChurches] = useState<ChurchData[]>([]);
  const [loadingChurches, setLoadingChurches] = useState(true);
  const [showCreateChurch, setShowCreateChurch] = useState(false);
  const [creatingChurch, setCreatingChurch] = useState(false);
  const [newChurchName, setNewChurchName] = useState('');
  const [newChurchSlug, setNewChurchSlug] = useState('');
  const [newChurchCity, setNewChurchCity] = useState('');
  const [newChurchState, setNewChurchState] = useState('');
  const [newChurchEmail, setNewChurchEmail] = useState('');
  
  // Edit church state
  const [editingChurch, setEditingChurch] = useState<ChurchData | null>(null);
  const [showEditChurch, setShowEditChurch] = useState(false);
  const [savingChurch, setSavingChurch] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([]);
  const [totalVisitors, setTotalVisitors] = useState(0);
  const [totalPageviews, setTotalPageviews] = useState(0);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  useEffect(() => {
    if (authLoading || adminLoading) return;
    
    if (!user) {
      navigate('/admin-login');
      return;
    }
    
    // Server-side role check only (via useAdmin hook which uses has_role RPC)
    if (!isAdmin) {
      toast({
        title: 'Acesso Negado',
        description: 'Esta área é restrita ao administrador do sistema.',
        variant: 'destructive',
      });
      navigate('/admin-login');
      return;
    }

    fetchDepartments();
    fetchAllProfiles();
    fetchChurches();
    fetchAnalytics();
  }, [user, isAdmin, authLoading, adminLoading]);

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-analytics');
      
      if (error) throw error;
      
      if (data) {
        setAnalyticsData(data.dailyData || []);
        setTotalVisitors(data.totalVisitors || 0);
        setTotalPageviews(data.totalPageviews || 0);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      // Don't show error toast, just log it
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const fetchChurches = async () => {
    setLoadingChurches(true);
    try {
      const { data, error } = await supabase
        .from('churches')
        .select('id, name, slug, code, city, state, address, logo_url, description, phone, email, created_at')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setChurches(data || []);
    } catch (error) {
      console.error('Error fetching churches:', error);
    } finally {
      setLoadingChurches(false);
    }
  };

  const handleOpenEditChurch = (church: ChurchData) => {
    setEditingChurch({ ...church });
    setShowEditChurch(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !editingChurch) return;
    
    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Erro',
        description: 'Por favor, selecione uma imagem.',
        variant: 'destructive',
      });
      return;
    }

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${editingChurch.id}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('church-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('church-logos')
        .getPublicUrl(filePath);

      setEditingChurch(prev => prev ? { ...prev, logo_url: publicUrl } : null);
      
      toast({
        title: 'Logo carregado!',
        description: 'A imagem será salva ao confirmar a edição.',
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível fazer upload do logo.',
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleUpdateChurch = async () => {
    if (!editingChurch || !editingChurch.name.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome da igreja é obrigatório.',
        variant: 'destructive',
      });
      return;
    }

    setSavingChurch(true);
    try {
      const { error } = await supabase
        .from('churches')
        .update({
          name: editingChurch.name.trim(),
          slug: editingChurch.slug?.trim() || null,
          description: editingChurch.description?.trim() || null,
          address: editingChurch.address?.trim() || null,
          city: editingChurch.city?.trim() || null,
          state: editingChurch.state?.trim() || null,
          phone: editingChurch.phone?.trim() || null,
          email: editingChurch.email?.trim() || null,
          logo_url: editingChurch.logo_url || null,
        })
        .eq('id', editingChurch.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Igreja atualizada com sucesso.',
      });
      
      setShowEditChurch(false);
      setEditingChurch(null);
      fetchChurches();
    } catch (error: any) {
      console.error('Error updating church:', error);
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível atualizar a igreja.',
        variant: 'destructive',
      });
    } finally {
      setSavingChurch(false);
    }
  };

  const handleCreateChurch = async () => {
    if (!newChurchName.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome da igreja é obrigatório.',
        variant: 'destructive',
      });
      return;
    }

    if (!newChurchEmail.trim()) {
      toast({
        title: 'Erro',
        description: 'Email da igreja é obrigatório para enviar o código.',
        variant: 'destructive',
      });
      return;
    }

    const slug = newChurchSlug.trim() || slugify(newChurchName);

    setCreatingChurch(true);
    try {
      const { data, error } = await supabase.rpc('admin_create_church', {
        p_name: newChurchName.trim(),
        p_slug: slug,
        p_email: newChurchEmail.trim(),
        p_city: newChurchCity.trim() || null,
        p_state: newChurchState.trim() || null,
      });

      if (error) throw error;

      // Send email with the church code
      try {
        await supabase.functions.invoke('send-church-code-email', {
          body: {
            churchId: data,
          },
        });
        
        toast({
          title: 'Igreja criada!',
          description: 'O código foi enviado para o email cadastrado.',
        });
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        toast({
          title: 'Igreja criada!',
          description: 'Igreja criada, mas houve erro ao enviar email. Copie o código manualmente.',
        });
      }

      setShowCreateChurch(false);
      setNewChurchName('');
      setNewChurchSlug('');
      setNewChurchCity('');
      setNewChurchState('');
      setNewChurchEmail('');
      fetchChurches();
    } catch (error: any) {
      console.error('Error creating church:', error);
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível criar a igreja.',
        variant: 'destructive',
      });
    } finally {
      setCreatingChurch(false);
    }
  };

  const copyInviteLink = (code: string) => {
    const url = `${window.location.origin}/join?code=${code}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Link copiado!',
      description: 'Compartilhe com os líderes de departamento.',
    });
  };

  const copyChurchUrl = (slug: string) => {
    const url = `${window.location.origin}/igreja/${slug}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Link copiado!',
      description: 'Link da página pública da igreja.',
    });
  };

  const fetchAllProfiles = async () => {
    setLoadingProfiles(true);
    try {
      // Fetch profiles with department and church info using RPC that checks members table
      const { data, error } = await supabase.rpc('get_all_profiles_with_departments');
      
      if (error) throw error;
      
      // Transform the data to match the Profile interface
      const transformedData = (data || []).map((profile: any) => ({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        whatsapp: profile.whatsapp,
        created_at: profile.created_at,
        invited_by_department_id: null,
        invited_by_department_name: profile.department_name,
        church_name: profile.church_name,
      }));
      
      setAllProfiles(transformedData);
    } catch (error) {
      console.error('Error fetching profiles:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os voluntários.',
        variant: 'destructive',
      });
    } finally {
      setLoadingProfiles(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase.rpc('get_all_departments_admin');
      
      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os departamentos.',
        variant: 'destructive',
      });
    } finally {
      setLoadingDepts(false);
    }
  };

  const fetchMembers = async (deptId: string) => {
    if (members[deptId]) return;
    
    setLoadingMembers(prev => ({ ...prev, [deptId]: true }));
    
    try {
      const { data, error } = await supabase.rpc('get_department_members_admin', { dept_id: deptId });
      
      if (error) throw error;
      setMembers(prev => ({ ...prev, [deptId]: data || [] }));
    } catch (error) {
      console.error('Error fetching members:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os membros.',
        variant: 'destructive',
      });
    } finally {
      setLoadingMembers(prev => ({ ...prev, [deptId]: false }));
    }
  };

  const toggleDepartment = (deptId: string) => {
    if (expandedDept === deptId) {
      setExpandedDept(null);
    } else {
      setExpandedDept(deptId);
      fetchMembers(deptId);
    }
  };

  const handleDeleteDepartment = async (deptId: string) => {
    setDeleting(true);
    try {
      const { error } = await supabase.rpc('admin_delete_department', { dept_id: deptId });
      
      if (error) throw error;
      
      setDepartments(prev => prev.filter(d => d.id !== deptId));
      toast({
        title: 'Sucesso',
        description: 'Departamento excluído com sucesso.',
      });
    } catch (error) {
      console.error('Error deleting department:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o departamento.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteMember = async (memberId: string, deptId: string) => {
    setDeleting(true);
    try {
      const { error } = await supabase.rpc('admin_delete_member', { member_id: memberId });
      
      if (error) throw error;
      
      setMembers(prev => ({
        ...prev,
        [deptId]: prev[deptId]?.filter(m => m.id !== memberId) || []
      }));
      
      // Update member count
      setDepartments(prev => prev.map(d => 
        d.id === deptId ? { ...d, member_count: d.member_count - 1 } : d
      ));
      
      toast({
        title: 'Sucesso',
        description: 'Membro removido com sucesso.',
      });
    } catch (error) {
      console.error('Error deleting member:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o membro.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteChurch = async (churchId: string) => {
    setDeletingChurch(churchId);
    try {
      const { error } = await supabase.rpc('admin_delete_church', { church_id: churchId });
      
      if (error) throw error;
      
      setChurches(prev => prev.filter(c => c.id !== churchId));
      toast({
        title: 'Sucesso',
        description: 'Igreja excluída com sucesso.',
      });
      // Refresh departments as they may have been deleted
      fetchDepartments();
    } catch (error) {
      console.error('Error deleting church:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a igreja.',
        variant: 'destructive',
      });
    } finally {
      setDeletingChurch(null);
    }
  };

  const handleDeleteVolunteer = async (profileId: string) => {
    setDeletingVolunteer(profileId);
    try {
      const { error } = await supabase.rpc('admin_delete_volunteer', { profile_id: profileId });
      
      if (error) throw error;
      
      setAllProfiles(prev => prev.filter(p => p.id !== profileId));
      toast({
        title: 'Sucesso',
        description: 'Voluntário excluído com sucesso.',
      });
      // Refresh departments as member counts may have changed
      fetchDepartments();
    } catch (error) {
      console.error('Error deleting volunteer:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o voluntário.',
        variant: 'destructive',
      });
    } finally {
      setDeletingVolunteer(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/admin-login';
  };

  if (authLoading || adminLoading || loadingDepts) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Painel Administrativo</h1>
              <p className="text-sm text-muted-foreground">Gerenciamento do sistema</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Email Inbox Button */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  Caixa de Entrada
                </CardTitle>
                <CardDescription>
                  Acesse os emails de suporte (suport@leviescalas.com.br)
                </CardDescription>
              </div>
              <Button 
                onClick={() => window.open('https://webmail.kinghost.com.br/leviescalas.com.br', '_blank')}
                className="gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir Webmail
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Igrejas Cadastradas</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Church className="w-6 h-6 text-primary" />
                {churches.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Voluntários Cadastrados</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Users className="w-6 h-6 text-primary" />
                {allProfiles.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total de Departamentos</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Building2 className="w-6 h-6 text-primary" />
                {departments.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Membros em Departamentos</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Users className="w-6 h-6 text-primary" />
                {departments.reduce((acc, d) => acc + d.member_count, 0)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Analytics Chart */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Acessos ao Site
                </CardTitle>
                <CardDescription>
                  Visitantes e visualizações nos últimos 30 dias
                </CardDescription>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Visitantes</span>
                  <span className="font-bold">{totalVisitors}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground">Pageviews</span>
                  <span className="font-bold">{totalPageviews}</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingAnalytics ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : analyticsData.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">
                Nenhum dado de analytics disponível.
              </p>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorPageviews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => format(new Date(value), 'dd/MM', { locale: ptBR })}
                      className="text-xs fill-muted-foreground"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis 
                      className="text-xs fill-muted-foreground"
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip 
                      labelFormatter={(value) => format(new Date(value), "dd 'de' MMMM", { locale: ptBR })}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number, name: string) => [
                        value,
                        name === 'visitors' ? 'Visitantes' : 'Pageviews'
                      ]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="visitors" 
                      stroke="hsl(var(--primary))" 
                      fillOpacity={1} 
                      fill="url(#colorVisitors)" 
                      strokeWidth={2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="pageviews" 
                      stroke="#3b82f6" 
                      fillOpacity={1} 
                      fill="url(#colorPageviews)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Churches Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Church className="w-5 h-5" />
                  Igrejas
                </CardTitle>
                <CardDescription>
                  Gerencie as igrejas cadastradas no sistema
                </CardDescription>
              </div>
              <Dialog open={showCreateChurch} onOpenChange={setShowCreateChurch}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Igreja
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Nova Igreja</DialogTitle>
                    <DialogDescription>
                      Cadastre uma nova igreja no sistema
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="churchName">Nome da Igreja *</Label>
                      <Input
                        id="churchName"
                        value={newChurchName}
                        onChange={(e) => {
                          setNewChurchName(e.target.value);
                          if (!newChurchSlug) {
                            setNewChurchSlug(slugify(e.target.value));
                          }
                        }}
                        placeholder="Ex: Igreja Batista Central"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="churchSlug">URL Amigável (slug)</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">/igreja/</span>
                        <Input
                          id="churchSlug"
                          value={newChurchSlug}
                          onChange={(e) => setNewChurchSlug(slugify(e.target.value))}
                          placeholder="igreja-batista-central"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="churchEmail">Email da Igreja *</Label>
                      <Input
                        id="churchEmail"
                        type="email"
                        value={newChurchEmail}
                        onChange={(e) => setNewChurchEmail(e.target.value)}
                        placeholder="contato@igreja.com.br"
                      />
                      <p className="text-xs text-muted-foreground">
                        O código da igreja será enviado para este email
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="churchCity">Cidade</Label>
                        <Input
                          id="churchCity"
                          value={newChurchCity}
                          onChange={(e) => setNewChurchCity(e.target.value)}
                          placeholder="São Paulo"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="churchState">Estado</Label>
                        <Input
                          id="churchState"
                          value={newChurchState}
                          onChange={(e) => setNewChurchState(e.target.value)}
                          placeholder="SP"
                        />
                      </div>
                    </div>
                    <Button 
                      onClick={handleCreateChurch} 
                      className="w-full"
                      disabled={creatingChurch || !newChurchName.trim() || !newChurchEmail.trim()}
                    >
                      {creatingChurch ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Criando e enviando email...
                        </>
                      ) : (
                        'Criar Igreja e Enviar Código'
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {loadingChurches ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : churches.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma igreja cadastrada.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Cidade/Estado</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="w-[150px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {churches.map((church) => (
                    <TableRow key={church.id}>
                      <TableCell className="font-medium">{church.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {church.code}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {[church.city, church.state].filter(Boolean).join(', ') || '-'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(church.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditChurch(church)}
                            title="Editar igreja"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyInviteLink(church.code)}
                            title="Copiar link de convite"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          {church.slug && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyChurchUrl(church.slug!)}
                              title="Copiar link da página"
                            >
                              <LinkIcon className="w-4 h-4" />
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                disabled={deletingChurch === church.id}
                                title="Excluir igreja"
                              >
                                {deletingChurch === church.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir igreja?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação excluirá permanentemente a igreja "{church.name}" e todos os seus departamentos, membros, escalas e dados relacionados. Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteChurch(church.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Church Dialog */}
        <Dialog open={showEditChurch} onOpenChange={(open) => {
          setShowEditChurch(open);
          if (!open) setEditingChurch(null);
        }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Igreja</DialogTitle>
              <DialogDescription>
                Atualize as informações da igreja
              </DialogDescription>
            </DialogHeader>
            {editingChurch && (
              <div className="space-y-4 py-4">
                {/* Logo Upload */}
                <div className="space-y-2">
                  <Label>Logo da Igreja</Label>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {editingChurch.logo_url ? (
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                          <img 
                            src={editingChurch.logo_url} 
                            alt="Logo" 
                            className="w-full h-full object-cover"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 w-6 h-6"
                            onClick={() => setEditingChurch(prev => prev ? { ...prev, logo_url: null } : null)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <label className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                          {uploadingLogo ? (
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                          ) : (
                            <Upload className="w-6 h-6 text-muted-foreground" />
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleLogoUpload}
                            disabled={uploadingLogo}
                          />
                        </label>
                      )}
                    </div>
                    {!editingChurch.logo_url && (
                      <p className="text-sm text-muted-foreground">
                        Clique para fazer upload do logo
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editChurchName">Nome da Igreja *</Label>
                  <Input
                    id="editChurchName"
                    value={editingChurch.name}
                    onChange={(e) => setEditingChurch(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="Ex: Igreja Batista Central"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editChurchDescription">Descrição</Label>
                  <Input
                    id="editChurchDescription"
                    value={editingChurch.description || ''}
                    onChange={(e) => setEditingChurch(prev => prev ? { ...prev, description: e.target.value } : null)}
                    placeholder="Uma breve descrição da igreja"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editChurchSlug">URL (slug)</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">/igreja/</span>
                    <Input
                      id="editChurchSlug"
                      value={editingChurch.slug || ''}
                      onChange={(e) => setEditingChurch(prev => prev ? { ...prev, slug: slugify(e.target.value) } : null)}
                      placeholder="igreja-batista-central"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editChurchAddress">Endereço</Label>
                  <Input
                    id="editChurchAddress"
                    value={editingChurch.address || ''}
                    onChange={(e) => setEditingChurch(prev => prev ? { ...prev, address: e.target.value } : null)}
                    placeholder="Rua das Flores, 123"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editChurchCity">Cidade</Label>
                    <Input
                      id="editChurchCity"
                      value={editingChurch.city || ''}
                      onChange={(e) => setEditingChurch(prev => prev ? { ...prev, city: e.target.value } : null)}
                      placeholder="São Paulo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editChurchState">Estado</Label>
                    <Input
                      id="editChurchState"
                      value={editingChurch.state || ''}
                      onChange={(e) => setEditingChurch(prev => prev ? { ...prev, state: e.target.value } : null)}
                      placeholder="SP"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editChurchPhone">Telefone</Label>
                    <Input
                      id="editChurchPhone"
                      value={editingChurch.phone || ''}
                      onChange={(e) => setEditingChurch(prev => prev ? { ...prev, phone: e.target.value } : null)}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editChurchEmail">Email</Label>
                    <Input
                      id="editChurchEmail"
                      type="email"
                      value={editingChurch.email || ''}
                      onChange={(e) => setEditingChurch(prev => prev ? { ...prev, email: e.target.value } : null)}
                      placeholder="contato@igreja.com.br"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowEditChurch(false);
                      setEditingChurch(null);
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleUpdateChurch} 
                    className="flex-1"
                    disabled={savingChurch || !editingChurch.name.trim()}
                  >
                    {savingChurch ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Salvar Alterações'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* All Volunteers List */}
        <Collapsible>
          <Card className="mb-6">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Todos os Voluntários
                  <Badge variant="secondary" className="ml-2">{allProfiles.length}</Badge>
                  <ChevronRight className="w-4 h-4 ml-auto transition-transform duration-200 group-data-[state=open]:rotate-90" />
                </CardTitle>
                <CardDescription>
                  Clique para expandir a lista de voluntários
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                {loadingProfiles ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : allProfiles.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum voluntário cadastrado.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>WhatsApp</TableHead>
                        <TableHead>Departamento</TableHead>
                        <TableHead>Igreja</TableHead>
                        <TableHead>Cadastrado em</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allProfiles.map((profile) => (
                        <TableRow key={profile.id}>
                          <TableCell className="font-medium">{profile.name || 'Sem nome'}</TableCell>
                          <TableCell>{profile.email}</TableCell>
                          <TableCell>{profile.whatsapp || '-'}</TableCell>
                          <TableCell>
                            {profile.invited_by_department_name ? (
                              <Badge variant="outline" className="text-xs">
                                {profile.invited_by_department_name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {profile.church_name ? (
                              <Badge variant="secondary" className="text-xs">
                                {profile.church_name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {format(new Date(profile.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  disabled={deletingVolunteer === profile.id}
                                >
                                  {deletingVolunteer === profile.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir voluntário?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação excluirá permanentemente o voluntário "{profile.name || profile.email}" e todos os seus dados (participações em departamentos, escalas, disponibilidade, etc). Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteVolunteer(profile.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Departments List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Departamentos
            </CardTitle>
            <CardDescription>
              Gerencie todos os departamentos do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {departments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum departamento encontrado.
              </p>
            ) : (
              <div className="space-y-4">
                {departments.map((dept) => (
                  <div key={dept.id} className="border border-border rounded-lg overflow-hidden">
                    {/* Department Row */}
                    <div 
                      className="flex items-center justify-between p-4 bg-card hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleDepartment(dept.id)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{dept.name}</h3>
                          <Badge variant="secondary">
                            {dept.member_count} membro{dept.member_count !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Líder: {dept.leader_name || 'N/A'} • Criado em {format(new Date(dept.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                              disabled={deleting}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir departamento?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação excluirá permanentemente o departamento "{dept.name}" e todos os seus dados (escalas, membros, notificações). Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteDepartment(dept.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        {expandedDept === dept.id ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Members Table */}
                    {expandedDept === dept.id && (
                      <div className="border-t border-border bg-muted/30 p-4">
                        {loadingMembers[dept.id] ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                          </div>
                        ) : members[dept.id]?.length === 0 ? (
                          <p className="text-center text-muted-foreground py-4">
                            Nenhum membro neste departamento.
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Função</TableHead>
                                <TableHead>Entrou em</TableHead>
                                <TableHead className="w-[80px]"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {members[dept.id]?.map((member) => (
                                <TableRow key={member.id}>
                                  <TableCell className="font-medium">{member.name}</TableCell>
                                  <TableCell>{member.email}</TableCell>
                                  <TableCell>
                                    <Badge variant={member.role === 'leader' ? 'default' : 'secondary'}>
                                      {member.role === 'leader' ? 'Líder' : 'Membro'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {format(new Date(member.joined_at), "dd/MM/yyyy", { locale: ptBR })}
                                  </TableCell>
                                  <TableCell>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button 
                                          variant="ghost" 
                                          size="sm"
                                          disabled={deleting}
                                        >
                                          <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Remover membro?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Deseja remover "{member.name}" do departamento "{dept.name}"?
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDeleteMember(member.id, dept.id)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            Remover
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
