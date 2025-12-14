import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
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

interface Sector {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface SectorManagementProps {
  departmentId: string;
  isLeader: boolean;
}

export default function SectorManagement({ departmentId, isLeader }: SectorManagementProps) {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [deletingSector, setDeletingSector] = useState<Sector | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSectors();
  }, [departmentId]);

  const fetchSectors = async () => {
    try {
      const { data, error } = await supabase
        .from('sectors')
        .select('*')
        .eq('department_id', departmentId)
        .order('name');

      if (error) throw error;
      setSectors(data || []);
    } catch (error) {
      console.error('Error fetching sectors:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar setores',
        description: 'Não foi possível carregar os setores.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (sector?: Sector) => {
    if (sector) {
      setEditingSector(sector);
      setName(sector.name);
      setDescription(sector.description || '');
    } else {
      setEditingSector(null);
      setName('');
      setDescription('');
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nome obrigatório',
        description: 'Informe o nome do setor.',
      });
      return;
    }

    setSaving(true);
    try {
      if (editingSector) {
        const { error } = await supabase
          .from('sectors')
          .update({
            name: name.trim(),
            description: description.trim() || null,
          })
          .eq('id', editingSector.id);

        if (error) throw error;

        toast({
          title: 'Setor atualizado',
          description: 'O setor foi atualizado com sucesso.',
        });
      } else {
        const { error } = await supabase
          .from('sectors')
          .insert({
            department_id: departmentId,
            name: name.trim(),
            description: description.trim() || null,
          });

        if (error) throw error;

        toast({
          title: 'Setor criado',
          description: 'O setor foi criado com sucesso.',
        });
      }

      setShowDialog(false);
      fetchSectors();
    } catch (error) {
      console.error('Error saving sector:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o setor.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSector) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('sectors')
        .delete()
        .eq('id', deletingSector.id);

      if (error) throw error;

      toast({
        title: 'Setor removido',
        description: 'O setor foi removido com sucesso.',
      });

      setShowDeleteDialog(false);
      setDeletingSector(null);
      fetchSectors();
    } catch (error) {
      console.error('Error deleting sector:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao remover',
        description: 'Não foi possível remover o setor.',
      });
    } finally {
      setDeleting(false);
    }
  };

  if (!isLeader) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Layers className="w-5 h-5" />
          <h3 className="font-semibold">Setores</h3>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : sectors.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum setor cadastrado.</p>
        ) : (
          <div className="grid gap-2">
            {sectors.map((sector) => (
              <div
                key={sector.id}
                className="p-3 rounded-lg bg-muted/50 border border-border"
              >
                <p className="font-medium text-sm">{sector.name}</p>
                {sector.description && (
                  <p className="text-xs text-muted-foreground mt-1">{sector.description}</p>
                )}
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
          <Layers className="w-5 h-5" />
          <h3 className="font-semibold">Setores</h3>
        </div>
        <Button size="sm" onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-1" />
          Novo Setor
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : sectors.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border rounded-lg">
          <Layers className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum setor cadastrado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crie setores para organizar as escalas
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {sectors.map((sector) => (
            <div
              key={sector.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
            >
              <div>
                <p className="font-medium text-sm">{sector.name}</p>
                {sector.description && (
                  <p className="text-xs text-muted-foreground mt-1">{sector.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleOpenDialog(sector)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => {
                    setDeletingSector(sector);
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
              {editingSector ? 'Editar Setor' : 'Novo Setor'}
            </DialogTitle>
            <DialogDescription>
              {editingSector
                ? 'Atualize as informações do setor.'
                : 'Crie um novo setor para organizar as escalas.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="sector-name">Nome do Setor</Label>
              <Input
                id="sector-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Recepção, Louvor, Multimídia..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sector-description">Descrição (opcional)</Label>
              <Textarea
                id="sector-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva as atividades deste setor..."
                rows={3}
              />
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
              {saving ? 'Salvando...' : editingSector ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Setor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o setor{' '}
              <strong>{deletingSector?.name}</strong>? As escalas associadas a
              este setor ficarão sem setor definido.
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
