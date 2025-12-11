import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CreditCard, Trash2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
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

interface DepartmentSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: {
    id: string;
    name: string;
    description: string | null;
    subscription_status: string;
  };
  onDepartmentUpdated: () => void;
}

export default function DepartmentSettingsDialog({
  open,
  onOpenChange,
  department,
  onDepartmentUpdated,
}: DepartmentSettingsDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [name, setName] = useState(department.name);
  const [description, setDescription] = useState(department.description || '');
  const [saving, setSaving] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nome obrigatório',
        description: 'O departamento precisa ter um nome.',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('departments')
        .update({ 
          name: name.trim(),
          description: description.trim() || null 
        })
        .eq('id', department.id);

      if (error) throw error;

      toast({
        title: 'Configurações salvas',
        description: 'As alterações foram aplicadas.',
      });
      onDepartmentUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating department:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as alterações.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleManageSubscription = async () => {
    setLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível abrir o portal de assinatura.',
      });
    } finally {
      setLoadingPortal(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== department.name) {
      toast({
        variant: 'destructive',
        title: 'Nome incorreto',
        description: 'Digite o nome do departamento corretamente para confirmar.',
      });
      return;
    }

    setDeleting(true);
    try {
      // Delete all schedules first
      await supabase
        .from('schedules')
        .delete()
        .eq('department_id', department.id);

      // Delete all notifications
      await supabase
        .from('notifications')
        .delete()
        .eq('department_id', department.id);

      // Delete all members
      await supabase
        .from('members')
        .delete()
        .eq('department_id', department.id);

      // Delete the department
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', department.id);

      if (error) throw error;

      toast({
        title: 'Departamento excluído',
        description: 'O departamento foi removido permanentemente.',
      });
      navigate('/dashboard');
    } catch (error) {
      console.error('Error deleting department:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o departamento.',
      });
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurações do Departamento</DialogTitle>
            <DialogDescription>
              Gerencie as informações e configurações do departamento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Departamento</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Estacionamento"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Uma breve descrição do departamento..."
                  rows={3}
                />
              </div>

              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="w-full"
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar Alterações
              </Button>
            </div>

            <Separator />

            {/* Subscription */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Assinatura</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    Status: {department.subscription_status === 'trial' ? 'Período de teste' : department.subscription_status}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManageSubscription}
                  disabled={loadingPortal}
                >
                  {loadingPortal ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Gerenciar
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Danger Zone */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-destructive">Zona de Perigo</p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir Departamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Excluir Departamento
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Esta ação é <strong>irreversível</strong>. Todos os dados serão perdidos:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Todas as escalas</li>
                <li>Todos os membros</li>
                <li>Todas as notificações</li>
              </ul>
              <p className="pt-2">
                Digite <strong>{department.name}</strong> para confirmar:
              </p>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={department.name}
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting || deleteConfirmText !== department.name}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}