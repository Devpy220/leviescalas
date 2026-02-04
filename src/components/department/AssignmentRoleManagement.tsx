import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Predefined icons for assignment roles
const ROLE_ICONS = [
  { value: '🚗', name: 'Carro' },
  { value: '⛪', name: 'Igreja' },
  { value: '👤', name: 'Pessoa' },
  { value: '🎵', name: 'Música' },
  { value: '🎤', name: 'Microfone' },
  { value: '📷', name: 'Câmera' },
  { value: '💻', name: 'Computador' },
  { value: '🔊', name: 'Som' },
  { value: '🎹', name: 'Teclado' },
  { value: '🎸', name: 'Guitarra' },
  { value: '🥁', name: 'Bateria' },
  { value: '📖', name: 'Livro' },
];

// Predefined colors for assignment roles
const ROLE_COLORS = [
  { value: 'text-amber-600 dark:text-amber-400', name: 'Âmbar', preview: '#D97706' },
  { value: 'text-green-600 dark:text-green-400', name: 'Verde', preview: '#16A34A' },
  { value: 'text-blue-600 dark:text-blue-400', name: 'Azul', preview: '#2563EB' },
  { value: 'text-purple-600 dark:text-purple-400', name: 'Roxo', preview: '#9333EA' },
  { value: 'text-red-600 dark:text-red-400', name: 'Vermelho', preview: '#DC2626' },
  { value: 'text-pink-600 dark:text-pink-400', name: 'Rosa', preview: '#DB2777' },
  { value: 'text-cyan-600 dark:text-cyan-400', name: 'Ciano', preview: '#0891B2' },
  { value: 'text-orange-600 dark:text-orange-400', name: 'Laranja', preview: '#EA580C' },
];

interface AssignmentRole {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  created_at: string;
}

interface AssignmentRoleManagementProps {
  departmentId: string;
  isLeader: boolean;
}

export default function AssignmentRoleManagement({ departmentId, isLeader }: AssignmentRoleManagementProps) {
  const [roles, setRoles] = useState<AssignmentRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<AssignmentRole | null>(null);
  const [deletingRole, setDeletingRole] = useState<AssignmentRole | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(ROLE_ICONS[0].value);
  const [selectedColor, setSelectedColor] = useState(ROLE_COLORS[0].value);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchRoles();
  }, [departmentId]);

  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('assignment_roles')
        .select('*')
        .eq('department_id', departmentId)
        .order('name');

      if (error) throw error;
      setRoles(data || []);
    } catch (error) {
      console.error('Error fetching assignment roles:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar funções',
        description: 'Não foi possível carregar as funções de escala.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (role?: AssignmentRole) => {
    if (role) {
      setEditingRole(role);
      setName(role.name);
      setDescription(role.description || '');
      setSelectedIcon(role.icon);
      setSelectedColor(role.color);
    } else {
      setEditingRole(null);
      setName('');
      setDescription('');
      setSelectedIcon(ROLE_ICONS[0].value);
      setSelectedColor(ROLE_COLORS[0].value);
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nome obrigatório',
        description: 'Informe o nome da função.',
      });
      return;
    }

    setSaving(true);
    try {
      if (editingRole) {
        const { error } = await supabase
          .from('assignment_roles')
          .update({
            name: name.trim(),
            description: description.trim() || null,
            icon: selectedIcon,
            color: selectedColor,
          })
          .eq('id', editingRole.id);

        if (error) throw error;

        toast({
          title: 'Função atualizada',
          description: 'A função foi atualizada com sucesso.',
        });
      } else {
        const { error } = await supabase
          .from('assignment_roles')
          .insert({
            department_id: departmentId,
            name: name.trim(),
            description: description.trim() || null,
            icon: selectedIcon,
            color: selectedColor,
          });

        if (error) throw error;

        toast({
          title: 'Função criada',
          description: 'A função foi criada com sucesso.',
        });
      }

      setShowDialog(false);
      fetchRoles();
    } catch (error: any) {
      console.error('Error saving assignment role:', error);
      const isDuplicate = error?.code === '23505';
      toast({
        variant: 'destructive',
        title: isDuplicate ? 'Nome já existe' : 'Erro ao salvar',
        description: isDuplicate 
          ? 'Já existe uma função com esse nome neste departamento.'
          : 'Não foi possível salvar a função.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRole) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('assignment_roles')
        .delete()
        .eq('id', deletingRole.id);

      if (error) throw error;

      toast({
        title: 'Função removida',
        description: 'A função foi removida com sucesso.',
      });

      setShowDeleteDialog(false);
      setDeletingRole(null);
      fetchRoles();
    } catch (error) {
      console.error('Error deleting assignment role:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao remover',
        description: 'Não foi possível remover a função.',
      });
    } finally {
      setDeleting(false);
    }
  };

  if (!isLeader) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <UserCog className="w-5 h-5" />
          <h3 className="font-semibold">Funções de Escala</h3>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma função cadastrada.</p>
        ) : (
          <div className="grid gap-2">
            {roles.map((role) => (
              <div
                key={role.id}
                className="p-3 rounded-lg bg-muted/50 border border-border flex items-start gap-3"
              >
                <span className={`text-lg ${role.color}`}>{role.icon}</span>
                <div>
                  <p className="font-medium text-sm">{role.name}</p>
                  {role.description && (
                    <p className="text-xs text-muted-foreground mt-1">{role.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-foreground">
          <UserCog className="w-5 h-5" />
          <h3 className="font-semibold">Funções de Escala</h3>
        </div>
        <Button size="sm" onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-1" />
          Nova Função
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : roles.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border rounded-lg">
          <UserCog className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma função cadastrada</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crie funções como "Plantão" ou "Culto"
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {roles.map((role) => (
            <div
              key={role.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
            >
              <div className="flex items-start gap-3">
                <span className={`text-lg ${role.color}`}>{role.icon}</span>
                <div>
                  <p className="font-medium text-sm">{role.name}</p>
                  {role.description && (
                    <p className="text-xs text-muted-foreground mt-1">{role.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleOpenDialog(role)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => {
                    setDeletingRole(role);
                    setShowDeleteDialog(true);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? 'Editar Função' : 'Nova Função'}
            </DialogTitle>
            <DialogDescription>
              {editingRole
                ? 'Atualize as informações da função de escala.'
                : 'Crie uma nova função para as escalas (ex: Plantão, Culto).'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Nome da Função</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Plantão, Culto, Recepção..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Descrição (opcional)</Label>
              <Textarea
                id="role-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva esta função..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Ícone</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {ROLE_ICONS.map((icon) => (
                  <button
                    key={icon.value}
                    type="button"
                    onClick={() => setSelectedIcon(icon.value)}
                    className={`w-10 h-10 rounded-lg border-2 transition-all flex items-center justify-center text-xl ${
                      selectedIcon === icon.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                    title={icon.name}
                  >
                    {icon.value}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {ROLE_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setSelectedColor(color.value)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      selectedColor === color.value
                        ? 'border-foreground scale-110'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color.preview }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editingRole ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Função</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a função{' '}
              <strong>{deletingRole?.name}</strong>? As escalas associadas a
              esta função ficarão sem função definida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
