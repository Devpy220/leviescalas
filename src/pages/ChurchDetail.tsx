import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Church, 
  Copy, 
  Users, 
  Calendar,
  Loader2,
  MapPin,
  Crown,
  Edit2,
  Trash2,
  Camera,
  ImageIcon
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
} from '@/components/ui/dialog';
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
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { slugify } from '@/lib/slugify';
import ImageCropDialog from '@/components/department/ImageCropDialog';

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
  logo_url: string | null;
  created_at: string;
}

interface DepartmentData {
  id: string;
  name: string;
  description: string | null;
  leader_id: string;
  leader_name: string | null;
  member_count: number;
  created_at: string;
}

export default function ChurchDetail() {
  const { id } = useParams<{ id: string }>();
  const [church, setChurch] = useState<ChurchData | null>(null);
  const [departments, setDepartments] = useState<DepartmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  // Logo upload state
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<ChurchForm>({
    resolver: zodResolver(churchSchema),
  });

  useEffect(() => {
    // Wait for auth to finish loading (ProtectedRoute ensures user exists)
    if (authLoading) return;
    
    if (user && id) {
      fetchChurch();
    }
  }, [user, authLoading, id]);

  const fetchChurch = async () => {
    if (!user || !id) return;
    
    try {
      // Fetch church
      const { data: churchData, error: churchError } = await supabase
        .from('churches')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (churchError) throw churchError;
      
      if (!churchData) {
        toast({
          variant: 'destructive',
          title: 'Igreja não encontrada',
        });
        navigate('/churches');
        return;
      }

      // Check if user is the leader
      if (churchData.leader_id !== user.id) {
        toast({
          variant: 'destructive',
          title: 'Acesso negado',
          description: 'Você não é o líder desta igreja.',
        });
        navigate('/churches');
        return;
      }

      setChurch(churchData);
      form.reset({
        name: churchData.name,
        description: churchData.description || '',
        address: churchData.address || '',
        city: churchData.city || '',
        state: churchData.state || '',
      });

      // Fetch departments using the function
      const { data: deptData, error: deptError } = await supabase
        .rpc('get_church_departments', { p_church_id: id });

      if (deptError) throw deptError;
      setDepartments(deptData || []);
    } catch (error) {
      console.error('Error fetching church:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar igreja',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (data: ChurchForm) => {
    if (!church) return;
    
    setIsEditing(true);
    
    try {
      const { error } = await supabase
        .from('churches')
        .update({
          name: data.name,
          description: data.description || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
        })
        .eq('id', church.id);

      if (error) throw error;

      setChurch(prev => prev ? { ...prev, ...data } : null);
      setEditDialogOpen(false);
      
      toast({
        title: 'Igreja atualizada!',
      });
    } catch (error) {
      console.error('Error updating church:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
      });
    } finally {
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!church) return;
    
    setIsDeleting(true);
    
    try {
      // Check if there are departments
      if (departments.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Não é possível excluir',
          description: 'Remova todos os departamentos antes de excluir a igreja.',
        });
        return;
      }

      const { error } = await supabase
        .from('churches')
        .delete()
        .eq('id', church.id);

      if (error) throw error;

      toast({
        title: 'Igreja excluída',
      });
      navigate('/churches');
    } catch (error) {
      console.error('Error deleting church:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const copyCode = () => {
    if (!church) return;
    navigator.clipboard.writeText(church.code);
    toast({
      title: 'Código copiado!',
      description: 'Compartilhe com os líderes de departamento.',
    });
  };

  // Logo upload handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Arquivo inválido',
        description: 'Por favor, selecione uma imagem.',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'A imagem deve ter no máximo 5MB.',
      });
      return;
    }

    setSelectedFile(file);
    setShowCropDialog(true);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!church || !user) return;
    
    setShowCropDialog(false);
    setUploadingLogo(true);

    try {
      // Delete old logo if exists
      if (church.logo_url) {
        const oldPath = church.logo_url.split('/').slice(-2).join('/');
        await supabase.storage.from('church-logos').remove([oldPath]);
      }

      // Upload new logo
      const fileName = `${church.id}/logo-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('church-logos')
        .upload(fileName, croppedBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('church-logos')
        .getPublicUrl(fileName);

      // Update church record
      const { error: updateError } = await supabase
        .from('churches')
        .update({ logo_url: publicUrl })
        .eq('id', church.id);

      if (updateError) throw updateError;

      setChurch(prev => prev ? { ...prev, logo_url: publicUrl } : null);

      toast({
        title: 'Logo atualizado!',
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar logo',
      });
    } finally {
      setUploadingLogo(false);
      setSelectedFile(null);
    }
  };

  const handleRemoveLogo = async () => {
    if (!church) return;
    
    setUploadingLogo(true);

    try {
      // Delete from storage
      if (church.logo_url) {
        const oldPath = church.logo_url.split('/').slice(-2).join('/');
        await supabase.storage.from('church-logos').remove([oldPath]);
      }

      // Update church record
      const { error } = await supabase
        .from('churches')
        .update({ logo_url: null })
        .eq('id', church.id);

      if (error) throw error;

      setChurch(prev => prev ? { ...prev, logo_url: null } : null);

      toast({
        title: 'Logo removido!',
      });
    } catch (error) {
      console.error('Error removing logo:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao remover logo',
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!church) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link 
            to="/churches" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Voltar</span>
          </Link>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setEditDialogOpen(true)}
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Church Header */}
        <div className="mb-8">
          <div className="flex items-start gap-4 mb-4">
            {/* Logo with edit capability */}
            <div className="relative group">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              {church.logo_url ? (
                <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-glow border-2 border-primary/20">
                  <img 
                    src={church.logo_url} 
                    alt={church.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
                  <Church className="w-10 h-10 text-primary-foreground" />
                </div>
              )}
              
              {/* Overlay with edit button */}
              <div className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </Button>
                {church.logo_url && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-white hover:bg-white/20"
                    onClick={handleRemoveLogo}
                    disabled={uploadingLogo}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="font-display text-2xl font-bold text-foreground">
                  {church.name}
                </h1>
                <Crown className="w-5 h-5 text-primary" />
              </div>
              {(church.city || church.state) && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>{[church.city, church.state].filter(Boolean).join(', ')}</span>
                </div>
              )}
              {church.description && (
                <p className="text-muted-foreground mt-2">{church.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Passe o mouse sobre o logo para alterar
              </p>
            </div>
          </div>

          {/* Church Code Card */}
          <div className="glass rounded-xl p-4 border border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Código da Igreja (compartilhe com líderes de departamento)
                </p>
                <code className="text-2xl font-mono font-bold text-primary">{church.code}</code>
              </div>
              <Button onClick={copyCode} variant="outline">
                <Copy className="w-4 h-4 mr-2" />
                Copiar
              </Button>
            </div>
          </div>
        </div>

        {/* Departments Section */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-foreground">
            Departamentos ({departments.length})
          </h2>
          <Link to={`/departments/new?church=${church.id}`}>
            <Button className="gradient-primary text-primary-foreground shadow-glow-sm">
              <Plus className="w-4 h-4 mr-2" />
              Novo Departamento
            </Button>
          </Link>
        </div>

        {departments.length === 0 ? (
          <div className="text-center py-12 glass rounded-xl border border-border/50">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-display text-lg font-semibold text-foreground mb-2">
              Nenhum departamento ainda
            </h3>
            <p className="text-muted-foreground mb-4">
              Crie o primeiro departamento desta igreja ou compartilhe o código com outros líderes.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => (
              <Link key={dept.id} to={`/departamento/${slugify(dept.name)}`}>
                <div className="glass rounded-xl p-4 border border-border/50 hover:border-primary/50 transition-all hover-lift">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{dept.name}</h3>
                      {dept.leader_name && (
                        <p className="text-sm text-muted-foreground truncate">
                          Líder: {dept.leader_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>{dept.member_count} membros</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Igreja</DialogTitle>
            <DialogDescription>
              Atualize os dados da igreja.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={form.handleSubmit(handleEdit)} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome da Igreja *</Label>
              <Input
                id="edit-name"
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Descrição</Label>
              <Textarea
                id="edit-description"
                {...form.register('description')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-city">Cidade</Label>
                <Input
                  id="edit-city"
                  {...form.register('city')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-state">Estado</Label>
                <Input
                  id="edit-state"
                  {...form.register('state')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-address">Endereço</Label>
              <Input
                id="edit-address"
                {...form.register('address')}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="flex-1 gradient-primary text-primary-foreground"
                disabled={isEditing}
              >
                {isEditing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Salvar'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir igreja?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A igreja será removida permanentemente.
              {departments.length > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  Atenção: Você precisa remover todos os departamentos antes de excluir a igreja.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting || departments.length > 0}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Crop Dialog */}
      <ImageCropDialog
        open={showCropDialog}
        onClose={() => {
          setShowCropDialog(false);
          setSelectedFile(null);
        }}
        imageFile={selectedFile}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
