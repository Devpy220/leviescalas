import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Trash2, Users, Building2, Mail, ChevronDown, ChevronUp, Shield, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
}

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
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  useEffect(() => {
    if (authLoading || adminLoading) return;
    
    if (!user) {
      navigate('/auth');
      return;
    }
    
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }

    fetchDepartments();
    fetchAllProfiles();
  }, [user, isAdmin, authLoading, adminLoading]);

  const fetchAllProfiles = async () => {
    setLoadingProfiles(true);
    try {
      const { data, error } = await supabase.rpc('get_all_profiles_admin');
      if (error) throw error;
      setAllProfiles(data || []);
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

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
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
        {/* Support Contact Card */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Contato de Suporte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <a 
              href="mailto:suporte@levi.app"
              className="text-primary hover:underline font-medium"
            >
              suporte@levi.app
            </a>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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

        {/* All Volunteers List */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Todos os Voluntários
            </CardTitle>
            <CardDescription>
              Lista de todos os voluntários cadastrados na plataforma
            </CardDescription>
          </CardHeader>
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
                    <TableHead>Cadastrado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allProfiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">{profile.name || 'Sem nome'}</TableCell>
                      <TableCell>{profile.email}</TableCell>
                      <TableCell>{profile.whatsapp || '-'}</TableCell>
                      <TableCell>
                        {format(new Date(profile.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

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
